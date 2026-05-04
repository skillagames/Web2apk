const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// The template string in server.ts defines scripts dynamically.
// Any place where `\\\\` is used inside a regex literal inside a template string needs to be `\\`.
content = content.replace(/\\\\\\\\/g, '\\\\');

fs.writeFileSync('server.ts', content);
console.log('Fixed double escaping');
