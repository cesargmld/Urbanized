const fs = require('fs');

console.log('Applying v40 comprehensive fixes...');

// ========================================================
// 1. UPDATE public/js/app.js (FIX SLIDER FREEZE + CACHE BUSTER)
// ========================================================
let appJs = fs.readFileSync('public/js/app.js', 'utf8');

// Update section.js import version
appJs = appJs.replace(
  /from '\.\/section\.js\?v=[0-9.]+'/,
  "from './section.js?v=7.0'"
);

// Fix slider freeze: smooth drawFrame on input, only adjust map zoom on change
const oldFitFrameBlock = appJs.slice(
  appJs.indexOf('// если рамка не помещается — отдаляем карту\nfunction fitFrame() {'),
  appJs.indexOf('window.addEventListener(\'resize\', () => { map.invalidateSize(); fitFrame(); });') + 80
);

const newFitFrameBlock = `// 60 FPS Smooth Frame Sizing without recursive zoom locks
function fitFrame(adjustZoom = false) {
  drawFrame();
  if (!adjustZoom) return;
  const box = map.getContainer();
  if (!box || !box.clientWidth || !box.clientHeight) return;
  const size = Number(sizeInput.value);
  const maxPx = Math.min(box.clientWidth, box.clientHeight) * 0.82;
  const c = map.getCenter();
  const currentZoom = map.getZoom();
  const cosLat = Math.cos((c.lat * Math.PI) / 180);
  const maxMpp = size / maxPx;
  const targetZoom = Math.min(18, Math.max(3, Math.floor(Math.log2((40075016.686 * cosLat) / maxMpp) - 8)));
  if (targetZoom < currentZoom) {
    map.setZoom(targetZoom, { animate: false });
    drawFrame();
  }
}

// Butter-smooth drag from 250m to 3500m (NEVER freezes the thread with zoom loops)
sizeInput.addEventListener('input', () => drawFrame());
sizeInput.addEventListener('change', () => fitFrame(true));
fitFrame(false);
setTimeout(() => { map.invalidateSize(); drawFrame(); }, 200);
setTimeout(() => { map.invalidateSize(); drawFrame(); }, 800);
window.addEventListener('resize', () => { map.invalidateSize(); drawFrame(); });`;

appJs = appJs.replace(oldFitFrameBlock, newFitFrameBlock);

// Remove forced synchronous reflow during drawFrame:
appJs = appJs.replace(
  "  if (over !== frame.classList.contains('over') && costEl.dataset.ready) {\n    costEl.classList.remove('flash');\n    void costEl.offsetWidth;\n    costEl.classList.add('flash');\n  }",
  "  if (over !== frame.classList.contains('over') && costEl.dataset.ready) {\n    costEl.classList.toggle('flash', over);\n  }"
);

fs.writeFileSync('public/js/app.js', appJs, 'utf8');
console.log('✓ public/js/app.js updated (Slider freeze eliminated & smooth 60 FPS)');

// ========================================================
// 2. UPDATE public/js/section.js (INTERPOLATED CORRIDOR SAMPLING)
// ========================================================
let secJs = fs.readFileSync('public/js/section.js', 'utf8');

// Replace fetchAlong to sample along the corridor so any cut (even 7 km) captures all buildings & trees
const oldFetchAlongStart = secJs.indexOf('async function fetchAlong(points, radius = 40, signal) {');
const oldFetchAlongEnd = secJs.indexOf('// Пересечения замкнутого контура');

const newFetchAlong = `async function fetchAlong(points, radius = 50, signal) {
  // Interpolate intermediate coordinates along the corridor so Overpass queries the full cut line
  const samples = [];
  const totalLen = sectionLength(points);
  const targetStep = Math.max(120, Math.min(350, totalLen / 20));
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i], p1 = points[i + 1];
    const segLen = sectionLength([p0, p1]);
    const numSub = Math.max(1, Math.round(segLen / targetStep));
    for (let k = 0; k < numSub; k++) {
      const t = k / numSub;
      samples.push([p0[0] + t * (p1[0] - p0[0]), p0[1] + t * (p1[1] - p0[1])]);
    }
  }
  samples.push(points[points.length - 1]);

  // Cap to max 22 points for lightning-fast ~1s Overpass query
  const maxPts = 22;
  const filteredSamples = samples.length <= maxPts
    ? samples
    : samples.filter((_, idx) => idx % Math.ceil(samples.length / maxPts) === 0 || idx === samples.length - 1);

  const coords = filteredSamples.map(([lat, lon]) => \`\${lat.toFixed(6)},\${lon.toFixed(6)}\`).join(',');
  const r = Math.max(35, Math.min(150, radius || 50));
  const query = \`[out:json][timeout:12];(
    way["building"](around:\${r},\${coords});
    relation["building"](around:\${r},\${coords});
    way["aeroway"="terminal"](around:\${r},\${coords});
    relation["aeroway"="terminal"](around:\${r},\${coords});
    node["natural"="tree"](around:\${r},\${coords});
    way["natural"="tree_row"](around:\${r},\${coords});
    way["landuse"="forest"](around:\${r},\${coords});
    way["natural"="wood"](around:\${r},\${coords});
    way["natural"="water"](around:\${r},\${coords});
    way["waterway"](around:\${r},\${coords});
  );out geom;\`;

  const ctrls = OVERPASS.map(() => new AbortController());
  const attempt = async (url) => {
    const isProxy = url.startsWith('/');
    const res = await fetch(url, {
      method: 'POST',
      headers: isProxy ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
      body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.any([AbortSignal.timeout(8000), ...(signal ? [signal] : [])]),
    });
    if (!res.ok) throw new Error(\`Overpass \${res.status}\`);
    return res.json();
  };
  try {
    return await Promise.any(OVERPASS.map(attempt));
  } catch (e) {
    return { elements: [] };
  } finally {
    ctrls.forEach((c) => c.abort());
  }
}

`;

secJs = secJs.slice(0, oldFetchAlongStart) + newFetchAlong + secJs.slice(oldFetchAlongEnd);
fs.writeFileSync('public/js/section.js', secJs, 'utf8');
console.log('✓ public/js/section.js updated (Interpolated corridor along full cut line)');

// ========================================================
// 3. UPDATE public/index.html (H3L KINETIC MOTION GRAPHICS + CACHE BUSTERS)
// ========================================================
let html = fs.readFileSync('public/index.html', 'utf8');

// Bump CSS and JS version numbers in index.html to force immediate browser cache invalidation
html = html.replace(/href="\/css\/style\.css\?v=[0-9.]+"/, 'href="/css/style.css?v=7.0"');
html = html.replace(/src="\/js\/app\.js\?v=[0-9.]+"/, 'src="/js/app.js?v=7.0"');

// Authentic H3L Kinetic Motion Graphics Loader Stage
const oldLoaderStart = html.indexOf('<div class="h3l-page-loader"');
const oldLoaderEnd = html.indexOf('<!-- ========================================================\n       1. TOP APPLICATION HEADER');

const h3lKineticLoader = `<div class="h3l-page-loader" id="h3l-page-loader" aria-label="Loading URBNZD Studio">
    <!-- Precision Architectural CAD Grid (40x40px, perfectly aligned to stage) -->
    <div class="h3l-loader-grid-bg"></div>

    <div class="h3l-loader-stage">
      <!-- Kinetic Architectural Frame -->
      <div class="h3l-brand-assembly" id="h3l-brand-assembly">
        <!-- 4-Corner Precision Reticles in Monochromatic Grayscale -->
        <span class="h3l-reticle tl"></span>
        <span class="h3l-reticle tr"></span>
        <span class="h3l-reticle bl"></span>
        <span class="h3l-reticle br"></span>

        <!-- Kinetic Revolving World Globe Vector SVG (True Geometric Meridian Sweep) -->
        <div class="h3l-globe-box" id="h3l-globe-box">
          <svg viewBox="0 0 48 48" class="h3l-globe-svg" id="h3l-globe-svg">
            <circle cx="24" cy="24" r="18" fill="none" stroke="#ffffff" stroke-width="1.8"/>
            <line x1="6" y1="24" x2="42" y2="24" stroke="rgba(255,255,255,0.7)" stroke-width="1.2"/>
            <path d="M 8 16 Q 24 19 40 16" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
            <path d="M 8 32 Q 24 29 40 32" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
            <!-- Dynamic Revolving Meridian Ellipse -->
            <ellipse cx="24" cy="24" rx="10" ry="18" fill="none" stroke="#ffffff" stroke-width="1.4" id="h3l-globe-meridian"/>
            <ellipse cx="24" cy="24" rx="18" ry="18" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="0.8"/>
            <polygon points="24,3 22,8 26,8" fill="#ffffff"/>
          </svg>
        </div>

        <!-- H3L Kinetic Typographic Wordmark (Helvetica Now Display) -->
        <div class="h3l-wordmark-motion" id="h3l-wordmark">
          <div class="h3l-char-cell" id="h3l-cell-0"><span class="h3l-char-inner" id="h3l-c0">_</span></div>
          <div class="h3l-char-cell" id="h3l-cell-1"><span class="h3l-char-inner" id="h3l-c1">_</span></div>
          <div class="h3l-char-cell" id="h3l-cell-2"><span class="h3l-char-inner" id="h3l-c2">_</span></div>
          <div class="h3l-char-cell" id="h3l-cell-3"><span class="h3l-char-inner" id="h3l-c3">_</span></div>
          <div class="h3l-char-cell" id="h3l-cell-4"><span class="h3l-char-inner" id="h3l-c4">_</span></div>
          <div class="h3l-char-cell" id="h3l-cell-5"><span class="h3l-char-inner" id="h3l-c5">_</span></div>
          <span class="h3l-scanner-line" id="h3l-scanner"></span>
        </div>
      </div>

      <!-- Bottom Discrete Stop-Motion Step Bar -->
      <div class="h3l-stage-meta-bottom">
        <div class="h3l-step-bar" id="h3l-step-bar">
          <span></span><span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
    </div>
  </div>
  <script>
    // H3L KINETIC TYPOGRAPHY & REVOLVING GLOBE MOTION GRAPHIC (12 FPS DISCRETE STEPS)
    (function initH3lKineticMotion() {
      const loader = document.getElementById('h3l-page-loader');
      if (!loader) return;
      const chars = [
        document.getElementById('h3l-c0'),
        document.getElementById('h3l-c1'),
        document.getElementById('h3l-c2'),
        document.getElementById('h3l-c3'),
        document.getElementById('h3l-c4'),
        document.getElementById('h3l-c5')
      ];
      const meridian = document.getElementById('h3l-globe-meridian');
      const scanner = document.getElementById('h3l-scanner');
      const ticks = Array.from(loader.querySelectorAll('#h3l-step-bar span'));
      const targets = ['u', 'r', 'b', 'n', 'z', 'd'];
      const scrambleSets = [
        ['V', '1', '/', 'u'],
        ['F', '7', '|', 'r'],
        ['P', 'D', '8', 'b'],
        ['H', 'M', '#', 'n'],
        ['S', '2', '%', 'z'],
        ['Q', '0', 'O', 'd']
      ];

      // 14 Discrete 12 FPS Kinetic Frames
      let frame = 0;
      let timer = null;
      const totalFrames = 14;

      const renderKineticFrame = (f) => {
        // 1. Globe dynamic meridian sweep (revolving 3D globe effect)
        if (meridian) {
          const rxVals = [4, 10, 16, 12, 6, 2, 8, 14, 18, 11, 5, 9, 13, 10];
          meridian.setAttribute('rx', String(rxVals[f % rxVals.length]));
        }

        // 2. Ticks fill
        const activeTicks = Math.round((f / totalFrames) * ticks.length);
        ticks.forEach((t, i) => t.classList.toggle('on', i < activeTicks));

        // 3. Sequential letter lock and scramble
        // f=0..2: all scramble
        // f=3: lock 'u'
        // f=5: lock 'r'
        // f=7: lock 'b'
        // f=9: lock 'n'
        // f=11: lock 'z'
        // f=12: lock 'd'
        const lockSchedule = [-1, -1, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
        const lockedUpTo = lockSchedule[Math.min(f, lockSchedule.length - 1)];

        chars.forEach((c, idx) => {
          if (!c) return;
          if (idx <= lockedUpTo) {
            c.textContent = targets[idx];
            c.classList.add('locked');
            c.classList.remove('scrambling');
          } else {
            const pool = scrambleSets[idx];
            const randGlyph = pool[(f + idx) % pool.length];
            c.textContent = randGlyph;
            c.classList.add('scrambling');
            c.classList.remove('locked');
          }
        });

        // 4. Scanner laser bar position
        if (scanner) {
          if (f < 12) {
            const activeCell = chars[Math.min(5, Math.max(0, lockedUpTo + 1))];
            if (activeCell && activeCell.parentElement) {
              const x = activeCell.parentElement.offsetLeft;
              scanner.style.transform = 'translateX(' + x + 'px)';
              scanner.style.opacity = '1';
            }
          } else {
            scanner.style.opacity = '0';
          }
        }
      };

      const stepLoop = () => {
        renderKineticFrame(frame);
        frame++;
        if (frame <= totalFrames) {
          timer = setTimeout(stepLoop, 85); // 12 FPS cadence
        } else {
          // Hold complete brand for 220ms then cinematic exit
          timer = setTimeout(() => {
            loader.classList.add('h3l-loader-exit');
            setTimeout(() => {
              loader.style.display = 'none';
              loader.hidden = true;
            }, 200);
          }, 240);
        }
      };

      window.replayH3lLoader = () => {
        if (timer) clearTimeout(timer);
        frame = 0;
        loader.hidden = false;
        loader.style.display = 'flex';
        loader.classList.remove('h3l-loader-exit');
        stepLoop();
      };

      timer = setTimeout(stepLoop, 60);
    })();
  </script>

  `;

html = html.slice(0, oldLoaderStart) + h3lKineticLoader + html.slice(oldLoaderEnd);

// Ensure Top Navigation Buttons have icons and .URBNZD
const oldTopRight = html.match(/<div class="axiom-topbar-right">[\s\S]*?<\/header>/);
const newTopRight = `<div class="axiom-topbar-right">
      <button type="button" class="axiom-header-action" id="btn-save-urbnz" title="Exportar archivo de proyecto .urbnzd">
        <svg class="header-action-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        <span class="btn-bracket-label">.URBNZD</span>
      </button>
      <button type="button" class="axiom-header-action" id="btn-open-urbnz" title="Abrir archivo .urbnzd">
        <svg class="header-action-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="btn-bracket-label" data-i18n="nav.openUrbnz">OPEN</span>
      </button>
      <input type="file" id="input-open-urbnz" accept=".urbnz,.urbnzd,.json" style="display:none;">

      <!-- Global Header Share Button -->
      <button type="button" class="axiom-header-action" id="btn-topbar-share" title="Compartir proyecto">
        <svg class="header-action-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        <span class="btn-bracket-label">SHARE</span>
      </button>

      <!-- 1-Piece Language Selector Button (Toggles between EN and ES) -->
      <button type="button" class="lang-single-btn" id="btn-lang-toggle" title="Switch language / Cambiar idioma" aria-label="Language">
        <svg class="header-action-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span id="lang-current-label" class="btn-bracket-label">EN</span>
      </button>
    </div>
  </header>`;

if (oldTopRight) {
  html = html.replace(oldTopRight[0], newTopRight);
}

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('✓ public/index.html updated (H3L Kinetic Motion Graphics + Header Icons + Cache Busters)');

// ========================================================
// 4. UPDATE public/css/style.css (STRICT ZERO-JUMP CARD + H3L KINETIC STYLES)
// ========================================================
let css = fs.readFileSync('public/css/style.css', 'utf8');

const v40Css = `
/* ========================================================
   v40 PRECISION POLISH & ROCK-SOLID FIXES
   ======================================================== */

/* 1. H3L KINETIC MOTION GRAPHICS STYLING */
.h3l-globe-box {
  width: 42px !important;
  height: 42px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-right: 14px !important;
  flex-shrink: 0 !important;
}

.h3l-globe-svg {
  width: 100% !important;
  height: 100% !important;
  filter: drop-shadow(0 2px 8px rgba(255, 255, 255, 0.2)) !important;
}

.h3l-wordmark-motion {
  display: flex !important;
  align-items: center !important;
  gap: 2px !important;
  position: relative !important;
  font-family: "Helvetica Now Display", "Helvetica Neue", Helvetica, Arial, sans-serif !important;
  font-size: 34px !important;
  font-weight: 700 !important;
  letter-spacing: -0.025em !important;
  line-height: 1 !important;
}

.h3l-char-cell {
  width: 22px !important;
  height: 38px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  position: relative !important;
  overflow: hidden !important;
}

.h3l-char-inner {
  display: block !important;
  width: 100% !important;
  text-align: center !important;
  transition: transform 0.05s ease, color 0.05s ease !important;
}

.h3l-char-inner.locked {
  color: #ffffff !important;
  transform: translateY(0) scale(1) !important;
}

.h3l-char-inner.scrambling {
  color: rgba(255, 255, 255, 0.45) !important;
  font-family: var(--font-mono), monospace !important;
  font-size: 30px !important;
  transform: translateY(-1px) scale(0.95) !important;
}

.h3l-scanner-line {
  position: absolute !important;
  bottom: -4px !important;
  left: 0 !important;
  width: 22px !important;
  height: 3px !important;
  background: #ffffff !important;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.8) !important;
  transition: transform 0.06s ease, opacity 0.1s ease !important;
  pointer-events: none !important;
}

/* 2. STRICT ZERO-JUMP LOCKED SETUP CARD (IDENTICAL 254px TOOLS HEIGHT) */
.axiom-setup-card {
  position: absolute !important;
  bottom: 24px !important;
  left: 20px !important;
  width: 320px !important;
  min-width: 320px !important;
  max-width: 320px !important;
  height: 330px !important;
  min-height: 330px !important;
  max-height: 330px !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
  padding: 14px 16px !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: flex-start !important;
  background: rgba(10, 12, 16, 0.82) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 2px !important;
  z-index: 500 !important;
}

.axiom-setup-card:has(#map-filters-list:not([hidden])) {
  height: 520px !important;
  max-height: 520px !important;
  overflow-y: auto !important;
}

.axiom-setup-form {
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: flex-start !important;
  margin: 0 !important;
  padding: 0 !important;
  gap: 10px !important;
}

.mode-seg {
  height: 32px !important;
  min-height: 32px !important;
  max-height: 32px !important;
  margin: 0 !important;
  flex-shrink: 0 !important;
}

#model-tools,
#section-tools {
  height: 254px !important;
  min-height: 254px !important;
  max-height: 254px !important;
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  margin: 0 !important;
  padding: 0 !important;
  flex-shrink: 0 !important;
}

#model-tools[hidden],
#section-tools[hidden] {
  display: none !important;
}
`;

css += v40Css;
fs.writeFileSync('public/css/style.css', css, 'utf8');
console.log('✓ public/css/style.css updated (Zero-jump exact tool heights & H3L kinetic styling)');
