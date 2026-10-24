const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const htmlPath = path.join(repoDir, 'public', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Replace all unescaped 'JetBrains Mono' in string concatenation
html = html.replace(/font-family:'JetBrains Mono'/g, 'font-family:monospace');
html = html.replace(/font-family:\x27JetBrains Mono\x27/g, 'font-family:monospace');

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Fixed JetBrains quote collision');
