// Разрез по линии на карте: профиль рельефа, здания и вода вдоль линии.
// Длина — до 20 км. Выгрузка: AutoCAD (DXF), Illustrator (SVG), PNG.
import { elevationAt, buildingHeight } from './data.js?v=4.1';

export const MAX_SECTION_KM = 20;
const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const OVERPASS = [
  '/api/overpass',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const metersPerDeg = (lat) => {
  const phi = (lat * Math.PI) / 180;
  return {
    lat: 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi),
    lon: 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi),
  };
};

export function sectionLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const m = metersPerDeg((points[i][0] + points[i - 1][0]) / 2);
    len += Math.hypot((points[i][1] - points[i - 1][1]) * m.lon, (points[i][0] - points[i - 1][0]) * m.lat);
  }
  return len;
}

async function fetchAlong(points, radius = 40, signal) {
  const coords = points.map(([lat, lon]) => `${lat.toFixed(6)},${lon.toFixed(6)}`).join(',');
  const r = Math.max(25, Math.min(150, radius || 40));
  const query = `[out:json][timeout:12];(
    way["building"](around:${r},${coords});
    relation["building"](around:${r},${coords});
    way["aeroway"="terminal"](around:${r},${coords});
    relation["aeroway"="terminal"](around:${r},${coords});
    node["natural"="tree"](around:${r},${coords});
    way["natural"="tree_row"](around:${r},${coords});
    way["landuse"="forest"](around:${r},${coords});
    way["natural"="wood"](around:${r},${coords});
    way["natural"="water"](around:${r},${coords});
    way["waterway"](around:${r},${coords});
  );out geom;`;
  const ctrls = OVERPASS.map(() => new AbortController());
  const attempt = async (url) => {
    const isProxy = url.startsWith('/');
    const res = await fetch(url, {
      method: 'POST',
      headers: isProxy ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
      body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.any([AbortSignal.timeout(8000), ...(signal ? [signal] : [])]),
    });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
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

// Пересечения замкнутого контура с линией разреза → интервалы расстояний вдоль линии.
function crossIntervals(poly, path) {
  const hits = [];
  for (let s = 0; s < path.length - 1; s++) {
    const a = path[s], b = path[s + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const ex = q[0] - p[0], ey = q[1] - p[1];
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((p[0] - a.x) * ey - (p[1] - a.y) * ex) / den;
      const u = ((p[0] - a.x) * dy - (p[1] - a.y) * dx) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) hits.push(a.d + t * (b.d - a.d));
    }
  }
  hits.sort((m, n) => m - n);
  const inside = ([x, y]) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const at = (d) => {
    for (let s = 0; s < path.length - 1; s++) {
      const a = path[s], b = path[s + 1];
      if (d >= a.d && d <= b.d) {
        const t = (d - a.d) / (b.d - a.d || 1);
        return [a.x + t * (b.x - a.x), a.y + t * (b.y - a.y)];
      }
    }
    return [path.at(-1).x, path.at(-1).y];
  };
  const spans = [];
  const bounds = [0, ...hits, path.at(-1).d];
  for (let i = 0; i < bounds.length - 1; i++) {
    const d0 = bounds[i], d1 = bounds[i + 1];
    if (d1 - d0 < 0.3) continue;
    if (inside(at((d0 + d1) / 2))) spans.push([d0, d1]);
  }
  return spans;
}

export async function buildSection(points, { exaggeration = 1, buffer = 40, includeBuildings = true, includeTrees = true } = {}, onStep = () => {}, signal) {
  const length = sectionLength(points);
  if (length > MAX_SECTION_KM * 1000) throw new Error('too long');

  onStep('status.sectionTerrain');
  const step = Math.min(25, Math.max(4, length / 180));
  const mid = points[Math.floor(points.length / 2)];
  const m = metersPerDeg(mid[0]);
  const toLocal = ([lat, lon]) => [(lon - mid[1]) * m.lon, (lat - mid[0]) * m.lat];

  // равномерные отсчёты вдоль ломаной
  const path = [];
  const samples = [];
  let d = 0;
  for (let i = 0; i < points.length; i++) {
    const [x, y] = toLocal(points[i]);
    if (i > 0) {
      const prev = path[i - 1];
      d += Math.hypot(x - prev.x, y - prev.y);
    }
    path.push({ x, y, d, lat: points[i][0], lon: points[i][1] });
  }
  for (let s = 0; s < path.length - 1; s++) {
    const a = path[s], b = path[s + 1];
    const n = Math.max(1, Math.round((b.d - a.d) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      samples.push({ d: a.d + t * (b.d - a.d), lat: a.lat + t * (b.lat - a.lat), lon: a.lon + t * (b.lon - a.lon) });
    }
  }
  samples.push({ d: path.at(-1).d, lat: path.at(-1).lat, lon: path.at(-1).lon });

  const zoom = length <= 2000 ? 15 : length <= 6000 ? 14 : 13;
  const elev = await elevationAt(samples.map((s) => [s.lat, s.lon]), zoom);
  const raw = samples.map((s) => ({ d: s.d, z: elev.at(s.lat, s.lon) }));
  // Ширина сглаживания подбирается по самим данным: измеряем длину «ступенек»
  // (подряд идущих одинаковых высот) — так профиль выпрямляется и при грубом растре.
  const runs = [];
  let run = 1;
  for (let i = 1; i < raw.length; i++) {
    if (Math.abs(raw[i].z - raw[i - 1].z) < 1e-4) run++;
    else { runs.push(run); run = 1; }
  }
  runs.push(run);
  runs.sort((a, b) => a - b);
  const medianRun = runs[Math.floor(runs.length / 2)] || 1;
  // минимум — окно около 5 м по длине: исходные высоты квантованы и идут ступеньками
  const win = Math.max(2, Math.min(80, Math.round(Math.max(medianRun, elev.res / step, 5 / step) * 0.9)));
  const smooth = (src) => src.map((p, i) => {
    let sum = 0, wsum = 0;
    for (let k = -win; k <= win; k++) {
      const q = src[i + k];
      if (!q) continue;
      const w = 1 - Math.abs(k) / (win + 1);
      sum += q.z * w;
      wsum += w;
    }
    return { d: p.d, z: sum / wsum };
  });
  const profile = smooth(smooth(raw)); // два прохода ≈ гауссово сглаживание

  const groundAt = (dist) => {
    const i = Math.min(profile.length - 1, Math.max(0, Math.round((dist / length) * (profile.length - 1))));
    return profile[i].z;
  };

  onStep('status.sectionData');
  let osm = { elements: [] };
  try { osm = await fetchAlong(points, buffer || 40, signal); } catch { /* sin edificios */ }

  const buildings = [], water = [], trees = [];
  // проекция точки на линию разреза: расстояние вдоль и отступ в сторону
  const project = ([x, y]) => {
    let best = null;
    for (let s2 = 0; s2 < path.length - 1; s2++) {
      const a = path[s2], b = path[s2 + 1];
      const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
      const px = a.x + t * dx, py = a.y + t * dy;
      const off = Math.hypot(x - px, y - py);
      if (!best || off < best.off) best = { d: a.d + t * (b.d - a.d), off };
    }
    return best;
  };
  const noise = (v) => ((Math.sin(v * 12.9898) * 43758.5453) % 1 + 1) % 1;
  const addTree = (d, h, r) => {
    if (d < 0 || d > length) return;
    trees.push({ d, h, r, z: groundAt(d) });
  };
  for (const el of osm.elements ?? []) {
    const tt = el.tags ?? {};

    // 1. Árboles individuales (nodos)
    if (el.type === 'node' && tt.natural === 'tree') {
      if (!includeTrees) continue;
      const pr = project(toLocal([el.lat, el.lon]));
      if (pr && pr.off <= (buffer || 40) * 0.6) addTree(pr.d, num(tt.height) ?? 10, (num(tt.diameter_crown) ?? 6) / 2);
      continue;
    }

    // 2. Extraer polígonos/líneas tanto de ways como de relations (multipolygons)
    const rawPolys = [];
    if (el.type === 'way' && el.geometry && el.geometry.length >= 2) {
      rawPolys.push(el.geometry);
    } else if (el.type === 'relation' && el.members) {
      for (const m of el.members) {
        if (m.geometry && m.geometry.length >= 2 && (m.role === 'outer' || !m.role)) {
          rawPolys.push(m.geometry);
        }
      }
    }
    if (!rawPolys.length) continue;

    // 3. Hileras de árboles (tree_row)
    if (tt.natural === 'tree_row') {
      if (!includeTrees) continue;
      for (const geom of rawPolys) {
        const pts = geom.map((g) => toLocal([g.lat, g.lon]));
        for (let i = 1; i < pts.length; i++) {
          const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          for (let k = 0; k < seg; k += 8) {
            const f = k / seg;
            const pr = project([pts[i - 1][0] + f * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + f * (pts[i][1] - pts[i - 1][1])]);
            if (pr && pr.off <= 18) addTree(pr.d, 9 + noise(pr.d) * 3, 3);
          }
        }
      }
      continue;
    }

    // 4. Bosques / Vegetación continua
    if (tt.landuse === 'forest' || tt.natural === 'wood') {
      if (!includeTrees) continue;
      for (const geom of rawPolys) {
        const poly = geom.map((g) => toLocal([g.lat, g.lon]));
        for (const [d0, d1] of crossIntervals(poly, path))
          for (let d2 = d0 + 3; d2 < d1 - 2; d2 += 6 + noise(d2) * 3) addTree(d2, 12 + noise(d2 * 1.7) * 7, 3 + noise(d2 * 2.3) * 1.5);
      }
      continue;
    }

    // 5. Edificios, Terminales o Volúmenes arquitectónicos
    const isBuilding = !!(tt.building || tt.aeroway === 'terminal' || tt['building:part']);
    for (const geom of rawPolys) {
      const poly = geom.map((g) => toLocal([g.lat, g.lon]));
      const spans = crossIntervals(poly, path);
      if (!spans.length) continue;

      if (isBuilding) {
        if (!includeBuildings) continue;
        let { base, top } = buildingHeight(tt);
        if (!top || isNaN(top) || top <= 0) {
          if (tt['building:levels']) top = Math.max(3.5, parseFloat(tt['building:levels']) * 3.5);
          else if (tt.aeroway === 'terminal') top = 14;
          else top = 8;
        }
        if (!base || isNaN(base)) base = 0;
        for (const [d0, d1] of spans) {
          let g = Infinity;
          for (let x = d0; x <= d1; x += Math.max(1, (d1 - d0) / 10)) g = Math.min(g, groundAt(x));
          buildings.push({
            d0, d1,
            base: g + base,
            top: g + top,
            name: tt.name ?? (tt.aeroway === 'terminal' ? 'Terminal' : ''),
            levels: tt['building:levels'] ?? null
          });
        }
      } else {
        // Cuerpos de agua
        for (const [d0, d1] of spans) water.push({ d0, d1, z: Math.min(groundAt(d0), groundAt(d1)) });
      }
    }
  }

  const zs = profile.map((p) => p.z);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs, ...buildings.map((b) => b.top));
  return {
    id: points.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join(';'),
    flip: false,
    points, length, profile, buildings, water, trees, minZ, maxZ, exaggeration,
    terrainRes: elev.res, terrainZoom: elev.zoom,
  };
}

/* ---------------- Отрисовка ---------------- */

const nice = (v) => [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000].find((n) => n >= v) ?? 5000;

// Примитивы в координатах чертежа: X — расстояние, Y — отметка × увеличение, метры.
export function sectionDrawing(sec) {
  const k = sec.exaggeration;
  const L0 = sec.length;
  const fx = sec.flip ? (d) => L0 - d : (d) => d;
  const base = Math.floor((sec.minZ - Math.max(5, (sec.maxZ - sec.minZ) * 0.15)) / 5) * 5;
  const L = sec.length;
  const polylines = [], texts = [];
  const ts = Math.min(40, Math.max(3, L / 220)); // высота подписей в метрах чертежа
  const gy = (z) => (z - base) * k;

  const ground = (sec.flip ? [...sec.profile].reverse() : sec.profile).map((p) => [fx(p.d), gy(p.z)]);
  polylines.push({ layer: 'SECTION_GROUND', pts: [[0, 0], ...ground, [L, 0]], closed: true, fill: true });
  polylines.push({ layer: 'SECTION_GROUND', pts: ground, closed: false });

  for (const b of sec.buildings)
    polylines.push({
      layer: 'SECTION_BUILDINGS',
      pts: [[fx(b.d0), gy(b.base)], [fx(b.d1), gy(b.base)], [fx(b.d1), gy(b.top)], [fx(b.d0), gy(b.top)]],
      closed: true, fill: true, building: b,
    });
  // деревья: ствол и крона-эллипс (по вертикали — с учётом увеличения)
  for (const tr of sec.trees ?? []) {
    const x = fx(tr.d), yb = gy(tr.z), crownY = gy(tr.z + tr.h - tr.r);
    polylines.push({ layer: 'SECTION_TREES', pts: [[x, yb], [x, crownY]], closed: false, trunk: true });
    const ellipse = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      ellipse.push([x + Math.cos(a) * tr.r, crownY + Math.sin(a) * tr.r * k]);
    }
    polylines.push({ layer: 'SECTION_TREES', pts: ellipse, closed: true, crown: true });
  }
  for (const w of sec.water) polylines.push({ layer: 'SECTION_WATER', pts: [[fx(w.d0), gy(w.z)], [fx(w.d1), gy(w.z)]], closed: false });

  // сетка: расстояния снизу, отметки слева
  const dStep = nice(L / 12);
  for (let x = 0; x <= L + 0.5; x += dStep) {
    polylines.push({ layer: 'SECTION_GRID', pts: [[x, 0], [x, gy(sec.maxZ) + 4 * k]], closed: false, thin: true });
    texts.push({ layer: 'SECTION_GRID', x, y: -ts * 1.6, text: `${Math.round(x)}`, size: ts, anchor: 'middle' });
  }
  const zStep = nice((sec.maxZ - base) / 8);
  for (let z = Math.ceil(base / zStep) * zStep; z <= sec.maxZ + zStep; z += zStep) {
    polylines.push({ layer: 'SECTION_GRID', pts: [[0, gy(z)], [L, gy(z)]], closed: false, thin: true });
    texts.push({ layer: 'SECTION_GRID', x: -ts * 0.6, y: gy(z) - ts * 0.35, text: `${Math.round(z)}`, size: ts, anchor: 'end' });
  }
  for (const b of sec.buildings)
    if (b.name && b.d1 - b.d0 > L / 60)
      texts.push({ layer: 'SECTION_LABELS', x: fx((b.d0 + b.d1) / 2), y: gy(b.top) + ts * 0.5, text: b.name, size: ts * 0.8, anchor: 'middle' });

  const bounds = { x0: -L * 0.06, x1: L * 1.02, y0: -ts * 3, y1: gy(sec.maxZ) + Math.max(ts * 3, 12 * k) };
  return { polylines, texts, bounds, base, gy };
}

const f = (v) => (Math.round(v * 1000) / 1000).toString();

export function sectionSVG(sec, opts = {}) {
  const { polylines, texts, bounds } = sectionDrawing(sec);
  const w = bounds.x1 - bounds.x0, h = bounds.y1 - bounds.y0;
  const scale = [200, 500, 1000, 2000, 5000, 10000, 25000].find((s) => (w * 1000) / s <= 1000) ?? 50000;
  const mm = (v) => (v * 1000) / scale;
  const lw = (mmWidth) => f((mmWidth * scale) / 1000);
  const d = (pts, closed) => `M${pts.map(([x, y]) => `${f(x - bounds.x0)},${f(bounds.y1 - y)}`).join('L')}${closed ? 'Z' : ''}`;
  const group = (layer, attrs, items) => (items.length ? `<g id="${layer}" ${attrs}>${items.join('')}</g>` : '');

  const layers = sec.layers || opts.layers || { ground: true, buildings: true, grid: true, trees: true };
  const darkMode = opts.darkMode ?? true;

  const groundFill = (layers.ground !== false) ? polylines.filter((p) => p.layer === 'SECTION_GROUND' && p.fill).map((p) => `<path d="${d(p.pts, true)}"/>`) : [];
  const groundLine = (layers.ground !== false) ? polylines.filter((p) => p.layer === 'SECTION_GROUND' && !p.fill).map((p) => `<path d="${d(p.pts, false)}"/>`) : [];
  const grid = (layers.grid !== false) ? polylines.filter((p) => p.layer === 'SECTION_GRID').map((p) => `<path d="${d(p.pts, false)}"/>`) : [];
  const bld = (layers.buildings !== false) ? polylines.filter((p) => p.layer === 'SECTION_BUILDINGS').map((p) => `<path d="${d(p.pts, true)}"/>`) : [];
  const treeTrunks = (layers.trees !== false) ? polylines.filter((p) => p.layer === 'SECTION_TREES' && p.trunk).map((p) => `<path d="${d(p.pts, false)}"/>`) : [];
  const treeCrowns = (layers.trees !== false) ? polylines.filter((p) => p.layer === 'SECTION_TREES' && p.crown).map((p) => `<path d="${d(p.pts, true)}"/>`) : [];
  const wat = polylines.filter((p) => p.layer === 'SECTION_WATER').map((p) => `<path d="${d(p.pts, false)}"/>`);
  const txt = (layer) => texts.filter((t) => t.layer === layer)
    .map((t) => `<text x="${f(t.x - bounds.x0)}" y="${f(bounds.y1 - t.y)}" font-size="${t.size}" text-anchor="${t.anchor}" font-family="Inter, sans-serif">${t.text.replace(/[<>&]/g, '')}</text>`);

  const bgFill = darkMode ? '#07080b' : '#ffffff';
  const gridStroke = darkMode ? 'rgba(255,255,255,0.12)' : '#d8d8d8';
  const groundFillColor = darkMode ? 'url(#secGroundGrad)' : '#e6e2d8';
  const groundStrokeColor = darkMode ? '#ffffff' : '#000000';
  const bldFill = darkMode ? 'rgba(255,255,255,0.14)' : '#ffffff';
  const bldStroke = darkMode ? 'rgba(255,255,255,0.88)' : '#3a3a3c';
  const treeFill = darkMode ? 'rgba(255,255,255,0.22)' : '#a8c98f';
  const textColor = darkMode ? 'rgba(255,255,255,0.58)' : '#6e6e73';
  const labelColor = darkMode ? '#ffffff' : '#1d1d1f';
  const hatchStep = f(Math.max(2, (bounds.x1 - bounds.x0) / 140));

  return new Blob([`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${f(mm(w))}mm" height="${f(mm(h))}mm" viewBox="0 0 ${f(w)} ${f(h)}">
<defs>
  <linearGradient id="secGroundGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22"/>
    <stop offset="100%" stop-color="#ffffff" stop-opacity="0.03"/>
  </linearGradient>
  <pattern id="secEarthHatch" width="${hatchStep}" height="${hatchStep}" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
    <line x1="0" y1="0" x2="0" y2="${hatchStep}" stroke="rgba(255,255,255,0.14)" stroke-width="${lw(0.08)}"/>
  </pattern>
</defs>
<rect width="${f(w)}" height="${f(h)}" fill="${bgFill}"/>
${layers.grid !== false ? group('SECTION_GRID', `fill="none" stroke="${gridStroke}" stroke-width="${lw(0.06)}" stroke-dasharray="${lw(0.3)} ${lw(0.3)}"`, grid) : ''}
${group('SECTION_GROUND_FILL', `fill="${groundFillColor}" stroke="none"`, groundFill)}
${darkMode ? group('SECTION_GROUND_HATCH', `fill="url(#secEarthHatch)" stroke="none"`, groundFill) : ''}
${group('SECTION_WATER', `fill="none" stroke="#94a3b8" stroke-width="${lw(0.5)}"`, wat)}
${group('SECTION_TREES_TRUNKS', `fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="${lw(0.12)}"`, treeTrunks)}
${group('SECTION_TREES', `fill="${treeFill}" stroke="rgba(255,255,255,0.55)" stroke-width="${lw(0.08)}"`, treeCrowns)}
${group('SECTION_BUILDINGS', `fill="${bldFill}" stroke="${bldStroke}" stroke-width="${lw(0.2)}"`, bld)}
${group('SECTION_GROUND', `fill="none" stroke="${groundStrokeColor}" stroke-width="${lw(0.45)}"`, groundLine)}
${layers.grid !== false ? group('SECTION_GRID_TEXT', `fill="${textColor}" font-weight="500"`, txt('SECTION_GRID')) : ''}
${group('SECTION_LABELS', `fill="${labelColor}" font-weight="600"`, txt('SECTION_LABELS'))}
</svg>`], { type: 'image/svg+xml' });
}

export function sectionDXF(sec) {
  const { polylines, texts } = sectionDrawing(sec);
  const o = [];
  const w = (c, v) => o.push(c, v);
  const layers = { SECTION_GROUND: 7, SECTION_BUILDINGS: 8, SECTION_WATER: 150, SECTION_TREES: 94, SECTION_GRID: 254, SECTION_LABELS: 7 };
  w(0, 'SECTION'); w(2, 'HEADER'); w(9, '$ACADVER'); w(1, 'AC1009'); w(0, 'ENDSEC');
  w(0, 'SECTION'); w(2, 'TABLES');
  w(0, 'TABLE'); w(2, 'LTYPE'); w(70, 1);
  w(0, 'LTYPE'); w(2, 'CONTINUOUS'); w(70, 0); w(3, 'Solid line'); w(72, 65); w(73, 0); w(40, 0);
  w(0, 'ENDTAB');
  w(0, 'TABLE'); w(2, 'LAYER'); w(70, Object.keys(layers).length + 1);
  w(0, 'LAYER'); w(2, '0'); w(70, 0); w(62, 7); w(6, 'CONTINUOUS');
  for (const [name, aci] of Object.entries(layers)) { w(0, 'LAYER'); w(2, name); w(70, 0); w(62, aci); w(6, 'CONTINUOUS'); }
  w(0, 'ENDTAB'); w(0, 'ENDSEC');
  w(0, 'SECTION'); w(2, 'ENTITIES');
  for (const p of polylines) {
    if (p.fill && p.layer === 'SECTION_GROUND') continue; // заливка нужна только в векторе для Illustrator
    w(0, 'POLYLINE'); w(8, p.layer); w(66, 1); w(10, 0); w(20, 0); w(30, 0); w(70, p.closed ? 1 : 0);
    for (const [x, y] of p.pts) { w(0, 'VERTEX'); w(8, p.layer); w(10, f(x)); w(20, f(y)); w(30, 0); }
    w(0, 'SEQEND'); w(8, p.layer);
  }
  for (const t of texts) {
    w(0, 'TEXT'); w(8, t.layer); w(10, f(t.x)); w(20, f(t.y)); w(30, 0); w(40, t.size);
    w(1, t.text.slice(0, 200)); w(72, t.anchor === 'middle' ? 1 : t.anchor === 'end' ? 2 : 0);
    if (t.anchor !== 'start') { w(11, f(t.x)); w(21, f(t.y)); w(31, 0); }
  }
  w(0, 'ENDSEC'); w(0, 'EOF');
  let s = '';
  for (let i = 0; i < o.length; i += 2) s += `${String(o[i]).padStart(3)}\r\n${o[i + 1]}\r\n`;
  return new Blob([s], { type: 'application/dxf' });
}

// PNG — растеризация того же SVG.
export async function sectionPNG(sec, pxPerMeter = 2) {
  const svg = sectionSVG(sec);
  const url = URL.createObjectURL(svg);
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const { bounds } = sectionDrawing(sec);
    const w = Math.min(12000, Math.round((bounds.x1 - bounds.x0) * pxPerMeter));
    const h = Math.max(1, Math.round((w * (bounds.y1 - bounds.y0)) / (bounds.x1 - bounds.x0)));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise((res) => canvas.toBlob(res, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const SECTION_FORMATS = {
  dxf: { ext: 'dxf', make: sectionDXF },
  svg: { ext: 'svg', make: sectionSVG },
  png: { ext: 'png', make: sectionPNG },
};
