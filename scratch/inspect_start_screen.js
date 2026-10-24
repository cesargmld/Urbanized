const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(repoDir, 'public', 'css', 'style.css'), 'utf8');

console.log('=== CSS Root Variables ===');
const rootIdx = css.indexOf(':root');
if (rootIdx !== -1) {
  console.log(css.substring(rootIdx, rootIdx + 1200));
}

console.log('\n=== Header Markup ===');
const headerIdx = html.indexOf('<header');
if (headerIdx !== -1) {
  console.log(html.substring(headerIdx, headerIdx + 1500));
}
