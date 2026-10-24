const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../public/css/style.css');
let css = fs.readFileSync(cssPath, 'utf8');

const refinedStyles = `
/* ========================================================
   REFINED MINIMALIST ARCHITECTURAL DESIGN SYSTEM (IMAGE 5)
   - Zero rounded gray blobs (pure matte black / fine outlines)
   - Clean delicate monospace typography (9px-11px, 0.14em tracking)
   - Fine outline pills (like SGP / CLEON WONG)
   - Perfectly balanced and aligned header & logo
   - Zoom-proof uncluttered frame with opacity mask
   ======================================================== */

/* 1. Global Typography: Delicate, Technical Monospace */
.axiom-topbar,
.axiom-view-btn,
.axiom-setup-card,
.axiom-map-island,
.map-arch-scale-card,
.frame-dim-badge,
.frame-dms-callout,
.map-hud-coord,
.axiom-seg-item,
.axiom-island-btn,
.axiom-cta-btn,
.axiom-subtle-btn,
.axiom-label,
.axiom-sub-header,
.axiom-val {
  font-family: "JetBrains Mono", "Space Mono", "SF Mono", Menlo, Consolas, monospace !important;
  text-transform: uppercase !important;
  letter-spacing: 0.14em !important;
  font-weight: 400 !important;
}

/* 2. Topbar & Logo: Elegant, Minimal & Centered */
.axiom-topbar {
  height: 48px !important;
  background: #000000 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
  padding: 0 28px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  box-shadow: none !important;
}
.axiom-topbar-left {
  gap: 20px !important;
  align-items: center !important;
}
.axiom-brand {
  display: flex !important;
  align-items: center !important;
  padding: 0 !important;
  cursor: pointer !important;
}
.axiom-header-logo {
  height: 16px !important;
  width: auto !important;
  filter: brightness(0) invert(1) !important;
  opacity: 0.92 !important;
  display: block !important;
}
.axiom-search-box {
  height: 28px !important;
  width: 220px !important;
  border-radius: 9999px !important;
  background: transparent !important;
  border: 1px solid rgba(255, 255, 255, 0.14) !important;
  padding: 0 10px 0 28px !important;
}
.axiom-search-box input {
  font-family: "JetBrains Mono", monospace !important;
  font-size: 9px !important;
  letter-spacing: 0.12em !important;
  color: #ffffff !important;
}

/* Header Navigation Tabs: Pure Minimal Outlines */
.axiom-view-nav {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  gap: 6px !important;
  padding: 0 !important;
}
.axiom-view-btn {
  background: transparent !important;
  border: 1px solid transparent !important;
  color: rgba(255, 255, 255, 0.45) !important;
  font-size: 9.5px !important;
  letter-spacing: 0.14em !important;
  padding: 4px 12px !important;
  border-radius: 9999px !important;
}
.axiom-view-btn:hover {
  color: #ffffff !important;
}
.axiom-view-btn.active {
  border: 1px solid rgba(255, 255, 255, 0.4) !important;
  color: #ffffff !important;
  background: transparent !important;
  box-shadow: none !important;
}
.axiom-view-btn.active::before,
.axiom-view-btn.active::after {
  display: none !important;
}

/* Header Right Buttons: Fine Outline Pills */
.axiom-topbar-right button {
  border: 1px solid rgba(255, 255, 255, 0.22) !important;
  border-radius: 9999px !important;
  background: transparent !important;
  font-size: 9px !important;
  letter-spacing: 0.12em !important;
  color: rgba(255, 255, 255, 0.8) !important;
  padding: 3px 10px !important;
}
#btn-topbar-share {
  background: #ffffff !important;
  color: #000000 !important;
  border-color: #ffffff !important;
  font-weight: 500 !important;
}

/* 3. Elimination of Rounded Gray Blobs in Setup Card */
.axiom-setup-card {
  position: absolute !important;
  bottom: 24px !important;
  left: 24px !important;
  width: 310px !important;
  background: rgba(8, 8, 10, 0.94) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 2px !important;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8) !important;
  padding: 16px !important;
}
.axiom-label {
  font-size: 9px !important;
  color: rgba(255, 255, 255, 0.5) !important;
  letter-spacing: 0.14em !important;
}
.axiom-val {
  font-size: 10px !important;
  color: #ffffff !important;
  font-weight: 500 !important;
}

/* Flat Rectilinear Segmented Controls */
.axiom-seg {
  display: flex !important;
  background: transparent !important;
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
  border-radius: 0px !important;
  padding: 0 !important;
  gap: 0 !important;
}
.axiom-seg-item {
  flex: 1 !important;
  padding: 6px 10px !important;
  border-radius: 0 !important;
  border: none !important;
  border-right: 1px solid rgba(255, 255, 255, 0.16) !important;
  background: transparent !important;
  color: rgba(255, 255, 255, 0.45) !important;
  font-size: 9px !important;
  letter-spacing: 0.14em !important;
  cursor: pointer !important;
}
.axiom-seg-item:last-child {
  border-right: none !important;
}
.axiom-seg-item:hover {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.04) !important;
}
.axiom-seg-item.active {
  background: rgba(255, 255, 255, 0.14) !important;
  color: #ffffff !important;
  box-shadow: none !important;
}

/* Primary CTA Button */
.axiom-cta-btn.generate {
  border-radius: 2px !important;
  background: #ffffff !important;
  color: #000000 !important;
  border: 1px solid #ffffff !important;
  font-size: 10px !important;
  font-weight: 500 !important;
  letter-spacing: 0.16em !important;
  padding: 9px 14px !important;
  transition: all 0.15s ease !important;
}
.axiom-cta-btn.generate:hover {
  background: rgba(255, 255, 255, 0.9) !important;
}

/* 4. Top Island: Pure Text Tabs with Fine Outline */
.axiom-map-island {
  top: 64px !important;
  background: transparent !important;
}
.axiom-island-capsule {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  gap: 8px !important;
  align-items: center !important;
}
.axiom-island-sep {
  color: rgba(255, 255, 255, 0.25) !important;
  font-family: var(--font-mono) !important;
  font-size: 10px !important;
}
.axiom-island-btn {
  background: transparent !important;
  border: 1px solid transparent !important;
  color: rgba(255, 255, 255, 0.45) !important;
  font-size: 9px !important;
  letter-spacing: 0.16em !important;
  padding: 3px 10px !important;
  border-radius: 9999px !important;
}
.axiom-island-btn:hover {
  color: #ffffff !important;
}
.axiom-island-btn.active {
  border: 1px solid rgba(255, 255, 255, 0.45) !important;
  color: #ffffff !important;
  background: transparent !important;
  box-shadow: none !important;
}

/* 5. Scale Indicator Card */
.map-arch-scale-card {
  border-radius: 2px !important;
  background: rgba(8, 8, 10, 0.94) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  padding: 8px 12px !important;
  gap: 4px !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7) !important;
}
.arch-scale-tag {
  background: transparent !important;
  border: 1px solid rgba(255, 255, 255, 0.35) !important;
  border-radius: 9999px !important;
  color: #ffffff !important;
  font-size: 8.5px !important;
  letter-spacing: 0.14em !important;
  padding: 1px 6px !important;
}
.arch-scale-ratio {
  font-size: 10px !important;
  letter-spacing: 0.12em !important;
  color: #ffffff !important;
  font-weight: 500 !important;
}
.arch-scale-metric {
  font-size: 9px !important;
  letter-spacing: 0.12em !important;
  color: rgba(255, 255, 255, 0.5) !important;
}
.arch-scale-bar-line {
  border-left: 1.5px solid #ffffff !important;
  border-right: 1.5px solid #ffffff !important;
  border-bottom: 1.5px solid #ffffff !important;
  height: 3px !important;
}
.arch-scale-bar-label {
  font-size: 9px !important;
  letter-spacing: 0.12em !important;
  color: rgba(255, 255, 255, 0.7) !important;
}

/* 6. Clean Uncluttered Frame & Opacity Mask */
.frame {
  border: 1px solid rgba(255, 255, 255, 0.28) !important;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6) !important;
  background: transparent !important;
  pointer-events: none !important;
}
.frame.circle {
  border-radius: 50% !important;
}
.frame-bracket {
  width: 22px !important;
  height: 22px !important;
  max-width: 32% !important;
  max-height: 32% !important;
  border-width: 2px !important;
  border-color: #ffffff !important;
}
.frame-bracket.top-left { border-width: 2px 0 0 2px !important; }
.frame-bracket.top-right { border-width: 2px 2px 0 0 !important; }
.frame-bracket.bottom-left { border-width: 0 0 2px 2px !important; }
.frame-bracket.bottom-right { border-width: 0 2px 2px 0 !important; }

/* Eliminate all interior clutter (no buildings, no polygons, no inner labels) */
.frame-inner-target,
.frame-inner-poly,
.frame-inner-label {
  display: none !important;
}

/* Dimension Badge & DMS Callout */
.frame-dim-badge {
  position: absolute !important;
  bottom: calc(100% + 8px) !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  border-radius: 9999px !important;
  background: rgba(0, 0, 0, 0.85) !important;
  padding: 2px 8px !important;
  font-size: 9px !important;
  letter-spacing: 0.14em !important;
  color: #ffffff !important;
  white-space: nowrap !important;
}
.frame-dms-callout {
  position: absolute !important;
  top: calc(100% + 8px) !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  font-size: 10.5px !important;
  font-weight: 500 !important;
  letter-spacing: 0.12em !important;
  color: #ffffff !important;
  white-space: nowrap !important;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9) !important;
}

/* Corner DMS Coordinates */
.map-hud-coord {
  font-size: 9.5px !important;
  letter-spacing: 0.12em !important;
  color: rgba(255, 255, 255, 0.65) !important;
}
.map-hud-coord::before {
  width: 7px !important;
  height: 7px !important;
  border: 1.2px solid rgba(255, 255, 255, 0.75) !important;
  margin-bottom: 4px !important;
}
`;

css += refinedStyles;
fs.writeFileSync(cssPath, css, 'utf8');
console.log('Successfully appended refined minimal styles!');
