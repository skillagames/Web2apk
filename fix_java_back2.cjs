const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

const regex = /    if \\(process\\.argv\\[7\\] === 'true'\\) \\{[\\s\\S]*?\\}\\n\\n    let needsOnCreate/s;

s = s.replace(regex, "    let needsOnCreate");
fs.writeFileSync('server.ts', s);
