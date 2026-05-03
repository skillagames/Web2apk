
const fs = require('fs');
const indexPath = 'index.html';
if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf8');
  let appIconBase64 = '';
  if (fs.existsSync('assets/icon.png')) {
      appIconBase64 = fs.readFileSync('assets/icon.png', 'base64');
  }
  let headInject = '<link rel="icon" href="/icon.png">\\n' +
                   '<link rel="apple-touch-icon" href="/icon.png">\\n' +
                   '<script>\\nwindow.APP_ICON_BASE64 = "' + appIconBase64 + '";\\n</script>\\n';
  if (content.includes('</head>')) {
     content = content.replace('</head>', headInject + '\\n</head>');
  }

  // Inject Capacitor plugins into index.html so Vite bundles them natively
  let jsConfig = "";
  if (false) {
     jsConfig += "import { StatusBar } from '@capacitor/status-bar';\\n";
     jsConfig += "StatusBar.setOverlaysWebView({ overlay: false }).catch(()=>{});\\n";
  }
  if (true) {
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
  if (jsConfig) {
     const scriptInject = "\\n<script type=\"module\">\\n" + jsConfig + "</script>\\n";
     content = content.replace('</body>', scriptInject + '</body>');
  }

  fs.writeFileSync(indexPath, content);
}
