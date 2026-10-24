const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(repoDir, 'public', 'js', 'app.js'), 'utf8');

const checkTools = [
  'dock-tool-select-3d',
  'dock-tool-dim-3d',
  'dock-tool-level-3d',
  'dock-tool-section-3d',
  'dock-tool-export-3d',
  'dock-tool-select-map',
  'dock-tool-dim-map',
  'dock-tool-hatch-map',
  'dock-tool-frame-map',
  'dock-tool-cam-map',
  'dock-tool-export-map',
  'dock-tool-select-illu',
  'dock-tool-explode-illu',
  'dock-tool-shadow-illu',
  'dock-tool-hatch-illu',
  'dock-tool-cam-illu',
  'dock-tool-export-illu'
];

for (const id of checkTools) {
  const inHtml = html.includes(`'${id}'`) || html.includes(`"${id}"`);
  const inApp = app.includes(`'${id}'`) || app.includes(`"${id}"`);
  console.log(`${id}: HTML=${inHtml}, app.js=${inApp}`);
}
