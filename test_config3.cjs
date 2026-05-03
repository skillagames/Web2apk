const fs = require('fs');

let finalPackageName = "${safePackageName}";
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
   c = c.replace(/minSdkVersion\s*=?\s*\d+/g, 'minSdkVersion = 24');
   c = c.replace(/compileSdkVersion\s*=?\s*\d+/g, 'compileSdkVersion = 36');
   c = c.replace(/targetSdkVersion\s*=?\s*\d+/g, 'targetSdkVersion = 36');
   c = c.replace(/compileSdk\s*=?\s*\d+/g, 'compileSdk = 36');
   c = c.replace(/targetSdk\s*=?\s*\d+/g, 'targetSdk = 36');
   
   // Handle the case where they might be defined without the 'ext' prefix inside ext block
   if (c.includes('ext {')) {
      if (!c.includes('androidxCoreVersion')) {
         c = c.replace('ext {', 'ext {' + String.fromCharCode(10) + "    androidxCoreVersion = '1.12.0'");
      } else {
         c = c.replace(/androidxCoreVersion\s*=?\s*['"][^'"]+['"]/g, "androidxCoreVersion = '1.12.0'");
      }
      if (!c.includes('androidxCoreKtxVersion')) {
         c = c.replace('ext {', 'ext {' + String.fromCharCode(10) + "    androidxCoreKtxVersion = '1.12.0'");
      } else {
         c = c.replace(/androidxCoreKtxVersion\s*=?\s*['"][^'"]+['"]/g, "androidxCoreKtxVersion = '1.12.0'");
      }
   }
   fs.writeFileSync(varFile, c);
} else {
   console.warn('variables.gradle not found');
}

const projGradle = 'android/build.gradle';
if (fs.existsSync(projGradle)) {
   console.log('Modifying build.gradle');
   let c = fs.readFileSync(projGradle, 'utf8');
   // Use AGP 8.9.1 - more flexible regex
   c = c.replace(/classpath\s*\(?['"]com\.android\.tools\.build:gradle:[\d\.]+['"]\)?/, "classpath 'com.android.tools.build:gradle:8.9.1'");
   c = c.replace(/id\s*\(?['"]com\.android\.application['"]\)?\s*version\s*['"][\d\.]+['"]/, 'id "com.android.application" version "8.9.1"');
   
   if (fs.existsSync('android/app/google-services.json')) {
      console.log('Adding google-services classpath');
      if (!c.includes('com.google.gms:google-services')) {
         c = c.replace(/dependencies\s*{/, 'dependencies {' + String.fromCharCode(10) + '        classpath "com.google.gms:google-services:4.4.1"');
      }
   }
   // Hard force resolution strategy at project level - put it at the very end
   if (!c.includes('resolutionStrategy')) {
      c += String.fromCharCode(10) + 'allprojects {' + String.fromCharCode(10) + '    configurations.all {' + String.fromCharCode(10) + '        resolutionStrategy {' + String.fromCharCode(10) + "            force 'androidx.core:core:1.12.0'" + String.fromCharCode(10) + "            force 'androidx.core:core-ktx:1.12.0'" + String.fromCharCode(10) + '        }' + String.fromCharCode(10) + '    }' + String.fromCharCode(10) + '}' + String.fromCharCode(10);
   }
   fs.writeFileSync(projGradle, c);
} else {
   console.warn('build.gradle not found');
}

const appGradle = 'android/app/build.gradle';
if (fs.existsSync(appGradle)) {
   console.log('Modifying app/build.gradle');
   let c = fs.readFileSync(appGradle, 'utf8');
   // Even more aggressive replacement for compileSdk
   c = c.replace(/compileSdk\s*\(?\s*\d+\s*\)?/g, 'compileSdk 36');
   c = c.replace(/targetSdk\s*\(?\s*\d+\s*\)?/g, 'targetSdk 36');
   c = c.replace(/compileSdkVersion\s*\(?\s*\d+\s*\)?/g, 'compileSdkVersion 36');
   c = c.replace(/targetSdkVersion\s*\(?\s*\d+\s*\)?/g, 'targetSdkVersion 36');
   c = c.replace(/compileSdk\s*=\s*\d+/g, 'compileSdk = 36');
   c = c.replace(/targetSdk\s*=\s*\d+/g, 'targetSdk = 36');

   if (fs.existsSync('android/app/google-services.json')) {
      if (!c.includes('com.google.gms.google-services')) {
         c += String.fromCharCode(10) + "apply plugin: 'com.google.gms.google-services'" + String.fromCharCode(10);
      }
   }
   c = c.replace(/applicationId\s+"[^"]+"/, 'applicationId "' + finalPackageName + '"');
   if (c.includes('namespace ')) {
      c = c.replace(/namespace\s+"[^"]+"/, 'namespace "' + finalPackageName + '"');
   }
   
   // Add to dependencies directly as a fallback
   if (!c.includes('implementation "androidx.core:core-ktx:1.12.0"')) {
      c = c.replace(/dependencies\s*\{/, 'dependencies {' + String.fromCharCode(10) + '    implementation "androidx.core:core-ktx:1.12.0"');
   }

   // Also force it globally outside android block if we missed it
   if (!c.includes("force 'androidx.core:core:1.12.0'")) {
      c += String.fromCharCode(10) + 'configurations.all {' + String.fromCharCode(10) + '    resolutionStrategy {' + String.fromCharCode(10) + "        force 'androidx.core:core:1.12.0'" + String.fromCharCode(10) + "        force 'androidx.core:core-ktx:1.12.0'" + String.fromCharCode(10) + '    }' + String.fromCharCode(10) + '}' + String.fromCharCode(10);
   }
   
   fs.writeFileSync(appGradle, c);
}

const tomlFile = 'android/gradle/libs.versions.toml';
if (fs.existsSync(tomlFile)) {
   console.log('Modifying libs.versions.toml');
   let c = fs.readFileSync(tomlFile, 'utf8');
   c = c.replace(/compileSdk\s*=\s*["']?\d+["']?/g, 'compileSdk = "36"');
   c = c.replace(/targetSdk\s*=\s*["']?\d+["']?/g, 'targetSdk = "36"');
   c = c.replace(/agp\s*=\s*['"][\d\.]+['"]/g, 'agp = "8.9.1"');
   // Core versions in TOML - handle various name styles
   c = c.replace(/coreKtx\s*=\s*['"][\d\.]+['"]/g, 'coreKtx = "1.12.0"');
   c = c.replace(/androidxCore\s*=\s*['"][\d\.]+['"]/g, 'androidxCore = "1.12.0"');
   c = c.replace(/androidx-core\s*=\s*['"][\d\.]+['"]/g, 'androidx-core = "1.12.0"');
   fs.writeFileSync(tomlFile, c);
}

const gradleWrapper = 'android/gradle/wrapper/gradle-wrapper.properties';
if (fs.existsSync(gradleWrapper)) {
   console.log('Modifying gradle-wrapper.properties');
   let c = fs.readFileSync(gradleWrapper, 'utf8');
   c = c.replace(/gradle-[\d\.]+-(all|bin)\.zip/, 'gradle-8.12-all.zip');
   fs.writeFileSync(gradleWrapper, c);
}

// Handle capacitor.config.json or .ts
const configJsonPath = 'capacitor.config.json';
const configTsPath = 'capacitor.config.ts';
let config = {};

if (fs.existsSync(configJsonPath)) {
  config = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
} else if (fs.existsSync(configTsPath)) {
  // If .ts exists, we'll delete it and switch to .json for easier manipulation
  fs.unlinkSync(configTsPath);
}

config.appId = finalPackageName;
config.appName = "${appName}";
config.webDir = config.webDir || 'dist';

config.plugins = config.plugins || {};
config.plugins.SplashScreen = {
  launchShowDuration: 3000,
  launchAutoHide: true,
  backgroundColor: process.argv[2] || '#ffffff',
  splashIconSize: parseInt(process.argv[4]) || 50,
  splashAnimation: process.argv[5] || 'fade',
  androidScaleType: 'CENTER_CROP',
  showSpinner: false,
  splashFullScreen: true,
  splashImmersive: true
};

if (process.argv[3] === 'true') {
   config.plugins.PushNotifications = config.plugins.PushNotifications || {};
   config.plugins.PushNotifications.presentationOptions = ['badge', 'sound', 'alert'];
   config.plugins.LocalNotifications = config.plugins.LocalNotifications || {};
   config.plugins.LocalNotifications.smallIcon = 'ic_stat_name';
} else {
   config.plugins.LocalNotifications = config.plugins.LocalNotifications || {};
   config.plugins.LocalNotifications.smallIcon = 'ic_launcher';
}

fs.writeFileSync(configJsonPath, JSON.stringify(config, null, 2));