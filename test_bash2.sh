cat << 'EOF' > patch_html.cjs
const fs = require('fs');
let appIconBase64 = '';
let headInject = '<link rel="icon" href="/icon.png">\n<link rel="apple-touch-icon" href="/icon.png">\n<script>\nwindow.APP_ICON_BASE64 = "' + appIconBase64 + '";\n</script>\n';
EOF
node patch_html.cjs
