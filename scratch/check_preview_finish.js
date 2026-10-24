const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const preview = fs.readFileSync(path.join(repoDir, 'public', 'js', 'preview.js'), 'utf8');

const matches = [...preview.matchAll(/finish/gi)].map(m => m.index);
console.log('Matches for finish in preview.js:', matches.length);
for (const idx of matches) {
  console.log(preview.substring(Math.max(0, idx - 40), Math.min(preview.length, idx + 150)));
  console.log('---');
}
