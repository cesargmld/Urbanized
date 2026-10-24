const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const app = fs.readFileSync(path.join(repoDir, 'public', 'js', 'app.js'), 'utf8');

const idx = app.indexOf('panel');
console.log(app.substring(idx - 20, idx + 400));
