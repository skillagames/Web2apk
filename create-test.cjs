const fs = require('fs');

let c = `
ext {
    minSdkVersion = 22
    compileSdkVersion = 33
    targetSdkVersion = 33
    androidxActivityVersion = '1.8.0'
    androidxAppCompatVersion = '1.6.1'
    androidxCoordinatorLayoutVersion = '1.2.0'
    androidxCoreVersion = '1.10.1'
    androidxFragmentVersion = '1.6.2'
    coreSplashScreenVersion = '1.0.1'
    androidxWebkitVersion = '1.9.0'
    junitVersion = '4.13.2'
    androidxJunitVersion = '1.1.5'
    androidxEspressoCoreVersion = '3.5.1'
    cordovaAndroidVersion = '10.1.1'
}
`

if (c.includes('ext {')) {
   if (!c.includes('androidxCoreVersion')) {
      c = c.replace('ext {', "ext {\n    androidxCoreVersion = '1.12.0'");
   } else {
      c = c.replace(/androidxCoreVersion\s*=?\s*['"][^'"]+['"]/g, "androidxCoreVersion = '1.12.0'");
   }
   if (!c.includes('androidxCoreKtxVersion')) {
      c = c.replace('ext {', "ext {\n    androidxCoreKtxVersion = '1.12.0'");
   } else {
      c = c.replace(/androidxCoreKtxVersion\s*=?\s*['"][^'"]+['"]/g, "androidxCoreKtxVersion = '1.12.0'");
   }
}

console.log(c);
