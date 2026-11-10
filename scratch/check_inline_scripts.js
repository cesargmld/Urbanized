const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('public/index.html', 'utf8');
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match, idx = 0;
while ((match = scriptRegex.exec(html)) !== null) {
  idx++;
  const tag = match[0].split('>')[0];
  const code = match[1];
  if (tag.includes('src=') || tag.includes('type="importmap"')) continue;
  try {
    new vm.Script(code);
    console.log('Script #' + idx + ' (' + tag + '): OK');
  } catch (e) {
    console.error('ERROR in script #' + idx + ':', e.message);
  }
}
