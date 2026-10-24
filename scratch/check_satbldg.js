const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(repoDir, 'public', 'js', 'app.js'), 'utf8');

console.log('HTML has data-satbldg listener?', html.includes('data-satbldg'));
console.log('app.js has data-satbldg listener?', app.includes('data-satbldg'));
