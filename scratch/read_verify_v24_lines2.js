const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const code = fs.readFileSync(path.join(repoDir, 'scratch', 'verify_v24.js'), 'utf8');
console.log(code.substring(2900, 4800));
