const source = `c = "applicationId \\"com.dummy\\"".replace(/applicationId\\s+"[^"]+"/, "test"); console.log(c);`;
require('fs').writeFileSync('test-regex5.cjs', source);
