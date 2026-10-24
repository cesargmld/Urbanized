const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const appPath = path.join(repoDir, 'public', 'js', 'app.js');
let app = fs.readFileSync(appPath, 'utf8');

const target = "buildBtn?.addEventListener('click', (e) => {\r\n  e.preventDefault();\r\n  if (panel.requestSubmit) {\r\n    panel.requestSubmit();\r\n  } else {\r\n    panel.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));\r\n  }\r\n});\r\n\r\n";

if (app.includes(target)) {
  app = app.replace(target, '');
  fs.writeFileSync(appPath, app, 'utf8');
  console.log('✓ Successfully removed duplicate/preventing buildBtn click listener');
} else {
  // Try with \n
  const targetLF = target.replace(/\r\n/g, '\n');
  if (app.includes(targetLF)) {
    app = app.replace(targetLF, '');
    fs.writeFileSync(appPath, app, 'utf8');
    console.log('✓ Successfully removed duplicate/preventing buildBtn click listener (LF)');
  } else {
    console.log('Target not found!');
  }
}
