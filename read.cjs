const fs = require('fs');
const content = fs.readFileSync('test-bash.sh', 'utf8');
console.log('length:', content.length);
console.log(content.split('').map(c => c.charCodeAt(0)).join(','));
