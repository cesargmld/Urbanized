const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const app = fs.readFileSync(path.join(repoDir, 'public', 'js', 'app.js'), 'utf8');

const idx = app.indexOf("addEventListener('submit'");
if (idx !== -1) {
  console.log(app.substring(idx - 50, idx + 800));
} else {
  const idx2 = app.indexOf("submit");
  console.log(app.substring(idx2 - 50, idx2 + 800));
}
