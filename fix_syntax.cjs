const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

const regex = /let headInject = \\`[\s\S]*?  \\`;/;
const fix = `let headInject = \`
    <link rel="icon" href="/icon.png">
    <link rel="apple-touch-icon" href="/icon.png">
    <script>
      window.APP_ICON_BASE64 = "\\\${appIconBase64}";
    </script>
  \`;`;

s = s.replace(regex, fix);
fs.writeFileSync('server.ts', s);
