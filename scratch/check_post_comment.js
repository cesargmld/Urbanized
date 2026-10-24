const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

console.log('HTML has btn-studio-post-comment in JS?', html.indexOf("document.getElementById('btn-studio-post-comment')") !== -1);
