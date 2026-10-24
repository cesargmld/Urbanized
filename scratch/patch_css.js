const fs = require('fs');
const path = require('path');

const cssPath = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo\\public\\css\\style.css';
let css = fs.readFileSync(cssPath, 'utf8');

const additionalStyles = `
/* ========================================================
   URBNZD OFFICIAL MONOCHROME & BRAND ARCHITECTURAL SYSTEM
   - Exact logo integration (Header & Loader)
   - Area Opacity Scrim (outside work bounds)
   - Clean Monochrome high-contrast satellite
   - Removed noise overlay
   - Smooth animated subtle buttons
   - Full uppercase architectural typography
   - Reference image footprint & corner reticle
   ======================================================== */

.axiom-header-logo {
  height: 20px;
  width: auto;
  max-width: 140px;
  object-fit: contain;
  filter: brightness(0) invert(1);
  display: block;
}

.axiom-loader-logo {
  height: 42px;
  width: auto;
  max-width: 220px;
  object-fit: contain;
  filter: brightness(0) invert(1);
  display: block;
}

/* Area Opacity on Non-Working Zone */
.frame {
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6) !important;
  background: transparent !important;
  pointer-events: none;
  z-index: 460 !important;
  transition: width 0.15s ease, height 0.15s ease, border-radius 0.2s ease;
}
.frame.circle {
  border-radius: 50% !important;
}

/* Crisp Monochrome Satellite Tile Rendering */
#map.map-style-monochrome .leaflet-tile-pane {
  filter: grayscale(100%) contrast(145%) brightness(96%) !important;
}

/* Eliminate Artificial Noise Overlay */
.map-noise-overlay {
  display: none !important;
}

/* Reference Image Central Footprint Target */
.frame-inner-target {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 28%;
  height: 28%;
  background: rgba(255, 255, 255, 0.14) !important;
  border: 1px dashed rgba(255, 255, 255, 0.65) !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 5px !important;
  pointer-events: none !important;
}
.frame-inner-poly {
  width: 20px;
  height: 38px;
  background: #ffffff;
  transform: rotate(-14deg);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.7);
}
.frame-inner-label {
  font-family: var(--font-mono, monospace);
  font-size: 8px !important;
  font-weight: 700 !important;
  letter-spacing: 0.12em !important;
  color: #ffffff !important;
  text-transform: uppercase !important;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.95);
  text-align: center;
  padding: 1px 5px !important;
  background: rgba(0, 0, 0, 0.75) !important;
  border-radius: 2px !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
}

/* Corner Reticle Box for DMS Coordinates */
.map-hud-coord::before {
  content: '';
  display: block;
  width: 9px;
  height: 9px;
  border: 1.5px solid rgba(255, 255, 255, 0.85);
  margin-bottom: 5px;
}

/* Full Uppercase Architectural Typography */
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
.axiom-sub-header {
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
}

/* Smooth Transition Between Subtle Segmented Buttons */
.axiom-seg-item,
.axiom-island-btn,
.axiom-view-btn,
.axiom-subtle-btn {
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.axiom-island-capsule {
  display: inline-flex !important;
  background: rgba(12, 14, 18, 0.88) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 8px !important;
  padding: 3px !important;
  gap: 3px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
}

.axiom-island-btn {
  background: transparent !important;
  border: 1px solid transparent !important;
  color: rgba(255, 255, 255, 0.5) !important;
  font-family: var(--font-mono, monospace) !important;
  font-size: 10px !important;
  font-weight: 700 !important;
  letter-spacing: 0.08em !important;
  padding: 5px 13px !important;
  border-radius: 6px !important;
  cursor: pointer !important;
}
.axiom-island-btn:hover {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.06) !important;
}
.axiom-island-btn.active {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.16) !important;
  border-color: rgba(255, 255, 255, 0.25) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
}

/* Subtle animated Segmented Controls */
.axiom-seg {
  display: flex !important;
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 8px !important;
  padding: 3px !important;
  gap: 3px !important;
}
.axiom-seg-item {
  flex: 1 !important;
  padding: 6px 10px !important;
  border-radius: 6px !important;
  font-family: var(--font-mono, monospace) !important;
  font-size: 10px !important;
  font-weight: 700 !important;
  text-align: center !important;
  background: transparent !important;
  border: 1px solid transparent !important;
  color: rgba(255, 255, 255, 0.5) !important;
  cursor: pointer !important;
}
.axiom-seg-item:hover {
  color: rgba(255, 255, 255, 0.85) !important;
  background: rgba(255, 255, 255, 0.05) !important;
}
.axiom-seg-item.active {
  background: rgba(255, 255, 255, 0.14) !important;
  border-color: rgba(255, 255, 255, 0.22) !important;
  color: #ffffff !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35) !important;
}
`;

css += additionalStyles;
fs.writeFileSync(cssPath, css, 'utf8');
console.log('Successfully added monochrome & brand styles to style.css!');
