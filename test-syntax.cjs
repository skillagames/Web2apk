const fs = require('fs');

const script = `
const fs = require('fs');
let c = 'ext {';
c = c.replace('ext {', 'ext {' + String.fromCharCode(10) + "    androidxCoreVersion = '1.12.0'");
console.log(c);
`;

fs.writeFileSync('test-syntax.cjs', script);
