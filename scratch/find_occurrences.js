const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

let pos = 0;
while (true) {
    const idx = html.indexOf('updateCompositorSheetView', pos);
    if (idx === -1) break;
    console.log(`Found at index ${idx}:`);
    console.log(html.substring(Math.max(0, idx - 50), Math.min(html.length, idx + 250)));
    console.log('---');
    pos = idx + 25;
}
