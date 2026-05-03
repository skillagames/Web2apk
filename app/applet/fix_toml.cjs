const fs = require('fs');

let c = fs.readFileSync('server.ts', 'utf8');

c = c.replace(/c \= c\.replace\(\/coreKtx\[\\\\s\]\*\=\[\\\\s\]\*\['"\]\[\\\\d\\\\\.\]\+\['"\]\/g, 'coreKtx = "1\.15\.0"'\);/g, "c = c.replace(/coreKtx\\\\s*=\\\\s*['\"][\\\\d\\\\.]+['\"]/g, 'coreKtx = \"1.15.0\"');");

// Let's just completely replace that section:
const newSection = `
   // Core versions in TOML - handle various name styles
   c = c.replace(/coreKtx\\s*=\\s*['"][\\\\d\\\\.]+['"]/g, 'coreKtx = "1.15.0"');
   c = c.replace(/androidxCore\\s*=\\s*['"][\\\\d\\\\.]+['"]/g, 'androidxCore = "1.15.0"');
   c = c.replace(/androidxCoreKtx\\s*=\\s*['"][\\\\d\\\\.]+['"]/g, 'androidxCoreKtx = "1.15.0"');
   c = c.replace(/androidx-core\\s*=\\s*['"][\\\\d\\\\.]+['"]/g, 'androidx-core = "1.15.0"');
   
   // Capacitor 8 template vars in TOML
   c = c.replace(/core\\s*=\\s*['"][\\\\d\\\\.]+['"]/g, 'core = "1.15.0"');
`;

c = c.replace(/\/\/ Core versions in TOML \- handle various name styles\n(\s*c = c\.replace\([^;]+;\n)+/g, newSection);

fs.writeFileSync('server.ts', c);
