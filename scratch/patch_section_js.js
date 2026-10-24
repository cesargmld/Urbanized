const fs = require('fs');
let code = fs.readFileSync('public/js/section.js', 'utf8');

// 1. OVERPASS list & fetchAlong
const oldOverpassBlock = code.slice(code.indexOf('const OVERPASS ='), code.indexOf('// Пересечения'));

const newOverpassBlock = `const OVERPASS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
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
  const coords = points.map(([lat, lon]) => \`\${lat.toFixed(6)},\${lon.toFixed(6)}\`).join(',');
  const r = Math.max(25, Math.min(150, radius || 40));
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
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Urbanized/2.0 (architecture-cgm@urbnzd.app)'
      },
      body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.any([AbortSignal.timeout(6000), ...(signal ? [signal] : [])]),
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

code = code.replace(oldOverpassBlock, newOverpassBlock);

// 2. buildSection parameters and parsing
const oldBuildHead = 'export async function buildSection(points, { exaggeration = 1 } = {}, onStep = () => {}, signal) {';
const newBuildHead = 'export async function buildSection(points, { exaggeration = 1, buffer = 40, includeBuildings = true, includeTrees = true } = {}, onStep = () => {}, signal) {';
code = code.replace(oldBuildHead, newBuildHead);

const oldFetchCall = 'try { osm = await fetchAlong(points, 30, signal); } catch { /* без зданий */ }';
const newFetchCall = 'try { osm = await fetchAlong(points, buffer || 40, signal); } catch { /* sin edificios */ }';
code = code.replace(oldFetchCall, newFetchCall);

// 3. Elements loop inside buildSection
const loopStart = code.indexOf('for (const el of osm.elements ?? []) {');
const loopEnd = code.indexOf('const zs = profile.map((p) => p.z);');
const oldLoop = code.slice(loopStart, loopEnd);

const newLoop = `for (const el of osm.elements ?? []) {
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

  `;

code = code.replace(oldLoop, newLoop);

fs.writeFileSync('public/js/section.js', code, 'utf8');
console.log('public/js/section.js updated successfully!');
