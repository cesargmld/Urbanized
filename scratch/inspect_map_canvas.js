const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const idx = html.indexOf('id="map-canvas"');
if (idx !== -1) {
  console.log(html.substring(idx - 100, idx + 600));
} else {
  const idx2 = html.indexOf('map-container');
  console.log(html.substring(idx2 - 100, idx2 + 600));
}
