const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const preview = fs.readFileSync(path.join(repoDir, 'public', 'js', 'preview.js'), 'utf8');

const idx = preview.indexOf('export function showModel(');
console.log(preview.substring(idx + 3500, idx + 7000));
