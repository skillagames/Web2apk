const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

const regexToReplace = /      \/\/ Inject the built script module into HTML[\s\S]*?node inject_js\.cjs`\s*\]\s*}\);/s;

const match = s.match(regexToReplace);
if (!match) {
    console.error("Match not found!");
    process.exit(1);
}

const replacement = `
      // Custom frontend Capacitor JS Logic
      if (fullscreen === false || doubleTapToExit) {
        let jsConfig = "";
        if (fullscreen === false) {
           jsConfig += "import { StatusBar } from '@capacitor/status-bar';\\n";
           jsConfig += "StatusBar.setOverlaysWebView({ overlay: false }).catch(()=>{});\\n";
        }
        if (doubleTapToExit) {
           jsConfig += "import { App } from '@capacitor/app';\\n";
           jsConfig += "import { Toast } from '@capacitor/toast';\\n";
           jsConfig += "let lastBack = 0;\\n";
           jsConfig += "App.addListener('backButton', ({ canGoBack }) => {\\n";
           jsConfig += "  if (canGoBack) { window.history.back(); } else {\\n";
           jsConfig += "    const now = Date.now();\\n";
           jsConfig += "    if (now - lastBack < 2000) { App.exitApp(); } else {\\n";
           jsConfig += "      lastBack = now;\\n";
           jsConfig += "      Toast.show({ text: 'Press back again to exit' });\\n";
           jsConfig += "    }\\n";
           jsConfig += "  }\\n";
           jsConfig += "}).catch(()=>{});\\n";
        }
        
        buildSteps.push({
          id: 'frontend-js-bundle',
          name: builderImage,
          dir: 'workspace',
          entrypoint: 'bash',
          args: [
            '-c',
            \`cat << 'EOF' > cap-init.js
\${jsConfig}
EOF
npx --yes esbuild cap-init.js --bundle --minify --outfile=dist/cap-init.bundle.js\`
          ]
        });
      }

      // Inject the built script module into HTML
      buildSteps.push({
        id: 'frontend-js-injection',
        name: builderImage,
        dir: 'workspace',
        entrypoint: 'bash',
        args: [
          '-c',
          \`cat << 'EOF' > inject_js.cjs
const fs = require('fs');
const indexPath = 'dist/index.html';
if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf8');
  let appIconBase64 = '';
  if (fs.existsSync('assets/icon.png')) {
      appIconBase64 = fs.readFileSync('assets/icon.png', 'base64');
  }
  let headInject = \\\\\`
    <link rel="icon" href="/icon.png">
    <link rel="apple-touch-icon" href="/icon.png">
    <script>
      window.APP_ICON_BASE64 = "\\\${appIconBase64}";
    </script>
  \\\\\`;
  if (content.includes('</head>')) {
     content = content.replace('</head>', headInject + '\\\\n</head>');
  }
  if (\${fullscreen === false || doubleTapToExit}) {
     content = content.replace('</body>', '  <script type="module" src="/cap-init.bundle.js"></script>\\\\n</body>');
  }
  fs.writeFileSync(indexPath, content);
}
EOF
node inject_js.cjs\`
        ]
      });`;

const newS = s.replace(regexToReplace, replacement);
fs.writeFileSync('server.ts', newS);
console.log("Done");
