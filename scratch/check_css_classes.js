const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const css = fs.readFileSync(path.join(repoDir, 'public', 'css', 'style.css'), 'utf8');

const classes = [
  '.comp-vp-block',
  '.comp-vp-empty',
  '.comp-vp-add-btn',
  '.comp-picker-overlay',
  '.studio-floating-section-bar',
  '.studio-measure-badge',
  '.axiom-dimmed-controls'
];

for (const cls of classes) {
  console.log(`${cls}: ${css.includes(cls)}`);
}
