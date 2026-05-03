const fs = require('fs');
let jsConfig = "";
jsConfig += "import { App } from '@capacitor/app';\n";
const scriptInject = "\n<script type=\"module\">\n" + jsConfig + "</script>\n";
fs.writeFileSync('output.html', scriptInject);
