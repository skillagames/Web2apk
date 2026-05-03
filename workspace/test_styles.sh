#!/bin/bash
cd $(mktemp -d)
npm init -y >/dev/null
npm install @capacitor/cli@7 @capacitor/core@7 @capacitor/android@7 >/dev/null
npx cap init test com.test.app --web-dir www >/dev/null
mkdir www
echo "1" > www/index.html
npx cap add android >/dev/null
cat android/app/src/main/res/values/styles.xml
