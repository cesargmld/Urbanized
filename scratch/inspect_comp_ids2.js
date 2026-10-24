const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const compStart = html.indexOf('<div id="composition"');
const compEnd = html.indexOf('<!-- =====================================\n', compStart + 100) !== -1
  ? html.indexOf('<!-- =====================================\n', compStart + 100)
  : html.indexOf('</section>', compStart);

const snippet = html.substring(compStart, compStart + 25000);
const ids = [...snippet.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
console.log('IDs in composition:\n', ids.join('\n'));
