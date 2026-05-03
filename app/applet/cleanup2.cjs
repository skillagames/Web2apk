const fs = require('fs');
let c = fs.readFileSync('server.ts', 'utf8');

c = c.replace(/if \(\!c\.includes\('resolutionStrategy'\)\) \{[\s\S]*?fs\.writeFileSync\(projGradle, c\);/g, 'fs.writeFileSync(projGradle, c);');
c = c.replace(/if \(\!c\.includes\("force 'androidx\.core:core:1\.12\.0'"\)\) \{[\s\S]*?fs\.writeFileSync\(appGradle, c\);/g, 'fs.writeFileSync(appGradle, c);');

fs.writeFileSync('server.ts', c);
