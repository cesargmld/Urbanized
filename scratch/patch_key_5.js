const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const htmlPath = path.join(repoDir, 'public', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const target = `      if (e.key === '4') {
        const btn = document.getElementById('view-btn-illu');
        if (btn && !btn.classList.contains('disabled')) switchView('illustrator');
      }`;

const replacement = `      if (e.key === '4') {
        const btn = document.getElementById('view-btn-illu');
        if (btn && !btn.classList.contains('disabled')) switchView('illustrator');
      }
      if (e.key === '5') {
        const btn = document.getElementById('view-btn-comp');
        if (btn && !btn.classList.contains('disabled')) switchView('composition');
      }`;

if (html.includes(target)) {
  html = html.replace(target, replacement);
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('✓ Added key 5 shortcut for composition');
} else {
  console.log('Target for key 4 not found');
}
