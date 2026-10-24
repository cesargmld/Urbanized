const fs = require('fs');
let css = fs.readFileSync('public/css/style.css', 'utf8');

css = css.replace(
  'left: 360px !important;\n  right: 250px !important;',
  'left: 360px !important;\n  right: 400px !important;\n  max-width: 800px !important;'
);

fs.writeFileSync('public/css/style.css', css, 'utf8');
console.log('style.css updated with right: 400px for section dock!');
