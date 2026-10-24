const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const css = fs.readFileSync(path.join(repoDir, 'public', 'css', 'style.css'), 'utf8');

const idx = css.indexOf('#mapper');
console.log(css.substring(idx, idx + 1000));
