// Cartografía Vectorial 2D (Estudio QGIS + Lámina Arquitectónica):
// Capas reordenables, modos analíticos (Nolli, Usos GIS, Alturas/Niveles, Topografía con cotas),
// tramas vectoriales reales (Hatch Punteado, Diagonal 45°, Cruzado), sombras, norte y escala CAD.
import { CLASS_COLORS } from './exporters.js?v=4.1';
import { pinStore } from './pins.js?v=1.0';

export const MAP_GRID_STEPS = ['auto', 5, 20, 50, 100, 250, 500, 1000];

export const HEIGHT_TIERS = [
  { max: 7.5, color: '#bae6fd', label: '1–2 Niv (<7.5m)' },
  { max: 15.0, color: '#38bdf8', label: '3–4 Niv (7.5–15m)' },
  { max: 28.0, color: '#0284c7', label: '5–8 Niv (15–28m)' },
  { max: Infinity, color: '#1e3a8a', label: '+9 Niv (>28m)' },
];

export const GIS_LANDUSE_LABELS = {
  residential: 'Habitacional / Residencial',
  commercial: 'Comercio y Servicios',
  public: 'Equipamiento y Dotacional',
  industrial: 'Industrial / Logístico',
  utility: 'Infraestructura',
  other: 'Mixto / General',
};

export const MAP_PRESETS = {
  classic: {
    colors: {
      bg: '#ffffff', building: '#e4e4e7', outline: '#52525b', road: '#ffffff', path: '#f4f4f6', rail: '#71717a',
      water: '#a9cbe3', green: '#cfe0b8', tree: '#849684', contour: '#a1a1aa', shadow: '#18181b',
      depthLow: '#f8fafc', depthHigh: '#cbd5e1', grid: '#d4d4d8', text: '#18181b',
    },
    layers: { buildings: true, roads: true, rail: true, water: true, green: true, trees: true, contours: false, site: true, byType: false, byHeight: false, satellite: false, flora: false, fauna: false },
    shadows: { on: true, azimuth: 315, altitude: 35, strength: 0.22 },
    relief: { hillshade: true, hillshadeStrength: 0.45, depth: false, depthStrength: 0.7 },
    overlays: { scalebar: true, north: true, grid: false, isochrones: false, labels: true, pins: true, contourLabels: false, legend: true, studioStamp: true },
    hatchMode: 'solid',
    outlineWidth: 0.08,
  },
  figure: {
    colors: {
      bg: '#ffffff', building: '#111114', outline: '#111114', road: '#ffffff', path: '#ffffff', rail: '#9a9a9a',
      water: '#e4e4e7', green: '#ffffff', tree: '#ffffff', contour: '#ffffff', shadow: '#000000',
      depthLow: '#ffffff', depthHigh: '#bdbdbd', grid: '#d4d4d8', text: '#111114',
    },
    layers: { buildings: true, roads: true, rail: false, water: true, green: false, trees: false, contours: false, site: false, byType: false, byHeight: false, satellite: false, flora: false, fauna: false },
    shadows: { on: false, azimuth: 315, altitude: 35, strength: 0.2 },
    relief: { hillshade: false, hillshadeStrength: 0.4, depth: false, depthStrength: 0.6 },
    overlays: { scalebar: true, north: true, grid: false, isochrones: false, labels: false, pins: false, contourLabels: false, legend: false, studioStamp: true },
    hatchMode: 'solid',
    outlineWidth: 0.08,
  },
  figure_invert: {
    colors: {
      bg: '#090a0d', building: '#ffffff', outline: '#ffffff', road: '#090a0d', path: '#090a0d', rail: '#555b68',
      water: '#162b42', green: '#090a0d', tree: '#090a0d', contour: '#090a0d', shadow: '#000000',
      depthLow: '#090a0d', depthHigh: '#22262f', grid: '#27272a', text: '#ffffff',
    },
    layers: { buildings: true, roads: true, rail: false, water: true, green: false, trees: false, contours: false, site: false, byType: false, byHeight: false, satellite: false, flora: false, fauna: false },
    shadows: { on: false, azimuth: 315, altitude: 35, strength: 0.2 },
    relief: { hillshade: false, hillshadeStrength: 0.4, depth: false, depthStrength: 0.6 },
    overlays: { scalebar: true, north: true, grid: false, isochrones: false, labels: false, pins: false, contourLabels: false, legend: false, studioStamp: true },
    hatchMode: 'solid',
    outlineWidth: 0.08,
  },
  gis: {
    colors: {
      bg: '#f8fafc', building: '#e2e8f0', outline: '#475569', road: '#ffffff', path: '#f1f5f9', rail: '#64748b',
      water: '#bae6fd', green: '#dcfce7', tree: '#86efac', contour: '#cbd5e1', shadow: '#0f172a',
      depthLow: '#f8fafc', depthHigh: '#cbd5e1', grid: '#cbd5e1', text: '#0f172a',
    },
    layers: { buildings: true, roads: true, rail: true, water: true, green: true, trees: true, contours: true, site: true, byType: true, byHeight: false, satellite: false, flora: false, fauna: false },
    shadows: { on: true, azimuth: 315, altitude: 38, strength: 0.16 },
    relief: { hillshade: false, hillshadeStrength: 0.3, depth: false, depthStrength: 0.5 },
    overlays: { scalebar: true, north: true, grid: true, isochrones: false, labels: true, pins: true, contourLabels: true, legend: true, studioStamp: true },
    hatchMode: 'solid',
    outlineWidth: 0.08,
  },
  heights: {
    colors: {
      bg: '#f8fafc', building: '#38bdf8', outline: '#1e3a8a', road: '#ffffff', path: '#f1f5f9', rail: '#64748b',
      water: '#e0f2fe', green: '#f0fdf4', tree: '#bbf7d0', contour: '#cbd5e1', shadow: '#0f172a',
      depthLow: '#f8fafc', depthHigh: '#e2e8f0', grid: '#cbd5e1', text: '#0f172a',
    },
    layers: { buildings: true, roads: true, rail: true, water: true, green: true, trees: false, contours: true, site: true, byType: false, byHeight: true, satellite: false, flora: false, fauna: false },
    shadows: { on: true, azimuth: 315, altitude: 35, strength: 0.2 },
    relief: { hillshade: false, hillshadeStrength: 0.3, depth: false, depthStrength: 0.5 },
    overlays: { scalebar: true, north: true, grid: true, isochrones: false, labels: true, pins: true, contourLabels: false, legend: true, studioStamp: true },
    hatchMode: 'solid',
    outlineWidth: 0.08,
  },
  relief: {
    colors: {
      bg: '#ffffff', building: '#ffffff', outline: '#4d4a45', road: '#ffffff', path: '#f1f5f9', rail: '#6d6a64',
      water: '#9fc4df', green: '#c7dcae', tree: '#8db872', contour: '#8c7250', shadow: '#2a2622',
      depthLow: '#dfeacb', depthHigh: '#c49668', grid: '#b0a898', text: '#2b2b2b',
    },
    layers: { buildings: true, roads: true, rail: true, water: true, green: false, trees: false, contours: true, site: true, byType: false, byHeight: false, satellite: false, flora: false, fauna: false },
    shadows: { on: false, azimuth: 315, altitude: 35, strength: 0.2 },
    relief: { hillshade: true, hillshadeStrength: 0.6, depth: true, depthStrength: 0.85 },
    overlays: { scalebar: true, north: true, grid: false, isochrones: false, labels: true, pins: true, contourLabels: true, legend: true, studioStamp: true },
    hatchMode: 'solid',
    outlineWidth: 0.08,
  },
  stipple: {
    colors: {
      bg: '#ffffff', building: '#ffffff', outline: '#1e3a8a', road: '#ffffff', path: '#f0f4f8', rail: '#1e3a8a',
      water: '#e0ecf7', green: '#edf4e8', tree: '#1e3a8a', contour: '#60a5fa', shadow: '#1e3a8a',
      depthLow: '#ffffff', depthHigh: '#1e3a8a', grid: '#93c5fd', text: '#1e3a8a',
    },
    layers: { buildings: true, roads: true, rail: true, water: true, green: true, trees: true, contours: true, site: true, byType: false, byHeight: false, satellite: false, flora: false, fauna: false },
    shadows: { on: true, azimuth: 315, altitude: 35, strength: 0.45 },
    relief: { hillshade: false, hillshadeStrength: 0.3, depth: false, depthStrength: 0.5 },
    overlays: { scalebar: true, north: true, grid: true, isochrones: false, labels: true, pins: true, contourLabels: true, legend: true, studioStamp: true },
    hatchMode: 'dots',
    outlineWidth: 0.14,
    grain: 12,
  },
  blueprint: {
    colors: {
      bg: '#16325c', building: '#1e4278', outline: '#e8effc', road: '#16325c', path: '#16325c', rail: '#9fb6dc',
      water: '#11284a', green: '#16325c', tree: '#38bdf8', contour: '#4f73ad', shadow: '#091529',
      depthLow: '#16325c', depthHigh: '#2c5aa0', grid: '#3b629b', text: '#e8effc',
    },
    layers: { buildings: true, roads: true, rail: true, water: true, green: false, trees: false, contours: true, site: true, byType: false, byHeight: false, satellite: false, flora: false, fauna: false },
    shadows: { on: false, azimuth: 315, altitude: 35, strength: 0.3 },
    relief: { hillshade: false, hillshadeStrength: 0.4, depth: false, depthStrength: 0.6 },
    overlays: { scalebar: true, north: true, grid: true, isochrones: false, labels: true, pins: true, contourLabels: true, legend: false, studioStamp: true },
    hatchMode: 'diag',
    outlineWidth: 0.1,
  },
  night: {
    colors: {
      bg: '#121418', building: '#2d323d', outline: '#4a505e', road: '#22262f', path: '#1a1d24', rail: '#555b68',
      water: '#162b42', green: '#19241e', tree: '#2b4733', contour: '#2c313b', shadow: '#000000',
      depthLow: '#121418', depthHigh: '#3a3f4c', grid: '#2e333d', text: '#e2e8f0',
    },
    layers: { buildings: true, roads: true, rail: true, water: true, green: true, trees: true, contours: false, site: true, byType: false, byHeight: false, satellite: false, flora: false, fauna: false },
    shadows: { on: true, azimuth: 315, altitude: 30, strength: 0.5 },
    relief: { hillshade: true, hillshadeStrength: 0.5, depth: false, depthStrength: 0.6 },
    overlays: { scalebar: true, north: true, grid: false, isochrones: false, labels: true, pins: true, contourLabels: false, legend: false, studioStamp: true },
    hatchMode: 'solid',
    outlineWidth: 0,
  },
};

export const MAP_COLOR_KEYS = ['bg', 'building', 'outline', 'road', 'path', 'water', 'green', 'tree', 'contour', 'shadow', 'depthLow', 'depthHigh', 'grid', 'text'];
export const MAP_SCALES = [500, 1000, 2000, 5000, 10000];

export function presetOptions(name) {
  const p = structuredClone(MAP_PRESETS[name] ?? MAP_PRESETS.classic);
  return { preset: name, scale: null, ...p };
}

const f = (v) => (Math.round(v * 100) / 100).toString();
const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const hex = (h) => [1, 3, 5].map((i) => parseInt((h || '#000000').slice(i, i + 2), 16));
const niceStep = (v) => {
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= v) ?? 10 * p;
};
export const autoScale = (size) => MAP_SCALES.find((k) => (size * 1000) / k <= 420) ?? 10000;

/* --- Rasters de Relieve: Hipsometría y Hillshade --- */
const rasterCache = new WeakMap();
function reliefRaster(grid, kind, { low, high, azimuth, altitude }) {
  const key = `${kind}|${low}|${high}|${azimuth}|${altitude}`;
  let byKey = rasterCache.get(grid);
  if (!byKey) rasterCache.set(grid, (byKey = new Map()));
  if (byKey.has(key)) return byKey.get(key);
  const w = Math.max(2, Math.round(grid.w || (grid.n ? grid.n + 1 : (grid.size && grid.res ? Math.round(grid.size / grid.res) : 40))));
  const step = grid.step || grid.res || 10;
  const maxH = grid.maxH ?? 50;
  const src = document.createElement('canvas');
  src.width = src.height = w;
  const ctx = src.getContext('2d');
  const img = ctx.createImageData(w, w);
  const at = (i, j) => {
    if (grid.heights && grid.heights.length) {
      return grid.heights[Math.min(w - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))] || 0;
    }
    if (typeof grid.heightAt === 'function') {
      const half = (grid.size || 1000) / 2;
      const x = -half + (i / (w - 1)) * (grid.size || 1000);
      const y = -half + (j / (w - 1)) * (grid.size || 1000);
      return grid.heightAt(x, y) || 0;
    }
    return 0;
  };
  const [lr, lg, lb] = kind === 'depth' ? hex(low) : [0, 0, 0], [hr, hg, hb] = kind === 'depth' ? hex(high) : [0, 0, 0];
  const az = ((azimuth ?? 315) * Math.PI) / 180, alt = ((altitude ?? 45) * Math.PI) / 180;
  const L = [Math.sin(az) * Math.cos(alt), Math.cos(az) * Math.cos(alt), Math.sin(alt)];
  const ex = 2.2;
  for (let j = 0; j < w; j++)
    for (let i = 0; i < w; i++) {
      const o = ((w - 1 - j) * w + i) * 4;
      if (kind === 'depth') {
        const t = maxH > 0 ? at(i, j) / maxH : 0;
        img.data[o] = lr + (hr - lr) * t; img.data[o + 1] = lg + (hg - lg) * t; img.data[o + 2] = lb + (hb - lb) * t; img.data[o + 3] = 255;
      } else {
        const dx = ((at(i + 1, j) - at(i - 1, j)) / (2 * step)) * ex, dy = ((at(i, j + 1) - at(i, j - 1)) / (2 * step)) * ex;
        const n = Math.hypot(dx, dy, 1);
        const shade = (-dx * L[0] - dy * L[1] + L[2]) / n;
        const flat = L[2];
        if (shade < flat) { img.data[o] = img.data[o + 1] = img.data[o + 2] = 0; img.data[o + 3] = Math.min(255, ((flat - shade) / flat) * 255); }
        else { img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = Math.min(255, ((shade - flat) / (1 - flat)) * 200); }
      }
    }
  ctx.putImageData(img, 0, 0);
  const n = Math.min(1600, Math.max(512, w * 8));
  const big = document.createElement('canvas');
  big.width = big.height = n;
  const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(src, 0, 0, n, n);
  const url = big.toDataURL('image/png');
  byKey.set(key, url);
  return url;
}

export function mapSVG(model, o) {
  const size = model.size || 1000;
  const h = model.frame?.half ?? (size / 2);
  const c = o.colors;
  const scale = o.scale ?? autoScale(size);
  const P = ([x, y]) => `${f(x + h)},${f(h - y)}`;
  const ring = (pts, closed = true) => `M${pts.map(P).join('L')}${closed ? 'Z' : ''}`;
  const pen = (mm) => f((mm * scale) / 1000);
  const penNum = (mm) => (mm * scale) / 1000;
  const groups = [];
  const layerSnippets = {};
  const gl = (id, attrs, body) => (body ? `<g id="${id}" ${attrs}>${body}</g>` : '');
  const getLayerPoints = (item) => (Array.isArray(item) ? item : (item?.pts || []));
  const lines = (layer) => (model.lines?.[layer] ?? []).map((item) => ring(getLayerPoints(item), false)).join('');
  const areas = (layer) => ((model.areas?.[layer] || model.polygons?.[layer]) ?? []).map((item) => ring(getLayerPoints(item))).join('');

  // Configuración de Tramas / Hatches Vectoriales Reales (<pattern>)
  const hatchMode = o.hatchMode || (o.preset === 'stipple' ? 'dots' : 'solid');
  const hatchInk = c.outline || c.text || '#1e3a8a';
  const patStep = Math.max(2.2, penNum(1.25)); // Paso en metros escalado a la lámina
  const dotR = f(patStep * 0.19);
  const dotRDense = f(patStep * 0.25);
  const dotRLight = f(patStep * 0.13);

  const hatchDefs = `
    <pattern id="arch-hatch-dots" width="${f(patStep)}" height="${f(patStep)}" patternUnits="userSpaceOnUse">
      <rect width="${f(patStep)}" height="${f(patStep)}" fill="${c.building}"/>
      <circle cx="${f(patStep * 0.25)}" cy="${f(patStep * 0.25)}" r="${dotR}" fill="${hatchInk}"/>
      <circle cx="${f(patStep * 0.75)}" cy="${f(patStep * 0.75)}" r="${dotR}" fill="${hatchInk}"/>
    </pattern>
    <pattern id="arch-hatch-dots-shadow" width="${f(patStep * 0.75)}" height="${f(patStep * 0.75)}" patternUnits="userSpaceOnUse">
      <circle cx="${f(patStep * 0.2)}" cy="${f(patStep * 0.2)}" r="${dotRDense}" fill="${c.shadow}"/>
      <circle cx="${f(patStep * 0.58)}" cy="${f(patStep * 0.58)}" r="${dotRDense}" fill="${c.shadow}"/>
    </pattern>
    <pattern id="arch-hatch-dots-green" width="${f(patStep * 1.35)}" height="${f(patStep * 1.35)}" patternUnits="userSpaceOnUse">
      <rect width="${f(patStep * 1.35)}" height="${f(patStep * 1.35)}" fill="${c.green}"/>
      <circle cx="${f(patStep * 0.35)}" cy="${f(patStep * 0.35)}" r="${dotRLight}" fill="${c.tree}"/>
      <circle cx="${f(patStep * 1.0)}" cy="${f(patStep * 1.0)}" r="${dotRLight}" fill="${c.tree}"/>
    </pattern>
    <pattern id="arch-hatch-diag" width="${f(patStep)}" height="${f(patStep)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="${f(patStep)}" height="${f(patStep)}" fill="${c.building}"/>
      <line x1="0" y1="0" x2="0" y2="${f(patStep)}" stroke="${hatchInk}" stroke-width="${pen(0.14)}"/>
    </pattern>
    <pattern id="arch-hatch-cross" width="${f(patStep * 1.15)}" height="${f(patStep * 1.15)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="${f(patStep * 1.15)}" height="${f(patStep * 1.15)}" fill="${c.building}"/>
      <line x1="0" y1="0" x2="0" y2="${f(patStep * 1.15)}" stroke="${hatchInk}" stroke-width="${pen(0.12)}"/>
      <line x1="0" y1="0" x2="${f(patStep * 1.15)}" y2="0" stroke="${hatchInk}" stroke-width="${pen(0.12)}"/>
    </pattern>
  `;

  const getLayerFill = (layerKey, fallbackColor) => {
    const customLayerHatch = o.layerHatches?.[layerKey];
    const mode = customLayerHatch || (layerKey === 'buildings' ? hatchMode : (hatchMode === 'dots' && (layerKey === 'shadows' || layerKey === 'green') ? 'dots' : 'solid'));
    if (mode === 'dots') {
      if (layerKey === 'shadows') return 'url(#arch-hatch-dots-shadow)';
      if (layerKey === 'green') return 'url(#arch-hatch-dots-green)';
      return 'url(#arch-hatch-dots)';
    }
    if (mode === 'diag') return 'url(#arch-hatch-diag)';
    if (mode === 'cross') return 'url(#arch-hatch-cross)';
    if (mode === 'transparent') return 'none';
    return fallbackColor;
  };

  // 0. Fotografía Satelital Real con Opacidad
  layerSnippets.satellite = (() => {
    if (!o.layers?.satellite) return '';
    if (model.imagery?.canvas) {
      try {
        const dataUrl = model.imagery.canvas.toDataURL('image/jpeg', 0.88);
        return gl('SATELLITE_IMG', '', `<image href="${dataUrl}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="none"/>`);
      } catch (e) {
        return '';
      }
    }
    return '';
  })();

  // 1. Relieve
  layerSnippets.relief = (() => {
    if (!model.grid || (model.grid.maxH ?? 0) <= 0.5) return '';
    const parts = [];
    if (o.relief.depth)
      parts.push(gl('RELIEF_DEPTH', `opacity="${o.relief.depthStrength}"`, `<image href="${reliefRaster(model.grid, 'depth', { low: c.depthLow, high: c.depthHigh })}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="none"/>`));
    if (o.relief.hillshade)
      parts.push(gl('HILLSHADE', `opacity="${o.relief.hillshadeStrength}"`, `<image href="${reliefRaster(model.grid, 'hillshade', { azimuth: o.shadows.azimuth, altitude: Math.max(25, o.shadows.altitude) })}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="none"/>`));
    return parts.join('');
  })();

  // 2. Curvas de nivel + Cotas Topográficas en Curvas Maestras
  layerSnippets.contours = (() => {
    if (!o.layers.contours || !model.contours?.length) return '';
    const ci = model.contourInterval ?? 5;
    const major = model.contours.filter((k) => Math.round(k.z / ci) % 5 === 0);
    const minor = model.contours.filter((k) => Math.round(k.z / ci) % 5 !== 0);
    let contourLabelsSvg = '';
    if (o.overlays?.contourLabels !== false) {
      const fsC = size * 0.01;
      const minH = model.grid?.offset ?? 0;
      const labelParts = [];
      for (let i = 0; i < major.length; i += 2) {
        const k = major[i];
        if (!k.pts || k.pts.length < 10) continue;
        const mid = k.pts[Math.floor(k.pts.length * 0.5)];
        const px = mid[0] + h;
        const py = h - mid[1];
        if (px < size * 0.08 || px > size * 0.92 || py < size * 0.08 || py > size * 0.92) continue;
        const elevTxt = `${Math.round(k.z + minH)}m`;
        const bw = elevTxt.length * fsC * 0.62 + fsC * 0.6;
        labelParts.push(
          `<g transform="translate(${f(px)},${f(py)})">`
          + `<rect x="${f(-bw / 2)}" y="${f(-fsC * 0.6)}" width="${f(bw)}" height="${f(fsC * 1.2)}" rx="${f(fsC * 0.25)}" fill="${c.bg}" opacity="0.9"/>`
          + `<text x="0" y="${f(fsC * 0.32)}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="${f(fsC * 0.85)}" font-weight="600" fill="${c.text}">${elevTxt}</text>`
          + `</g>`
        );
      }
      if (labelParts.length) contourLabelsSvg = gl('CONTOUR_LABELS', '', labelParts.join(''));
    }
    return gl('CONTOURS', `fill="none" stroke="${c.contour}" stroke-width="${pen(0.09)}"`, minor.map((k) => `<path d="${ring(k.pts, false)}"/>`).join(''))
         + gl('CONTOURS_INDEX', `fill="none" stroke="${c.contour}" stroke-width="${pen(0.22)}"`, major.map((k) => `<path d="${ring(k.pts, false)}"/>`).join(''))
         + contourLabelsSvg;
  })();

  // 3. Áreas verdes
  layerSnippets.green = (() => {
    if (!o.layers.green) return '';
    const gFill = getLayerFill('green', c.green);
    return gl('GREEN', `fill="${gFill}"`, areas('GREEN') && `<path d="${areas('GREEN')}"/>`);
  })();

  // 3b. Zonas de Flora Nativa (Simbología técnica QGIS)
  layerSnippets.flora = (() => {
    if (!o.layers?.flora) return '';
    const greenAreas = areas('GREEN');
    const parts = [];
    if (greenAreas) {
      parts.push(`<path d="${greenAreas}" fill="#52795d" fill-opacity="0.22" stroke="#2d6a4f" stroke-width="${pen(0.24)}" stroke-dasharray="${pen(1.2)} ${pen(0.8)}"/>`);
    }
    if (model.trees?.length) {
      for (const t of model.trees) {
        parts.push(`<circle cx="${f(t.x + h)}" cy="${f(h - t.y)}" r="${f(t.r * 1.35)}" fill="none" stroke="#2d6a4f" stroke-width="${pen(0.14)}" stroke-dasharray="${pen(0.6)} ${pen(0.6)}"/>`);
      }
    }
    return gl('FLORA_ZONES', '', parts.join(''));
  })();

  // 3c. Corredores Ecológicos de Fauna (Simbología técnica QGIS)
  layerSnippets.fauna = (() => {
    if (!o.layers?.fauna) return '';
    const parts = [];
    if (lines('WATER')) {
      parts.push(`<path d="${lines('WATER')}" fill="none" stroke="#d97706" stroke-width="${pen(0.85)}" stroke-dasharray="${pen(2.2)} ${pen(1.4)}" opacity="0.78"/>`);
    }
    return gl('FAUNA_CORRIDORS', '', parts.join(''));
  })();

  // 4. Cuerpos de agua
  layerSnippets.water = (() => {
    if (!o.layers.water) return '';
    return gl('WATER', `fill="${c.water}"`, areas('WATER') && `<path d="${areas('WATER')}"/>`)
         + gl('WATERWAYS', `fill="none" stroke="${c.water}" stroke-width="${pen(0.5)}" stroke-linecap="round" stroke-linejoin="round"`, lines('WATER') && `<path d="${lines('WATER')}"/>`);
  })();

  // 5. Vialidades con jerarquía cartográfica
  layerSnippets.roads = (() => {
    if (!o.layers.roads) return '';
    const parts = [];
    if (model.roadAreas?.length) {
      for (const { layer, polys } of model.roadAreas)
        parts.push(gl(layer, `fill="${layer === 'ROADS_AREA' ? c.road : c.path}" fill-rule="evenodd"`, `<path d="${polys.map((rs) => rs.map((r) => ring(r)).join('')).join('')}"/>`));
    } else {
      const stroke = (layer, color, width, dash = '') => gl(layer, `fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${dash}`, lines(layer) && `<path d="${lines(layer)}"/>`);
      parts.push(stroke('PATHS', c.path, 2.2, ` stroke-dasharray="${pen(0.8)} ${pen(0.6)}"`));
      parts.push(stroke('ROADS_MINOR', c.road, 6.8));
      parts.push(stroke('ROADS_MAJOR', c.road, 13.2));
    }
    if (model.lines.BRIDGES?.length)
      parts.push(gl('BRIDGES', `fill="none" stroke="${c.road}" stroke-width="9" stroke-linecap="butt" stroke-linejoin="round"`, `<path d="${lines('BRIDGES')}"/>`));
    return parts.join('');
  })();

  // 6. Ferrocarriles
  layerSnippets.rail = (() => {
    if (!o.layers.rail) return '';
    return gl('RAILWAYS', `fill="none" stroke="${c.rail}" stroke-width="${pen(0.28)}" stroke-dasharray="${pen(1.6)} ${pen(0.8)}"`, lines('RAILWAYS') && `<path d="${lines('RAILWAYS')}"/>`);
  })();

  // 7. Sombras arrojadas (con soporte para Hatch Punteado)
  layerSnippets.shadows = (() => {
    if (!o.shadows.on || (!o.layers.buildings && !o.layers.trees)) return '';
    const az = (o.shadows.azimuth * Math.PI) / 180, k = 1 / Math.tan((Math.max(4, o.shadows.altitude) * Math.PI) / 180);
    const ux = -Math.sin(az), uy = -Math.cos(az);
    const ccw = (pts) => {
      let a = 0;
      for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
      return a >= 0 ? pts : pts.slice().reverse();
    };
    const parts = [];
    if (o.layers.buildings)
      for (const b of model.buildings) {
        const len = Math.min(500, (b.height ?? 10) * k);
        if (!(len > 0.3)) continue;
        const dx = ux * len, dy = uy * len, r = b.rings[0];
        let d = ring(ccw(r)) + ring(ccw(r.map(([x, y]) => [x + dx, y + dy])));
        for (let i = 0; i < r.length; i++) {
          const a = r[i], q = r[(i + 1) % r.length];
          d += ring(ccw([a, q, [q[0] + dx, q[1] + dy], [a[0] + dx, a[1] + dy]]));
        }
        parts.push(`<path d="${d}"/>`);
      }
    if (o.layers.trees)
      for (const t of model.trees) {
        const len = t.h * k * 0.55;
        parts.push(`<circle cx="${f(t.x + ux * len + h)}" cy="${f(h - t.y - uy * len)}" r="${f(t.r * 0.9)}"/>`);
      }
    const shFill = getLayerFill('shadows', c.shadow);
    return gl('SHADOWS', `fill="${shFill}" fill-rule="nonzero" opacity="${o.shadows.strength}"`, parts.join(''));
  })();

  // 8. Árboles con estilos arquitectónicos seleccionables
  layerSnippets.trees = (() => {
    if (!o.layers.trees || !model.trees.length) return '';
    const style = o.overlays?.treeStyle || o.treeStyle || 'branching';
    const glyphs = model.trees.map((t) => {
      const cx = f(t.x + h), cy = f(h - t.y), r = f(t.r);
      const rad = Number(r);
      if (style === 'crown_hatch') {
        return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.tree}" fill-opacity="0.35"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.text}" stroke-width="${pen(0.12)}"/><path d="M${f(Number(cx) - rad * 0.7)},${cy}L${f(Number(cx) + rad * 0.7)},${cy} M${cx},${f(Number(cy) - rad * 0.7)}L${cx},${f(Number(cy) + rad * 0.7)}" stroke="${c.text}" stroke-width="${pen(0.12)}"/></g>`;
      } else if (style === 'stipple') {
        return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.tree}" stroke-width="${pen(0.18)}" stroke-dasharray="${pen(0.5)} ${pen(0.5)}"/><circle cx="${cx}" cy="${cy}" r="${f(rad * 0.55)}" fill="${c.tree}" fill-opacity="0.65"/><circle cx="${cx}" cy="${cy}" r="${f(Math.max(0.4, rad * 0.16))}" fill="${c.text}"/></g>`;
      } else if (style === 'branching') {
        return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.tree}" opacity="0.45"/><line x1="${cx}" y1="${f(Number(cy) + rad * 0.8)}" x2="${cx}" y2="${f(Number(cy) - rad * 0.4)}" stroke="${c.text}" stroke-width="${pen(0.16)}" stroke-linecap="round"/><line x1="${cx}" y1="${f(Number(cy) + rad * 0.1)}" x2="${f(Number(cx) - rad * 0.55)}" y2="${f(Number(cy) - rad * 0.35)}" stroke="${c.text}" stroke-width="${pen(0.12)}" stroke-linecap="round"/><line x1="${cx}" y1="${f(Number(cy) + rad * 0.25)}" x2="${f(Number(cx) + rad * 0.55)}" y2="${f(Number(cy) - rad * 0.25)}" stroke="${c.text}" stroke-width="${pen(0.12)}" stroke-linecap="round"/></g>`;
      } else if (style === 'detailed') {
        return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.tree}" opacity="0.25"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.text}" stroke-width="${pen(0.14)}"/><circle cx="${cx}" cy="${cy}" r="${f(rad * 0.6)}" fill="none" stroke="${c.text}" stroke-width="${pen(0.1)}"/><circle cx="${cx}" cy="${cy}" r="${f(Math.max(0.4, rad * 0.15))}" fill="${c.text}"/></g>`;
      } else {
        return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.tree}"/><circle cx="${cx}" cy="${cy}" r="${f(Math.max(0.5, rad * 0.22))}" fill="${c.text}"/></g>`;
      }
    }).join('');
    return gl('TREES', '', glyphs);
  })();

  // 9. Edificios (Sólido, Hatch Punteado/Diagonal/Cruzado, Usos de Suelo GIS o Mapa de Alturas)
  layerSnippets.buildings = (() => {
    if (!o.layers.buildings || !model.buildings.length) return '';
    const stroke = o.outlineWidth > 0 ? ` stroke="${c.outline}" stroke-width="${pen(o.outlineWidth)}" stroke-linejoin="round"` : '';
    if (o.layers.byHeight) {
      const parts = [];
      for (let ti = 0; ti < HEIGHT_TIERS.length; ti++) {
        const tier = HEIGHT_TIERS[ti];
        const minH = ti === 0 ? 0 : HEIGHT_TIERS[ti - 1].max;
        const list = model.buildings.filter((b) => {
          const bh = b.height ?? 8;
          return bh >= minH && bh < tier.max;
        });
        if (list.length) {
          parts.push(gl(`BUILDINGS_H_${ti + 1}`, `fill="${tier.color}" fill-rule="evenodd"${stroke}`, list.map((b) => `<path d="${b.rings.map((r) => ring(r)).join('')}"/>`).join('')));
        }
      }
      return parts.join('');
    } else if (o.layers.byType) {
      const parts = [];
      for (const cls of Object.keys(CLASS_COLORS)) {
        const list = model.buildings.filter((b) => (b.cls ?? 'other') === cls);
        if (list.length) parts.push(gl(`BUILDINGS_${cls.toUpperCase()}`, `fill="${CLASS_COLORS[cls]}" fill-rule="evenodd"${stroke}`, list.map((b) => `<path d="${b.rings.map((r) => ring(r)).join('')}"/>`).join('')));
      }
      return parts.join('');
    } else {
      const list = model.buildings.slice().sort((a, b) => (a.height ?? 0) - (b.height ?? 0));
      const bFill = getLayerFill('buildings', c.building);
      return gl('BUILDINGS', `fill="${bFill}" fill-rule="evenodd"${stroke}`, list.map((b) => `<path d="${b.rings.map((r) => ring(r)).join('')}"/>`).join(''));
    }
  })();

  // 10. Polígono de predio
  layerSnippets.site = (() => {
    if (!o.layers.site || !model.site || model.site.length <= 2) return '';
    return gl('SITE', `fill="rgba(220,38,38,0.06)" stroke="#dc2626" stroke-width="${pen(0.5)}" stroke-dasharray="${pen(2.8)} ${pen(1.4)}"`, `<path d="${ring(model.site)}"/>`);
  })();

  // 11. Etiquetas Arquitectónicas
  layerSnippets.labels = (() => {
    if (o.overlays?.labels === false) return '';
    const pins = pinStore?.getPins?.() || [];
    if (!pins.length) return '';
    const fsRef = size * 0.015;
    const parts = pins.filter(p => p.visible !== false).map((p) => {
      const px = (p.x !== undefined) ? (p.x + h) : (((p.lng - model.frame.west) / (model.frame.east - model.frame.west)) * size);
      const py = (p.y !== undefined) ? (h - p.y) : (((model.frame.north - p.lat) / (model.frame.north - model.frame.south)) * size);
      const text = p.label || 'Hito';
      const textW = Math.max(fsRef * 2.8, text.length * fsRef * 0.52);
      return `<g class="axiom-callout-label" transform="translate(${f(px)}, ${f(py)})">`
        + `<line x1="0" y1="0" x2="0" y2="${f(-fsRef * 1.6)}" stroke="${c.text}" stroke-width="${pen(0.14)}"/>`
        + `<circle cx="0" cy="0" r="${f(fsRef * 0.22)}" fill="${p.color || c.text}"/>`
        + `<rect x="${f(-textW / 2)}" y="${f(-fsRef * 2.7)}" width="${f(textW)}" height="${f(fsRef * 1.1)}" rx="${f(fsRef * 0.35)}" fill="#111215" stroke="rgba(255,255,255,0.22)" stroke-width="${pen(0.1)}"/>`
        + `<text x="0" y="${f(-fsRef * 1.95)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="${f(fsRef * 0.55)}" font-weight="600" fill="#ffffff">${esc(text)}</text>`
        + `</g>`;
    }).join('');
    return gl('LABELS', '', parts);
  })();

  // Ensamble dinámico según orden de capas y opacidad personalizada
  const defaultOrder = ['satellite', 'relief', 'contours', 'green', 'flora', 'water', 'fauna', 'rail', 'roads', 'shadows', 'trees', 'buildings', 'site', 'labels'];
  const layerOrder = Array.isArray(o.layerOrder) && o.layerOrder.length ? o.layerOrder : defaultOrder;
  const opacities = o.layerOpacities || {};

  for (const layerKey of layerOrder) {
    const snippet = layerSnippets[layerKey];
    if (snippet) {
      const op = opacities[layerKey] !== undefined ? opacities[layerKey] : 1.0;
      groups.push(`<g id="LAYER_${layerKey.toUpperCase()}" opacity="${op}">${snippet}</g>`);
    }
  }

  const fs = size * 0.015;
  const m = size * 0.075;
  const extras = [];

  // Isócronas peatonales en lámina 2D
  if (o.overlays.isochrones) {
    const rings = [
      { r: 400, color: '#0284c7', label: '5 MIN · 400M' },
      { r: 800, color: '#4f46e5', label: '10 MIN · 800M' },
      { r: 1200, color: '#7c3aed', label: '15 MIN · 1.2KM' },
    ];
    for (const { r, color, label } of rings) {
      if (r > size * 0.9) continue;
      groups.push(`<g id="ISOCHRONE_${r}"><circle cx="${f(h)}" cy="${f(h)}" r="${f(r)}" fill="none" stroke="${color}" stroke-width="${pen(0.32)}" stroke-dasharray="${pen(2)} ${pen(1.2)}"/>`
        + `<text x="${f(h)}" y="${f(h - r - fs * 0.35)}" fill="${color}" font-family="JetBrains Mono, monospace" font-size="${f(fs * 0.58)}" font-weight="600" text-anchor="middle">${label}</text></g>`);
    }
  }

  // Retícula Métrica de Precisión CAD
  if (o.overlays.grid) {
    let st;
    const configuredStep = o.gridStep ?? o.overlays.gridStep;
    if (configuredStep && configuredStep !== 'auto') {
      st = Number(configuredStep) || 100;
    } else {
      st = niceStep(size / 6);
    }
    const maxDivs = 140;
    if (size / st > maxDivs) st = niceStep(size / maxDivs);

    let d = '';
    const style = o.overlays.gridStyle || 'cross';
    if (style === 'cross') {
      const cr = fs * 0.26;
      for (let x = st; x < size - 1e-6; x += st) {
        for (let y = st; y < size - 1e-6; y += st) {
          d += `M${f(x - cr)},${f(y)}H${f(x + cr)}M${f(x)},${f(y - cr)}V${f(y + cr)}`;
        }
      }
    } else if (style === 'dots') {
      const cr = fs * 0.12;
      for (let x = st; x < size - 1e-6; x += st) {
        for (let y = st; y < size - 1e-6; y += st) {
          d += `M${f(x - cr)},${f(y)}A${f(cr)},${f(cr)} 0 1 0 ${f(x + cr)},${f(y)}A${f(cr)},${f(cr)} 0 1 0 ${f(x - cr)},${f(y)}`;
        }
      }
    } else {
      for (let v = st; v < size - 1e-6; v += st) {
        d += `M${f(v)},0V${size}M0,${f(v)}H${size}`;
      }
    }

    const gridColor = c.grid || '#888888';
    const gridLineWidth = style === 'line' ? Math.max(penNum(0.18), size * 0.0008) : Math.max(penNum(0.24), size * 0.0012);
    const gridOpacity = style === 'line' ? '0.65' : '0.85';
    groups.push(`<g id="GRID" fill="${style === 'dots' ? gridColor : 'none'}" stroke="${gridColor}" stroke-width="${f(gridLineWidth)}" stroke-linecap="round" opacity="${gridOpacity}">${d ? `<path d="${d}"/>` : ''}</g>`);

    let ticks = '';
    const tickLen = fs * 0.22;
    for (let v = st; v < size - 1e-6; v += st) {
      ticks += `M${f(v)},0V${f(tickLen)}M${f(v)},${size}V${f(size - tickLen)}`;
      ticks += `M0,${f(v)}H${f(tickLen)}M${size},${f(v)}H${f(size - tickLen)}`;
    }
    if (ticks) {
      groups.push(`<g id="GRID_TICKS" stroke="${c.text}" stroke-width="${pen(0.2)}" opacity="0.8"><path d="${ticks}"/></g>`);
    }

    let labels = '';
    const labelStep = (size / st > 10) ? st * Math.ceil((size / st) / 8) : st;
    for (let v = 0; v <= size + 1e-6; v += labelStep) {
      labels += `<text x="${f(v)}" y="${f(-fs * 0.45)}" text-anchor="middle">${Math.round(v)}m</text>`;
      labels += `<text x="${f(-fs * 0.45)}" y="${f(size - v + fs * 0.22)}" text-anchor="end">${Math.round(v)}m</text>`;
    }
    extras.push(`<g id="GRID_LABELS" fill="${c.text}" opacity="0.65" font-family="JetBrains Mono, monospace" font-size="${f(fs * 0.56)}" font-weight="500">${labels}</g>`);
  }

  // Pines y Marcadores Personalizados
  if (o.overlays?.pins !== false) {
    const pins = pinStore.getPins().filter((p) => p.visible);
    if (pins.length > 0) {
      let pinShapes = '';
      for (const p of pins) {
        const px = p.x + h;
        const py = h - p.y;
        const r = fs * 0.6;
        const pStyle = p.style || 'glass';
        const labelBg = pStyle === 'white' ? '#ffffff' : (pStyle === 'accent' ? p.color : (pStyle === 'wire' ? 'rgba(0,0,0,0.65)' : '#111215'));
        const textCol = pStyle === 'white' ? '#111215' : '#ffffff';
        const strokeCol = pStyle === 'white' ? '#cbd5e1' : (pStyle === 'wire' ? p.color : 'rgba(255,255,255,0.25)');
        const needleH = Math.max(10, p.needleHeight || 45);
        const stemScale = Math.min(2.5, Math.max(0.6, needleH / 45));
        const lblText = esc(p.label.length > 16 ? p.label.slice(0, 15) + '…' : p.label);
        const boxW = Math.max(fs * 3.8, lblText.length * fs * 0.42 + fs * 1.1);
        pinShapes += `
        <g id="PIN_${p.id}">
          <circle cx="${f(px)}" cy="${f(py)}" r="${f(r * 1.5)}" fill="${p.color}" opacity="0.22"/>
          <circle cx="${f(px)}" cy="${f(py)}" r="${f(r * 0.85)}" fill="${p.color}" stroke="#ffffff" stroke-width="${pen(0.3)}"/>
          <line x1="${f(px)}" y1="${f(py - r * 0.85)}" x2="${f(px + r * 1.1 * stemScale)}" y2="${f(py - r * 2.1 * stemScale)}" stroke="${p.color}" stroke-width="${pen(0.24)}"/>
          <rect x="${f(px + r * 1.1 * stemScale)}" y="${f(py - r * 3.2 * stemScale)}" width="${f(boxW)}" height="${f(fs * 1.2)}" rx="${f(fs * 0.28)}" fill="${labelBg}" stroke="${strokeCol}" stroke-width="${pen(0.12)}"/>
          <text x="${f(px + r * 1.5 * stemScale)}" y="${f(py - r * 2.38 * stemScale)}" fill="${textCol}" font-family="Inter, sans-serif" font-size="${f(fs * 0.58)}" font-weight="600">${lblText}</text>
        </g>`;
      }
      groups.push(`<g id="CUSTOM_PINS">${pinShapes}</g>`);
    }
  }

  // ============================================================================
  // PIE DE PLANO ARQUITECTÓNICO SUIZO (ESCALA GRÁFICA CAD + LEYENDA GIS + NORTE)
  // ============================================================================
  const footerY = size + m * 0.42;

  // 1. Escala Gráfica de Alta Precisión CAD (Izquierda del Pie de Plano)
  if (o.overlays.scalebar) {
    const len = niceStep(size / 5);
    const seg = len / 4;
    const bh = fs * 0.34;
    const style = o.overlays.scalebarStyle || 'minimal';
    let bar = '';

    if (style === 'minimal') {
      // Línea técnica suiza de alta precisión con subdivisiones y tarjeta de escala
      bar += `<line x1="0" y1="${f(footerY + bh * 0.5)}" x2="${f(len)}" y2="${f(footerY + bh * 0.5)}" stroke="${c.text}" stroke-width="${pen(0.26)}"/>`;
      for (let i = 0; i <= 4; i++) {
        const tickH = (i === 0 || i === 2 || i === 4) ? bh * 1.15 : bh * 0.65;
        const y0 = footerY + (bh - tickH) / 2;
        bar += `<line x1="${f(i * seg)}" y1="${f(y0)}" x2="${f(i * seg)}" y2="${f(y0 + tickH)}" stroke="${c.text}" stroke-width="${pen(i % 2 === 0 ? 0.26 : 0.16)}"/>`;
      }
      bar += `<g fill="${c.text}" font-family="JetBrains Mono, monospace" font-size="${f(fs * 0.6)}" font-weight="600">`
        + `<text x="0" y="${f(footerY + bh + fs * 0.85)}">0</text>`
        + `<text x="${f(seg)}" y="${f(footerY + bh + fs * 0.85)}" text-anchor="middle">${Math.round(seg)}</text>`
        + `<text x="${f(len / 2)}" y="${f(footerY + bh + fs * 0.85)}" text-anchor="middle">${Math.round(len / 2)}</text>`
        + `<text x="${f(len)}" y="${f(footerY + bh + fs * 0.85)}" text-anchor="middle">${len} m</text>`
        + `<text x="${f(len + fs * 1.1)}" y="${f(footerY + bh * 0.8)}" font-weight="700" opacity="0.85">ESC 1:${scale}</text></g>`;
    } else if (style === 'subdivided') {
      // Escalímetro técnico Bauhaus con doble riel y micro-subdivisiones en el primer tramo
      const subSeg = seg / 5;
      bar += `<rect x="0" y="${f(footerY)}" width="${f(len)}" height="${f(bh)}" fill="none" stroke="${c.text}" stroke-width="${pen(0.2)}"/>`;
      bar += `<line x1="0" y1="${f(footerY + bh * 0.5)}" x2="${f(len)}" y2="${f(footerY + bh * 0.5)}" stroke="${c.text}" stroke-width="${pen(0.14)}"/>`;
      for (let i = 1; i < 5; i++) {
        bar += `<line x1="${f(i * subSeg)}" y1="${f(footerY)}" x2="${f(i * subSeg)}" y2="${f(footerY + bh)}" stroke="${c.text}" stroke-width="${pen(0.14)}"/>`;
        if (i % 2 === 1) {
          bar += `<rect x="${f((i - 1) * subSeg)}" y="${f(footerY)}" width="${f(subSeg)}" height="${f(bh * 0.5)}" fill="${c.text}"/>`;
        }
      }
      for (let i = 1; i < 4; i++) {
        bar += `<line x1="${f(i * seg)}" y1="${f(footerY)}" x2="${f(i * seg)}" y2="${f(footerY + bh)}" stroke="${c.text}" stroke-width="${pen(0.2)}"/>`;
        if (i % 2 === 1) {
          bar += `<rect x="${f(i * seg)}" y="${f(footerY + bh * 0.5)}" width="${f(seg)}" height="${f(bh * 0.5)}" fill="${c.text}"/>`;
        } else {
          bar += `<rect x="${f(i * seg)}" y="${f(footerY)}" width="${f(seg)}" height="${f(bh * 0.5)}" fill="${c.text}"/>`;
        }
      }
      bar += `<g fill="${c.text}" font-family="JetBrains Mono, monospace" font-size="${f(fs * 0.58)}" font-weight="600">`
        + `<text x="0" y="${f(footerY + bh + fs * 0.85)}">0</text>`
        + `<text x="${f(seg)}" y="${f(footerY + bh + fs * 0.85)}" text-anchor="middle">${Math.round(seg)}</text>`
        + `<text x="${f(seg * 2)}" y="${f(footerY + bh + fs * 0.85)}" text-anchor="middle">${Math.round(seg * 2)}</text>`
        + `<text x="${f(len)}" y="${f(footerY + bh + fs * 0.85)}" text-anchor="middle">${len} m</text>`
        + `<text x="${f(len + fs * 1.1)}" y="${f(footerY + bh * 0.85)}" font-weight="700">1:${scale}</text></g>`;
    } else {
      // Clásica arquitectónica alternada de precisión
      for (let i = 0; i < 4; i++) {
        bar += `<rect x="${f(i * seg)}" y="${f(footerY)}" width="${f(seg)}" height="${f(bh)}" fill="${i % 2 ? c.bg : c.text}" stroke="${c.text}" stroke-width="${pen(0.2)}"/>`;
      }
      bar += `<g fill="${c.text}" font-family="JetBrains Mono, monospace" font-size="${f(fs * 0.58)}" font-weight="600">`
        + `<text x="0" y="${f(footerY + bh + fs * 0.85)}">0</text>`
        + `<text x="${f(len / 2)}" y="${f(footerY + bh + fs * 0.85)}" text-anchor="middle">${Math.round(len / 2)}</text>`
        + `<text x="${f(len)}" y="${f(footerY + bh + fs * 0.85)}" text-anchor="middle">${len} m</text>`
        + `<text x="${f(len + fs * 1.1)}" y="${f(footerY + bh * 0.85)}" font-weight="700">1:${scale}</text></g>`;
    }
    extras.push(`<g id="SCALEBAR">${bar}</g>`);
  }

  // 2. Leyenda Cartográfica Automática (Centro del Pie de Plano cuando Usos GIS o Alturas están activos)
  if (o.overlays?.legend !== false && (o.layers.byType || o.layers.byHeight)) {
    const legItems = o.layers.byHeight
      ? HEIGHT_TIERS.map((t) => ({ color: t.color, label: t.label }))
      : [
          { color: CLASS_COLORS.residential, label: 'Residencial' },
          { color: CLASS_COLORS.commercial, label: 'Comercial' },
          { color: CLASS_COLORS.public, label: 'Equipamiento' },
          { color: CLASS_COLORS.industrial, label: 'Industrial' },
        ];
    const itemSpan = size * 0.125;
    const startX = size * 0.36;
    const swSize = fs * 0.55;
    let legSvg = '';
    legItems.forEach((it, idx) => {
      const ix = startX + idx * itemSpan;
      legSvg += `<rect x="${f(ix)}" y="${f(footerY - fs * 0.08)}" width="${f(swSize)}" height="${f(swSize)}" rx="${f(fs * 0.1)}" fill="${it.color}" stroke="${c.text}" stroke-width="${pen(0.12)}"/>`;
      legSvg += `<text x="${f(ix + swSize + fs * 0.32)}" y="${f(footerY + fs * 0.38)}" fill="${c.text}" font-family="Inter, sans-serif" font-size="${f(fs * 0.54)}" font-weight="600">${esc(it.label)}</text>`;
    });
    extras.push(`<g id="CARTO_LEGEND">${legSvg}</g>`);
  }

  // 3. Norte Arquitectónico Curado de Precisión CAD (Derecha del Pie de Plano)
  if (o.overlays.north) {
    const r = fs * 0.92;
    const nx = size - r * 1.25;
    const ny = footerY + fs * 0.32;
    const nStyle = o.overlays.northStyle || 'arch_bar_n';
    let northShape = '';

    // Anillo exterior auxiliar de graduación cardinal sutil
    const ticks = `<line x1="${f(nx)}" y1="${f(ny - r * 1.18)}" x2="${f(nx)}" y2="${f(ny - r)}" stroke="${c.text}" stroke-width="${pen(0.14)}" opacity="0.5"/>`
      + `<line x1="${f(nx + r)}" y1="${f(ny)}" x2="${f(nx + r * 1.18)}" y2="${f(ny)}" stroke="${c.text}" stroke-width="${pen(0.14)}" opacity="0.5"/>`
      + `<line x1="${f(nx)}" y1="${f(ny + r)}" x2="${f(nx)}" y2="${f(ny + r * 1.18)}" stroke="${c.text}" stroke-width="${pen(0.14)}" opacity="0.5"/>`
      + `<line x1="${f(nx - r * 1.18)}" y1="${f(ny)}" x2="${f(nx - r)}" y2="${f(ny)}" stroke="${c.text}" stroke-width="${pen(0.14)}" opacity="0.5"/>`;

    if (nStyle === 'arch_cross') {
      northShape = ticks
        + `<circle cx="${f(nx)}" cy="${f(ny)}" r="${f(r)}" fill="none" stroke="${c.text}" stroke-width="${pen(0.2)}"/>`
        + `<line x1="${f(nx - r)}" y1="${f(ny)}" x2="${f(nx + r)}" y2="${f(ny)}" stroke="${c.text}" stroke-width="${pen(0.14)}"/>`
        + `<line x1="${f(nx)}" y1="${f(ny)}" x2="${f(nx)}" y2="${f(ny + r)}" stroke="${c.text}" stroke-width="${pen(0.14)}"/>`
        + `<line x1="${f(nx)}" y1="${f(ny)}" x2="${f(nx)}" y2="${f(ny - r)}" stroke="${c.text}" stroke-width="${pen(0.58)}" stroke-linecap="butt"/>`
        + `<text x="${f(nx)}" y="${f(ny - r - fs * 0.38)}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="${f(fs * 0.62)}" font-weight="700" fill="${c.text}">N</text>`;
    } else if (nStyle === 'arch_bar') {
      northShape = `<circle cx="${f(nx)}" cy="${f(ny)}" r="${f(r)}" fill="none" stroke="${c.text}" stroke-width="${pen(0.22)}"/>`
        + `<circle cx="${f(nx)}" cy="${f(ny)}" r="${f(r * 0.14)}" fill="${c.text}"/>`
        + `<line x1="${f(nx)}" y1="${f(ny)}" x2="${f(nx)}" y2="${f(ny - r)}" stroke="${c.text}" stroke-width="${pen(0.55)}" stroke-linecap="round"/>`;
    } else if (nStyle === 'arch_bar_n') {
      northShape = ticks
        + `<circle cx="${f(nx)}" cy="${f(ny)}" r="${f(r)}" fill="none" stroke="${c.text}" stroke-width="${pen(0.22)}"/>`
        + `<circle cx="${f(nx)}" cy="${f(ny)}" r="${f(r * 0.15)}" fill="${c.text}"/>`
        + `<line x1="${f(nx)}" y1="${f(ny)}" x2="${f(nx)}" y2="${f(ny - r)}" stroke="${c.text}" stroke-width="${pen(0.55)}" stroke-linecap="butt"/>`
        + `<text x="${f(nx)}" y="${f(ny - r - fs * 0.38)}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="${f(fs * 0.66)}" font-weight="700" fill="${c.text}">N</text>`;
    } else if (nStyle === 'arch_notch') {
      const slitW = r * 0.2;
      northShape = `<circle cx="${f(nx)}" cy="${f(ny)}" r="${f(r)}" fill="none" stroke="${c.text}" stroke-width="${pen(0.22)}"/>`
        + `<rect x="${f(nx - slitW / 2)}" y="${f(ny - r - 0.5)}" width="${f(slitW)}" height="${f(r * 0.95)}" fill="${c.bg || '#ffffff'}"/>`
        + `<path d="M${f(nx - slitW / 2)},${f(ny - r)}L${f(nx - slitW / 2)},${f(ny - r * 0.1)}L${f(nx + slitW / 2)},${f(ny - r * 0.1)}L${f(nx + slitW / 2)},${f(ny - r)}" fill="none" stroke="${c.text}" stroke-width="${pen(0.2)}"/>`
        + `<text x="${f(nx)}" y="${f(ny - r - fs * 0.38)}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="${f(fs * 0.62)}" font-weight="700" fill="${c.text}">N</text>`;
    } else if (nStyle === 'arch_disc') {
      const slitW = r * 0.22;
      northShape = `<circle cx="${f(nx)}" cy="${f(ny)}" r="${f(r)}" fill="${c.text}"/>`
        + `<rect x="${f(nx - slitW / 2)}" y="${f(ny - r - 0.5)}" width="${f(slitW)}" height="${f(r * 1.02)}" fill="${c.bg || '#ffffff'}"/>`
        + `<text x="${f(nx)}" y="${f(ny - r - fs * 0.38)}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="${f(fs * 0.62)}" font-weight="700" fill="${c.text}">N</text>`;
    } else if (nStyle === 'swiss') {
      northShape = `<circle cx="${f(nx)}" cy="${f(ny)}" r="${f(r * 0.92)}" fill="none" stroke="${c.text}" stroke-width="${pen(0.14)}" opacity="0.45"/>`
        + `<path d="M${f(nx)},${f(ny - r * 1.08)}L${f(nx + r * 0.36)},${f(ny + r * 0.78)}L${f(nx)},${f(ny + r * 0.42)}Z" fill="${c.text}"/>`
        + `<path d="M${f(nx)},${f(ny - r * 1.08)}L${f(nx - r * 0.36)},${f(ny + r * 0.78)}L${f(nx)},${f(ny + r * 0.42)}Z" fill="${c.bg}" stroke="${c.text}" stroke-width="${pen(0.2)}"/>`
        + `<text x="${f(nx)}" y="${f(ny - r * 1.32)}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="${f(fs * 0.64)}" font-weight="700" fill="${c.text}">N</text>`;
    } else if (nStyle === 'circle') {
      northShape = ticks
        + `<circle cx="${f(nx)}" cy="${f(ny)}" r="${f(r)}" fill="none" stroke="${c.text}" stroke-width="${pen(0.2)}"/>`
        + `<polygon points="${f(nx)},${f(ny - r)} ${f(nx + r * 0.28)},${f(ny)} ${f(nx - r * 0.28)},${f(ny)}" fill="${c.text}"/>`
        + `<polygon points="${f(nx)},${f(ny + r)} ${f(nx + r * 0.28)},${f(ny)} ${f(nx - r * 0.28)},${f(ny)}" fill="none" stroke="${c.text}" stroke-width="${pen(0.16)}"/>`
        + `<text x="${f(nx)}" y="${f(ny - r - fs * 0.38)}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="${f(fs * 0.64)}" font-weight="700" fill="${c.text}">N</text>`;
    } else {
      northShape = `<line x1="${f(nx)}" y1="${f(ny + r)}" x2="${f(nx)}" y2="${f(ny - r)}" stroke="${c.text}" stroke-width="${pen(0.26)}" stroke-linecap="round"/>`
        + `<path d="M${f(nx - r * 0.32)},${f(ny - r * 0.42)}L${f(nx)},${f(ny - r)}L${f(nx + r * 0.32)},${f(ny - r * 0.42)}" fill="none" stroke="${c.text}" stroke-width="${pen(0.26)}" stroke-linecap="round" stroke-linejoin="round"/>`
        + `<circle cx="${f(nx)}" cy="${f(ny + r)}" r="${f(r * 0.14)}" fill="${c.text}"/>`
        + `<text x="${f(nx)}" y="${f(ny - r - fs * 0.38)}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="${f(fs * 0.64)}" font-weight="700" fill="${c.text}">N</text>`;
    }
    extras.push(`<g id="NORTH">${northShape}</g>`);
  }

  // 4. Sello Editorial Sutil en Lámina (Opcional)
  if (o.overlays?.studioStamp !== false) {
    extras.push(
      `<text x="${f(size)}" y="${f(-fs * 0.45)}" text-anchor="end" fill="${c.text}" opacity="0.42" font-family="JetBrains Mono, monospace" font-size="${f(fs * 0.46)}" font-weight="500" letter-spacing="0.06em">URBANIZED · CGM ATELIER · ${model.center.lat.toFixed(4)}°N ${model.center.lon.toFixed(4)}°E</text>`
    );
  }

  const frameShape = model.shape === 'circle'
    ? `<circle cx="${f(h)}" cy="${f(h)}" r="${f(h)}"/>`
    : `<rect x="0" y="0" width="${size}" height="${size}"/>`;
  const vx = -m, vy = -m * 0.65, vw = size + 2 * m, vh = size + m * 0.65 + m * 1.45;
  const mmW = (vw * 1000) / scale, mmH = (vh * 1000) / scale;

  const grainDef = (o.grain && o.grain > 0) ? `
  <filter id="arch-noise" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" result="noise"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${f(Math.min(0.2, (o.grain / 100) * 0.2))} 0"/>
  </filter>` : '';
  const grainOverlay = (o.grain && o.grain > 0) ? `
  <rect x="${f(vx)}" y="${f(vy)}" width="${f(vw)}" height="${f(vh)}" fill="#000000" filter="url(#arch-noise)" style="mix-blend-mode: overlay; pointer-events: none;"/>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Urbanized · CGM Atelier · ${model.center.lat.toFixed(6)}, ${model.center.lon.toFixed(6)} · ${size} x ${size} m · 1:${scale} -->
<svg xmlns="http://www.w3.org/2000/svg" width="${f(mmW)}mm" height="${f(mmH)}mm" viewBox="${f(vx)} ${f(vy)} ${f(vw)} ${f(vh)}">
<defs>
<clipPath id="frame">${frameShape}</clipPath>
${hatchDefs}
${grainDef}
</defs>
<rect id="PAPER" x="${f(vx)}" y="${f(vy)}" width="${f(vw)}" height="${f(vh)}" fill="${c.bg}"/>
<g id="MAP" clip-path="url(#frame)">
${groups.join('\n')}
</g>
<g id="FRAME" fill="none" stroke="${c.text}" stroke-width="${pen(0.28)}">${frameShape}</g>
${extras.join('\n')}
${grainOverlay}
<!-- ${esc('© OpenStreetMap contributors · Made by CGM Atelier')} -->
</svg>`;
}

export function mapPNG(svg, width = 4000) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const k = width / img.naturalWidth;
      const cv = document.createElement('canvas');
      cv.width = width;
      cv.height = Math.round(img.naturalHeight * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('svg')); };
    img.src = url;
  });
}
