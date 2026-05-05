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
         filter: `status="SUCCESS" AND results.images.name="gcr.io/${gcpProjectId}/android-builder:v29"`
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
    && sdkmanager "platform-tools" "platforms;android-34" "platforms;android-35" "platforms;android-36" "build-tools;34.0.0" "build-tools;35.0.0"

# Pre-warm npm and gradle caches
RUN mkdir /dummy_app && cd /dummy_app \\
    && npm init -y \\
    && npm install @capacitor/cli@7 @capacitor/core@7 @capacitor/android@7 @capacitor/camera@7 @capacitor/geolocation@7 @capacitor/voice-recorder@7 @capacitor/filesystem@7 @capacitor/local-notifications@7 @capacitor/assets@latest \\
    && npx cap init dummy com.dummy.app --web-dir www \\
    && mkdir www && echo "<html></html>" > www/index.html \\
    && npx cap add android \\
    && sed -i -e "s/minSdkVersion = 23/minSdkVersion = 24/g" android/variables.gradle \\
    && sed -i -e "s/dependencies {/dependencies {\\n\\tclasspath 'com.google.gms:google-services:4.4.1'/g" android/build.gradle \\
    && echo "apply plugin: 'com.google.gms.google-services'" >> android/app/build.gradle \\
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
            args: ['build', '-t', `gcr.io/${gcpProjectId}/android-builder:v29`, '-f', 'Dockerfile', '.']
          },
          {
            name: 'gcr.io/cloud-builders/docker',
            args: ['push', `gcr.io/${gcpProjectId}/android-builder:v29`]
          }
        ],
        images: [`gcr.io/${gcpProjectId}/android-builder:v29`],
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
        notificationIconBase64,
        splashBackgroundColor,
        splashIconSize,
        splashAnimation
      } = req.body;
      
      let rawBase64Icon = '';
      if (appIconBase64) {
         rawBase64Icon = appIconBase64.replace(/^data:image\/\w+;base64,/, "");
      }

      let rawBase64NotificationIcon = '';
      if (notificationIconBase64) {
         rawBase64NotificationIcon = notificationIconBase64.replace(/^data:[^;]+;base64,/, "");
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

        if (rawBase64NotificationIcon) {
            const nBuffer = Buffer.from(rawBase64NotificationIcon, 'base64');
            const isXml = nBuffer[0] === 60; // '<'
            const ext = isXml ? 'xml' : 'png';
            const contentType = isXml ? 'application/xml' : 'image/png';
            const nIconFile = bucket.file(`builds/${projectId}/notification-icon.${ext}`);
            await nIconFile.save(nBuffer, {
               metadata: { contentType }
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
      
            // Upload configure_build.cjs to avoid argument length limits
      try {
         const configureScriptStr = `const fs = require('fs');
const path = require('path');

let finalPackageName = "\\\${safePackageName}";
if (fs.existsSync('android/app/google-services.json')) {
   try {
      const gs = JSON.parse(fs.readFileSync('android/app/google-services.json', 'utf8'));
      if (gs.client && gs.client[0] && gs.client[0].client_info && gs.client[0].client_info.android_client_info) {
         finalPackageName = gs.client[0].client_info.android_client_info.package_name;
      }
   } catch (e) {}
}

const varFile = 'android/variables.gradle';
if (fs.existsSync(varFile)) {
   console.log('Modifying variables.gradle');
   let c = fs.readFileSync(varFile, 'utf8');
   c = c.replace(/minSdkVersion\\\\s*=?\\\\s*\\\\d+/g, 'minSdkVersion = 24');
   c = c.replace(/compileSdkVersion\\\\s*=?\\\\s*\\\\d+/g, 'compileSdkVersion = 35');
   c = c.replace(/targetSdkVersion\\\\s*=?\\\\s*\\\\d+/g, 'targetSdkVersion = 35');
   c = c.replace(/compileSdk\\\\s*=?\\\\s*\\\\d+/g, 'compileSdk = 35');
   c = c.replace(/targetSdk\\\\s*=?\\\\s*\\\\d+/g, 'targetSdk = 35');
   c = c.replace(/androidxCoreVersion\\\\s*=?\\\\s*['"][\\\\d\\\\.]+['"]/g, "androidxCoreVersion = '1.15.0'");
   c = c.replace(/androidxCoreKtxVersion\\\\s*=?\\\\s*['"][\\\\d\\\\.]+['"]/g, "androidxCoreKtxVersion = '1.15.0'");
   
   fs.writeFileSync(varFile, c);
} else {
   console.warn('variables.gradle not found');
}

const projGradle = 'android/build.gradle';
if (fs.existsSync(projGradle)) {
   console.log('Modifying build.gradle');
   let c = fs.readFileSync(projGradle, 'utf8');
   c = c.replace(/classpath\\\\s*\\\\(?['"]com\\\\.android\\\\.tools\\\\.build:gradle:[\\\\d\\\\.]+['"]\\\\)?/, "classpath 'com.android.tools.build:gradle:8.7.2'");
   c = c.replace(/id\\\\s*\\\\(?['"]com\\\\.android\\\\.application['"]\\\\)?\\\\s*version\\\\s*['"][\\\\d\\\\.]+['"]/, 'id "com.android.application" version "8.7.2"');
   
   if (fs.existsSync('android/app/google-services.json')) {
      console.log('Adding google-services classpath');
      if (!c.includes('com.google.gms:google-services')) {
         c = c.replace(/dependencies\\\\s*{/, 'dependencies {' + String.fromCharCode(10) + '        classpath "com.google.gms:google-services:4.4.1"');
      }
   }
   if (!c.includes('resolutionStrategy')) {
      c += "\\\\nallprojects {\\\\n    configurations.all {\\\\n        resolutionStrategy {\\\\n            force 'androidx.core:core:1.15.0'\\\\n            force 'androidx.core:core-ktx:1.15.0'\\\\n        }\\\\n    }\\\\n}\\\\n";
   }
   fs.writeFileSync(projGradle, c);
} else {
   console.warn('build.gradle not found');
}

const appGradle = 'android/app/build.gradle';
if (fs.existsSync(appGradle)) {
   console.log('Modifying app/build.gradle');
   let c = fs.readFileSync(appGradle, 'utf8');
   c = c.replace(/compileSdk\\\\s*\\\\(?\\\\s*\\\\d+\\\\s*\\\\)?/g, 'compileSdk 35');
   c = c.replace(/targetSdk\\\\s*\\\\(?\\\\s*\\\\d+\\\\s*\\\\)?/g, 'targetSdk 35');
   c = c.replace(/compileSdkVersion\\\\s*\\\\(?\\\\s*\\\\d+\\\\s*\\\\)?/g, 'compileSdkVersion 35');
   c = c.replace(/targetSdkVersion\\\\s*\\\\(?\\\\s*\\\\d+\\\\s*\\\\)?/g, 'targetSdkVersion 35');
   c = c.replace(/compileSdk\\\\s*=\\\\s*\\\\d+/g, 'compileSdk = 35');
   c = c.replace(/targetSdk\\\\s*=\\\\s*\\\\d+/g, 'targetSdk = 35');

   if (fs.existsSync('android/app/google-services.json')) {
      if (!c.includes('com.google.gms.google-services')) {
         c += String.fromCharCode(10) + "apply plugin: 'com.google.gms.google-services'" + String.fromCharCode(10);
      }
   }
   c = c.replace(/applicationId\\\\s+"[^"]+"/, 'applicationId "' + finalPackageName + '"');
   if (c.includes('namespace ')) {
      c = c.replace(/namespace\\\\s+"[^"]+"/, 'namespace "' + finalPackageName + '"');
   }
   
   fs.writeFileSync(appGradle, c);
}

const tomlFile = 'android/gradle/libs.versions.toml';
if (fs.existsSync(tomlFile)) {
   console.log('Modifying libs.versions.toml');
   let c = fs.readFileSync(tomlFile, 'utf8');
   c = c.replace(/compileSdk\\\\s*=\\\\s*["']?\\\\d+["']?/g, 'compileSdk = "35"');
   c = c.replace(/targetSdk\\\\s*=\\\\s*["']?\\\\d+["']?/g, 'targetSdk = "35"');
   c = c.replace(/agp\\\\s*=\\\\s*['"][\\\\d\\\\.]+['"]/g, 'agp = "8.7.2"');
   c = c.replace(/coreKtx\\\\s*=\\\\s*['"][\\\\d\\\\.]+['"]/g, 'coreKtx = "1.15.0"');
   c = c.replace(/androidxCore\\\\s*=\\\\s*['"][\\\\d\\\\.]+['"]/g, 'androidxCore = "1.15.0"');
   c = c.replace(/androidx-core\\\\s*=\\\\s*['"][\\\\d\\\\.]+['"]/g, 'androidx-core = "1.15.0"');
   c = c.replace(/core\\\\s*=\\\\s*['"][\\\\d\\\\.]+['"]/g, 'core = "1.15.0"');
   fs.writeFileSync(tomlFile, c);
}

const gradleWrapper = 'android/gradle/wrapper/gradle-wrapper.properties';
if (fs.existsSync(gradleWrapper)) {
   console.log('Modifying gradle-wrapper.properties');
   let c = fs.readFileSync(gradleWrapper, 'utf8');
   c = c.replace(/gradle-[\\\\d\\\\.]+-(all|bin)\\\\.zip/, 'gradle-8.10.2-all.zip');
   fs.writeFileSync(gradleWrapper, c);
}

const configJsonPath = 'capacitor.config.json';
const configTsPath = 'capacitor.config.ts';
let config = {};

if (fs.existsSync(configJsonPath)) {
  config = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
} else if (fs.existsSync(configTsPath)) {
  fs.unlinkSync(configTsPath);
}

config.appId = finalPackageName;
config.appName = "\\\${appName}";
config.webDir = config.webDir || 'dist';

config.plugins = config.plugins || {};
config.plugins.SplashScreen = {
  launchShowDuration: 2000,
  launchAutoHide: true,
  backgroundColor: '#ffffff',
  androidSplashResourceName: "splash",
  splashIconSize: parseInt(process.argv[4]) || 50,
  splashAnimation: process.argv[5] || 'fade',
  androidScaleType: 'CENTER_CROP',
  showSpinner: false,
  splashFullScreen: process.argv[6] === 'true'
};

const blendColor = process.argv[2] || '#ffffff';
let isLight = true;
try {
    var hex = blendColor.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var rgbR = parseInt(hex.substr(0, 2), 16), rgbG = parseInt(hex.substr(2, 2), 16), rgbB = parseInt(hex.substr(4, 2), 16);
    var yiqCalc = ((rgbR*299)+(rgbG*587)+(rgbB*114))/1000;
    isLight = (yiqCalc >= 128);
} catch(e) {}

config.plugins.StatusBar = {
    backgroundColor: blendColor,
    style: isLight ? 'LIGHT' : 'DARK',
    overlaysWebView: false
};

const javaDir = path.join('android', 'app', 'src', 'main', 'java');
function getMainActivityPath(dir) {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            const res = getMainActivityPath(fullPath);
            if (res) return res;
        } else if (file === 'MainActivity.java') {
            return fullPath;
        }
    }
    return null;
}
const mainActivityPath = getMainActivityPath(javaDir);
if (mainActivityPath) {
    let javaCode = fs.readFileSync(mainActivityPath, 'utf8');

    let needsOnCreate = true; // process.argv[8] === 'true' || process.argv[3] === 'true';
    if (needsOnCreate) {
        if (!javaCode.includes('import android.os.Build;')) {
             javaCode = javaCode.replace(/(import [^;]+;)/, '\$1\\\\nimport android.os.Build;\\\\nimport android.os.Bundle;\\\\nimport androidx.core.content.ContextCompat;\\\\nimport androidx.core.app.ActivityCompat;\\\\nimport android.app.NotificationChannel;\\\\nimport android.app.NotificationManager;\\\\nimport android.content.Context;');
        }
        if (!javaCode.includes('public void onCreate(')) {
             let onCreateLogic = \\\`
    @Override
    public void onStart() {
        super.onStart();
        android.content.SharedPreferences prefs = getSharedPreferences("app_prefs", Context.MODE_PRIVATE);
        int currentVersionCode = 1;
        try {
            currentVersionCode = getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
        } catch (Exception e) {}
        int savedVersionCode = prefs.getInt("version_code", -1);
        if (savedVersionCode != currentVersionCode) {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().clearCache(true);
            }
            prefs.edit().putInt("version_code", currentVersionCode).apply();
            try {
                java.io.File webViewDir = new java.io.File(getApplicationInfo().dataDir, "app_webview");
                if (webViewDir.exists()) {
                    java.io.File swDir1 = new java.io.File(webViewDir, "Default/Service Worker");
                    java.io.File swDir2 = new java.io.File(webViewDir, "Service Worker");
                    java.io.File[] dirs = {swDir1, swDir2};
                    for (java.io.File dir : dirs) {
                        if (dir.exists()) {
                            String[] children = dir.list();
                            if (children != null) {
                                for (String child : children) {
                                    new java.io.File(dir, child).delete();
                                }
                            }
                            dir.delete();
                        }
                    }
                }
            } catch (Exception e) {}
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        getWindow().setDecorFitsSystemWindows(true);
        super.onCreate(savedInstanceState);
\\\`;
             if (process.argv[8] === 'true') {
                 onCreateLogic += \\\`
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 1);
            }
        }
\\\`;
             }
             if (process.argv[3] === 'true') {
                 onCreateLogic += \\\`
        if (Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel channel = new NotificationChannel("primary_notifications_v4", "Primary Notifications", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Main app notifications");
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
\\\`;
             }
             onCreateLogic += \\\`    }
\\\`;
             javaCode = javaCode.replace(/public class MainActivity extends BridgeActivity \\\\{/, 'public class MainActivity extends BridgeActivity {' + onCreateLogic);
        }
    }

    fs.writeFileSync(mainActivityPath, javaCode);
}

if (process.argv[3] === 'true') {
   config.plugins.PushNotifications = config.plugins.PushNotifications || {};
   config.plugins.PushNotifications.presentationOptions = ['badge', 'sound', 'alert'];
   config.plugins.LocalNotifications = config.plugins.LocalNotifications || {};
   config.plugins.LocalNotifications.smallIcon = 'ic_stat_notification';
} else {
   config.plugins.LocalNotifications = config.plugins.LocalNotifications || {};
   config.plugins.LocalNotifications.smallIcon = 'ic_launcher';
}

fs.writeFileSync(configJsonPath, JSON.stringify(config, null, 2));
`;
         const configScriptFile = bucket.file(`builds/${projectId}/configure_build.cjs`);
         await configScriptFile.save(Buffer.from(configureScriptStr, "utf8"), {
             metadata: { contentType: 'application/javascript' }
         });
      } catch (err) {
         console.warn("Could not handle storage bucket operations for configure script.", err);
      }

      const safeAppName = appName.replace(/[^a-zA-Z0-9]/g, '_') || 'My_App';
      const safePackageName = packageName.trim() || 'com.web2apk.app';
      const safeVersionCode = parseInt(versionCode) || 1;
      const safeVersionName = versionName || '1.0.0';
      
      const builderImage = `gcr.io/${gcpProjectId}/android-builder:v29`;
      const cachePath = `gs://${storageBucketName}/cache/v1/${projectId}/cache.tar.gz`;

      let pluginsToInstall = ['@capacitor/splash-screen', '@capacitor/status-bar'];
      if (doubleTapToExit) { pluginsToInstall.push('@capacitor/app'); pluginsToInstall.push('@capacitor/toast'); }
      if (googleServicesJsonBase64) pluginsToInstall.push('@capacitor/push-notifications');
      if (permissions && permissions.length > 0) {
         if (permissions.includes('CAMERA')) pluginsToInstall.push('@capacitor/camera');
         if (permissions.includes('ACCESS_FINE_LOCATION') || permissions.includes('ACCESS_COARSE_LOCATION')) pluginsToInstall.push('@capacitor/geolocation');
         if (permissions.includes('RECORD_AUDIO')) pluginsToInstall.push('@capacitor/voice-recorder');
         if (permissions.includes('READ_EXTERNAL_STORAGE') || permissions.includes('WRITE_EXTERNAL_STORAGE')) pluginsToInstall.push('@capacitor/filesystem');
         if (permissions.includes('POST_NOTIFICATIONS')) pluginsToInstall.push('@capacitor/local-notifications');
      }
      
      if (askNotificationsOnLaunch && !pluginsToInstall.includes('@capacitor/local-notifications')) {
         pluginsToInstall.push('@capacitor/local-notifications');
      }

      const buildSteps: any[] = [
        {
          id: 'git-clone',
          name: 'gcr.io/cloud-builders/git',
          args: ['clone', repoUrl, 'workspace']
        },
        {
          id: 'restore-cache',
          name: 'gcr.io/cloud-builders/gsutil',
          dir: 'workspace',
          entrypoint: 'bash',
          args: [
            '-c',
            `gsutil cp ${cachePath} cache.tar.gz && (tar -xzf cache.tar.gz node_modules || true) && (tar -xzf cache.tar.gz .gradle_home .npm_cache || true) || echo "No cache found"`
          ],
          allowFailure: true
        },
        {
          id: 'npm-install',
          name: builderImage,
          dir: 'workspace',
          env: [
            'NPM_CONFIG_CACHE=/workspace/.npm_cache',
            'GRADLE_USER_HOME=/workspace/.gradle_home'
          ],
          entrypoint: 'bash',
          args: [
            '-c', 
            `node -e 'const fs=require("fs");if(fs.existsSync("package.json")){const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));["dependencies","devDependencies"].forEach(d=>{Object.keys(pkg[d]||{}).forEach(k=>{if(k.startsWith("@capacitor/") && k !== "@capacitor/assets") pkg[d][k]="^7.0.0";});});fs.writeFileSync("package.json",JSON.stringify(pkg,null,2));}'
             npm install --prefer-offline --no-audit
             npm install ${pluginsToInstall.map(p => p !== '@capacitor/assets' ? p + "@7" : p).join(" ")}`
          ]
        },
        {
          id: 'patch-index-html',
          name: builderImage,
          dir: 'workspace',
          entrypoint: 'bash',
          args: [
            '-c',
            `cat << 'EOF' > patch_html.cjs
const fs = require('fs');
const indexPath = 'index.html';
if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf8');
  let appIconBase64 = '';
  if (fs.existsSync('assets/icon.png')) {
      appIconBase64 = fs.readFileSync('assets/icon.png', 'base64');
  }
  let headInject = '<link rel="icon" href="/icon.png">\\n' +
                   '<link rel="apple-touch-icon" href="/icon.png">\\n' +
                   '<script>\\nwindow.APP_ICON_BASE64 = "' + appIconBase64 + '";\\n' +
                   'if ("serviceWorker" in navigator) {navigator.serviceWorker.getRegistrations().then(function(regs){for(var i=0;i<regs.length;i++){regs[i].unregister();}});}\\n' +
                   'if ("caches" in window) {caches.keys().then(function(keys){Promise.all(keys.map(function(k){return caches.delete(k);}));});}\\n' +
                   '</script>\\n';
  if (content.includes('</head>')) {
     content = content.replace('</head>', headInject + '\\n</head>');
  }

  // Capacitor plugins are natively configured via capacitor.config.json and MainActivity.java

  let jsConfig = "";
  if (${fullscreen === false}) {
     jsConfig += "import { StatusBar, Style } from '@capacitor/status-bar';\\n";
     jsConfig += "StatusBar.setOverlaysWebView({ overlay: false }).catch(()=>{});\\n";
     jsConfig += "StatusBar.setBackgroundColor({ color: '${splashBackgroundColor || '#ffffff'}' }).catch(()=>{});\\n";
     jsConfig += "let isBgLight = true;\\n";
     jsConfig += "try {\\n";
     jsConfig += "  const hexStr = ('${splashBackgroundColor || '#ffffff'}').replace('#', '');\\n";
     jsConfig += "  const rColor = parseInt(hexStr.substr(0, 2), 16), gColor = parseInt(hexStr.substr(2, 2), 16), bColor = parseInt(hexStr.substr(4, 2), 16);\\n";
     jsConfig += "  const yiqVal = ((rColor*299)+(gColor*587)+(bColor*114))/1000;\\n";
     jsConfig += "  isBgLight = yiqVal >= 128;\\n";
     jsConfig += "} catch(e) {}\\n";
     jsConfig += "StatusBar.setStyle({ style: isBgLight ? Style.Light : Style.Dark }).catch(()=>{});\\n";
  }
  if (${doubleTapToExit}) {
     jsConfig += "import { App } from '@capacitor/app';\\n";
     jsConfig += "import { Toast } from '@capacitor/toast';\\n";
     jsConfig += "let lastBack = 0;\\n";
     jsConfig += "App.addListener('backButton', ({ canGoBack }) => {\\n";
     jsConfig += "  if (canGoBack) { window.history.back(); } else {\\n";
     jsConfig += "    const now = Date.now();\\n";
     jsConfig += "    if (now - lastBack < 2000) { App.exitApp(); } else {\\n";
     jsConfig += "      lastBack = now;\\n";
     jsConfig += "      Toast.show({ text: 'Press back again to exit' });\\n";
     jsConfig += "    }\\n";
     jsConfig += "  }\\n";
     jsConfig += "}).catch(()=>{});\\n";
  }
  if (jsConfig) {
     const scriptInject = "\\n<script type=\\\"module\\\">\\n" + jsConfig + "</script>\\n";
     content = content.replace('</body>', scriptInject + '</body>');
  }

  fs.writeFileSync(indexPath, content);
}
EOF
node patch_html.cjs`
          ]
        },
        {
          id: 'vite-build',
          name: builderImage,
          dir: 'workspace',
          entrypoint: 'npm',
          args: ['run', 'build']
        },
        {
          id: 'clean-service-workers',
          name: 'ubuntu',
          dir: 'workspace',
          entrypoint: 'bash',
          args: [
            '-c',
            `rm -f dist/sw.js dist/service-worker.js dist/workbox-*.js || true
if find dist -maxdepth 1 \\( -name "sw.js" -o -name "service-worker.js" -o -name "workbox-*.js" \\) | grep -q .; then
  echo "❌ Service Worker files detected — fix app config"
  exit 1
fi`
          ]
        },
        {
          id: 'capacitor-init',
          name: builderImage,
          dir: 'workspace',
          env: [
            'GRADLE_USER_HOME=/workspace/.gradle_home'
          ],
          entrypoint: 'bash',
          args: [
            '-c',
            `set -ex
             npm install @capacitor/core@7 @capacitor/cli@7 @capacitor/android@7 || true
             rm -rf android
             rm -f capacitor.config.*
             npx cap init "${safeAppName}" "${safePackageName}" --web-dir dist
             npx cap add android || npx cap sync android
             
             # Update Version Code and Version Name
             if [ -f android/app/build.gradle ]; then
               sed -i -e 's/versionCode 1/versionCode ${safeVersionCode}/g' android/app/build.gradle
               sed -i -e 's/versionName "1.0"/versionName "${safeVersionName}"/g' android/app/build.gradle
             fi`
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

  // Add tools namespace if missing
  if (!content.includes('xmlns:tools')) {
    content = content.replace('<manifest', '<manifest xmlns:tools=\"http://schemas.android.com/tools\"');
  }

  function setAttribute(tag, attr, value) {
    const tagRegex = new RegExp('<' + tag + '[^>]*>', 'g');
    const attrRegex = new RegExp(attr + '="[^"]*"');
    content = content.replace(tagRegex, (match) => {
      let newMatch = match;
      if (attrRegex.test(newMatch)) {
        newMatch = newMatch.replace(attrRegex, \`\${attr}="\${value}"\`);
      } else {
        newMatch = newMatch.replace('<' + tag, \`<\${tag} \${attr}="\${value}"\`);
      }
      
      // ONLY add tools:replace to application tag if we're setting android:theme
      if (tag === 'application' && attr === 'android:theme' && !newMatch.includes('tools:replace')) {
        newMatch = newMatch.replace('<application', '<application tools:replace="android:theme"');
      }
      return newMatch;
    });
  }

  if (orientation !== 'default') {
    setAttribute('activity', 'android:screenOrientation', orientation);
  }
  
  // Remove the fullscreen theme injection here since it bypasses splash screen. We will handle it in fix_styles.cjs
  if (allowCleartext) {
    setAttribute('application', 'android:usesCleartextTraffic', 'true');
  }
  fs.writeFileSync(manifestPath, content);
}
EOF
node modify_manifest.cjs "${orientation}" "${fullscreen}" "${allowCleartext}"

cat << 'EOF' > fix_styles.cjs
const fs = require('fs');
const path = require('path');

const stylesPath = path.join('android', 'app', 'src', 'main', 'res', 'values', 'styles.xml');
const nightStylesPath = path.join('android', 'app', 'src', 'main', 'res', 'values-night', 'styles.xml');

const bgColor = process.argv[2] || '#ffffff';
const isFullscreen = process.argv[3] === 'true';


function updateStyles(file) {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix Splash Screen Background
  if (content.includes('name="AppTheme.NoActionBarLaunch"')) {
      const splashInjection = "\n" +
'        <item name="android:windowLayoutInDisplayCutoutMode">never</item>\n' +
'        <item name="android:windowFullscreen">false</item>\n' +
'        <item name="windowSplashScreenBackground">' + bgColor + '</item>\n' +
'        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_round</item>\n      ';

      content = content.replace(/(<style name="AppTheme\.NoActionBarLaunch"[^>]*>[\s\S]*?)(<\/style>)/, (match, p1, p2) => {
          if (!p1.includes('windowSplashScreenBackground')) {
              p1 = p1 + splashInjection;
          }
          return p1 + p2;
      });
  }

  // Opt out of edge-to-edge globally for all themes
  ['AppTheme', 'AppTheme.NoActionBarLaunch', 'AppTheme.NoActionBar'].forEach(theme => {
      const regexStr = '(<style name="' + theme + '"[^>]*>[\\\\s\\\\S]*?)(<\\\\/style>)';
      const regex = new RegExp(regexStr);
      content = content.replace(regex, (match, p1, p2) => {
          if (!p1.includes('android:windowOptOutEdgeToEdgeEnforcement')) {
              p1 = p1 + '\\n        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>\\n      ';
          }
          return p1 + p2;
      });
  });

  // Handle Fullscreen UI
  if (isFullscreen) {
      if (content.includes('name="AppTheme.NoActionBar"')) {
          const fullscreenInjection = '\\n        <item name="android:windowFullscreen">true</item>\\n      ';
          content = content.replace(/(<style name="AppTheme\\.NoActionBar"[^>]*>[\\s\\S]*?)(<\\/style>)/, (match, p1, p2) => {
              if (!p1.includes('android:windowFullscreen')) {
                  p1 = p1 + fullscreenInjection;
              }
              return p1 + p2;
          });
      }
  } else {
      let isDarkColor = false;
      try {
          var hex = bgColor.replace('#', '');
          if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
          var r = parseInt(hex.substr(0, 2), 16), g = parseInt(hex.substr(2, 2), 16), b = parseInt(hex.substr(4, 2), 16);
          var yiq = ((r*299)+(g*587)+(b*114))/1000;
          isDarkColor = (yiq < 128);
      } catch(e) {}
      
      const statusBarInject = '\\n        <item name="android:statusBarColor">' + bgColor + '</item>\\n        <item name="android:windowLightStatusBar">' + (!isDarkColor) + '</item>\\n        <item name="android:navigationBarColor">' + bgColor + '</item>\\n        <item name="android:windowLightNavigationBar">' + (!isDarkColor) + '</item>\\n      ';

      content = content.replace(/(<style name="AppTheme\\.NoActionBarLaunch"[^>]*>[\\s\\S]*?)(<\\/style>)/, (match, p1, p2) => {
          if (!p1.includes('android:statusBarColor')) {
              p1 = p1 + statusBarInject;
          }
          return p1 + p2;
      });
      content = content.replace(/(<style name="AppTheme\\.NoActionBar"[^>]*>[\\s\\S]*?)(<\\/style>)/, (match, p1, p2) => {
          if (!p1.includes('android:statusBarColor')) {
              p1 = p1 + statusBarInject;
          }
          return p1 + p2;
      });
  }

  fs.writeFileSync(file, content);
}

const resDir = path.join('android', 'app', 'src', 'main', 'res');
if (fs.existsSync(resDir)) {
    const dirs = fs.readdirSync(resDir);
    dirs.forEach(d => {
        if (d.startsWith('values')) {
            const file = path.join(resDir, d, 'styles.xml');
            updateStyles(file);
        }
    });
}

EOF
node fix_styles.cjs "${splashBackgroundColor || "#ffffff"}" "${fullscreen}"
`
        ]
      });

      // Plugins and Sync
      buildSteps.push({
        id: 'plugin-sync',
        name: builderImage,
        dir: 'workspace',
        entrypoint: 'bash',
        args: [
          '-c',
          `npx cap sync android`
        ]
      });

      // Assets (Icon & Splash)
      let iconFileDetails = null;
      if (rawBase64Icon) {
        iconFileDetails = bucket.file(`builds/${projectId}/icon.png`);
      } else {
        const iFile = bucket.file(`builds/${projectId}/icon.png`);
        const [exists] = await iFile.exists();
        if (exists) iconFileDetails = iFile;
      }
      
      if (iconFileDetails) {
        buildSteps.push({
          id: 'fetch-icon-asset',
          name: 'gcr.io/cloud-builders/gsutil',
          dir: 'workspace',
          entrypoint: 'bash',
          args: [
            '-c',
            `mkdir -p assets && gsutil cp "gs://${storageBucketName}/builds/${projectId}/icon.png" assets/icon.png && mkdir -p dist && cp assets/icon.png dist/icon.png`
          ]
        });

        buildSteps.push({
          id: 'asset-generation',
          name: builderImage,
          dir: 'workspace',
          entrypoint: 'bash',
          args: [
            '-c',
            `npm install @capacitor/assets@latest --save-dev
             npx @capacitor/assets generate --iconBackgroundColor '#ffffff' --splashBackgroundColor '${splashBackgroundColor || '#ffffff'}' --android
             echo "Assets generated"`
          ]
        });
      }

      // Notification Icon
      let nIconExt = 'png';
      let nIconFileDetails = null;
      if (rawBase64NotificationIcon) {
         const nBuffer = Buffer.from(rawBase64NotificationIcon, 'base64');
         nIconExt = nBuffer[0] === 60 ? 'xml' : 'png';
         nIconFileDetails = bucket.file(`builds/${projectId}/notification-icon.${nIconExt}`);
      } else {
         const nFilePng = bucket.file(`builds/${projectId}/notification-icon.png`);
         const [existsPng] = await nFilePng.exists();
         if (existsPng) {
             nIconFileDetails = nFilePng;
             nIconExt = 'png';
         } else {
             const nFileXml = bucket.file(`builds/${projectId}/notification-icon.xml`);
             const [existsXml] = await nFileXml.exists();
             if (existsXml) {
                 nIconFileDetails = nFileXml;
                 nIconExt = 'xml';
             }
         }
      }
      
      if (nIconFileDetails) {
        let copyScript = `mkdir -p android/app/src/main/res/drawable && gsutil cp "gs://${storageBucketName}/builds/${projectId}/notification-icon.${nIconExt}" android/app/src/main/res/drawable/ic_stat_notification.${nIconExt}`;
        if (nIconExt === 'png') {
           copyScript += `\n             for folder in drawable-mdpi drawable-hdpi drawable-xhdpi drawable-xxhdpi drawable-xxxhdpi; do
                mkdir -p android/app/src/main/res/$folder
                cp android/app/src/main/res/drawable/ic_stat_notification.png android/app/src/main/res/$folder/ic_stat_notification.png
             done`;
        }

        buildSteps.push({
          id: 'fetch-notification-asset',
          name: 'gcr.io/cloud-builders/gsutil',
          dir: 'workspace',
          entrypoint: 'bash',
          args: [
            '-c',
            copyScript
          ]
        });

        buildSteps.push({
          id: 'notification-icon-generation',
          name: builderImage,
          dir: 'workspace',
          entrypoint: 'bash',
          args: [
            '-c',
            `# Configure AndroidManifest.xml for Firebase Push Notifications to use the icon
             cat << 'EOF' > modify_notif_icon.cjs
const fs = require('fs');
let c = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
const metaData = '        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_notification" />\\n' +
                 '        <meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@android:color/black" />\\n' +
                 '        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="primary_notifications_v4" />';
                 
if (c.includes('com.google.firebase.messaging.default_notification_icon')) {
   c = c.replace(/<meta-data[^>]*android:name="com\\.google\\.firebase\\.messaging\\.default_notification_icon"[^>]*\\/?>/g, ''); // wipe old if any
   c = c.replace(/<meta-data[^>]*android:name="com\\.google\\.firebase\\.messaging\\.default_notification_color"[^>]*\\/?>/g, ''); 
   c = c.replace(/<meta-data[^>]*android:name="com\\.google\\.firebase\\.messaging\\.default_notification_channel_id"[^>]*\\/?>/g, ''); 
}
c = c.replace('</application>', metaData + '\\n    </application>');
fs.writeFileSync('android/app/src/main/AndroidManifest.xml', c);
EOF
             node modify_notif_icon.cjs`
          ]
        });
      }

      // Google Services
      let gsFileDetails = null;
      if (rawBase64GoogleServices) {
         gsFileDetails = bucket.file(`builds/${projectId}/google-services.json`);
      } else {
         const gFile = bucket.file(`builds/${projectId}/google-services.json`);
         const [exists] = await gFile.exists();
         if (exists) gsFileDetails = gFile;
      }
      
      if (gsFileDetails) {
        buildSteps.push({
          id: 'fetch-google-services',
          name: 'gcr.io/cloud-builders/gsutil',
          dir: 'workspace',
          entrypoint: 'bash',
          args: [
            '-c',
            `mkdir -p android/app && gsutil cp "gs://${storageBucketName}/builds/${projectId}/google-services.json" android/app/google-services.json`
          ]
        });
      }

      // Permissions and Features
      if (permissions && permissions.length > 0) {
        let permissionsXml = '';
        for (const p of permissions) {
          if (p === 'INTERNET') continue;
          permissionsXml += `    <uses-permission android:name="android.permission.${p}" />\n`;
          if (p === 'CAMERA') {
            permissionsXml += '    <uses-feature android:name="android.hardware.camera" android:required="false" />\n';
            permissionsXml += '    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />\n';
          } else if (p === 'ACCESS_FINE_LOCATION') {
            permissionsXml += '    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n';
            permissionsXml += '    <uses-feature android:name="android.hardware.location.gps" android:required="false" />\n';
          } else if (p === 'RECORD_AUDIO') {
            permissionsXml += '    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />\n';
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
content = content.replace('<application', permissionsXml + '    <application');
fs.writeFileSync(manifestPath, content);
EOF
node insert_permissions.cjs`
          ]
        });
      }






      // Final Gradle Setup and APK Build
      
            const buildStepsToPush = [
      {
        id: 'fetch-gradle-config',
        name: 'gcr.io/cloud-builders/gsutil',
        dir: 'workspace',
        entrypoint: 'bash',
        args: [
          '-c',
          `gsutil cp gs://${storageBucketName}/builds/${projectId}/configure_build.cjs configure_build.cjs || echo "No configure build script"`
        ]
      },
      {
        id: 'gradle-config',
        name: builderImage,
        dir: 'workspace',
        entrypoint: 'bash',
        args: [
          '-c',
          `node configure_build.cjs "${splashBackgroundColor || '#ffffff'}" "${nIconFileDetails ? 'true' : 'false'}" "${splashIconSize || '50'}" "${splashAnimation || 'fade'}" "${fullscreen ? 'true' : 'false'}" "${doubleTapToExit ? 'true' : 'false'}" "${askNotificationsOnLaunch ? 'true' : 'false'}"
npx cap sync android`
        ]
      }];
      buildSteps.push(...buildStepsToPush);


      buildSteps.push({
        id: 'apk-compilation',
        name: builderImage,
        dir: 'workspace/android',
        env: [
          'GRADLE_USER_HOME=/workspace/.gradle_home'
        ],
        entrypoint: 'bash',
        args: ['-c', './gradlew clean assembleDebug --no-daemon --stacktrace']
      });

      buildSteps.push({
        id: 'save-cache',
        name: 'gcr.io/cloud-builders/gsutil',
        dir: 'workspace',
        entrypoint: 'bash',
        args: [
          '-c',
          `tar -czf cache.tar.gz node_modules .gradle_home .npm_cache && gsutil cp cache.tar.gz ${cachePath} || echo "Failed to save cache"`
        ],
        allowFailure: true
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

  app.post("/api/build/:buildId/cancel", async (req, res) => {
    try {
      const buildId = req.params.buildId;
      const { projectId } = req.body;
      
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
        id: buildId
      });

      res.json({ success: true, status: 'CANCELLED' });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Failed to cancel build" });
    }
  });

  app.get("/api/icon/:projectId", async (req, res) => {
    try {
      let authOptions: any = {};
      if (process.env.GCP_CREDENTIALS_JSON) {
         try {
           authOptions.credentials = JSON.parse(process.env.GCP_CREDENTIALS_JSON);
         } catch (e) { }
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
         authOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }
      
      const { Storage } = await import('@google-cloud/storage');
      const storage = new Storage(authOptions);
      let gcpProjectId = process.env.GCP_PROJECT_ID;
      if (!gcpProjectId) {
         const cb = new CloudBuildClient(authOptions);
         gcpProjectId = await cb.getProjectId();
      }
      
      const bucketName = process.env.GCP_STORAGE_BUCKET || `${gcpProjectId}-apk-builds`;
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(`builds/${req.params.projectId}/icon.png`);
      
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).send('Not found');
      }
      
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      file.createReadStream().on('error', (err) => {
        if (!res.headersSent) res.status(500).send("Error streaming icon");
      }).pipe(res);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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
      const appName = req.query.appName as string;

      const buildId = req.params.buildId;
      const [build] = await cb.getBuild({
        projectId: gcpProjectId,
        id: buildId
      });

      let downloadUrl = null;
      if (build.status === 'SUCCESS' && projectId) {
        const bucket = storage.bucket(storageBucketName);
        const apkFile = bucket.file(`builds/${projectId}/app-debug.apk`);
        const safeAppName = appName ? appName.replace(/[^a-zA-Z0-9-]/g, '_') : 'app-debug';
        const filename = `${safeAppName}.apk`;
        const [url] = await apkFile.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000, // 1 hour
          responseDisposition: `attachment; filename="${filename}"`
        });
        downloadUrl = url;
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

      const [metadata] = await file.getMetadata();
      const size = parseInt(metadata.size as string || "0");
      
      // Only fetch the last 64KB to save bandwidth (especially on mobile)
      const LIMIT = 65536; 
      const start = Math.max(0, size - LIMIT);
      
      const [contents] = await file.download({ start });
      let logText = contents.toString("utf-8");
      
      if (start > 0) {
        logText = `... (logs truncated, showing last ${Math.round(LIMIT/1024)}KB) ...\n` + logText;
      }
      
      res.send(logText);
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

  app.get("/api/logs/:buildId/download", async (req, res) => {
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
        return res.status(404).json({ error: "Log file not found yet." });
      }

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000, // 15 mins
        responseDisposition: `attachment; filename="build-log-${req.params.buildId}.txt"`
      });

      res.json({ url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
