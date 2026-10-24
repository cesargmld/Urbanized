const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const mapplan = fs.readFileSync(path.join(repoDir, 'public', 'js', 'mapplan.js'), 'utf8');

const idx = mapplan.indexOf('export const MAP_PRESETS =');
console.log(mapplan.substring(idx, idx + 2500));
