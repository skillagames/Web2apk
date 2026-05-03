const fs = require('fs');
const code = fs.readFileSync('server.ts', 'utf8');
const start = code.indexOf(`cat << 'EOF' > configure_build.cjs`);
const end = code.indexOf(`EOF\nnode configure_build.cjs`);
const scriptContent = code.substring(start + `cat << 'EOF' > configure_build.cjs\n`.length, end);
fs.writeFileSync('extracted_build.cjs', scriptContent);
try {
  const { execSync } = require('child_process');
  execSync('node extracted_build.cjs', { stdio: 'inherit' });
  console.log('SUCCESS');
} catch (e) {
  console.log('FAIL');
}
