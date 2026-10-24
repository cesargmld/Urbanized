const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const mapperIdx = html.indexOf('id="mapper"');
const illuIdx = html.indexOf('id="illustrator"');
const mapperHtml = html.substring(mapperIdx, illuIdx);

const matches = [...mapperHtml.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
console.log('IDs in #mapper:\n', matches.join('\n'));
