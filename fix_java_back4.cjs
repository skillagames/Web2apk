const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

const startIndex = s.indexOf("    if (process.argv[7] === 'true') {");
const endIndexStr = "    let needsOnCreate = process.argv[8] === 'true' || process.argv[3] === 'true';";
const endIndex = s.indexOf(endIndexStr);

if (startIndex !== -1 && endIndex !== -1) {
    s = s.substring(0, startIndex) + s.substring(endIndex);
    fs.writeFileSync('server.ts', s);
    console.log("Success");
} else {
    console.log("Not found");
}
