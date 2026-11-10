const { spawnSync } = require('child_process');
const fs = require('fs');

const files = [
  'public/js/data.js',
  'public/js/exporters.js',
  'public/js/preview.js',
  'public/js/pins.js',
  'public/js/feasibility.js',
  'public/js/mapplan.js',
  'public/js/biodiversity.js',
  'public/js/i18n.js',
  'public/js/section.js',
  'public/js/illustrate.js',
  'public/js/viewsManager.js',
  'public/js/billing.js',
  'public/js/pricing.js',
  'public/js/app.js'
];

for (const f of files) {
  const res = spawnSync('node', ['--check', f], { encoding: 'utf8' });
  if (res.status !== 0) {
    console.error('SYNTAX ERROR in', f, res.stderr);
  } else {
    console.log('OK:', f);
  }
}
