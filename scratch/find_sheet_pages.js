const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const idx = html.indexOf('let sheetPages');
if (idx !== -1) {
  console.log(html.substring(idx - 50, idx + 800));
} else {
  console.log('sheetPages not declared with let sheetPages');
  const idx2 = html.indexOf('sheetPages');
  console.log(html.substring(idx2 - 50, idx2 + 800));
}
