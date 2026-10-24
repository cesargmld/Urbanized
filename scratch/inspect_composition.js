const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

console.log('HTML length:', html.length);
console.log('Includes updateCompositorSheetView?', html.includes('updateCompositorSheetView'));

// Find where updateCompositorSheetView is defined
const idx = html.indexOf('updateCompositorSheetView');
if (idx !== -1) {
    console.log('Snippet around updateCompositorSheetView:');
    console.log(html.substring(Math.max(0, idx - 100), Math.min(html.length, idx + 800)));
}

// Find where #composition is defined
const compIdx = html.indexOf('id="composition"');
if (compIdx !== -1) {
    console.log('\nSnippet around id="composition":');
    console.log(html.substring(Math.max(0, compIdx - 50), Math.min(html.length, compIdx + 600)));
}
