const script = `cat << 'EOF' > modify_notif_icon.cjs
if (c.includes('com.google.firebase.messaging.default_notification_icon')) {
   c = c.replace(/<meta-data[^>]*android:name="com\\.google\\.firebase\\.messaging\\.default_notification_icon"[^>]*\\/?>/g, ''); // wipe old if any
   c = c.replace(/<meta-data[^>]*android:name="com\\.google\\.firebase\\.messaging\\.default_notification_color"[^>]*\\/?>/g, ''); 
   c = c.replace(/<meta-data[^>]*android:name="com\\.google\\.firebase\\.messaging\\.default_notification_channel_id"[^>]*\\/?>/g, ''); 
}
EOF
`;
console.log(script);
