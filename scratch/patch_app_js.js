const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo\\public\\js\\app.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldBlock = `const bases = {
  bwnoise: L.layerGroup([
    tiles('World_Imagery', 18),
    tiles('Reference/World_Boundaries_and_Places', 18)
  ]),
  sat: L.layerGroup([
    tiles('World_Imagery', 18),
    tiles('Reference/World_Boundaries_and_Places', 18)
  ]),
  map: L.layerGroup([
    tiles('Canvas/World_Dark_Gray_Base', 16),
    tiles('Canvas/World_Dark_Gray_Reference', 16)
  ]),
};
let baseName = 'bwnoise';
store.set('ue:base', 'bwnoise');
bases[baseName].addTo(map);
document.getElementById('map')?.classList.add('map-style-bwnoise');
map.attributionControl.setPrefix(false);

function setBaseMap(name) {
  if (name === baseName) return;
  map.removeLayer(bases[baseName]);
  baseName = name;
  bases[baseName].addTo(map);
  store.set('ue:base', baseName);

  const isBw = baseName === 'bwnoise';
  document.getElementById('map')?.classList.toggle('map-style-bwnoise', isBw);
  const grid = document.getElementById('map-grid-overlay');
  if (grid) grid.style.display = isBw ? 'block' : 'none';
  const noise = document.getElementById('map-noise-overlay');
  if (noise) noise.style.display = isBw ? 'block' : 'none';
  const coordsNw = document.getElementById('map-coord-nw');
  if (coordsNw) coordsNw.style.display = isBw ? 'block' : 'none';
  const coordsSw = document.getElementById('map-coord-sw');
  if (coordsSw) coordsSw.style.display = isBw ? 'block' : 'none';

  document.querySelectorAll('[data-base]').forEach((b) => {
    const isThis = b.dataset.base === baseName;
    b.setAttribute('aria-pressed', String(isThis));
    b.classList.toggle('active', isThis);
    const dot = b.querySelector('.axiom-island-dot') || b.querySelector('.axiom-dot');
    if (dot) dot.classList.toggle('active', isThis);
  });
}
window.setBaseMap = setBaseMap;`;

const newBlock = `const bases = {
  monochrome: L.layerGroup([
    tiles('World_Imagery', 18),
    tiles('Reference/World_Boundaries_and_Places', 18)
  ]),
  sat: L.layerGroup([
    tiles('World_Imagery', 18),
    tiles('Reference/World_Boundaries_and_Places', 18)
  ]),
  map: L.layerGroup([
    tiles('Canvas/World_Dark_Gray_Base', 16),
    tiles('Canvas/World_Dark_Gray_Reference', 16)
  ]),
};
bases.bwnoise = bases.monochrome;
let baseName = 'monochrome';
store.set('ue:base', 'monochrome');
bases[baseName].addTo(map);
document.getElementById('map')?.classList.add('map-style-monochrome');
map.attributionControl.setPrefix(false);

function setBaseMap(name) {
  if (name === 'bwnoise') name = 'monochrome';
  if (name === baseName) return;
  map.removeLayer(bases[baseName]);
  baseName = name;
  bases[baseName].addTo(map);
  store.set('ue:base', baseName);

  const isMono = baseName === 'monochrome';
  document.getElementById('map')?.classList.toggle('map-style-monochrome', isMono);
  document.getElementById('map')?.classList.remove('map-style-bwnoise');
  const grid = document.getElementById('map-grid-overlay');
  if (grid) grid.style.display = isMono ? 'block' : 'none';
  const coordsNw = document.getElementById('map-coord-nw');
  if (coordsNw) coordsNw.style.display = isMono ? 'block' : 'none';
  const coordsSw = document.getElementById('map-coord-sw');
  if (coordsSw) coordsSw.style.display = isMono ? 'block' : 'none';

  document.querySelectorAll('[data-base]').forEach((b) => {
    const isThis = b.dataset.base === baseName || (baseName === 'monochrome' && b.dataset.base === 'bwnoise');
    b.setAttribute('aria-pressed', String(isThis));
    b.classList.toggle('active', isThis);
  });
}
window.setBaseMap = setBaseMap;

// Toggle buttons for section tools (buildings & trees)
document.getElementById('btn-sec-bldgs')?.addEventListener('click', function() {
  this.classList.toggle('active');
  const cb = document.getElementById('sec-buildings');
  if (cb) cb.checked = this.classList.contains('active');
});
document.getElementById('btn-sec-trees')?.addEventListener('click', function() {
  this.classList.toggle('active');
  const cb = document.getElementById('sec-trees');
  if (cb) cb.checked = this.classList.contains('active');
});`;

// Normalize line endings
content = content.replace(/\r\n/g, '\n');
const normalizedOld = oldBlock.replace(/\r\n/g, '\n');

if (content.includes(normalizedOld)) {
  content = content.replace(normalizedOld, newBlock.replace(/\r\n/g, '\n'));
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated app.js!');
} else {
  console.error('Could not find old block in app.js');
}
