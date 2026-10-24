const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const lines = html.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('<main') || line.includes('</main>') || line.includes('id="app"') || line.includes('id="result"') || line.includes('id="mapper"') || line.includes('id="illustrator"')) {
    console.log(`${i+1}: ${line.trim().slice(0, 80)}`);
  }
}
