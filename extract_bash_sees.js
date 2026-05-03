const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');
let chunk = s.substring(s.indexOf('patch-index-html'), s.indexOf('vite-build'));
let match = chunk.match(/cat << 'EOF' > patch_html\.cjs([\s\S]*?)EOF/);
if (match) {
    fs.writeFileSync('what_bash_sees.txt', match[1]);
    console.log("Extracted!");
}
