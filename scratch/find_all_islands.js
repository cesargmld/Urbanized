const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const matches = [...html.matchAll(/class="axiom-studio-island"/g)].map(m => m.index);
console.log('Matches for axiom-studio-island:', matches);
for (const idx of matches) {
  console.log(html.substring(idx - 60, idx + 400));
  console.log('===');
}
