const fs = require('fs');
let c = fs.readFileSync('/server.ts', 'utf8');

c = c.replace(/c \+= String\.fromCharCode\(10\) \+ 'allprojects \{' \+ String\.fromCharCode\(10\)(.|\n)*?'\}' \+ String\.fromCharCode\(10\);/g, '');
c = c.replace(/c \+= String\.fromCharCode\(10\) \+ 'configurations\.all \{' \+ String\.fromCharCode\(10\)(.|\n)*?'\}' \+ String\.fromCharCode\(10\);/g, '');

c = c.replace(/if \(\!c\.includes\('resolutionStrategy'\)\) \{\s*\}/g, '');
c = c.replace(/if \(\!c\.includes\("force 'androidx\.core:core:1\.12\.0'"\)\) \{\s*\}/g, '');

fs.writeFileSync('/app/applet/server.ts', c);
