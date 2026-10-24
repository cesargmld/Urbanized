const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const idx = html.indexOf("document.getElementById('dock-tool-section-3d')");
console.log(html.substring(idx, idx + 2500));
