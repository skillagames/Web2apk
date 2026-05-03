const xml = `
<application>
        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/old_icon" />
</application>
`;
let c = xml;
c = c.replace(/<meta-data[^>]*android:name="com\\.google\\.firebase\\.messaging\\.default_notification_icon"[^>]*\/?>/g, '');
console.log(c);
