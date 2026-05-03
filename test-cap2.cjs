const { execSync } = require('child_process');
try {
  execSync('npm init -y && npm install @capacitor/cli @capacitor/core @capacitor/android && npx cap init dummy com.dummy.tmp && npx cap add android', { stdio: 'inherit' });
  console.log('Build gradle:', execSync('cat android/build.gradle').toString());
  console.log('Variables gradle:', execSync('cat android/variables.gradle').toString());
} catch(e) {}
