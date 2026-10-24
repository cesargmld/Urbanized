const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';

function checkJsSyntax(filePath) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    new Function(code);
    console.log(`✓ Syntax OK: ${path.basename(filePath)}`);
  } catch (err) {
    console.error(`✗ Syntax ERROR in ${path.basename(filePath)}:`, err.message);
  }
}

// For index.html, extract scripts
function checkHtmlScripts(filePath) {
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    const scripts = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)];
    console.log(`Checking ${scripts.length} inline scripts in ${path.basename(filePath)}...`);
    scripts.forEach((m, idx) => {
      try {
        new Function(m[1]);
        console.log(`  ✓ Script #${idx + 1} syntax OK`);
      } catch (e) {
        console.error(`  ✗ Script #${idx + 1} syntax ERROR:`, e.message);
      }
    });
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
  }
}

checkJsSyntax(path.join(repoDir, 'public', 'js', 'mapplan.js'));
checkHtmlScripts(path.join(repoDir, 'public', 'index.html'));
