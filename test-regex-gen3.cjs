const source = `c = "minSdkVersion 23".replace(/minSdkVersion\\\\s*=?\\\\s*\\\\d+/g, "minSdkVersion 24"); console.log(c);`;
require('fs').writeFileSync('test-regex6.cjs', source);
