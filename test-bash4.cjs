const cjs = `
let c = 'ext {';
c = c.replace('ext {', "ext {\\n    androidxCoreVersion = '1.12.0'");
console.log(c);
`;
const fs = require('fs');
fs.writeFileSync('test-bash4.cjs', cjs);
