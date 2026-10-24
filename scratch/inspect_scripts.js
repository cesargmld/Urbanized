const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const scriptTags = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*>/g)].map(m => m[1]);
console.log('Script sources in index.html:\n', scriptTags.join('\n'));

// Check where inline scripts start
const inlineStarts = [...html.matchAll(/<script(?![^>]*src=)[^>]*>/g)].map(m => m.index);
console.log('Inline script start indices:', inlineStarts);
