const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');
const lines = content.split('\n');
console.log(lines[743]);
console.log(lines[743].split('').map(c => c.charCodeAt(0)).join(','));
