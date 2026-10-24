const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const mapplan = fs.readFileSync(path.join(repoDir, 'public', 'js', 'mapplan.js'), 'utf8');

const idx = mapplan.indexOf('presets = {');
if (idx !== -1) {
  console.log(mapplan.substring(idx, idx + 2000));
} else {
  const idx2 = mapplan.indexOf('preset');
  console.log(mapplan.substring(idx2, idx2 + 1000));
}
