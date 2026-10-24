const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const app = fs.readFileSync(path.join(repoDir, 'public', 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

console.log('data-tpl in app.js:', app.indexOf('data-tpl') !== -1);
console.log('data-tpl in html:', html.indexOf('data-tpl') !== -1);
