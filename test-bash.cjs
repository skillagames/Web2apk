const fs = require('fs');
const { execSync } = require('child_process');

const script = `cat << 'EOF' > dummy_config.cjs
let c = "ext {\\n    foo = 'bar'";
console.log(c);
EOF
node dummy_config.cjs
`;

fs.writeFileSync('test-bash.sh', script);
try {
  execSync('bash test-bash.sh', { stdio: 'inherit' });
} catch (e) {
  console.log('Error!');
}
