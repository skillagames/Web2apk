const x = `cat << 'EOF' > configure_build.cjs
const fs = require('fs');
let c = 'ext {';
if (c.includes('ext {')) {
   if (!c.includes('androidxCoreVersion')) {
      c = c.replace('ext {', "ext {\\n    androidxCoreVersion = '1.12.0'");
   } else {
      c = c.replace(/androidxCoreVersion\\s*=?\\s*['"][^'"]+['"]/g, "androidxCoreVersion = '1.12.0'");
   }
}
EOF
`;

console.log(x);
