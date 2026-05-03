const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

const regexToRemove = /    if \(process\.argv\[7\] === 'true'\) \{\s*if \(\!javaCode\.includes\('import android\.widget\.Toast;'\)\) \{[\s\S]*?javaCode = javaCode\.replace\(\/\\}\\s\*\$\/, backPressedLogic \+ '\\}\\n'\);\s*\}\s*\}/s;

s = s.replace(regexToRemove, "");
fs.writeFileSync('server.ts', s);
