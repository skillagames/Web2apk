
cat << 'EOF' > modify_notif_icon.cjs
const fs = require('fs');
let c = fs.readFileSync('test_manifest.xml', 'utf8');
const metaData = '        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_name" />';
if (c.includes('com.google.firebase.messaging.default_notification_icon')) {
   c = c.replace(/<meta-data[^>]*android:name="com\.google\.firebase\.messaging\.default_notification_icon"[^>]*\/?>/g, ''); // wipe old if any
}
c = c.replace('</application>', metaData + '\n    </application>');
fs.writeFileSync('test_manifest_out.xml', c);
EOF
