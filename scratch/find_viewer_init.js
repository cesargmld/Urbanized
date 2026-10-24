const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const preview = fs.readFileSync(path.join(repoDir, 'public', 'js', 'preview.js'), 'utf8');
const app = fs.readFileSync(path.join(repoDir, 'public', 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

console.log('--- preview.js ---');
const idx = preview.indexOf('function init(');
if (idx !== -1) {
  console.log(preview.substring(idx - 50, idx + 600));
} else {
  const idx2 = preview.indexOf('viewer');
  console.log(preview.substring(idx2 - 50, idx2 + 600));
}

console.log('\n--- Where is showModel called in app.js? ---');
const appIdx = app.indexOf('showModel(');
if (appIdx !== -1) {
  console.log(app.substring(appIdx - 100, appIdx + 600));
}
