const { execSync } = require('child_process');
execSync('mkdir -p dummy-web');
execSync('npx @capacitor/cli create dummy-app com.dummy.app dummy-app');
execSync('cd dummy-app && npm install @capacitor/android @capacitor/core && npx cap add android');
console.log(execSync('cat dummy-app/android/build.gradle').toString());
console.log('--- variables.gradle ---');
console.log(execSync('cat dummy-app/android/variables.gradle').toString());
console.log('--- app/build.gradle ---');
console.log(execSync('cat dummy-app/android/app/build.gradle').toString());
