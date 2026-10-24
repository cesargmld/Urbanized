const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const idx = html.indexOf('window.switchView =');
console.log('Index of window.switchView =:', idx);
if (idx !== -1) {
  console.log(html.substring(idx - 100, idx + 200));
}

// Find the <script tag that contains window.switchView
const scriptTags = [...html.matchAll(/<script(?![^>]*src=)[^>]*>/gi)];
for (const s of scriptTags) {
  console.log('Script tag at', s.index, ':', html.substring(s.index, s.index + 80));
}
