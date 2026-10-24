const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const app = fs.readFileSync(path.join(repoDir, 'public', 'js', 'app.js'), 'utf8');

const matches = [...app.matchAll(/setBuildingFinish/g)];
console.log('Matches in app.js:', matches.length);
for (const m of matches) {
  console.log(app.substring(Math.max(0, m.index - 50), Math.min(app.length, m.index + 100)));
  console.log('---');
}
