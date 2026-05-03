const { execSync } = require('child_process');
execSync('rm -rf testapp && mkdir testapp');
execSync('cd testapp && npm init -y && npm install @capacitor/cli @capacitor/core @capacitor/android');
execSync('cd testapp && npx cap init "TestApp" "com.test.app" --web-dir dist');
execSync('cd testapp && mkdir dist && npx cap add android');
const fs = require('fs');
console.log(fs.readFileSync('testapp/android/app/src/main/java/com/test/app/MainActivity.java', 'utf8'));
