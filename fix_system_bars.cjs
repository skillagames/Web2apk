const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const replacement = `
      content = content.replace(/(<style name="AppTheme"[^>]*>[\\s\\S]*?)(<\\/style>)/, (match, p1, p2) => {
          if (!p1.includes('android:windowOptOutEdgeToEdgeEnforcement')) {
              p1 = p1 + '\\n        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>\\n';
          }
           if (!p1.includes('android:statusBarColor')) {
              p1 = p1 + '        <item name="android:statusBarColor">?android:attr/colorBackground</item>\\n';
          }
          if (!p1.includes('android:navigationBarColor')) {
              p1 = p1 + '        <item name="android:navigationBarColor">?android:attr/colorBackground</item>\\n      ';
          }
          return p1 + p2;
      });
      content = content.replace(/(<style name="AppTheme\\\\.NoActionBarLaunch"[^>]*>[\\s\\S]*?)(<\\/style>)/, (match, p1, p2) => {
          if (!p1.includes('android:windowOptOutEdgeToEdgeEnforcement')) {
              p1 = p1 + '\\n        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>\\n      ';
          }
          return p1 + p2;
      });
      content = content.replace(/(<style name="AppTheme\\\\.NoActionBar"[^>]*>[\\s\\S]*?)(<\\/style>)/, (match, p1, p2) => {
          if (!p1.includes('android:windowOptOutEdgeToEdgeEnforcement')) {
              p1 = p1 + '\\n        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>\\n';
          }
          if (!p1.includes('android:statusBarColor')) {
              p1 = p1 + '        <item name="android:statusBarColor">?android:attr/colorBackground</item>\\n';
          }
          if (!p1.includes('android:navigationBarColor')) {
              p1 = p1 + '        <item name="android:navigationBarColor">?android:attr/colorBackground</item>\\n      ';
          }
          return p1 + p2;
      });
`;

let targetBlockRegex = /      \/\/ Opt-out of Edge to Edge and let the system theme handle the colors natively![\s\S]+?\}\);\n  \}/;

if (!targetBlockRegex.test(content)) {
    console.error("Target block not found!");
} else {
    content = content.replace(targetBlockRegex, replacement.trim() + '\n  }');
    fs.writeFileSync('server.ts', content);
    console.log("Success");
}
