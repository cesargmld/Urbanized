const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const matches = [...html.matchAll(/data-studio-finish="([^"]+)"/g)].map(m => m[1]);
console.log('data-studio-finish attributes:', matches);
if (!matches.length) {
  const finishMatches = [...html.matchAll(/acabados|volumetria|finishes/gi)].map(m => m.index);
  console.log('Finish related match indices:', finishMatches.slice(0, 5));
}
