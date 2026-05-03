const c = '<meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_name" />';

// Scenario 2: Single backslashes
const regex2 = /<meta-data[^>]*android:name="com\.google\.firebase\.messaging\.default_notification_icon"[^>]*\/?>/g;

console.log("Regex 2 replaces:", c.replace(regex2, 'REPLACED'));
