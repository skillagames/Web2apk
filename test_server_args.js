const fs = require('fs');
eval(fs.readFileSync('server.ts', 'utf8').replace(/import /g, '// ').replace(/export /g, '// '));
// Now `buildSteps` should be defined? Wait, server.ts is a module, things are inside handlers.
