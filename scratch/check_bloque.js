const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const matches = [...html.matchAll(/Bloque|bloque|addConceptualMassBlock/g)];
for (const m of matches) {
  console.log(`Match at ${m.index}:`);
  console.log(html.substring(Math.max(0, m.index - 50), Math.min(html.length, m.index + 200)));
  console.log('---');
}
