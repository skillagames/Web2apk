const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

const targetStr = `    if (process.argv[7] === 'true') {
        if (!javaCode.includes('import android.widget.Toast;')) {
            javaCode = javaCode.replace(/(import [^;]+;)/, '$1\\\\nimport android.widget.Toast;');
        }
        if (!javaCode.includes('public void onBackPressed()')) {
            const backPressedLogic = \\\`
    private long lastBack = 0;

    @Override
    public void onBackPressed() {
        if (bridge != null && bridge.getWebView() != null && bridge.getWebView().canGoBack()) {
            bridge.getWebView().goBack();
        } else {
            if (System.currentTimeMillis() - lastBack < 2000) {
                super.onBackPressed();
            } else {
                lastBack = System.currentTimeMillis();
                Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show();
            }
        }
    }
\\\`;
            javaCode = javaCode.replace(/}\\s*$/, backPressedLogic + '}\\n');
        }
    }`;

s = s.replace(targetStr, "");
fs.writeFileSync('server.ts', s);
