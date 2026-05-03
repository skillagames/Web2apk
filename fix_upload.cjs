const fs = require('fs');
let c = fs.readFileSync('server.ts', 'utf8');
c = c.replace(/if \(rawBase64NotificationIcon\) \{\s*const nIconFile = bucket\.file\(`builds\/\$\{projectId\}\/notification-icon\.png`\);\s*const nBuffer = Buffer\.from\(rawBase64NotificationIcon, 'base64'\);\s*await nIconFile\.save\(nBuffer, \{\s*metadata: \{ contentType: 'image\/png' \}\s*\}\);\s*\}/s, `if (rawBase64NotificationIcon) {
            const nBuffer = Buffer.from(rawBase64NotificationIcon, 'base64');
            const isXml = nBuffer[0] === 60; // '<'
            const ext = isXml ? 'xml' : 'png';
            const contentType = isXml ? 'application/xml' : 'image/png';
            const nIconFile = bucket.file(\`builds/\${projectId}/notification-icon.\${ext}\`);
            await nIconFile.save(nBuffer, {
               metadata: { contentType }
            });
         }`);
fs.writeFileSync('server.ts', c);
