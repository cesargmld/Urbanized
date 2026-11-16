const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const scripts = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)];
scripts.forEach((m, idx) => {
  try {
    new vm.SourceTextModule(m[1], { context: vm.createContext({}) });
    console.log(`✓ Inline Script #${idx + 1} syntax OK as module`);
  } catch (err) {
    if (err.name === 'SyntaxError') {
      console.error(`✗ Inline Script #${idx + 1} SYNTAX ERROR:`, err.message);
    } else {
      console.log(`✓ Inline Script #${idx + 1} parsed OK (${err.message})`);
    }
  }
});
