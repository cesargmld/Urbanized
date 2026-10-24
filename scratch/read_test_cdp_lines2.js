const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const code = fs.readFileSync(path.join(repoDir, 'scratch', 'test_cdp.js'), 'utf8');
console.log(code.substring(2900, 5000));
