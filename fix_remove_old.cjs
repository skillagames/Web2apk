const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

const regexToRemove1 = /      \/\/ Custom frontend Capacitor JS Logic[\s\S]*?id: 'frontend-js-bundle'[\s\S]*?\]\s*}\);\s*}/s;
const regexToRemove2 = /      \/\/ Inject the built script module into HTML[\s\S]*?id: 'frontend-js-injection'[\s\S]*?\]\s*}\);/s;

s = s.replace(regexToRemove1, '');
s = s.replace(regexToRemove2, '');

fs.writeFileSync('server.ts', s);
console.log("Removed old JS bundle logic");
