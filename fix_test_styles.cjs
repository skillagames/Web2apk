const fs = require('fs');
let content = fs.readFileSync(process.argv[2], 'utf8');
const bgColor = "#ffffff";
const isDarkColor = false;
const statusBarInject = '\n        <item name="android:statusBarColor">' + bgColor + '</item>\n        <item name="android:windowLightStatusBar">' + (!isDarkColor) + '</item>\n        <item name="android:navigationBarColor">' + bgColor + '</item>\n        <item name="android:windowLightNavigationBar">' + (!isDarkColor) + '</item>\n        <item name="android:windowTranslucentStatus">false</item>\n        <item name="android:windowTranslucentNavigation">false</item>\n        <item name="android:windowDrawsSystemBarBackgrounds">true</item>\n      ';

content = content.replace(/(<style name="AppTheme"[^>]*>[\s\S]*?)(<\/style>)/, (match, p1, p2) => {
    if (!p1.includes('android:statusBarColor')) {
        p1 = p1 + statusBarInject;
    }
    return p1 + p2;
});
content = content.replace(/(<style name="AppTheme\.NoActionBarLaunch"[^>]*>[\s\S]*?)(<\/style>)/, (match, p1, p2) => {
    if (!p1.includes('android:statusBarColor')) {
        p1 = p1 + statusBarInject;
    }
    return p1 + p2;
});
content = content.replace(/(<style name="AppTheme\.NoActionBar"[^>]*>[\s\S]*?)(<\/style>)/, (match, p1, p2) => {
    if (!p1.includes('android:statusBarColor')) {
        p1 = p1 + statusBarInject;
    }
    return p1 + p2;
});

['AppTheme', 'AppTheme.NoActionBarLaunch', 'AppTheme.NoActionBar'].forEach(theme => {
    const regexStr = '(<style name="' + theme + '"[^>]*>[\\s\\S]*?)(<\\/style>)';
    const regex = new RegExp(regexStr);
    content = content.replace(regex, (match, p1, p2) => {
        if (!p1.includes('android:windowOptOutEdgeToEdgeEnforcement')) {
            p1 = p1 + '\n        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>\n      ';
        }
        return p1 + p2;
    });
});
console.log(content);
