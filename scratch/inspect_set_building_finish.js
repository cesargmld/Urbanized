const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const preview = fs.readFileSync(path.join(repoDir, 'public', 'js', 'preview.js'), 'utf8');

const idx = preview.indexOf('setBuildingFinish');
console.log(preview.substring(Math.max(0, idx - 50), Math.min(preview.length, idx + 1500)));
