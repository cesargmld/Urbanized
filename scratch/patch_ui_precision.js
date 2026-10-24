const fs = require('fs');

// ========================================================
// 1. UPDATE public/index.html
// ========================================================
let html = fs.readFileSync('public/index.html', 'utf8');

// A. Replace H3L Loader block with stop-motion typography in Helvetica Now Display + original globe + aligned grid
const oldLoaderStart = html.indexOf('<div class="h3l-page-loader"');
const oldLoaderEnd = html.indexOf('<!-- ========================================================\n       1. TOP APPLICATION HEADER');
if (oldLoaderStart !== -1 && oldLoaderEnd !== -1) {
  const newLoader = `<div class="h3l-page-loader" id="h3l-page-loader" aria-label="Loading URBNZD Studio">
    <!-- Perfectly Aligned Background Architectural Grid (40x40px, intersecting the stage corners) -->
    <div class="h3l-loader-grid-bg"></div>

    <div class="h3l-loader-stage">
      <!-- Center Stop-Motion Brand Assembly -->
      <div class="h3l-brand-assembly">
        <!-- Corner Precision Reticles in Monochrome Grayscale -->
        <span class="h3l-reticle tl"></span>
        <span class="h3l-reticle tr"></span>
        <span class="h3l-reticle bl"></span>
        <span class="h3l-reticle br"></span>

        <!-- Authentic Globe Icon Crop (100% original from assets/urbnzd-logo.png) -->
        <div class="h3l-globe-box" id="h3l-globe-box">
          <img src="assets/urbnzd-logo.png" alt="" class="h3l-globe-crop-img" draggable="false" />
        </div>

        <!-- Stop-Motion Helvetica Now Display Wordmark -->
        <div class="h3l-wordmark-motion" id="h3l-wordmark">
          <span class="h3l-char" data-target="u" id="h3l-c0">_</span>
          <span class="h3l-char" data-target="r" id="h3l-c1">_</span>
          <span class="h3l-char" data-target="b" id="h3l-c2">_</span>
          <span class="h3l-char" data-target="n" id="h3l-c3">_</span>
          <span class="h3l-char" data-target="z" id="h3l-c4">_</span>
          <span class="h3l-char" data-target="d" id="h3l-c5">_</span>
          <span class="h3l-block-cursor" id="h3l-cursor"></span>
        </div>
      </div>

      <!-- Bottom Discrete Stop-Motion Progress Ticks -->
      <div class="h3l-stage-meta-bottom">
        <div class="h3l-step-bar" id="h3l-step-bar">
          <span></span><span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
    </div>
  </div>
  <script>
    // H3L STOP-MOTION MECHANICAL TYPOGRAPHY LOADER (12 FPS, HELVETICA NOW DISPLAY)
    (function initH3lStopMotionLoader() {
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
      const cursor = document.getElementById('h3l-cursor');
      const ticks = Array.from(loader.querySelectorAll('#h3l-step-bar span'));
      const targets = ['u', 'r', 'b', 'n', 'z', 'd'];
      const scramblePool = ['a', 'c', 'e', 'x', 'o', 's', 'v', '1', '7', '/', '_'];

      // 12 Discrete Mechanical Steps
      const steps = [
        { activeIndex: 0, locked: [], scrambles: { 0: '_' } },
        { activeIndex: 0, locked: [], scrambles: { 0: 'v' } },
        { activeIndex: 1, locked: ['u'], scrambles: { 1: '/' } },
        { activeIndex: 1, locked: ['u'], scrambles: { 1: 'i' } },
        { activeIndex: 2, locked: ['u', 'r'], scrambles: { 2: 'p' } },
        { activeIndex: 2, locked: ['u', 'r'], scrambles: { 2: 'h' } },
        { activeIndex: 3, locked: ['u', 'r', 'b'], scrambles: { 3: 'm' } },
        { activeIndex: 3, locked: ['u', 'r', 'b'], scrambles: { 3: 'r' } },
        { activeIndex: 4, locked: ['u', 'r', 'b', 'n'], scrambles: { 4: 's' } },
        { activeIndex: 4, locked: ['u', 'r', 'b', 'n'], scrambles: { 4: '2' } },
        { activeIndex: 5, locked: ['u', 'r', 'b', 'n', 'z'], scrambles: { 5: 'q' } },
        { activeIndex: 6, locked: ['u', 'r', 'b', 'n', 'z', 'd'], scrambles: {} }
      ];

      const renderStep = (idx) => {
        const s = steps[Math.min(idx, steps.length - 1)];
        chars.forEach((c, i) => {
          if (!c) return;
          if (i < s.locked.length) {
            c.textContent = s.locked[i];
            c.classList.add('locked');
            c.classList.remove('scramble');
          } else if (s.scrambles[i] !== undefined) {
            c.textContent = s.scrambles[i];
            c.classList.add('scramble');
            c.classList.remove('locked');
          } else {
            c.textContent = '_';
            c.classList.remove('locked', 'scramble');
          }
        });

        // Position cursor at active cell
        if (cursor) {
          if (s.activeIndex < chars.length) {
            const activeChar = chars[s.activeIndex];
            if (activeChar) {
              const offset = activeChar.offsetLeft;
              cursor.style.transform = 'translateX(' + offset + 'px)';
              cursor.style.display = 'block';
            }
          } else {
            cursor.style.display = 'none';
          }
        }

        // Fill progress ticks
        const activeCount = Math.round(((idx + 1) / steps.length) * ticks.length);
        ticks.forEach((t, i) => t.classList.toggle('on', i < activeCount));
      };

      let currentStep = 0;
      let timer = null;

      const runLoop = () => {
        renderStep(currentStep);
        currentStep++;
        if (currentStep < steps.length) {
          timer = setTimeout(runLoop, 80); // ~12 fps discrete cadence
        } else {
          // Hold complete logo for 220ms then exit
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
        currentStep = 0;
        loader.hidden = false;
        loader.style.display = 'flex';
        loader.classList.remove('h3l-loader-exit');
        runLoop();
      };

      timer = setTimeout(runLoop, 60);
    })();
  </script>

  `;
  html = html.slice(0, oldLoaderStart) + newLoader + html.slice(oldLoaderEnd);
  console.log('✓ Replaced H3L Loader with Stop-Motion Helvetica Now Display');
}

// B. Header Action Buttons with Technical SVG Icons and .URBNZD
const oldHeaderRight = html.match(/<div class="axiom-topbar-right">[\s\S]*?<\/header>/);
if (oldHeaderRight) {
  const newHeaderRight = `<div class="axiom-topbar-right">
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
  html = html.replace(oldHeaderRight[0], newHeaderRight);
  console.log('✓ Replaced Header Action Buttons with Technical SVG Icons & .URBNZD');
}

// C. Section Modal 4-corner brackets
if (!html.includes('class="section-modal-window axiom-hud-window"><span class="axiom-bracket tl"></span>')) {
  html = html.replace(
    '<div class="section-modal-window axiom-hud-window">',
    `<div class="section-modal-window axiom-hud-window">
      <!-- 4-Corner Precision Reticles for Floating CAD Window -->
      <span class="axiom-bracket tl"></span>
      <span class="axiom-bracket tr"></span>
      <span class="axiom-bracket bl"></span>
      <span class="axiom-bracket br"></span>`
  );
  console.log('✓ Added 4-corner brackets to section-modal');
}

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('public/index.html updated successfully!');
