const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const startIdx = html.indexOf('function updateCompositorSheetView()');
const endIdx = html.indexOf('function exportCompositeSheet4K()');

console.log('startIdx:', startIdx, 'endIdx:', endIdx);
console.log(html.substring(startIdx, endIdx));
