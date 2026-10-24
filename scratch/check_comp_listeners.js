const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

// Find all occurrences of document.getElementById('comp- in the file
const matches = [...html.matchAll(/getElementById\(['"](comp-[^'"]+)['"]\)/g)].map(m => m[1]);
console.log('Unique comp- IDs with getElementById:\n', [...new Set(matches)].join('\n'));
