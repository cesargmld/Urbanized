const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const checkTools = [
  'dock-tool-dim-3d',
  'dock-tool-section-3d',
  'dock-tool-export-3d',
  'dock-tool-export-map',
  'dock-tool-export-illu'
];

for (const id of checkTools) {
  let pos = 0;
  console.log(`=== ${id} ===`);
  while (true) {
    const idx = html.indexOf(id, pos);
    if (idx === -1) break;
    console.log(html.substring(Math.max(0, idx - 50), Math.min(html.length, idx + 150)));
    console.log('---');
    pos = idx + id.length;
  }
}
