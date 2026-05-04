const content = `
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <!-- Customize your theme here. -->
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
    </style>
`;
let newContent = content;
['AppTheme', 'AppTheme.NoActionBarLaunch', 'AppTheme.NoActionBar'].forEach(theme => {
      const regexStr = '(<style name="' + theme + '"[^>]*>[\\s\\S]*?)(<\\/style>)';
      const regex = new RegExp(regexStr);
      newContent = newContent.replace(regex, (match, p1, p2) => {
          if (!p1.includes('android:windowOptOutEdgeToEdgeEnforcement')) {
              p1 = p1 + '\n        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>\n      ';
          }
          return p1 + p2;
      });
  });
console.log(newContent);
