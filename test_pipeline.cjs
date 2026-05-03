const cp = require('child_process');
cp.execSync('bash -c "' + `cat << 'EOF' > patch_html.cjs
const fs = require('fs');
let jsConfig = "";
jsConfig += "import { App } from '@capacitor/app';\\n";
const scriptInject = "\\n<script type=\\"module\\">\\n" + jsConfig + "</script>\\n";
fs.writeFileSync('output.html', scriptInject);
EOF
node patch_html.cjs` + '"');
console.log(JSON.stringify(require('fs').readFileSync('output.html', 'utf8')));
