const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');
const match = content.match(/const configureScriptStr = `([\s\S]*?)`;/);
if (match) {
   fs.writeFileSync('test-gen-config.js', match[1]);
   console.log('Successfully extracted configureScriptStr');
} else {
   console.log('Could not find configureScriptStr');
}
