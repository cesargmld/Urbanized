// Векторная карта (план сверху): слои, тени зданий, отмывка рельефа и карта высот,
// сетка, масштабная линейка, север. Один SVG — и для превью, и для Illustrator.
import { CLASS_COLORS } from './exporters.js?v=4.1';
import { pinStore } from './pins.js?v=1.0';

export const MAP_GRID_STEPS = ['auto', 5, 20, 50, 100, 250, 500, 1000];

export const MAP_PRESETS = {
  classic: {
    colors: {
      bg: '#f4f1ea', building: '#d8d0c2', outline: '#8a8276', road: '#ffffff', path: '#ebe3d3', rail: '#77736c',
      water: '#a9cbe3', green: '#cfe0b8', tree: '#9cc17f', contour: '#cdbd9f', shadow: '#2b2924',
      depthLow: '#eef0e2', depthHigh: '#c8ab84', grid: '#b9b2a6', text: '#2b2b2b',
    },
    layers: { buildings: true, roads: true, rail: true, water: true, green: true, trees: true, contours: false, site: true, byType: false },
    shadows: { on: true, azimuth: 315, altitude: 35, strength: 0.22 },
    relief: { hillshade: true, hillshadeStrength: 0.45, depth: false, depthStrength: 0.7 },
    overlays: { scalebar: true, north: true, grid: false },
    outlineWidth: 0.08,
  },
  figure: {
    colors: {
      bg: '#ffffff', building: '#111111', outline: '#111111', road: '#ffffff', path: '#ffffff', rail: '#9a9a9a',
      water: '#dcdcdc', green: '#f1f1f1', tree: '#d6d6d6', contour: '#d0d0d0', shadow: '#000000',
      depthLow: '#ffffff', depthHigh: '#bdbdbd', grid: '#cfcfcf', text: '#111111',
    },
    layers: { buildings: true, roads: true, rail: false, water: true, green: false, trees: false, contours: false, site: true, byType: false },
    shadows: { on: false, azimuth: 315, altitude: 35, strength: 0.2 },
    relief: { hillshade: false, hillshadeStrength: 0.4, depth: false, depthStrength: 0.6 },
    overlays: { scalebar: true, north: true, grid: false },
    outlineWidth: 0,
  },
  relief: {
    colors: {
      bg: '#fbfaf6', building: '#ffffff', outline: '#4d4a45', road: '#fffdf8', path: '#f3eadb', rail: '#6d6a64',
      water: '#9fc4df', green: '#c7dcae', tree: '#8db872', contour: '#9c8463', shadow: '#2a2622',
      depthLow: '#dfeacb', depthHigh: '#c49668', grid: '#b0a898', text: '#2b2b2b',
    },
    layers: { buildings: true, roads: true, rail: true, water: true, green: false, trees: false, contours: true, site: true, byType: false },
    shadows: { on: false, azimuth: 315, altitude: 35, strength: 0.2 },
    relief: { hillshade: true, hillshadeStrength: 0.6, depth: true, depthStrength: 0.85 },
    overlays: { scalebar: true, north: true, grid: false },
    outlineWidth: 0.08,
  },
  night: {
    colors: {
      bg: '#15171c', building: '#353a46', outline: '#4a505e', road: '#2a2e37', path: '#20232a', rail: '#555b68',
      water: '#1b3450', green: '#1d2a22', tree: '#2b4733', contour: '#2c313b', shadow: '#000000',
      depthLow: '#15171c', depthHigh: '#3a3f4c', grid: '#2e333d', text: '#d3d7df',
    },
    layers: { buildings: true, roads: true, rail: true, water: true, green: true, trees: true, contours: false, site: true, byType: false },
    shadows: { on: true, azimuth: 315, altitude: 30, strength: 0.5 },
    relief: { hillshade: true, hillshadeStrength: 0.5, depth: false, depthStrength: 0.6 },
    overlays: { scalebar: true, north: true, grid: false },
    outlineWidth: 0,
  },
  blueprint: {
    colors: {
      bg: '#1d3e72', building: '#24497f', outline: '#e8effc', road: '#1d3e72', path: '#1d3e72', rail: '#9fb6dc',
      water: '#183462', green: '#1d3e72', tree: '#2a5491', contour: '#4f73ad', shadow: '#0b1a33',
      depthLow: '#1d3e72', depthHigh: '#2c5aa0', grid: '#4f73ad', text: '#e8effc',
    },
    layers: { buildings: true, roads: true, rail: true, water: true, green: false, trees: false, contours: true, site: true, byType: false },
    shadows: { on: false, azimuth: 315, altitude: 35, strength: 0.3 },
    relief: { hillshade: false, hillshadeStrength: 0.4, depth: false, depthStrength: 0.6 },
    overlays: { scalebar: true, north: true, grid: true },
    outlineWidth: 0.1,
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
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const niceStep = (v) => {
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= v) ?? 10 * p;
};
export const autoScale = (size) => MAP_SCALES.find((k) => (size * 1000) / k <= 420) ?? 10000;

/* --- растры рельефа: карта высот и отмывка, с плавным увеличением --- */
const rasterCache = new WeakMap();
function reliefRaster(grid, kind, { low, high, azimuth, altitude }) {
  const key = `${kind}|${low}|${high}|${azimuth}|${altitude}`;
  let byKey = rasterCache.get(grid);
  if (!byKey) rasterCache.set(grid, (byKey = new Map()));
  if (byKey.has(key)) return byKey.get(key);
  const { w, heights: hgt, step, maxH } = grid;
  const src = document.createElement('canvas');
  src.width = src.height = w;
  const ctx = src.getContext('2d');
  const img = ctx.createImageData(w, w);
  const at = (i, j) => hgt[Math.min(w - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))];
  const [lr, lg, lb] = kind === 'depth' ? hex(low) : [0, 0, 0], [hr, hg, hb] = kind === 'depth' ? hex(high) : [0, 0, 0];
  const az = ((azimuth ?? 315) * Math.PI) / 180, alt = ((altitude ?? 45) * Math.PI) / 180;
  const L = [Math.sin(az) * Math.cos(alt), Math.cos(az) * Math.cos(alt), Math.sin(alt)];
  const ex = 2.2; // усиление рельефа: в городе перепады малы
  for (let j = 0; j < w; j++)
    for (let i = 0; i < w; i++) {
      const o = ((w - 1 - j) * w + i) * 4; // строка 0 сетки — юг, а у картинки сверху север
      if (kind === 'depth') {
        const t = maxH > 0 ? at(i, j) / maxH : 0;
        img.data[o] = lr + (hr - lr) * t; img.data[o + 1] = lg + (hg - lg) * t; img.data[o + 2] = lb + (hb - lb) * t; img.data[o + 3] = 255;
      } else {
        const dx = ((at(i + 1, j) - at(i - 1, j)) / (2 * step)) * ex, dy = ((at(i, j + 1) - at(i, j - 1)) / (2 * step)) * ex;
        const n = Math.hypot(dx, dy, 1);
        const shade = (-dx * L[0] - dy * L[1] + L[2]) / n;
        const flat = L[2];
        // склоны в тени — тёмные, освещённые — светлее фона; ровная земля прозрачна
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

/* --- SVG --- */
export function mapSVG(model, o) {
  const h = model.frame.half, size = model.size;
  const c = o.colors;
  const scale = o.scale ?? autoScale(size);
  const P = ([x, y]) => `${f(x + h)},${f(h - y)}`;
  const ring = (pts, closed = true) => `M${pts.map(P).join('L')}${closed ? 'Z' : ''}`;
  const pen = (mm) => f((mm * scale) / 1000); // толщина пера в мм на листе → метры
  const groups = [];
  const g = (id, attrs, body) => { if (body) groups.push(`<g id="${id}" ${attrs}>${body}</g>`); };
  const lines = (layer) => (model.lines[layer] ?? []).map((pts) => ring(pts, false)).join('');
  const areas = (layer) => (model.areas[layer] ?? []).map((pts) => ring(pts)).join('');

  // рельеф
  if (model.grid.maxH > 0.5) {
    if (o.relief.depth)
      g('RELIEF_DEPTH', `opacity="${o.relief.depthStrength}"`, `<image href="${reliefRaster(model.grid, 'depth', { low: c.depthLow, high: c.depthHigh })}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="none"/>`);
    if (o.relief.hillshade)
      g('HILLSHADE', `opacity="${o.relief.hillshadeStrength}"`, `<image href="${reliefRaster(model.grid, 'hillshade', { azimuth: o.shadows.azimuth, altitude: Math.max(25, o.shadows.altitude) })}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="none"/>`);
  }
  if (o.layers.contours && model.contours?.length) {
    const ci = model.contourInterval ?? 5;
    const major = model.contours.filter((k) => Math.round(k.z / ci) % 5 === 0);
    const minor = model.contours.filter((k) => Math.round(k.z / ci) % 5 !== 0);
    g('CONTOURS', `fill="none" stroke="${c.contour}" stroke-width="${pen(0.08)}"`, minor.map((k) => `<path d="${ring(k.pts, false)}"/>`).join(''));
    g('CONTOURS_INDEX', `fill="none" stroke="${c.contour}" stroke-width="${pen(0.2)}"`, major.map((k) => `<path d="${ring(k.pts, false)}"/>`).join(''));
  }
  if (o.layers.green) g('GREEN', `fill="${c.green}"`, areas('GREEN') && `<path d="${areas('GREEN')}"/>`);
  if (o.layers.water) {
    g('WATER', `fill="${c.water}"`, areas('WATER') && `<path d="${areas('WATER')}"/>`);
    g('WATERWAYS', `fill="none" stroke="${c.water}" stroke-width="${pen(0.5)}" stroke-linecap="round" stroke-linejoin="round"`, lines('WATER') && `<path d="${lines('WATER')}"/>`);
  }
  if (o.layers.roads) {
    if (model.roadAreas?.length) {
      for (const { layer, polys } of model.roadAreas)
        g(layer, `fill="${layer === 'ROADS_AREA' ? c.road : c.path}" fill-rule="evenodd"`, `<path d="${polys.map((rs) => rs.map((r) => ring(r)).join('')).join('')}"/>`);
    } else {
      // без реальной ширины: линии с типовой шириной в метрах
      const stroke = (layer, color, width) => g(layer, `fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`, lines(layer) && `<path d="${lines(layer)}"/>`);
      stroke('PATHS', c.path, 2.5);
      stroke('ROADS_MINOR', c.road, 7);
      stroke('ROADS_MAJOR', c.road, 13);
    }
    if (model.lines.BRIDGES?.length)
      g('BRIDGES', `fill="none" stroke="${c.road}" stroke-width="9" stroke-linecap="butt" stroke-linejoin="round"`, `<path d="${lines('BRIDGES')}"/>`);
  }
  if (o.layers.rail) g('RAILWAYS', `fill="none" stroke="${c.rail}" stroke-width="${pen(0.25)}" stroke-dasharray="${pen(1.6)} ${pen(0.8)}"`, lines('RAILWAYS') && `<path d="${lines('RAILWAYS')}"/>`);

  // тени: след основания, протянутый от солнца; прозрачность — у группы, чтобы наложения не темнели
  if (o.shadows.on && (o.layers.buildings || o.layers.trees)) {
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
    g('SHADOWS', `fill="${c.shadow}" fill-rule="nonzero" opacity="${o.shadows.strength}"`, parts.join(''));
  }
  if (o.layers.trees && model.trees.length)
    g('TREES', `fill="${c.tree}"`, model.trees.map((t) => `<circle cx="${f(t.x + h)}" cy="${f(h - t.y)}" r="${f(t.r)}"/>`).join(''));
  if (o.layers.buildings && model.buildings.length) {
    const stroke = o.outlineWidth > 0 ? ` stroke="${c.outline}" stroke-width="${pen(o.outlineWidth)}" stroke-linejoin="round"` : '';
    if (o.layers.byType) {
      for (const cls of Object.keys(CLASS_COLORS)) {
        const list = model.buildings.filter((b) => (b.cls ?? 'other') === cls);
        if (list.length) g(`BUILDINGS_${cls.toUpperCase()}`, `fill="${CLASS_COLORS[cls]}" fill-rule="evenodd"${stroke}`, list.map((b) => `<path d="${b.rings.map((r) => ring(r)).join('')}"/>`).join(''));
      }
    } else {
      // сначала низкие объёмы, потом высокие: башня над подиумом читается целиком
      const list = model.buildings.slice().sort((a, b) => (a.height ?? 0) - (b.height ?? 0));
      g('BUILDINGS', `fill="${c.building}" fill-rule="evenodd"${stroke}`, list.map((b) => `<path d="${b.rings.map((r) => ring(r)).join('')}"/>`).join(''));
    }
  }
  if (o.layers.site && model.site?.length > 2)
    g('SITE', `fill="none" stroke="#c0392b" stroke-width="${pen(0.5)}" stroke-dasharray="${pen(3)} ${pen(1.5)}"`, `<path d="${ring(model.site)}"/>`);

  // сетка поверх карты, подписи — на полях
  const fs = size * 0.016;
  const m = size * 0.07; // поля листа
  const extras = [];

  // Isócronas peatonales en lámina 2D
  if (o.overlays.isochrones) {
    const rings = [
      { r: 400, color: '#0284c7', label: '5 min · 400 m' },
      { r: 800, color: '#4f46e5', label: '10 min · 800 m' },
      { r: 1200, color: '#7c3aed', label: '15 min · 1.2 km' },
    ];
    for (const { r, color, label } of rings) {
      if (r > size * 0.9) continue;
      groups.push(`<g id="ISOCHRONE_${r}"><circle cx="${f(h)}" cy="${f(h)}" r="${f(r)}" fill="none" stroke="${color}" stroke-width="${pen(0.35)}" stroke-dasharray="${pen(2)} ${pen(1.2)}"/>`
        + `<text x="${f(h + r - fs * 0.4)}" y="${f(h - fs * 0.3)}" fill="${color}" font-family="Roboto, sans-serif" font-size="${f(fs * 0.65)}" font-weight="600" text-anchor="end">${label}</text></g>`);
    }
  }
  if (o.overlays.grid) {
    let st;
    if (o.overlays.gridStep && o.overlays.gridStep !== 'auto') {
      st = Number(o.overlays.gridStep) || 100;
    } else {
      st = niceStep(size / 6);
    }
    const maxDivs = 140;
    if (size / st > maxDivs) st = niceStep(size / maxDivs);

    let d = '';
    const style = o.overlays.gridStyle || 'cross';
    if (style === 'cross') {
      const cr = fs * 0.28;
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
      for (let v = st; v < size - 1e-6; v += st) d += `M${f(v)},0V${size}M0,${f(v)}H${size}`;
    }
    groups.push(`<g id="GRID" fill="${style === 'dots' ? c.grid : 'none'}" stroke="${c.grid}" stroke-width="${pen(0.12)}">${d ? `<path d="${d}"/>` : ''}</g>`);

    let labels = '';
    for (let v = 0; v <= size + 1e-6; v += st) {
      labels += `<text x="${f(v)}" y="${f(size + fs * 1.4)}" text-anchor="middle">${Math.round(v)}</text>`;
      labels += `<text x="${f(-fs * 0.5)}" y="${f(size - v + fs * 0.35)}" text-anchor="end">${Math.round(v)}</text>`;
    }
    extras.push(`<g id="GRID_LABELS" fill="${c.text}" font-family="Roboto, Arial, sans-serif" font-size="${f(fs * 0.8)}">${labels}</g>`);
  }

  // Pines y Marcadores Personalizados (Imagen 3)
  const pins = pinStore.getPins().filter((p) => p.visible);
  if (pins.length > 0) {
    let pinShapes = '';
    for (const p of pins) {
      const px = p.x + h;
      const py = h - p.y;
      const r = fs * 0.65;
      pinShapes += `
      <g id="PIN_${p.id}">
        <circle cx="${f(px)}" cy="${f(py)}" r="${f(r * 1.6)}" fill="${p.color}" opacity="0.25"/>
        <circle cx="${f(px)}" cy="${f(py)}" r="${f(r)}" fill="${p.color}" stroke="#ffffff" stroke-width="${pen(0.35)}"/>
        <line x1="${f(px)}" y1="${f(py - r)}" x2="${f(px + r * 1.2)}" y2="${f(py - r * 2.2)}" stroke="${p.color}" stroke-width="${pen(0.25)}"/>
        <rect x="${f(px + r * 1.2)}" y="${f(py - r * 3.4)}" width="${f(fs * 4.2)}" height="${f(fs * 1.3)}" rx="${f(fs * 0.3)}" fill="${p.color}"/>
        <text x="${f(px + r * 1.6)}" y="${f(py - r * 2.5)}" fill="#ffffff" font-family="Inter, sans-serif" font-size="${f(fs * 0.65)}" font-weight="600">${esc(p.label.length > 14 ? p.label.slice(0, 13) + '…' : p.label)}</text>
      </g>`;
    }
    groups.push(`<g id="CUSTOM_PINS">${pinShapes}</g>`);
  }

  const barY = size + m * (o.overlays.grid ? 0.95 : 0.55);
  if (o.overlays.scalebar) {
    const len = niceStep(size / 5);
    const seg = len / 4, bh = fs * 0.45;
    let bar = '';
    for (let i = 0; i < 4; i++) bar += `<rect x="${f(i * seg)}" y="${f(barY)}" width="${f(seg)}" height="${f(bh)}" fill="${i % 2 ? c.bg : c.text}" stroke="${c.text}" stroke-width="${f(fs * 0.06)}"/>`;
    bar += `<g fill="${c.text}" font-family="Roboto, Arial, sans-serif" font-size="${f(fs * 0.8)}">`
      + `<text x="0" y="${f(barY + bh + fs * 1.1)}">0</text>`
      + `<text x="${f(len)}" y="${f(barY + bh + fs * 1.1)}" text-anchor="middle">${len} m</text>`
      + `<text x="${f(len + fs * 1.4)}" y="${f(barY + bh)}">1:${scale}</text></g>`;
    extras.push(`<g id="SCALEBAR">${bar}</g>`);
  }
  if (o.overlays.north) {
    const nx = size - fs, ny = barY - fs * 0.2, s2 = fs * 0.75;
    const nStyle = o.overlays.northStyle || 'swiss';
    let northShape = '';
    if (nStyle === 'swiss') {
      northShape = `<path d="M${f(nx)},${f(ny)}L${f(nx + s2 * 0.6)},${f(ny + s2 * 1.8)}L${f(nx)},${f(ny + s2 * 1.4)}Z" fill="${c.text}"/>`
        + `<path d="M${f(nx)},${f(ny)}L${f(nx - s2 * 0.6)},${f(ny + s2 * 1.8)}L${f(nx)},${f(ny + s2 * 1.4)}Z" fill="none" stroke="${c.text}" stroke-width="${pen(0.1)}"/>`;
    } else if (nStyle === 'minimal') {
      northShape = `<line x1="${f(nx)}" y1="${f(ny + s2 * 2)}" x2="${f(nx)}" y2="${f(ny)}" stroke="${c.text}" stroke-width="${pen(0.15)}"/>`
        + `<polyline points="${f(nx - s2 * 0.4)},${f(ny + s2 * 0.6)} ${f(nx)},${f(ny)} ${f(nx + s2 * 0.4)},${f(ny + s2 * 0.6)}" fill="none" stroke="${c.text}" stroke-width="${pen(0.15)}"/>`;
    } else {
      northShape = `<circle cx="${f(nx)}" cy="${f(ny + s2)}" r="${f(s2)}" fill="none" stroke="${c.text}" stroke-width="${pen(0.1)}"/>`
        + `<path d="M${f(nx)},${f(ny)}L${f(nx + s2 * 0.5)},${f(ny + s2 * 1.8)}L${f(nx)},${f(ny + s2 * 1.4)}L${f(nx - s2 * 0.5)},${f(ny + s2 * 1.8)}Z" fill="${c.text}"/>`;
    }
    extras.push(`<g id="NORTH">${northShape}`
      + `<text x="${f(nx)}" y="${f(ny + s2 * 1.8 + fs * 1.1)}" text-anchor="middle" font-family="Roboto, Arial, sans-serif" font-size="${f(fs * 0.85)}" font-weight="700" fill="${c.text}">N</text></g>`);
  }

  const frameShape = model.shape === 'circle'
    ? `<circle cx="${f(h)}" cy="${f(h)}" r="${f(h)}"/>`
    : `<rect x="0" y="0" width="${size}" height="${size}"/>`;
  const vx = -m, vy = -m * 0.6, vw = size + 2 * m, vh = size + m * 0.6 + m * (o.overlays.grid ? 1.7 : 1.35);
  const mmW = (vw * 1000) / scale, mmH = (vh * 1000) / scale;

  // Filtro de ruido / textura arquitectónica (Imagen 2)
  const grainDef = (o.grain && o.grain > 0) ? `
  <filter id="arch-noise" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" result="noise"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${f(Math.min(0.2, (o.grain / 100) * 0.2))} 0"/>
  </filter>` : '';
  const grainOverlay = (o.grain && o.grain > 0) ? `
  <rect x="${f(vx)}" y="${f(vy)}" width="${f(vw)}" height="${f(vh)}" fill="#000000" filter="url(#arch-noise)" style="mix-blend-mode: overlay; pointer-events: none;"/>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Urbanized · ${model.center.lat.toFixed(6)}, ${model.center.lon.toFixed(6)} · ${size} x ${size} m · 1:${scale} -->
<svg xmlns="http://www.w3.org/2000/svg" width="${f(mmW)}mm" height="${f(mmH)}mm" viewBox="${f(vx)} ${f(vy)} ${f(vw)} ${f(vh)}">
<defs>
<clipPath id="frame">${frameShape}</clipPath>
${grainDef}
</defs>
<rect id="PAPER" x="${f(vx)}" y="${f(vy)}" width="${f(vw)}" height="${f(vh)}" fill="${c.bg}"/>
<g id="MAP" clip-path="url(#frame)">
${groups.join('\n')}
</g>
<g id="FRAME" fill="none" stroke="${c.text}" stroke-width="${pen(0.25)}">${frameShape}</g>
${extras.join('\n')}
${grainOverlay}
<!-- ${esc('© OpenStreetMap contributors')} -->
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
