import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { CloudBuildClient } from "@google-cloud/cloudbuild";
import { Storage } from "@google-cloud/storage";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // API Routes
  app.get("/api/health", (req, res) => {
    const isCloudBuildReady = !!process.env.GCP_PROJECT_ID && !!process.env.GCP_CREDENTIALS_JSON;
    res.json({ status: "ok", isCloudBuildReady });
  });

  app.get("/api/builder-image-status", async (req, res) => {
    try {
      let authOptions: any = {};
      if (process.env.GCP_CREDENTIALS_JSON) {
         try {
           authOptions.credentials = JSON.parse(process.env.GCP_CREDENTIALS_JSON);
         } catch (e) { }
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
         authOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }
      
      const cb = new CloudBuildClient(authOptions);
      let gcpProjectId = process.env.GCP_PROJECT_ID;
      if (!gcpProjectId) {
         try {
           gcpProjectId = await cb.getProjectId();
         } catch (err) { }
      }

      if (!gcpProjectId) {
         return res.json({ exists: false, error: "Project ID not configured" });
      }

      const [builds] = await cb.listBuilds({
         projectId: gcpProjectId,
         filter: `status="SUCCESS" AND results.images.name="gcr.io/${gcpProjectId}/android-builder:v24"`
      });

      if (builds.length > 0) {
         res.json({ exists: true });
      } else {
         res.json({ exists: false });
      }
    } catch (error: any) {
      console.error("Error checking builder image status:", error);
      res.json({ exists: false, error: error.message });
    }
  });

  app.post("/api/setup-builder", async (req, res) => {
    try {
      let authOptions: any = {};
      if (process.env.GCP_CREDENTIALS_JSON) {
         try {
           authOptions.credentials = JSON.parse(process.env.GCP_CREDENTIALS_JSON);
         } catch (e) {
           console.error("Failed to parse GCP_CREDENTIALS_JSON", e);
         }
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
         authOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }
      
      const cb = new CloudBuildClient(authOptions);
      
      let gcpProjectId = process.env.GCP_PROJECT_ID;
      if (!gcpProjectId) {
        try {
          gcpProjectId = await cb.getProjectId();
        } catch (err) {
          console.warn("Could not determine GCP Project ID automatically.");
        }
      }

      if (!gcpProjectId) {
         return res.status(500).json({ 
           error: "Google Cloud Project ID is not configured. Please set GCP_PROJECT_ID in your environment." 
         });
      }

      const storageBucketName = process.env.GCP_STORAGE_BUCKET || `${gcpProjectId}-apk-builds`;
      const storage = new Storage(authOptions);
      try {
        const [bucketExists] = await storage.bucket(storageBucketName).exists();
        if (!bucketExists) {
          await storage.bucket(storageBucketName).create();
        }
      } catch (err) {
        // Ignore bucket creation errors
      }

      const dockerfileContent = `
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV ANDROID_HOME=/opt/android-sdk
ENV GRADLE_USER_HOME=/opt/gradle-cache
ENV NPM_CONFIG_CACHE=/opt/npm-cache
ENV PATH=/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN apt-get update && apt-get install -y \\
    openjdk-21-jdk-headless \\
    wget \\
    unzip \\
    curl \\
    git \\
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \\
    && apt-get install -y nodejs

RUN mkdir -p /opt/android-sdk/cmdline-tools \\
    && wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip \\
    && unzip -q cmdline-tools.zip -d /opt/android-sdk/cmdline-tools \\
    && mv /opt/android-sdk/cmdline-tools/cmdline-tools /opt/android-sdk/cmdline-tools/latest \\
    && rm cmdline-tools.zip

RUN yes | sdkmanager --licenses \\
    && sdkmanager "platform-tools" "platforms;android-34" "platforms;android-35" "build-tools;34.0.0"

# Pre-warm npm and gradle caches
RUN mkdir /dummy_app && cd /dummy_app \\
    && npm init -y \\
    && npm install @capacitor/cli @capacitor/core @capacitor/android @capacitor/camera @capacitor/geolocation @capacitor/voice-recorder @capacitor/filesystem @capacitor/local-notifications @capacitor/assets \\
    && npx cap init dummy com.dummy.app --web-dir www \\
    && mkdir www && echo "<html></html>" > www/index.html \\
    && npx cap add android \\
    && sed -i -e "s/minSdkVersion = 23/minSdkVersion = 24/g" android/variables.gradle
         
         # Add Firebase Google Services classpath and plugin
         sed -i -e "s/dependencies {/dependencies {\\n\tclasspath 'com.google.gms:google-services:4.4.1'/g" android/build.gradle
         echo "apply plugin: 'com.google.gms.google-services'" >> android/app/build.gradle
 \\
    && cd android \\
    && ./gradlew assembleDebug --no-daemon \\
    || true
`;

      const build = {
        steps: [
          {
            name: 'ubuntu',
            entrypoint: 'bash',
            args: [
              '-c',
              `cat << 'EOF' > Dockerfile\n${dockerfileContent}\nEOF`
            ]
          },
          {
            name: 'gcr.io/cloud-builders/docker',
            args: ['build', '-t', `gcr.io/${gcpProjectId}/android-builder:v24`, '-f', 'Dockerfile', '.']
          },
          {
            name: 'gcr.io/cloud-builders/docker',
            args: ['push', `gcr.io/${gcpProjectId}/android-builder:v24`]
          }
        ],
        images: [`gcr.io/${gcpProjectId}/android-builder:v24`],
        logsBucket: `gs://${storageBucketName}/logs`
      };

      const [operation] = await cb.createBuild({
        projectId: gcpProjectId,
        build
      });

      res.json({ 
        success: true, 
        operationName: operation.name,
        buildId: (operation.metadata as any)?.build?.id
      });
    } catch (error: any) {
      console.error("Setup builder error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/verify-repo", async (req, res) => {
    try {
      const { repoUrl } = req.body;
      if (!repoUrl || !repoUrl.startsWith("https://github.com/")) {
        return res.json({ valid: false });
      }
      const response = await fetch(repoUrl);
      if (response.status === 200) {
        res.json({ valid: true });
      } else {
        res.json({ valid: false });
      }
    } catch (e) {
      res.json({ valid: false });
    }
  });

  app.post("/api/build", async (req, res) => {
    try {
      const { 
        repoUrl, 
        appName, 
        packageName,
        versionName,
        versionCode,
        orientation,
        fullscreen,
        allowCleartext,
        projectId,
        permissions, 
        doubleTapToExit, 
        askNotificationsOnLaunch,
        googleServicesJsonBase64,
        appIconBase64,
        splashBackgroundColor,
        splashIconSize,
        splashAnimation
      } = req.body;
      
      let rawBase64Icon = '';
      if (appIconBase64) {
         rawBase64Icon = appIconBase64.replace(/^data:image\/\w+;base64,/, "");
      }

      let rawBase64GoogleServices = '';
      if (googleServicesJsonBase64) {
         rawBase64GoogleServices = googleServicesJsonBase64.replace(/^data:application\/json;base64,/, "");
      }
      
      let authOptions: any = {};
      if (process.env.GCP_CREDENTIALS_JSON) {
         try {
           authOptions.credentials = JSON.parse(process.env.GCP_CREDENTIALS_JSON);
         } catch (e) {
           console.error("Failed to parse GCP_CREDENTIALS_JSON", e);
         }
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
         authOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }
      
      const cb = new CloudBuildClient(authOptions);
      
      // We need a GCP project ID. Since we are running in AI studio, we might lack the auth context 
      // unless provided via GOOGLE_APPLICATION_CREDENTIALS.
      let gcpProjectId = process.env.GCP_PROJECT_ID;
      if (!gcpProjectId) {
        try {
          gcpProjectId = await cb.getProjectId();
        } catch (err) {
          console.warn("Could not determine GCP Project ID automatically.");
        }
      }

      if (!gcpProjectId) {
         return res.status(500).json({ 
           error: "Google Cloud Project ID is not configured. Please set GCP_PROJECT_ID in your environment." 
         });
      }

      const storageBucketName = process.env.GCP_STORAGE_BUCKET || `${gcpProjectId}-apk-builds`;
      
      const storage = new Storage(authOptions);
      const bucket = storage.bucket(storageBucketName);
      try {
        const [bucketExists] = await bucket.exists();
        if (!bucketExists) {
           await bucket.create();
        }
        
        if (rawBase64Icon) {
           const iconFile = bucket.file(`builds/${projectId}/icon.png`);
           const buffer = Buffer.from(rawBase64Icon, 'base64');
           await iconFile.save(buffer, {
              metadata: { contentType: 'image/png' }
           });
        }

         if (rawBase64GoogleServices) {
            const gsFile = bucket.file(`builds/${projectId}/google-services.json`);
            const buffer = Buffer.from(rawBase64GoogleServices, 'base64');
            await gsFile.save(buffer, {
               metadata: { contentType: 'application/json' }
            });
         }
      } catch (err) {
        console.warn("Could not handle storage bucket operations.", err);
      }
      
      const safeAppName = appName.replace(/[^a-zA-Z0-9]/g, '_') || 'My_App';
      const safePackageName = packageName.trim() || 'com.web2apk.app';
      const safeVersionCode = parseInt(versionCode) || 1;
      const safeVersionName = versionName || '1.0.0';
      
      const builderImage = `gcr.io/${gcpProjectId}/android-builder:v24`;
      const buildSteps: any[] = [
        {
          id: 'git-clone',
          name: 'gcr.io/cloud-builders/git',
          args: ['clone', repoUrl, 'workspace']
        },
        {
          id: 'npm-install',
          name: builderImage,
          dir: 'workspace',
          entrypoint: 'bash',
          args: ['-c', 'rm -f package-lock.json && npm install']
        },
        {
          id: 'vite-build',
          name: builderImage,
          dir: 'workspace',
          entrypoint: 'npm',
          args: ['run', 'build']
        },
        {
          id: 'capacitor-init',
          name: builderImage,
          dir: 'workspace',
          entrypoint: 'bash',
          args: [
            '-c',
            `npm install @capacitor/cli @capacitor/core @capacitor/android
             npx cap init "${appName}" "${safePackageName}" --web-dir dist
             npx cap add android
             
             # Update Version Code and Version Name
             sed -i -e 's/versionCode 1/versionCode ${safeVersionCode}/g' android/app/build.gradle
             sed -i -e 's/versionName "1.0"/versionName "${safeVersionName}"/g' android/app/build.gradle`
          ]
        }
      ];

      // Manifest and Theme modifications
      buildSteps.push({
        id: 'native-config',
        name: builderImage,
        dir: 'workspace',
        entrypoint: 'bash',
        args: [
          '-c',
          `cat << 'EOF' > modify_manifest.cjs
const fs = require('fs');
const path = require('path');
const manifestPath = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (fs.existsSync(manifestPath)) {
  let content = fs.readFileSync(manifestPath, 'utf8');
  const orientation = process.argv[2] || 'default';
  const fullscreen = process.argv[3] === 'true';
  const allowCleartext = process.argv[4] === 'true';

  function setAttribute(tag, attr, value) {
    const tagRegex = new RegExp('<' + tag + '[^>]*>', 'g');
    const attrRegex = new RegExp(attr + '="[^"]*"');
    content = content.replace(tagRegex, (match) => {
      if (attrRegex.test(match)) {
        return match.replace(attrRegex, \`\${attr}="\${value}"\`);
      } else {
        return match.replace('<' + tag, \`<\${tag} \${attr}="\${value}"\`);
      }
    });
  }

  if (orientation !== 'default') {
    setAttribute('activity', 'android:screenOrientation', orientation);
  }
  if (fullscreen) {
    setAttribute('activity', 'android:theme', '@style/AppTheme.NoActionBarFullscreen');
  }
  if (allowCleartext) {
    setAttribute('application', 'android:usesCleartextTraffic', 'true');
  }
  fs.writeFileSync(manifestPath, content);
}
EOF
node modify_manifest.cjs "${orientation}" "${fullscreen}" "${allowCleartext}"

if [ "${fullscreen}" = "true" ]; then
  cat << 'EOF' > inject_styles.cjs
const fs = require('fs');
const path = require('path');
const stylesPath = path.join('android', 'app', 'src', 'main', 'res', 'values', 'styles.xml');

if (fs.existsSync(stylesPath)) {
  let content = fs.readFileSync(stylesPath, 'utf8');
  const fullscreenTheme = \`
    <style name="AppTheme.NoActionBarFullscreen" parent="AppTheme.NoActionBar">
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowContentOverlay">@null</item>
    </style>\`;
  
  if (!content.includes('AppTheme.NoActionBarFullscreen')) {
    content = content.replace('</resources>', fullscreenTheme + '\\n</resources>');
    fs.writeFileSync(stylesPath, content);
  }
}
EOF
  node inject_styles.cjs
fi`
        ]
      });

      // Plugins and Sync
      let pluginsToInstall = ['@capacitor/splash-screen'];
      if (doubleTapToExit) pluginsToInstall.push('@capacitor/app');
      if (googleServicesJsonBase64) pluginsToInstall.push('@capacitor/push-notifications');
      if (permissions && permissions.length > 0) {
         if (permissions.includes('CAMERA')) pluginsToInstall.push('@capacitor/camera');
         if (permissions.includes('ACCESS_FINE_LOCATION') || permissions.includes('ACCESS_COARSE_LOCATION')) pluginsToInstall.push('@capacitor/geolocation');
         if (permissions.includes('RECORD_AUDIO')) pluginsToInstall.push('@capacitor/voice-recorder');
         if (permissions.includes('READ_EXTERNAL_STORAGE') || permissions.includes('WRITE_EXTERNAL_STORAGE')) pluginsToInstall.push('@capacitor/filesystem');
         if (permissions.includes('POST_NOTIFICATIONS')) pluginsToInstall.push('@capacitor/local-notifications');
      }

      buildSteps.push({
        id: 'plugin-sync',
        name: builderImage,
        dir: 'workspace',
        entrypoint: 'bash',
        args: [
          '-c',
          `npm install ${pluginsToInstall.join(' ')}
           npx cap sync android`
        ]
      });

      // Assets (Icon & Splash)
      if (rawBase64Icon) {
        try {
          const iconFile = bucket.file(`builds/${projectId}/icon.png`);
          const [url] = await iconFile.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000,
          });
          buildSteps.push({
            id: 'asset-generation',
            name: builderImage,
            dir: 'workspace',
            entrypoint: 'bash',
            args: [
              '-c',
              `mkdir -p assets
               curl -sS -L "${url}" -o assets/icon.png
               npm install @capacitor/assets --save-dev
               npx @capacitor/assets generate --iconBackgroundColor '#ffffff' --splashBackgroundColor '${splashBackgroundColor || '#ffffff'}' --android
               echo "Assets generated"`
            ]
          });
        } catch (e) {
          console.error("Icon signed URL error", e);
        }
      }

      // Google Services
      if (rawBase64GoogleServices) {
        try {
          const gsFile = bucket.file(`builds/${projectId}/google-services.json`);
          const [gsUrl] = await gsFile.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000,
          });
          buildSteps.push({
            id: 'google-services',
            name: builderImage,
            dir: 'workspace',
            entrypoint: 'bash',
            args: [
              '-c',
              `mkdir -p android/app
               curl -sS -L "${gsUrl}" -o android/app/google-services.json`
            ]
          });
        } catch (e) {
          console.error("GS signed URL error", e);
        }
      }

      // Permissions and Features
      if (permissions && permissions.length > 0) {
        let permissionsXml = '';
        for (const p of permissions) {
          if (p === 'INTERNET') continue;
          permissionsXml += `    <uses-permission android:name="android.permission.${p}" />\n`;
          if (p === 'CAMERA') {
            permissionsXml += '    <uses-feature android:name="android.hardware.camera" android:required="false" />\\n';
            permissionsXml += '    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />\\n';
          } else if (p === 'ACCESS_FINE_LOCATION') {
            permissionsXml += '    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\\n';
            permissionsXml += '    <uses-feature android:name="android.hardware.location.gps" android:required="false" />\\n';
          } else if (p === 'RECORD_AUDIO') {
            permissionsXml += '    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />\\n';
          }
        }

        buildSteps.push({
          id: 'permission-injection',
          name: builderImage,
          dir: 'workspace',
          entrypoint: 'bash',
          args: [
            '-c',
            `cat << 'EOF' > insert_permissions.cjs
const fs = require('fs');
const path = require('path');
const manifestPath = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
let content = fs.readFileSync(manifestPath, 'utf8');
const permissionsXml = Buffer.from('${Buffer.from(permissionsXml).toString("base64")}', 'base64').toString('utf8');
content = content.replace('<application', permissionsXml + '\\n    <application');
fs.writeFileSync(manifestPath, content);
EOF
node insert_permissions.cjs`
          ]
        });
      }

      // Native Logic (Double Tap)
      if (doubleTapToExit) {
        buildSteps.push({
          id: 'native-logic',
          name: builderImage,
          dir: 'workspace',
          entrypoint: 'bash',
          args: [
            '-c',
            `cat << 'EOF' > inject_double_tap.cjs
const fs = require('fs');
const path = require('path');
const packageName = process.argv[2];
const packagePath = packageName.replace(/\./g, path.sep);
const mainActivityPath = path.join('android', 'app', 'src', 'main', 'java', packagePath, 'MainActivity.java');

if (fs.existsSync(mainActivityPath)) {
  let content = fs.readFileSync(mainActivityPath, 'utf8');
  if (!content.includes('import android.widget.Toast;')) {
    content = content.replace('import com.getcapacitor.BridgeActivity;', 'import com.getcapacitor.BridgeActivity;\\nimport android.widget.Toast;');
  }
  const backButtonLogic = \`
    private long lastBackPressedTime = 0;
    private static final int BACK_PRESSED_INTERVAL = 2000;
    @Override
    public void onBackPressed() {
        if (this.bridge.getWebView().canGoBack()) {
            this.bridge.getWebView().goBack();
        } else {
            if (System.currentTimeMillis() - lastBackPressedTime < BACK_PRESSED_INTERVAL) {
                super.onBackPressed();
            } else {
                lastBackPressedTime = System.currentTimeMillis();
                Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show();
            }
        }
    \}\`;
  const lastBraceIndex = content.lastIndexOf('}');
  content = content.slice(0, lastBraceIndex) + backButtonLogic + "\\n" + content.slice(lastBraceIndex);
  fs.writeFileSync(mainActivityPath, content);
}
EOF
node inject_double_tap.cjs "${safePackageName}"`
          ]
        });
      }

      // Notifications on Launch
      if (askNotificationsOnLaunch) {
        buildSteps.push({
          id: 'notification-setup',
          name: builderImage,
          dir: 'workspace',
          entrypoint: 'bash',
          args: [
            '-c',
            `cat << 'EOF' > inject_notifs.cjs
const fs = require('fs');
const path = require('path');
const indexPath = path.join('dist', 'index.html');
if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf8');
  const scriptInject = \`
  <script type="module">
    import { PushNotifications } from 'https://cdn.jsdelivr.net/npm/@capacitor/push-notifications@latest/dist/esm/index.js';
    async function requestPermissions() {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') permStatus = await PushNotifications.requestPermissions();
        if (permStatus.receive === 'granted') await PushNotifications.register();
      } catch (e) {
        console.warn('Push fail:', e);
      }
    }
    window.addEventListener('load', () => setTimeout(requestPermissions, 1000));
  </script>\`;
  content = content.replace('</body>', scriptInject + '\\n</body>');
  fs.writeFileSync(indexPath, content);
}
EOF
node inject_notifs.cjs`
          ]
        });
      }

      // Final Gradle Setup and APK Build
      buildSteps.push({
        id: 'gradle-config',
        name: builderImage,
        dir: 'workspace',
        entrypoint: 'bash',
        args: [
          '-c',
          `sed -i -e "s/minSdkVersion = 23/minSdkVersion = 24/g" android/variables.gradle
           sed -i -e "s/dependencies {/dependencies {\\n        classpath 'com.google.gms:google-services:4.4.1'/g" android/build.gradle
           echo "apply plugin: 'com.google.gms.google-services'" >> android/app/build.gradle
           echo "allprojects { configurations.all { resolutionStrategy { force 'androidx.core:core:1.15.0'; force 'androidx.core:core-ktx:1.15.0'; exclude group: 'org.jetbrains.kotlin', module: 'kotlin-stdlib-jdk7'; exclude group: 'org.jetbrains.kotlin', module: 'kotlin-stdlib-jdk8' } } }" >> android/build.gradle
           
           # Configure SplashScreen
           cat << 'EOF' > configure_splash.cjs
const fs = require('fs');
const configPath = 'capacitor.config.json';
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.plugins = config.plugins || {};
  config.plugins.SplashScreen = {
    launchShowDuration: 3000,
    launchAutoHide: true,
    backgroundColor: process.argv[2] || "#ffffff",
    androidScaleType: "CENTER_CROP",
    showSpinner: false,
    splashFullScreen: true,
    splashImmersive: true
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
EOF
           node configure_splash.cjs "${splashBackgroundColor || "#ffffff"}"`
        ]
      });

      buildSteps.push({
        id: 'apk-compilation',
        name: builderImage,
        dir: 'workspace/android',
        entrypoint: 'bash',
        args: ['-c', './gradlew assembleDebug --no-daemon']
      });

      const build = {
        steps: buildSteps,
        artifacts: {
          objects: {
            location: `gs://${storageBucketName}/builds/${projectId}/`,
            paths: ['workspace/android/app/build/outputs/apk/debug/app-debug.apk']
          }
        },
        logsBucket: `gs://${storageBucketName}/logs`
      };

      const [operation] = await cb.createBuild({
        projectId: gcpProjectId,
        build
      });

      res.json({ 
        success: true, 
        operationName: operation.name,
        buildId: (operation.metadata as any)?.build?.id
      });

    } catch (error: any) {
      console.error("Build trigger error:", error);
      res.status(500).json({ error: error.message || "Failed to trigger build" });
    }
  });

  app.get("/api/build/:buildId", async (req, res) => {
    try {
      let authOptions: any = {};
      if (process.env.GCP_CREDENTIALS_JSON) {
         try {
           authOptions.credentials = JSON.parse(process.env.GCP_CREDENTIALS_JSON);
         } catch (e) { }
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
         authOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }
      const cb = new CloudBuildClient(authOptions);
      const storage = new Storage(authOptions);
      let gcpProjectId = process.env.GCP_PROJECT_ID;
      if (!gcpProjectId) gcpProjectId = await cb.getProjectId();

      const storageBucketName = process.env.GCP_STORAGE_BUCKET || `${gcpProjectId}-apk-builds`;
      const projectId = req.query.projectId as string;

      const buildId = req.params.buildId;
      const [build] = await cb.getBuild({
        projectId: gcpProjectId,
        id: buildId
      });

      let downloadUrl = null;
      if (build.status === 'SUCCESS' && projectId) {
        const bucket = storage.bucket(storageBucketName);
        const apkFile = bucket.file(`builds/${projectId}/app-debug.apk`);
        const [url] = await apkFile.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });
        downloadUrl = url;
      }

      const terminalStatuses: string[] = ['SUCCESS', 'FAILURE', 'INTERNAL_ERROR', 'TIMEOUT', 'CANCELLED'];
      if (projectId && build.status && terminalStatuses.includes(String(build.status))) {
        try {
          const { getFirestore, doc, getDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
          const { initializeApp, getApps } = await import('firebase/app');
          const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
          
          if (getApps().length === 0) initializeApp(firebaseConfig);
          const db = getFirestore();
          
          const projectRef = doc(db, 'projects', projectId);
          const projectSnap = await getDoc(projectRef);
          
          if (projectSnap.exists()) {
            const projectData = projectSnap.data();
            // Critical check: only update if high-level status is still 'building'
            if (projectData.buildId === buildId && projectData.status === 'building') {
              const nextStatus = build.status === 'SUCCESS' ? 'completed' : 'failed';
              const updateData: any = {
                status: nextStatus,
                buildStatusDetails: build.status,
                updatedAt: serverTimestamp()
              };
              if (downloadUrl) updateData.downloadUrl = downloadUrl;
              if (build.failureInfo) {
                let reason = build.failureInfo.detail || build.failureInfo.type || 'Build failed';
                if (typeof reason !== 'string') reason = JSON.stringify(reason);
                updateData.buildFailureReason = reason.substring(0, 1900);
              }
              await updateDoc(projectRef, updateData);

              const buildRef = doc(db, 'projects', projectId, 'builds', buildId);
              await updateDoc(buildRef, {
                status: nextStatus,
                downloadUrl: downloadUrl || null,
                logUrl: build.logUrl || null,
                updatedAt: serverTimestamp(),
                buildFailureReason: updateData.buildFailureReason || ''
              });
              console.log(`[Backend] Synced terminal build state: ${build.status}`);
            }
          }
        } catch (dbError) {
          console.error('[Backend] DB sync failed:', dbError);
        }
      }

      res.json({ 
        status: build.status,
        logUrl: build.logUrl,
        steps: build.steps?.map(s => ({ name: s.id || s.name, status: s.status })) || [],
        failureInfo: build.failureInfo || build.statusDetail,
        downloadUrl
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/build/:buildId/cancel", async (req, res) => {
    try {
      let authOptions: any = {};
      if (process.env.GCP_CREDENTIALS_JSON) {
         try {
           authOptions.credentials = JSON.parse(process.env.GCP_CREDENTIALS_JSON);
         } catch (e) { }
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
         authOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }
      const cb = new CloudBuildClient(authOptions);
      let gcpProjectId = process.env.GCP_PROJECT_ID;
      if (!gcpProjectId) gcpProjectId = await cb.getProjectId();

      await cb.cancelBuild({
        projectId: gcpProjectId,
        id: req.params.buildId
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/logs/:buildId", async (req, res) => {
    try {
      let authOptions: any = {};
      if (process.env.GCP_CREDENTIALS_JSON) {
         try {
           authOptions.credentials = JSON.parse(process.env.GCP_CREDENTIALS_JSON);
         } catch (e) { }
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
         authOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }
      const cb = new CloudBuildClient(authOptions);
      let gcpProjectId = process.env.GCP_PROJECT_ID;
      if (!gcpProjectId) {
          gcpProjectId = await cb.getProjectId();
      }

      const [build] = await cb.getBuild({
        projectId: gcpProjectId,
        id: req.params.buildId
      });

      let storageBucketName = process.env.GCP_STORAGE_BUCKET || `${gcpProjectId}-apk-builds`;
      let logFilePath = `logs/log-${req.params.buildId}.txt`;
      if (build.logsBucket) {
         if (build.logsBucket.startsWith('gs://')) {
            const pathParts = build.logsBucket.replace('gs://', '').split('/');
            storageBucketName = pathParts.shift() || storageBucketName;
            const prefix = pathParts.join('/');
            logFilePath = prefix ? `${prefix}/log-${req.params.buildId}.txt` : `log-${req.params.buildId}.txt`;
         } else {
            storageBucketName = build.logsBucket;
         }
      }

      const storage = new Storage(authOptions);
      const file = storage.bucket(storageBucketName).file(logFilePath);
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ error: "Log file not found yet. It may take a moment to be created." });
      }

      const [contents] = await file.download();
      res.send(contents.toString("utf-8"));
    } catch (error: any) {
      if (error.message.includes("does not have storage.objects.get access") || error.message.includes("Permission 'storage.objects.get' denied")) {
        res.status(403).json({ 
          error: `GCP Permission Error: The Service Account does not have Storage Object Viewer privileges to read the file. Note: If the file does not exist yet, GCP returns this permission error. Wait a moment and try again.` 
        });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.post("/api/download", async (req, res) => {
    try {
      const { projectId, appName } = req.body;
      let authOptions: any = {};
      if (process.env.GCP_CREDENTIALS_JSON) {
         try {
           authOptions.credentials = JSON.parse(process.env.GCP_CREDENTIALS_JSON);
         } catch (e) { }
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
         authOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }
      const storage = new Storage(authOptions);
      let gcpProjectId = process.env.GCP_PROJECT_ID;
      const storageBucketName = process.env.GCP_STORAGE_BUCKET || `${gcpProjectId}-apk-builds`;
      
      const file = storage.bucket(storageBucketName!).file(`builds/${projectId}/app-debug.apk`);
      
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ error: "APK not found on storage" });
      }

      // Format the app name to be safe for filenames
      const safeAppName = appName ? appName.replace(/[^a-zA-Z0-9-]/g, '_') : 'app-debug';
      const filename = `${safeAppName}.apk`;

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000, // 15 mins
        responseDisposition: `attachment; filename="${filename}"`
      });

      res.json({ url });
    } catch (error: any) {
      if (error.message.includes("does not have storage.objects.get access") || error.message.includes("Permission 'storage.objects.get' denied")) {
        res.status(403).json({ 
          error: `GCP Permission Error: The Service Account does not have Storage Object Viewer privileges to access the APK. Also, it might mean the file does not exist yet.` 
        });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.post("/api/delete-project", async (req, res) => {
    try {
      const { projectId } = req.body;
      let authOptions: any = {};
      if (process.env.GCP_CREDENTIALS_JSON) {
         try {
           authOptions.credentials = JSON.parse(process.env.GCP_CREDENTIALS_JSON);
         } catch (e) { }
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
         authOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }
      
      const storage = new Storage(authOptions);
      let gcpProjectId = process.env.GCP_PROJECT_ID;
      const storageBucketName = process.env.GCP_STORAGE_BUCKET || `${gcpProjectId}-apk-builds`;
      
      const bucket = storage.bucket(storageBucketName);
      
      try {
        await bucket.deleteFiles({ prefix: `builds/${projectId}/` });
      } catch (err) {
        console.warn(`Cleanup error for builds/${projectId}/`, err);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Cleanup API error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // We would need robust path handling for production built files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
