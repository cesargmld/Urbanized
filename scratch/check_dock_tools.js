const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const dockMatches = [...html.matchAll(/id="dock-tool-[^"]+"/g)].map(m => m[0]);
console.log('dock-tool IDs:\n', dockMatches.join('\n'));
