const { execSync } = require('child_process');
try {
  execSync('rm -rf /tmp/dummy2 && mkdir /tmp/dummy2 && cd /tmp/dummy2 && npm init -y && npm i @capacitor/cli@7 @capacitor/core@7 @capacitor/android@7', { stdio: 'inherit' });
  execSync('cd /tmp/dummy2 && npx -y @capacitor/cli@7 init dummy com.dummy.app --web-dir www && mkdir -p www && echo "" > www/index.html && npx -y @capacitor/cli@7 add android', { stdio: 'inherit' });
  const fs = require('fs');
  console.log(fs.readFileSync('/tmp/dummy2/android/app/build.gradle', 'utf8').substring(0, 500));
} catch (e) { console.error(e.message); }
