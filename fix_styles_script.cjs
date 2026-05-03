const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

const replacement = `
function updateStyles(file) {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix Splash Screen
  if (content.includes('name="AppTheme.NoActionBarLaunch"')) {
      const splashInjection = "\\\\n" +
'        <item name="windowSplashScreenBackground">' + bgColor + '</item>\\\\n' +
'        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_round</item>\\\\n      ';
      content = content.replace(/(<style name="AppTheme\\\\.NoActionBarLaunch"[^>]*>[\\\\s\\\\S]*?)(<\\\\/style>)/, (match, p1, p2) => {
          if (!p1.includes('windowSplashScreenBackground')) {
              return p1 + splashInjection + p2;
          }
          return match;
      });
  }

  // Restore standard bounds to prevent Android 15 from forcing edge-to-edge layout, which breaks their web UI.
  if (content.includes('name="AppTheme.NoActionBar"')) {
      const optOutInjection = '\\\\n        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>\\\\n      ';
      content = content.replace(/(<style name="AppTheme\\\\.NoActionBar"[^>]*>[\\\\s\\\\S]*?)(<\\\\/style>)/, (match, p1, p2) => {
          if (!p1.includes('windowOptOutEdgeToEdgeEnforcement')) {
              p1 = p1 + optOutInjection;
          }
          return p1 + p2;
      });
  }

  // Handle Fullscreen UI
  if (isFullscreen) {
      if (content.includes('name="AppTheme.NoActionBar"')) {
          const fullscreenInjection = '\\\\n        <item name="android:windowFullscreen">true</item>\\\\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>\\\\n        <item name="android:windowTranslucentNavigation">true</item>\\\\n        <item name="android:windowTranslucentStatus">true</item>\\\\n      ';
          content = content.replace(/(<style name="AppTheme\\\\.NoActionBar"[^>]*>[\\\\s\\\\S]*?)(<\\\\/style>)/, (match, p1, p2) => {
              if (!p1.includes('android:windowFullscreen')) {
                  p1 = p1 + fullscreenInjection;
              }
              return p1 + p2;
          });
      }
  } else {
      // Remove edge-to-edge making things transparent, enforce standard colored status bar
      let isDarkColor = false;
      try {
          var hex = bgColor.replace('#', '');
          if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
          var r = parseInt(hex.substr(0, 2), 16), g = parseInt(hex.substr(2, 2), 16), b = parseInt(hex.substr(4, 2), 16);
          var yiq = ((r*299)+(g*587)+(b*114))/1000;
          isDarkColor = (yiq < 128); // Not light
      } catch(e) {}
      
      const statusBarColorInject = '\\\\n        <item name="android:statusBarColor">' + bgColor + '</item>\\\\n        <item name="android:windowDrawsSystemBarBackgrounds">true</item>\\\\n        <item name="android:enforceStatusBarContrast">false</item>\\\\n        <item name="android:enforceNavigationBarContrast">false</item>\\\\n        <item name="android:windowLightStatusBar">' + (!isDarkColor) + '</item>\\\\n        <item name="android:navigationBarColor">' + bgColor + '</item>\\\\n        <item name="android:windowLightNavigationBar">' + (!isDarkColor) + '</item>\\\\n        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>\\\\n      ';
      if (content.includes('name="AppTheme.NoActionBar"')) {
          content = content.replace(/(<style name="AppTheme\\\\.NoActionBar"[^>]*>[\\\\s\\\\S]*?)(<\\\\/style>)/, (match, p1, p2) => {
              // Strip any existing StatusBarColor so we can forcefully add ours
              p1 = p1.replace(/<item name="android:statusBarColor">[^<]*<\\/item>\\s*/g, '');
              p1 = p1.replace(/<item name="android:windowLightStatusBar">[^<]*<\\/item>\\s*/g, '');
              p1 = p1.replace(/<item name="android:navigationBarColor">[^<]*<\\/item>\\s*/g, '');
              p1 = p1.replace(/<item name="android:windowLightNavigationBar">[^<]*<\\/item>\\s*/g, '');
              p1 = p1.replace(/<item name="android:windowTranslucentNavigation">[^<]*<\\/item>\\s*/g, '');
              p1 = p1.replace(/<item name="android:windowTranslucentStatus">[^<]*<\\/item>\\s*/g, '');
              p1 = p1.replace(/<item name="android:windowDrawsSystemBarBackgrounds">[^<]*<\\/item>\\s*/g, '');
              p1 = p1.replace(/<item name="android:enforceStatusBarContrast">[^<]*<\\/item>\\s*/g, '');
              p1 = p1.replace(/<item name="android:enforceNavigationBarContrast">[^<]*<\\/item>\\s*/g, '');
              p1 = p1.replace(/<item name="android:windowOptOutEdgeToEdgeEnforcement">[^<]*<\\/item>\\s*/g, '');
              return p1 + statusBarColorInject + p2;
          });
      }
  }

  fs.writeFileSync(file, content);
}

const resDir = path.join('android', 'app', 'src', 'main', 'res');
if (fs.existsSync(resDir)) {
    const dirs = fs.readdirSync(resDir);
    dirs.forEach(d => {
        if (d.startsWith('values')) {
            const file = path.join(resDir, d, 'styles.xml');
            updateStyles(file);
        }
    });
}
`;

const regex = /function updateStyles\(file\) \{[\s\S]*?updateStyles\(nightStylesPath\);/s;

s = s.replace(regex, replacement);
fs.writeFileSync('server.ts', s);
