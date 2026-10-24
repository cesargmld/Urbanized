const fs = require('fs');

let css = fs.readFileSync('public/css/style.css', 'utf8');

const precisionPatch = `
/* ========================================================
   v39 PRECISION ARCHITECTURAL OVERRIDES (CGM ATELIER / AXIOM)
   - Header Buttons: .URBNZD, OPEN, SHARE, EN with technical SVG icons
   - H3L Stop-Motion Typography Loader (Helvetica Now Display + Grid Alignment)
   - Zero-Jump Setup Card (Strict 320x320px lock)
   - Floating CAD Dock for Section Modal (Zero Overlap with Attribution or Scale)
   ======================================================== */

/* 1. HEADER ACTION BUTTONS WITH TECHNICAL SVG ICONS */
.axiom-header-action,
.lang-single-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  height: 28px !important;
  padding: 0 10px !important;
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 2px !important;
  color: rgba(255, 255, 255, 0.85) !important;
  font-family: var(--font-mono), monospace !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  letter-spacing: 0.04em !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
  user-select: none !important;
}

.axiom-header-action:hover,
.lang-single-btn:hover {
  background: rgba(255, 255, 255, 0.12) !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
  color: #ffffff !important;
}

.axiom-header-action .header-action-icon,
.lang-single-btn .header-action-icon {
  stroke: rgba(255, 255, 255, 0.7) !important;
  transition: stroke 0.15s ease !important;
  flex-shrink: 0 !important;
}

.axiom-header-action:hover .header-action-icon,
.lang-single-btn:hover .header-action-icon {
  stroke: #ffffff !important;
}

/* 2. H3L STOP-MOTION MECHANICAL PAGE LOADER (HELVETICA NOW DISPLAY + GRID LOCK) */
.h3l-page-loader {
  position: fixed !important;
  inset: 0 !important;
  z-index: 10000 !important;
  background: #08090b !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: opacity 0.2s ease, visibility 0.2s ease !important;
}

.h3l-page-loader.h3l-loader-exit {
  opacity: 0 !important;
  pointer-events: none !important;
}

.h3l-loader-grid-bg {
  position: absolute !important;
  inset: 0 !important;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px) !important;
  background-size: 40px 40px !important;
  background-position: center center !important;
  pointer-events: none !important;
}

.h3l-loader-stage {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 20px !important;
  z-index: 2 !important;
}

.h3l-brand-assembly {
  position: relative !important;
  width: 320px !important;
  height: 80px !important;
  box-sizing: border-box !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: rgba(12, 14, 18, 0.88) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(255, 255, 255, 0.14) !important;
  border-radius: 2px !important;
}

/* Precise 4-Corner Reticles in Grayscale */
.h3l-reticle {
  position: absolute !important;
  width: 6px !important;
  height: 6px !important;
  border-color: rgba(255, 255, 255, 0.65) !important;
  pointer-events: none !important;
}
.h3l-reticle.tl { top: -1px; left: -1px; border-top: 1.5px solid; border-left: 1.5px solid; }
.h3l-reticle.tr { top: -1px; right: -1px; border-top: 1.5px solid; border-right: 1.5px solid; }
.h3l-reticle.bl { bottom: -1px; left: -1px; border-bottom: 1.5px solid; border-left: 1.5px solid; }
.h3l-reticle.br { bottom: -1px; right: -1px; border-bottom: 1.5px solid; border-right: 1.5px solid; }

.h3l-globe-box {
  width: 44px !important;
  height: 44px !important;
  position: relative !important;
  overflow: hidden !important;
  margin-right: 14px !important;
  flex-shrink: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.h3l-globe-crop-img {
  position: absolute !important;
  left: -8px !important;
  top: -6px !important;
  height: 56px !important;
  width: auto !important;
  max-width: none !important;
  image-rendering: -webkit-optimize-contrast !important;
  user-select: none !important;
}

.h3l-wordmark-motion {
  display: flex !important;
  align-items: center !important;
  gap: 2px !important;
  font-family: "Helvetica Now Display", "Helvetica Neue", Helvetica, Arial, sans-serif !important;
  font-size: 34px !important;
  font-weight: 700 !important;
  letter-spacing: -0.025em !important;
  color: #ffffff !important;
  line-height: 1 !important;
  user-select: none !important;
  position: relative !important;
}

.h3l-wordmark-motion .h3l-char {
  display: inline-block !important;
  width: 22px !important;
  text-align: center !important;
  color: rgba(255, 255, 255, 0.2) !important;
}

.h3l-wordmark-motion .h3l-char.locked {
  color: #ffffff !important;
}

.h3l-wordmark-motion .h3l-char.scramble {
  color: rgba(255, 255, 255, 0.7) !important;
  font-family: var(--font-mono), monospace !important;
}

.h3l-wordmark-motion .h3l-block-cursor {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 22px !important;
  height: 100% !important;
  border-bottom: 2.5px solid #ffffff !important;
  pointer-events: none !important;
  transition: transform 0.06s ease !important;
}

.h3l-stage-meta-bottom {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 8px !important;
}

.h3l-step-bar {
  display: flex !important;
  gap: 4px !important;
  align-items: center !important;
  justify-content: center !important;
  width: 140px !important;
  height: 2.5px !important;
}

.h3l-step-bar span {
  flex: 1 !important;
  height: 100% !important;
  background: rgba(255, 255, 255, 0.12) !important;
  border-radius: 1px !important;
  transition: background 0.05s ease !important;
}

.h3l-step-bar span.on {
  background: #ffffff !important;
}

/* 3. ZERO-JUMP LOCKED SETUP CARD (320px x 320px EXACT DIMENSIONS) */
.axiom-setup-card {
  position: absolute !important;
  bottom: 24px !important;
  left: 20px !important;
  width: 320px !important;
  min-width: 320px !important;
  max-width: 320px !important;
  height: 320px !important;
  min-height: 320px !important;
  max-height: 320px !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
  padding: 14px 16px !important;
  display: flex !important;
  flex-direction: column !important;
  background: rgba(10, 12, 16, 0.82) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 2px !important;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7) !important;
  z-index: 500 !important;
}

.axiom-setup-card:has(#map-filters-list:not([hidden])) {
  max-height: 520px !important;
  height: auto !important;
  overflow-y: auto !important;
}

.axiom-setup-form {
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  margin: 0 !important;
  padding: 0 !important;
}

#model-tools,
#section-tools {
  height: calc(100% - 42px) !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  margin: 0 !important;
  padding: 0 !important;
}

#model-tools[hidden],
#section-tools[hidden] {
  display: none !important;
}

#sec-hint {
  font-size: 9.5px !important;
  line-height: 1.35 !important;
  color: rgba(255, 255, 255, 0.6) !important;
  margin: 0 0 6px 0 !important;
  padding: 0 !important;
}

/* 4. REDESIGNED FLOATING CAD SECTION DOCK (SPATIAL AWARENESS: ZERO OVERLAPS) */
#section-modal.section-modal-backdrop {
  position: fixed !important;
  inset: auto !important;
  bottom: 34px !important;
  left: 360px !important;
  right: 250px !important;
  height: 250px !important;
  min-height: 250px !important;
  max-height: 260px !important;
  width: auto !important;
  background: rgba(10, 12, 16, 0.94) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  border-radius: 3px !important;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.85) !important;
  z-index: 550 !important;
  display: flex !important;
  flex-direction: column !important;
  padding: 0 !important;
  margin: 0 !important;
  overflow: hidden !important;
}

#section-modal .section-modal-window {
  position: relative !important;
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  border-radius: 0 !important;
  border: none !important;
  background: transparent !important;
  padding: 0 !important;
  margin: 0 !important;
}

#section-modal .section-modal-header {
  height: 38px !important;
  min-height: 38px !important;
  padding: 0 16px !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  flex-shrink: 0 !important;
}

#section-modal .section-title-badge-row {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

#section-modal .section-modal-title h3 {
  display: none !important; /* Keep compact */
}

#section-modal .section-modal-body.hero-visual {
  flex: 1 !important;
  min-height: 120px !important;
  height: 125px !important;
  margin: 0 !important;
  padding: 4px 16px !important;
  border: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background:
    linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px) !important;
  background-size: 24px 24px !important;
}

#section-modal .section-modal-body.hero-visual .flat img {
  width: 100% !important;
  height: 100% !important;
  max-height: 120px !important;
  object-fit: fill !important;
}

#section-modal .section-telemetry-ribbon {
  display: grid !important;
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  height: 38px !important;
  min-height: 38px !important;
  padding: 0 16px !important;
  border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  background: rgba(0, 0, 0, 0.3) !important;
  align-items: center !important;
  flex-shrink: 0 !important;
}

#section-modal .sec-stat-item {
  padding: 2px 8px !important;
}

#section-modal .sec-stat-label,
#section-modal .sec-stat-lbl {
  font-size: 7px !important;
  letter-spacing: 0.1em !important;
}

#section-modal .sec-stat-val {
  font-size: 10.5px !important;
  font-weight: 600 !important;
}

#section-modal .section-modal-footer {
  height: 38px !important;
  min-height: 38px !important;
  padding: 0 16px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  flex-shrink: 0 !important;
}

/* Keep Leaflet attribution cleanly below the floating dock */
.leaflet-control-attribution {
  bottom: 8px !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  font-size: 9px !important;
  line-height: 16px !important;
  padding: 1px 8px !important;
  z-index: 400 !important;
}
`;

css += precisionPatch;
fs.writeFileSync('public/css/style.css', css, 'utf8');
console.log('public/css/style.css patched with v39 precision rules!');
