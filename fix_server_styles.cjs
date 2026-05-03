const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// We want to remove the sections adding statusBarInject completely
content = content.replace(/          if \(\!p1\.includes\('android:statusBarColor'\)\) \{\n              p1 \= p1 \+ statusBarInject;\n          \}\n/g, '');

content = content.replace(/      const statusBarInject = '[^']*';\n\n/g, '');

content = content.replace(/      let isDarkColor = false;\n      try \{\n          var hex = bgColor\.replace\('#', ''\);\n          if \(hex\.length === 3\) hex = hex\[0\] \+ hex\[0\] \+ hex\[1\] \+ hex\[1\] \+ hex\[2\] \+ hex\[2\];\n          var r = parseInt\(hex\.substr\(0, 2\), 16\), g = parseInt\(hex\.substr\(2, 2\), 16\), b = parseInt\(hex\.substr\(4, 2\), 16\);\n          var yiq = \(\(r\*299\)\+\(g\*587\)\+\(b\*114\)\)\/1000;\n          isDarkColor \= \(yiq < 128\); \/\/ Not light\n      \} catch\(e\) \{\}\n      \n/g, '');

fs.writeFileSync('server.ts', content);
console.log('Fixed server.ts xml injection code');
