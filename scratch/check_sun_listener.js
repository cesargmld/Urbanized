const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(repoDir, 'public', 'js', 'app.js'), 'utf8');

console.log('HTML has sun azimuth listener?', html.includes("'slider-studio-sun-azimuth'"));
console.log('app.js has sun azimuth listener?', app.includes("'slider-studio-sun-azimuth'"));
