const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

const regex = /let headInject = `[\s\S]*?  `;/;
const fix = 'let headInject = "<link rel=\\"icon\\" href=\\"/icon.png\\">\\n<link rel=\\"apple-touch-icon\\" href=\\"/icon.png\\">\\n<script>\\nwindow.APP_ICON_BASE64 = \\"" + appIconBase64 + "\\";\\n</script>\\n";';

s = s.replace(regex, fix);
fs.writeFileSync('server.ts', s);
