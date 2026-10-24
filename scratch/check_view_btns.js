const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const matches = [...html.matchAll(/id="view-btn-[^"]+"/g)].map(m => m[0]);
console.log('view-btn IDs:\n', matches.join('\n'));
