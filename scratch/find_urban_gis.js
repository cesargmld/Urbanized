const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const matches = [...html.matchAll(/Urban GIS|Maqueta/gi)].map(m => m.index);
console.log('Matches for Urban GIS or Maqueta:', matches);
for (const idx of matches) {
  console.log(html.substring(Math.max(0, idx - 80), Math.min(html.length, idx + 180)));
  console.log('===');
}
