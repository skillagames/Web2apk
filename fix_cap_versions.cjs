const fs = require('fs');
let c = fs.readFileSync('server.ts', 'utf8');

c = c.replace(/npm install @capacitor\/cli @capacitor\/core @capacitor\/android @capacitor\/camera @capacitor\/geolocation @capacitor\/voice-recorder @capacitor\/filesystem @capacitor\/local-notifications @capacitor\/assets/g, 'npm install @capacitor/cli@7 @capacitor/core@7 @capacitor/android@7 @capacitor/camera@7 @capacitor/geolocation@7 @capacitor/voice-recorder@7 @capacitor/filesystem@7 @capacitor/local-notifications@7 @capacitor/assets@latest');

c = c.replace(/npm install @capacitor\/core @capacitor\/cli @capacitor\/android/g, 'npm install @capacitor/core@7 @capacitor/cli@7 @capacitor/android@7');

c = c.replace(/npm install \$\{pluginsToInstall\.join\(' '\)\}/g, 'npm install ${pluginsToInstall.map(p => p + "@7").join(" ")}');

c = c.replace(/npm install @capacitor\/assets --save-dev/g, 'npm install @capacitor/assets --save-dev');

fs.writeFileSync('server.ts', c);
