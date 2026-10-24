const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';

// ==========================================
// 1. UPDATE public/index.html
// ==========================================
let html = fs.readFileSync(path.join(repoDir, 'public/index.html'), 'utf8');

// A. Clean up header left: Remove clunky blue Workspace pill next to logo
html = html.replace(
  /<header class="axiom-topbar">[\s\S]*?<div class="axiom-topbar-center">/,
  `<header class="axiom-topbar">
    <div class="axiom-topbar-left">
      <div class="axiom-brand" id="axiom-brand-btn" role="button" tabindex="0" data-switchview="workspace-home" style="cursor:pointer;" title="URBNZD">
        <img src="assets/urbnzd-logo.png" alt="URBNZD" class="axiom-header-logo" />
      </div>

      <!-- Clean Minimal Search Bar -->
      <div class="axiom-search-box search">
        <svg class="axiom-search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input id="q" type="search" placeholder="SEARCH LOCATION..." aria-label="Buscar lugar" data-i18n-ph="search.ph" data-i18n-aria="search.aria" autocomplete="off">
        <ul id="results" class="results" hidden></ul>
      </div>
    </div>

    <!-- Center Mode Switcher Capsule -->
    <div class="axiom-topbar-center">`
);

// B. Remove inner target / fake building polygon from #frame
html = html.replace(
  /<div class="frame" id="frame">[\s\S]*?<\/div>\s*<\/div>\s*<!-- Frame Top Dimension Badge -->/g,
  `<div class="frame" id="frame">
        <div class="frame-bracket top-left"></div>
        <div class="frame-bracket top-right"></div>
        <div class="frame-bracket bottom-left"></div>
        <div class="frame-bracket bottom-right"></div>

        <!-- Frame Top Dimension Badge -->`
);

// Fallback removal if regex doesn't catch exact spacing
html = html.replace(/<div class="frame-inner-target">[\s\S]*?<\/div>/g, '');

// C. Update top island capsule to fine text group
html = html.replace(
  /<div class="axiom-island-capsule"[\s\S]*?<\/div>/,
  `<div class="axiom-island-capsule" role="group" aria-label="Capa base">
          <button type="button" class="axiom-island-btn active" id="map-btn-monochrome" data-base="monochrome" title="Monochrome Satellite">MONOCHROME</button>
          <span class="axiom-island-sep">/</span>
          <button type="button" class="axiom-island-btn" id="map-btn-sat" data-base="sat" title="Color Satellite">SATELLITE</button>
          <span class="axiom-island-sep">/</span>
          <button type="button" class="axiom-island-btn" id="map-btn-vector" data-base="map" title="Dark CAD Map">DARK MAP</button>
        </div>`
);

fs.writeFileSync(path.join(repoDir, 'public/index.html'), html, 'utf8');
console.log('index.html updated successfully!');

// ==========================================
// 2. UPDATE public/js/app.js
// ==========================================
let appJs = fs.readFileSync(path.join(repoDir, 'public/js/app.js'), 'utf8');

// Ensure minZoom: 12 on map
if (!appJs.includes('minZoom: 12')) {
  appJs = appJs.replace(
    /L\.map\('map',\s*\{([^}]+)\}\)/,
    "L.map('map', { $1, minZoom: 12 })"
  );
}

// In drawFrame, clamp px to min 50px so it never collapses to a dot on zoom out
appJs = appJs.replace(
  /const px = size \/ mpp;/,
  'const px = Math.max(50, size / mpp);'
);

fs.writeFileSync(path.join(repoDir, 'public/js/app.js'), appJs, 'utf8');
console.log('app.js updated successfully!');
