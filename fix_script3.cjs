const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');
s = s.replace('     undefined\n     content = content.replace(\'</body>\', scriptInject + \'</body>\');',
              '     const scriptInject = "\\\\n<script type=\\\\\\"module\\\\\\">\\\\n" + jsConfig + "</script>\\\\n";\n     content = content.replace(\'</body>\', scriptInject + \'</body>\');');
fs.writeFileSync('server.ts', s);
console.log(s.includes('scriptInject ='));
