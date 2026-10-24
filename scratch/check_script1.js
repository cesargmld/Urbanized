const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const s1Match = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/i);
if (s1Match) {
  console.log('Script #1 tag:');
  console.log(html.substring(s1Match.index, s1Match.index + 200));
}
