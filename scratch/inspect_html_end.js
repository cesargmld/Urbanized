const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

console.log('Total length:', html.length);
console.log('Snippet of last 3000 chars:');
console.log(html.substring(html.length - 3000));
