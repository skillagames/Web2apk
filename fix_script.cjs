const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');
s = s.replace('const scriptInject = "\\\\\\\\n<script type=\\\\\\"module\\\\\\">\\\\\\\\n" + jsConfig + "</script>\\\\\\\\n";',
              'const scriptInject = "\\\\n<script type=\\\\\\"module\\\\\\">\\\\n" + jsConfig + "</script>\\\\n";');
fs.writeFileSync('server.ts', s);
console.log(s.includes('const scriptInject = "\\\\n<script type=\\\\\\"module\\\\\\">\\\\n" + jsConfig + "</script>\\\\n";'));
