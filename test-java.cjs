const { execSync } = require('child_process');
execSync('rm -rf testapp && mkdir testapp');
execSync('cd testapp && npm init -y && npm install @capacitor/cli @capacitor/core @capacitor/android');
execSync('cd testapp && npx cap init "TestApp" "com.test.app" --web-dir dist');
execSync('cd testapp && mkdir dist && npx cap add android');
const fs = require('fs');

const path = require('path');
const javaDir = path.join('testapp', 'android', 'app', 'src', 'main', 'java');
function getMainActivityPath(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            const res = getMainActivityPath(fullPath);
            if (res) return res;
        } else if (file === 'MainActivity.java') {
            return fullPath;
        }
    }
    return null;
}
const mainActivityPath = getMainActivityPath(javaDir);
let javaCode = fs.readFileSync(mainActivityPath, 'utf8');
if (!javaCode.includes('import android.widget.Toast;')) {
    javaCode = javaCode.replace(/(import [^;]+;)/, '$1\nimport android.widget.Toast;');
}
if (!javaCode.includes('public void onBackPressed()')) {
    const backPressedLogic = `
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
`;
    javaCode = javaCode.replace(/}\s*$/, backPressedLogic + '}\n');
    fs.writeFileSync(mainActivityPath, javaCode);
}
console.log('Compiling...');
try {
    execSync('cd testapp/android && ./gradlew assembleDebug', { stdio: 'inherit' });
    console.log('SUCCESS');
} catch(e) {
    console.log('FAILED');
}
