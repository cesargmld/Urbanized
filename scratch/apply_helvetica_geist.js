const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../public/css/style.css');
let css = fs.readFileSync(cssPath, 'utf8');

const fontFaceDefs = `
/* ========================================================
   OFFICIAL BRAND TYPOGRAPHY: HELVETICA NOW DISPLAY + GEIST MONO
   ======================================================== */

@font-face {
  font-family: 'Helvetica Now Display';
  src: url('../fonts/HelveticaNowDisplay-Light.ttf') format('truetype');
  font-weight: 300;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Helvetica Now Display';
  src: url('../fonts/HelveticaNowDisplay-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Helvetica Now Display';
  src: url('../fonts/HelveticaNowDisplay-Medium.ttf') format('truetype');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Helvetica Now Display';
  src: url('../fonts/HelveticaNowDisplay-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Geist Mono';
  src: url('../fonts/GeistMono-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Geist Mono';
  src: url('../fonts/GeistMono-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Geist Mono';
  src: url('../fonts/GeistMono-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
`;

const typographyAndGlassOverrides = `
/* ========================================================
   HELVETICA NOW DISPLAY (MEDIUM) + GEIST MONO OVERHAUL
   + TRANSLUCENT LIQUID GLASS HEADER
   ======================================================== */

:root {
  --font-sans: 'Helvetica Now Display', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  --font-mono: 'Geist Mono', 'SF Mono', Consolas, monospace !important;
}

/* 1. Translucent Liquid Glass Header (Darker like 3D Island) */
.axiom-topbar {
  height: 54px !important;
  background: rgba(10, 12, 16, 0.76) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
  padding: 0 32px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
  position: relative !important;
  z-index: 1000 !important;
}

.axiom-topbar-left {
  display: flex !important;
  align-items: center !important;
  gap: 26px !important;
}

/* 2. Logo in Header: Large, Sharp & Commanding */
.axiom-brand {
  display: flex !important;
  align-items: center !important;
  padding: 0 !important;
  cursor: pointer !important;
  user-select: none !important;
}

.axiom-header-logo {
  height: 28px !important;
  width: auto !important;
  max-width: 150px !important;
  object-fit: contain !important;
  filter: brightness(0) invert(1) !important;
  opacity: 0.98 !important;
  display: block !important;
}

/* 3. Search Bar */
.axiom-search-box {
  height: 30px !important;
  width: 230px !important;
  border-radius: 9999px !important;
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  padding: 0 12px 0 32px !important;
  transition: all 0.2s ease !important;
}
.axiom-search-box:focus-within {
  border-color: rgba(255, 255, 255, 0.35) !important;
  background: rgba(255, 255, 255, 0.07) !important;
}
.axiom-search-box input {
  font-family: var(--font-sans) !important;
  font-weight: 400 !important;
  font-size: 11px !important;
  letter-spacing: 0.03em !important;
  color: #ffffff !important;
}

/* 4. Navigation Tabs: Helvetica Now Display Medium */
.axiom-view-nav {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  gap: 6px !important;
  padding: 0 !important;
}

.axiom-view-btn {
  font-family: var(--font-sans) !important;
  font-size: 11.5px !important;
  font-weight: 500 !important;
  letter-spacing: 0.04em !important;
  text-transform: uppercase !important;
  color: rgba(255, 255, 255, 0.5) !important;
  padding: 5px 14px !important;
  border-radius: 9999px !important;
  border: 1px solid transparent !important;
  background: transparent !important;
  transition: all 0.18s ease !important;
}
.axiom-view-btn:hover {
  color: #ffffff !important;
}
.axiom-view-btn.active {
  border: 1px solid rgba(255, 255, 255, 0.35) !important;
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.06) !important;
}

/* 5. Header Right Buttons: Helvetica Now Display Medium */
.axiom-topbar-right button {
  font-family: var(--font-sans) !important;
  font-size: 10.5px !important;
  font-weight: 500 !important;
  letter-spacing: 0.04em !important;
  text-transform: uppercase !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  border-radius: 9999px !important;
  background: transparent !important;
  color: rgba(255, 255, 255, 0.8) !important;
  padding: 4px 12px !important;
}
#btn-topbar-share {
  background: #ffffff !important;
  color: #000000 !important;
  border-color: #ffffff !important;
  font-weight: 500 !important;
}

/* 6. Top Base Map Switcher: Helvetica Now Display Medium */
.axiom-island-btn {
  font-family: var(--font-sans) !important;
  font-size: 10.5px !important;
  font-weight: 500 !important;
  letter-spacing: 0.05em !important;
  text-transform: uppercase !important;
  color: rgba(255, 255, 255, 0.5) !important;
  background: transparent !important;
  border: 1px solid transparent !important;
  padding: 4px 12px !important;
  border-radius: 9999px !important;
}
.axiom-island-btn:hover {
  color: #ffffff !important;
}
.axiom-island-btn.active {
  border: 1px solid rgba(255, 255, 255, 0.45) !important;
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.08) !important;
}

/* 7. Setup Card: Helvetica Now Display Medium for Controls & Labels */
.axiom-setup-card {
  background: rgba(8, 10, 14, 0.92) !important;
  backdrop-filter: blur(24px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(24px) saturate(160%) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 2px !important;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.8) !important;
  padding: 16px !important;
}

.axiom-label,
.axiom-sub-header {
  font-family: var(--font-sans) !important;
  font-size: 10.5px !important;
  font-weight: 500 !important;
  letter-spacing: 0.05em !important;
  text-transform: uppercase !important;
  color: rgba(255, 255, 255, 0.6) !important;
}

.axiom-seg-item {
  font-family: var(--font-sans) !important;
  font-size: 10px !important;
  font-weight: 500 !important;
  letter-spacing: 0.05em !important;
  text-transform: uppercase !important;
}

.axiom-cta-btn.generate {
  font-family: var(--font-sans) !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
  padding: 11px 16px !important;
}

/* 8. TECHNICAL METRICS & COORDINATES: GEIST MONO (Functional & Precise) */
.map-hud-coord,
.frame-dms-callout,
.frame-dim-badge,
.arch-scale-ratio,
.arch-scale-metric,
.arch-scale-bar-label,
.axiom-val {
  font-family: var(--font-mono) !important;
  font-weight: 500 !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
}

.map-hud-coord {
  font-size: 10.5px !important;
  color: rgba(255, 255, 255, 0.72) !important;
}

.frame-dms-callout {
  font-size: 11.5px !important;
  font-weight: 500 !important;
  color: #ffffff !important;
  letter-spacing: 0.06em !important;
}

.frame-dim-badge {
  font-size: 10px !important;
  letter-spacing: 0.08em !important;
  color: #ffffff !important;
}

.arch-scale-ratio {
  font-size: 11.5px !important;
  color: #ffffff !important;
}

.arch-scale-metric {
  font-size: 10px !important;
  color: rgba(255, 255, 255, 0.6) !important;
}

.arch-scale-tag {
  font-family: var(--font-sans) !important;
  font-weight: 500 !important;
  font-size: 9px !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  border-radius: 9999px !important;
  padding: 1px 7px !important;
  color: #ffffff !important;
}
`;

css = fontFaceDefs + '\n' + css + '\n' + typographyAndGlassOverrides;
fs.writeFileSync(cssPath, css, 'utf8');
console.log('Successfully updated CSS with Helvetica Now Display, Geist Mono and Translucent Liquid Glass Header!');
