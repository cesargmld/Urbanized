const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const code = fs.readFileSync(path.join(repoDir, 'scratch', 'check_nolli_svg.js'), 'utf8');
console.log(code.substring(1500, 3500));
