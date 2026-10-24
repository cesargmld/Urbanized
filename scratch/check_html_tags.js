const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');

const voidTags = new Set(['img', 'input', 'line', 'polyline', 'polygon', 'path', 'circle', 'rect', 'br', 'hr', 'meta', 'link']);

// Match all tags anywhere in the file
const tagRegex = /<(\/?[a-zA-Z0-9_-]+)([^>]*)>/g;
let match;
let stack = [];

// Calculate line numbers
function getLine(index) {
  return html.slice(0, index).split('\n').length;
}

while ((match = tagRegex.exec(html)) !== null) {
  const full = match[0];
  const name = match[1].toLowerCase();
  const attrs = match[2];
  const line = getLine(match.index);

  if (line < 590 || line > 1365) continue;

  const cleanName = name.replace('/', '');
  if (full.endsWith('/>') || voidTags.has(cleanName)) continue;

  if (name.startsWith('/')) {
    const tag = name.slice(1);
    const top = stack.pop();
    if (!top) {
      console.log(`Line ${line}: EXTRA CLOSE </${tag}>`);
    } else if (top.name !== tag) {
      console.log(`Line ${line}: MISMATCH close </${tag}> expected </${top.name}> opened at Line ${top.line} (${top.id || top.cls})`);
      // push it back or see what broke
    }
  } else {
    const idMatch = attrs.match(/id=["']([^"']+)["']/);
    const clsMatch = attrs.match(/class=["']([^"']+)["']/);
    const id = idMatch ? idMatch[1] : '';
    const cls = clsMatch ? clsMatch[1] : '';
    stack.push({ name, line, id, cls });
  }
}

console.log('Remaining open tags in range:');
stack.forEach(s => console.log(`  <${s.name} id="${s.id}" class="${s.cls}"> (line ${s.line})`));
