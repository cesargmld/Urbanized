const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const dataJs = fs.readFileSync(path.join(repoDir, 'public', 'js', 'data.js'), 'utf8');

const lines = dataJs.split('\n');
console.log(lines.slice(60, 100).join('\n'));
