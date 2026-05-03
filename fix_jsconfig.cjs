const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const jsConfig = `
  let jsConfig = "";
  if (\${doubleTapToExit} || !\${fullscreen}) {
     jsConfig += "import { App } from '@capacitor/app';\\n";
     jsConfig += "import { StatusBar, Style } from '@capacitor/status-bar';\\n";
     
     if (\${doubleTapToExit}) {
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
     if (!\${fullscreen}) {
         // Auto-adapt status bar colors since capacitor styles might not map dynamically
         jsConfig += "const updateStatusBar = () => {\\n";
         jsConfig += "   const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;\\n";
         // Capacitor Style.Dark = dark text, Style.Light = light text
         jsConfig += "   StatusBar.setStyle({ style: isDark ? Style.Light : Style.Dark }).catch(()=>{});\\n";
         jsConfig += "};\\n";
         jsConfig += "updateStatusBar();\\n";
         jsConfig += "window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateStatusBar);\\n";
     }
  }
`;

content = content.replace(/  let jsConfig = "";\n  if \(\$\{doubleTapToExit\}\) \{[\s\S]+?\}\)\.catch\(\(\)=>\{\}\);\n  \}/, jsConfig.trim());

fs.writeFileSync('server.ts', content);
console.log('Fixed jsConfig');
