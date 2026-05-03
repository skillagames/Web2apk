const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');
let chunk = s.substring(s.indexOf('patch-index-html'), s.indexOf('vite-build'));
let match = chunk.match(/args: \[\s*'-c',\s*`([\s\S]*?)`\s*\]/);
if (match) {
    let script = match[1];
    script = script.replace(/\$\{fullscreen === false\}/g, 'false').replace(/\$\{doubleTapToExit\}/g, 'true');
    fs.writeFileSync('test_bash.sh', script);
}
