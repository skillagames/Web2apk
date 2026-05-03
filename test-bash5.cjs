const fs = require('fs');
const { execSync } = require('child_process');

const script = `cat << 'EOF' > dummy_config.cjs
        let c = 'ext {';
         c = c.replace('ext {', "ext {\\\\n    androidxCoreVersion = '1.12.0'");
        console.log(c);
EOF
node dummy_config.cjs
`;
fs.writeFileSync('test-bash5.sh', script);
execSync('bash test-bash5.sh', { stdio: 'inherit' });
