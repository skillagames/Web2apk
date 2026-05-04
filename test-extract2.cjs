// Load server.ts using Babel or just eval the string to see its real memory value!
const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');
const match = content.match(/const configureScriptStr = `([\s\S]*?)`;/);
if (match) {
   const evaled = eval("`" + match[1] + "`"); 
   console.log(evaled.split('\n').find(l => l.includes('classpath')));
}
