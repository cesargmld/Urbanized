const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const preview = fs.readFileSync(path.join(repoDir, 'public', 'js', 'preview.js'), 'utf8');

console.log('preview.js has window.setBuildingFinish?', preview.includes('window.setBuildingFinish'));
