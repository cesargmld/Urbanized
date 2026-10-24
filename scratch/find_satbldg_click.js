const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const app = fs.readFileSync(path.join(repoDir, 'public', 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const findListeners = (str, label) => {
  let pos = 0;
  while (true) {
    const idx = str.indexOf('data-satbldg', pos);
    if (idx === -1) break;
    console.log(`${label} at ${idx}:`);
    console.log(str.substring(Math.max(0, idx - 40), Math.min(str.length, idx + 200)));
    console.log('---');
    pos = idx + 12;
  }
};
findListeners(app, 'app.js');
findListeners(html, 'index.html');
