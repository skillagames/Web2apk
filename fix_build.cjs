const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

const targetRegex = /buildSteps\.push\(\{\s*id:\s*'gradle-config'[\s\S]*?args:\s*\[\s*'-c',\s*`cat << 'EOF' > configure_build\.cjs([\s\S]*?)EOF\nnode configure_build\.cjs (.*)\nnpx cap sync android`\s*\]\s*\}\);/;

const match = s.match(targetRegex);
if (!match) {
    console.error("Not found");
    process.exit(1);
}

const scriptBody = match[1];
const nodeArgs = match[2];

const replacement = `
      const rawConfigureScript = \`${scriptBody}\`;
      const b64ConfigureScript = Buffer.from(rawConfigureScript).toString("base64");
      const chunks = b64ConfigureScript.match(/.{1,8000}/g) || [];
      const bashCmds = chunks.map((chunk, i) => i === 0 ? \`echo -n "\${chunk}" > conf.b64\` : \`echo -n "\${chunk}" >> conf.b64\`).join("\\n");
      const finalBashArgs = \`\${bashCmds}\\nbase64 -d conf.b64 > configure_build.cjs\\nnode configure_build.cjs ${nodeArgs}\\nnpx cap sync android\`;

      buildSteps.push({
        id: 'gradle-config',
        name: builderImage,
        dir: 'workspace',
        entrypoint: 'bash',
        args: [
          '-c',
          finalBashArgs
        ]
      });`;

const newS = s.replace(targetRegex, replacement);
fs.writeFileSync('server.ts', newS);
console.log("Replaced successfully!");
