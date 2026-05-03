const fs = require('fs');
const script = `cat << 'EOF' > dummy_config.cjs
         c = c.replace('ext {', "ext {\\\\n    androidxCoreVersion = '1.12.0'");
EOF
`;
fs.writeFileSync('test-bash3.sh', script);
