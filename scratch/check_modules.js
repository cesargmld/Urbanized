const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';

function checkModule(filePath) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    // Using vm.Script with module detection
    new vm.SourceTextModule(code, { context: vm.createContext({}) });
    console.log(`✓ Module syntax OK: ${path.basename(filePath)}`);
  } catch (err) {
    if (err.name === 'SyntaxError') {
      console.error(`✗ Module syntax ERROR in ${path.basename(filePath)}:`, err);
    } else {
      console.log(`✓ Module parsed (non-syntax error: ${err.message}): ${path.basename(filePath)}`);
    }
  }
}

checkModule(path.join(repoDir, 'public', 'js', 'preview.js'));
checkModule(path.join(repoDir, 'public', 'js', 'mapplan.js'));
checkModule(path.join(repoDir, 'public', 'js', 'app.js'));
