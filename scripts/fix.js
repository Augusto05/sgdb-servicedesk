const fs = require('fs');
let text = fs.readFileSync('public/js/app.js', 'utf8');
text = text.replace(/\\`/g, '`');
text = text.replace(/\\\$\{/g, '${');
fs.writeFileSync('public/js/app.js', text);
