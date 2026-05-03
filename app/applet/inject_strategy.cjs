const fs = require('fs');

let c = fs.readFileSync('server.ts', 'utf8');

const forceStrategy = `
   if (!c.includes('resolutionStrategy')) {
      c += "\\nallprojects {\\n    configurations.all {\\n        resolutionStrategy {\\n            force 'androidx.core:core:1.15.0'\\n            force 'androidx.core:core-ktx:1.15.0'\\n        }\\n    }\\n}\\n";
   }
`;

c = c.replace(/fs\.writeFileSync\(projGradle, c\);/, `${forceStrategy}   fs.writeFileSync(projGradle, c);`);

fs.writeFileSync('server.ts', c);
