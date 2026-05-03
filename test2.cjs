const fs = require('fs');
const s = `cat << 'EOF' > patch_html.cjs
let jsConfig = "";
  if (true) {
     jsConfig += "import { App } from '@capacitor/app';\\\\n";
  }
EOF`;
console.log(s);
