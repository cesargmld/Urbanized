const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const compStart = html.indexOf('<div id="composition"');
const compEnd = html.indexOf('<!-- =====================================\r\n     MODAL', compStart) !== -1 
  ? html.indexOf('<!-- =====================================\r\n     MODAL', compStart)
  : html.indexOf('<!-- MODAL', compStart);

console.log('compStart:', compStart, 'compEnd:', compEnd);
if (compStart !== -1) {
  const compHtml = html.substring(compStart, compEnd !== -1 ? compEnd : compStart + 15000);
  console.log('Length of comp section:', compHtml.length);
  // Find all id attributes in #composition
  const ids = [...compHtml.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  console.log('IDs in composition:\n', ids.join('\n'));
}
