const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const idx = html.indexOf('slider-studio-sun');
console.log(html.substring(Math.max(0, idx - 100), Math.min(html.length, idx + 1500)));
