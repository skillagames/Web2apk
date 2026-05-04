const configureScriptStr = `c = "minSdkVersion 23".replace(/minSdkVersion\\s*=?\\s*\\d+/g, 'minSdkVersion = 24'); console.log(c);`;
require('fs').writeFileSync('test-regex7.js', configureScriptStr);
console.log(require('fs').readFileSync('test-regex7.js', 'utf8'));
require('child_process').execSync('node test-regex7.js', {stdio: 'inherit'});
