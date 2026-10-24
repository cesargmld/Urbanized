const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const html = fs.readFileSync(path.join(repoDir, 'public', 'index.html'), 'utf8');

const scripts = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)];
const s3 = scripts[2][1];

let pos = 0;
while (true) {
  const idx = s3.indexOf('JetBrains', pos);
  if (idx === -1) break;
  console.log(`JetBrains at ${idx}:`);
  console.log(s3.substring(Math.max(0, idx - 50), Math.min(s3.length, idx + 80)));
  console.log('---');
  pos = idx + 10;
}
