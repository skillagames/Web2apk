const fs = require('fs');

let c = fs.readFileSync('android/app/build.gradle', 'utf8');

let finalPackageName = "com.test.app";

c = c.replace(/applicationId\s+"[^"]+"/, 'applicationId "' + finalPackageName + '"');

if (c.includes('namespace ')) {
   c = c.replace(/namespace\s+"[^"]+"/, 'namespace "' + finalPackageName + '"');
}

console.log(c.substring(0, 300));
