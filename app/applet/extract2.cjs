const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');
const lines = content.split('\n');
let inScript = false;
let script = [];
for (const line of lines) {
  if (line.includes(`cat << 'EOF' > configure_build.cjs`)) {
    inScript = true;
    continue;
  }
  if (inScript && line.trim() === 'EOF') {
    break;
  }
  if (inScript) {
    script.push(line);
  }
}
fs.writeFileSync('test_config.js', script.join('\n'));
