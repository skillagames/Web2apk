const cp = require('child_process');
const result = cp.execSync("cat << 'EOF'\nlet a = \"\\n\";\nEOF", {shell: 'bash'});
console.log("RESULT: " + result.toString());
