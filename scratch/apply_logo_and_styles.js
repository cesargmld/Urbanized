const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
let html = fs.readFileSync(path.join(repoDir, 'public/index.html'), 'utf8');

// 1. Replace Header Logo
html = html.replace(
  /<div class="axiom-brand" id="axiom-brand-btn"[\s\S]*?<\/div>/,
  `<div class="axiom-brand" id="axiom-brand-btn" role="button" tabindex="0" data-switchview="workspace-home" style="cursor:pointer;" title="URBNZD">
        <img src="assets/urbnzd-logo.png" alt="URBNZD" class="axiom-header-logo" />
      </div>`
);

// 2. Replace Loader Logo
html = html.replace(
  /<div class="rayon-loader-glyph-wrap"[\s\S]*?<\/div>/,
  `<div class="rayon-loader-glyph-wrap" style="display:flex; flex-direction:column; align-items:center; gap:12px; margin-bottom:18px;">
        <img src="assets/urbnzd-logo.png" alt="URBNZD" class="axiom-loader-logo" />
      </div>`
);

// 3. Update top dynamic island capsule (remove dot toggles, use MONOCHROME, SATELLITE, DARK MAP in uppercase)
html = html.replace(
  /<div class="axiom-island-capsule" role="group" aria-label="Capa base">[\s\S]*?<\/div>/,
  `<div class="axiom-island-capsule" role="group" aria-label="Capa base">
          <button type="button" class="axiom-island-btn active" id="map-btn-monochrome" data-base="monochrome" title="Monochrome High-Contrast Satellite">
            <span>MONOCHROME</span>
          </button>
          <button type="button" class="axiom-island-btn" id="map-btn-sat" data-base="sat" title="Color Satellite Imagery">
            <span>SATELLITE</span>
          </button>
          <button type="button" class="axiom-island-btn" id="map-btn-vector" data-base="map" title="Dark Technical CAD Map">
            <span>DARK MAP</span>
          </button>
        </div>`
);

// 4. Update inner target of frame to include white building footprint polygon like the reference image
html = html.replace(
  /<div class="frame-inner-target">[\s\S]*?<\/div>/,
  `<div class="frame-inner-target">
          <div class="frame-inner-poly"></div>
          <span class="frame-inner-label">ÁREA DE PROYECTO</span>
        </div>`
);

// 5. Replace Section checkboxes with subtle animated segmented buttons
html = html.replace(
  /<div class="axiom-dot-list">\s*<label class="axiom-check-row">\s*<span data-i18n="sec\.cutBldgs">[\s\S]*?<\/div>/,
  `<div class="axiom-seg" role="group" style="margin-top:8px; margin-bottom:10px;">
              <button type="button" class="axiom-seg-item active" id="btn-sec-bldgs" aria-pressed="true">EDIFICIOS</button>
              <button type="button" class="axiom-seg-item active" id="btn-sec-trees" aria-pressed="true">VEGETACIÓN</button>
            </div>
            <input type="checkbox" id="sec-buildings" checked hidden>
            <input type="checkbox" id="sec-trees" checked hidden>`
);

fs.writeFileSync(path.join(repoDir, 'public/index.html'), html, 'utf8');
console.log('Successfully updated index.html!');
