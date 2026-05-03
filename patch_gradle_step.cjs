const fs = require('fs');

const rawScriptBody = String.raw`const fs = require('fs');
const path = require('path');

let finalPackageName = "\${safePackageName}";
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
   c = c.replace(/minSdkVersion\\s*=?\\s*\\d+/g, 'minSdkVersion = 24');
   c = c.replace(/compileSdkVersion\\s*=?\\s*\\d+/g, 'compileSdkVersion = 35');
   c = c.replace(/targetSdkVersion\\s*=?\\s*\\d+/g, 'targetSdkVersion = 35');
   c = c.replace(/compileSdk\\s*=?\\s*\\d+/g, 'compileSdk = 35');
   c = c.replace(/targetSdk\\s*=?\\s*\\d+/g, 'targetSdk = 35');
   c = c.replace(/androidxCoreVersion\\s*=?\\s*['"][\\d\\.]+['"]/g, "androidxCoreVersion = '1.15.0'");
   c = c.replace(/androidxCoreKtxVersion\\s*=?\\s*['"][\\d\\.]+['"]/g, "androidxCoreKtxVersion = '1.15.0'");
   
   fs.writeFileSync(varFile, c);
} else {
   console.warn('variables.gradle not found');
}

const projGradle = 'android/build.gradle';
if (fs.existsSync(projGradle)) {
   console.log('Modifying build.gradle');
   let c = fs.readFileSync(projGradle, 'utf8');
   c = c.replace(/classpath\\s*\\(?['"]com\\.android\\.tools\\.build:gradle:[\\d\\.]+['"]\\)?/, "classpath 'com.android.tools.build:gradle:8.7.2'");
   c = c.replace(/id\\s*\\(?['"]com\\.android\\.application['"]\\)?\\s*version\\s*['"][\\d\\.]+['"]/, 'id "com.android.application" version "8.7.2"');
   
   if (fs.existsSync('android/app/google-services.json')) {
      console.log('Adding google-services classpath');
      if (!c.includes('com.google.gms:google-services')) {
         c = c.replace(/dependencies\\s*{/, 'dependencies {' + String.fromCharCode(10) + '        classpath "com.google.gms:google-services:4.4.1"');
      }
   }
   if (!c.includes('resolutionStrategy')) {
      c += "\\nallprojects {\\n    configurations.all {\\n        resolutionStrategy {\\n            force 'androidx.core:core:1.15.0'\\n            force 'androidx.core:core-ktx:1.15.0'\\n        }\\n    }\\n}\\n";
   }
   fs.writeFileSync(projGradle, c);
} else {
   console.warn('build.gradle not found');
}

const appGradle = 'android/app/build.gradle';
if (fs.existsSync(appGradle)) {
   console.log('Modifying app/build.gradle');
   let c = fs.readFileSync(appGradle, 'utf8');
   c = c.replace(/compileSdk\\s*\\(?\\s*\\d+\\s*\\)?/g, 'compileSdk 35');
   c = c.replace(/targetSdk\\s*\\(?\\s*\\d+\\s*\\)?/g, 'targetSdk 35');
   c = c.replace(/compileSdkVersion\\s*\\(?\\s*\\d+\\s*\\)?/g, 'compileSdkVersion 35');
   c = c.replace(/targetSdkVersion\\s*\\(?\\s*\\d+\\s*\\)?/g, 'targetSdkVersion 35');
   c = c.replace(/compileSdk\\s*=\\s*\\d+/g, 'compileSdk = 35');
   c = c.replace(/targetSdk\\s*=\\s*\\d+/g, 'targetSdk = 35');

   if (fs.existsSync('android/app/google-services.json')) {
      if (!c.includes('com.google.gms.google-services')) {
         c += String.fromCharCode(10) + "apply plugin: 'com.google.gms.google-services'" + String.fromCharCode(10);
      }
   }
   c = c.replace(/applicationId\\s+"[^"]+"/, 'applicationId "' + finalPackageName + '"');
   if (c.includes('namespace ')) {
      c = c.replace(/namespace\\s+"[^"]+"/, 'namespace "' + finalPackageName + '"');
   }
   
   fs.writeFileSync(appGradle, c);
}

const tomlFile = 'android/gradle/libs.versions.toml';
if (fs.existsSync(tomlFile)) {
   console.log('Modifying libs.versions.toml');
   let c = fs.readFileSync(tomlFile, 'utf8');
   c = c.replace(/compileSdk\\s*=\\s*["']?\\d+["']?/g, 'compileSdk = "35"');
   c = c.replace(/targetSdk\\s*=\\s*["']?\\d+["']?/g, 'targetSdk = "35"');
   c = c.replace(/agp\\s*=\\s*['"][\\d\\.]+['"]/g, 'agp = "8.7.2"');
   c = c.replace(/coreKtx\\s*=\\s*['"][\\d\\.]+['"]/g, 'coreKtx = "1.15.0"');
   c = c.replace(/androidxCore\\s*=\\s*['"][\\d\\.]+['"]/g, 'androidxCore = "1.15.0"');
   c = c.replace(/androidx-core\\s*=\\s*['"][\\d\\.]+['"]/g, 'androidx-core = "1.15.0"');
   c = c.replace(/core\\s*=\\s*['"][\\d\\.]+['"]/g, 'core = "1.15.0"');
   fs.writeFileSync(tomlFile, c);
}

const gradleWrapper = 'android/gradle/wrapper/gradle-wrapper.properties';
if (fs.existsSync(gradleWrapper)) {
   console.log('Modifying gradle-wrapper.properties');
   let c = fs.readFileSync(gradleWrapper, 'utf8');
   c = c.replace(/gradle-[\\d\\.]+-(all|bin)\\.zip/, 'gradle-8.10.2-all.zip');
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
config.appName = "\${appName}";
config.webDir = config.webDir || 'dist';

config.plugins = config.plugins || {};
config.plugins.SplashScreen = {
  launchShowDuration: 3000,
  launchAutoHide: true,
  backgroundColor: process.argv[2] || '#ffffff',
  androidSplashResourceName: "splash",
  splashIconSize: parseInt(process.argv[4]) || 50,
  splashAnimation: process.argv[5] || 'fade',
  androidScaleType: 'CENTER_CROP',
  showSpinner: false
};

if (process.argv[6] === 'true') {
   const blendColor = process.argv[2] || '#ffffff';
   // Auto-calculate whether the color is light or dark
   // ...
   config.plugins.StatusBar = {
      backgroundColor: blendColor,
      style: blendColor.toUpperCase() === '#FFFFFF' ? 'DARK' : 'LIGHT',
      overlaysWebView: false
   };
}

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

    if (process.argv[7] === 'true') {
        if (!javaCode.includes('import android.widget.Toast;')) {
            javaCode = javaCode.replace(/(import [^;]+;)/, '$1\\nimport android.widget.Toast;');
        }
        if (!javaCode.includes('public void onBackPressed()')) {
            const backPressedLogic = \`
    private long lastBack = 0;

    @Override
    public void onBackPressed() {
        if (bridge != null && bridge.getWebView() != null && bridge.getWebView().canGoBack()) {
            bridge.getWebView().goBack();
        } else {
            if (System.currentTimeMillis() - lastBack < 2000) {
                super.onBackPressed();
            } else {
                lastBack = System.currentTimeMillis();
                Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show();
            }
        }
    }
\`;
            javaCode = javaCode.replace(/}\\s*$/, backPressedLogic + '}\\n');
        }
    }

    let needsOnCreate = process.argv[8] === 'true' || process.argv[3] === 'true';
    if (needsOnCreate) {
        if (!javaCode.includes('import android.os.Build;')) {
             javaCode = javaCode.replace(/(import [^;]+;)/, '$1\\nimport android.os.Build;\\nimport android.os.Bundle;\\nimport androidx.core.content.ContextCompat;\\nimport androidx.core.app.ActivityCompat;\\nimport android.app.NotificationChannel;\\nimport android.app.NotificationManager;\\nimport android.content.Context;');
        }
        if (!javaCode.includes('public void onCreate(')) {
             let onCreateLogic = \`
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
\`;
             if (process.argv[8] === 'true') {
                 onCreateLogic += \`
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 1);
            }
        }
\`;
             }
             if (process.argv[3] === 'true') {
                 onCreateLogic += \`
        if (Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel channel = new NotificationChannel("primary_notifications_v4", "Primary Notifications", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Main app notifications");
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
\`;
             }
             onCreateLogic += \`    }
\`;
             javaCode = javaCode.replace(/public class MainActivity extends BridgeActivity \\{/, 'public class MainActivity extends BridgeActivity {' + onCreateLogic);
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

let s = fs.readFileSync('server.ts', 'utf8');

const regexToReplace = /const rawConfigureScript = String\.raw`.*?\]\s*}\);/s;

s = s.replace(regexToReplace, `      const buildStepsToPush = [
      {
        id: 'fetch-gradle-config',
        name: 'gcr.io/cloud-builders/gsutil',
        dir: 'workspace',
        entrypoint: 'bash',
        args: [
          '-c',
          \`gsutil cp gs://\${storageBucketName}/builds/\${projectId}/configure_build.cjs configure_build.cjs || echo "No configure build script"\`
        ]
      },
      {
        id: 'gradle-config',
        name: builderImage,
        dir: 'workspace',
        entrypoint: 'bash',
        args: [
          '-c',
          \`node configure_build.cjs "\${splashBackgroundColor || '#ffffff'}" "\${nIconFileDetails ? 'true' : 'false'}" "\${splashIconSize || '50'}" "\${splashAnimation || 'fade'}" "\${fullscreen ? 'true' : 'false'}" "\${doubleTapToExit ? 'true' : 'false'}" "\${askNotificationsOnLaunch ? 'true' : 'false'}"
npx cap sync android\`
        ]
      }];
      buildSteps.push(...buildStepsToPush);
`);

// Now add the GCS upload logic
const gcsUploadLogic = `      // Upload configure_build.cjs to avoid argument length limits
      try {
         const configureScriptStr = \`${rawScriptBody.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
         const configScriptFile = bucket.file(\`builds/\${projectId}/configure_build.cjs\`);
         await configScriptFile.save(Buffer.from(configureScriptStr, "utf8"), {
             metadata: { contentType: 'application/javascript' }
         });
      } catch (err) {
         console.warn("Could not handle storage bucket operations for configure script.", err);
      }
`;

// Insert after bucket.file(...)
// Search for finalPackageName creation line
const insertMarker = "const safeAppName = appName.replace(/[^a-zA-Z0-9]/g, '_') || 'My_App';";

// First, make sure the string is only replaced once:
const insertArray = s.split(insertMarker);
if (insertArray.length === 2) {
   s = insertArray[0] + gcsUploadLogic + '\\n      ' + insertMarker + insertArray[1];
}

fs.writeFileSync('server.ts', s);
