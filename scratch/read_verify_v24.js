const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const code = fs.readFileSync(path.join(repoDir, 'scratch', 'verify_v24_cdp.js'), 'utf8');
console.log(code.substring(0, 1500));
