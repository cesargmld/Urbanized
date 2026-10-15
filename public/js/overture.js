// Здания Overture Maps там, где в OpenStreetMap их нет: Китай и Восточная Азия
// (East Asian Buildings), машинные контуры Microsoft и Google, данные Esri.
// Читаются прямо из векторных тайлов PMTiles (z14) — без сервера и ключей.
// Здания из OSM пропускаются: они уже приходят из Overpass.
import { PMTiles } from 'https://cdn.jsdelivr.net/npm/pmtiles@4.3.0/+esm';
import { VectorTile } from 'https://cdn.jsdelivr.net/npm/@mapbox/vector-tile@2.0.3/+esm';
import Pbf from 'https://cdn.jsdelivr.net/npm/pbf@4.0.1/+esm';
import * as ClipperLib from 'https://cdn.jsdelivr.net/npm/clipper-lib@6.4.2/+esm';

const CATALOG = 'https://stac.overturemaps.org/catalog.json';
const FALLBACK_RELEASE = '2026-09-23.1';
const TILES = (release) => `https://overturemaps-extras-us-west-2.s3.amazonaws.com/tiles/${release}/buildings.pmtiles`;
const Z = 14;
const MAX_TILES = 25;

// номер последнего выпуска: каталог крошечный, но спрашиваем не чаще раза в сутки
async function latestRelease() {
  try {
    const saved = JSON.parse(localStorage.getItem('ue:overture') ?? 'null');
    if (saved && Date.now() - saved.at < 86400000) return saved.release;
  } catch { /* приватный режим */ }
  try {
    const res = await fetch(CATALOG, { signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    let release = json.latest;
    if (!release && json.links) {
      const childLinks = json.links.filter((l) => l.rel === 'child').map((l) => l.href);
      const lastChild = childLinks.at(-1);
      if (lastChild) {
        const m = lastChild.match(/(\d{4}-\d{2}-\d{2}\.\d+)/);
        if (m) release = m[1];
      }
    }
    if (!release) throw new Error('no release');
    try { localStorage.setItem('ue:overture', JSON.stringify({ release, at: Date.now() })); } catch { /* приватный режим */ }
    return release;
  } catch {
    return FALLBACK_RELEASE;
  }
}

const tileX = (lon) => ((lon + 180) / 360) * 2 ** Z;
const tileY = (lat) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** Z;
};
const lonOf = (x) => (x / 2 ** Z) * 360 - 180;
const latOf = (y) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** Z))) * 180) / Math.PI;

const area = (r) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return a / 2;
};

// куски одного здания из соседних тайлов (у каждого тайла есть запас за краем) — сливаем
function unionPieces(pieces) {
  const S = 100;
  const c = new ClipperLib.Clipper();
  for (const rings of pieces)
    rings.forEach((r, i) => {
      const p = r.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) }));
      if (ClipperLib.Clipper.Orientation(p) !== (i === 0)) p.reverse();
      c.AddPath(p, ClipperLib.PolyType.ptSubject, true);
    });
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const out = [];
  for (const outer of tree.Childs()) out.push([outer.Contour(), ...outer.Childs().map((h) => h.Contour())].map((r) => r.map(({ X, Y }) => [X / S, Y / S])));
  // если после слияния несколько частей — берём самую большую
  out.sort((a, b) => Math.abs(area(b[0])) - Math.abs(area(a[0])));
  return out[0] ?? pieces[0];
}

/**
 * Здания Overture внутри рамки (с запасом pad, м), кроме взятых из OSM.
 * @returns {Promise<Array<{ id: string, rings: number[][][], height: number|null, floors: number|null, minHeight: number, cls: string|null, source: string }>>}
 */
export async function fetchOvertureBuildings(frame, { pad = 60, signal } = {}) {
  const release = await latestRelease();
  const pm = new PMTiles(TILES(release));
  const dLat = (frame.north - frame.south) * (pad / frame.size), dLon = (frame.east - frame.west) * (pad / frame.size);
  const x0 = Math.floor(tileX(frame.west - dLon)), x1 = Math.floor(tileX(frame.east + dLon));
  const y0 = Math.floor(tileY(frame.north + dLat)), y1 = Math.floor(tileY(frame.south - dLat));
  const tiles = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push([x, y]);
  if (tiles.length > MAX_TILES) throw new Error('area too large for Overture tiles');

  const byId = new Map();
  await Promise.all(tiles.map(async ([tx, ty]) => {
    if (signal?.aborted) return;
    const res = await pm.getZxy(Z, tx, ty, signal);
    if (!res?.data) return;
    const layer = new VectorTile(new Pbf(new Uint8Array(res.data))).layers.building;
    if (!layer) return;
    const ext = layer.extent;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      const p = f.properties;
      if (p['@geometry_source'] === 'OpenStreetMap' || p.is_underground === true) continue;
      // кольца MVT → метры участка; внешнее кольцо после переворота оси Y — против часовой
      const rings = f.loadGeometry().map((ring) => ring.map((pt) => frame.toLocal(latOf(ty + pt.y / ext), lonOf(tx + pt.x / ext))));
      // MultiPolygon в MVT — подряд идущие внешние кольца, каждое со своими дырами.
      // Внешнее кольцо — с тем же знаком площади, что у первого (после переворота оси Y знаки меняются)
      const polys = [];
      const outerSign = Math.sign(area(rings.find((r) => r.length >= 4) ?? [[0, 0]]));
      for (const r of rings) {
        if (r.length < 4) continue;
        if (Math.sign(area(r)) === outerSign || !polys.length) polys.push([r]);
        else polys.at(-1).push(r);
      }
      const id = String(p.id ?? `${tx}/${ty}/${i}`);
      if (!byId.has(id)) byId.set(id, { props: p, pieces: [] });
      for (const poly of polys) byId.get(id).pieces.push(poly);
    }
  }));

  const out = [];
  for (const [id, { props: p, pieces }] of byId) {
    let rings = pieces.length > 1 ? unionPieces(pieces) : pieces[0];
    if (!rings?.[0] || rings[0].length < 4) continue;
    // замыкающая точка не нужна, внешнее кольцо — против часовой
    rings = rings.map((r) => {
      const q = r.slice();
      if (q.length > 1 && q[0][0] === q.at(-1)[0] && q[0][1] === q.at(-1)[1]) q.pop();
      return q;
    });
    if (area(rings[0]) < 0) rings[0].reverse();
    for (let k = 1; k < rings.length; k++) if (area(rings[k]) > 0) rings[k].reverse();
    if (Math.abs(area(rings[0])) < 8) continue;
    const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
    out.push({
      id,
      rings,
      height: num(p.height),
      floors: num(p.num_floors),
      minHeight: num(p.min_height) ?? 0,
      cls: p.class ?? p.subtype ?? null,
      source: String(p['@geometry_source'] ?? 'Overture'),
    });
  }
  return out;
}

/* ---------- Запасной источник: вся модель из Overture Maps, если серверы OSM (Overpass) недоступны ----------
 * Тайлы Overture превращаются в те же элементы, что приходят из Overpass (way / relation / node с тегами OSM),
 * поэтому дальше модель собирается тем же кодом. Здания и дороги — z14, вода, зелень и деревья — z13.
 */
const THEME = (release, theme) => `https://overturemaps-extras-us-west-2.s3.amazonaws.com/tiles/${release}/${theme}.pmtiles`;
const txAt = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const tyAt = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z;
};
const lonAtZ = (x, z) => (x / 2 ** z) * 360 - 180;
const latAtZ = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

// все объекты темы в тайлах уровня z, покрывающих рамку с запасом pad (м)
async function readTiles(release, theme, frame, z, pad, signal, onFeature) {
  const pm = new PMTiles(THEME(release, theme));
  const dLat = (frame.north - frame.south) * (pad / frame.size), dLon = (frame.east - frame.west) * (pad / frame.size);
  const x0 = Math.floor(txAt(frame.west - dLon, z)), x1 = Math.floor(txAt(frame.east + dLon, z));
  const y0 = Math.floor(tyAt(frame.north + dLat, z)), y1 = Math.floor(tyAt(frame.south - dLat, z));
  const jobs = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push([x, y]);
  if (jobs.length > 40) throw new Error('area too large for Overture tiles');
  await Promise.all(jobs.map(async ([tx, ty]) => {
    const res = await pm.getZxy(z, tx, ty, signal);
    if (!res?.data) return;
    const vt = new VectorTile(new Pbf(new Uint8Array(res.data)));
    for (const [name, layer] of Object.entries(vt.layers))
      for (let i = 0; i < layer.length; i++) onFeature(name, layer.feature(i), tx, ty, layer.extent);
  }));
}

// линия, обрезанная по своему тайлу (без запаса на соседей — иначе дубли на стыках тайлов)
function clipToTile(line, ext) {
  const out = [];
  let cur = null;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    let t0 = 0, t1 = 1;
    const dx = b.x - a.x, dy = b.y - a.y;
    let ok = true;
    for (const [p, q] of [[-dx, a.x], [dx, ext - a.x], [-dy, a.y], [dy, ext - a.y]]) {
      if (Math.abs(p) < 1e-12) { if (q < 0) { ok = false; break; } continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) { ok = false; break; } if (r > t0) t0 = r; } else { if (r < t0) { ok = false; break; } if (r < t1) t1 = r; }
    }
    if (!ok) { cur = null; continue; }
    const pa = { x: a.x + dx * t0, y: a.y + dy * t0 }, pb = { x: a.x + dx * t1, y: a.y + dy * t1 };
    if (!cur) { cur = [pa]; out.push(cur); }
    cur.push(pb);
    if (t1 < 1) cur = null;
  }
  return out.filter((l) => l.length > 1);
}

// куски одной линии из соседних тайлов — в одну линию по совпадающим концам
function joinPieces(pieces) {
  const eq = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05;
  const pool = pieces.map((p) => p.slice());
  const out = [];
  while (pool.length) {
    let c = pool.shift(), grown = true;
    while (grown) {
      grown = false;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (eq(c.at(-1), p[0])) c = c.concat(p.slice(1));
        else if (eq(p.at(-1), c[0])) c = p.concat(c.slice(1));
        else continue;
        pool.splice(i, 1);
        grown = true;
        break;
      }
    }
    out.push(c);
  }
  return out;
}

// линия → части по долям длины [{ from, to, flags }] (мосты, тоннели, уровни Overture)
function splitByRules(line, rules) {
  const d = [0];
  for (let i = 1; i < line.length; i++) d.push(d[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  const L = d.at(-1) || 1;
  const at = (f) => {
    const s = f * L;
    let i = 1;
    while (i < d.length - 1 && d[i] < s) i++;
    const t = (s - d[i - 1]) / ((d[i] - d[i - 1]) || 1);
    return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
  };
  const cuts = [...new Set([0, 1, ...rules.flatMap((r) => r.between ?? [])])].filter((f) => f >= 0 && f <= 1).sort((a, b) => a - b);
  const parts = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    const a = cuts[k], b = cuts[k + 1];
    if (b - a < 1e-6) continue;
    const mid = (a + b) / 2;
    const pts = [at(a), ...line.filter((_, i) => d[i] / L > a && d[i] / L < b), at(b)];
    const active = rules.filter((r) => !r.between || (mid >= r.between[0] && mid <= r.between[1]));
    parts.push({ pts, active });
  }
  return parts;
}

const parseJson = (v) => { if (!v) return []; if (Array.isArray(v)) return v; try { return JSON.parse(v); } catch { return []; } };
const ROAD = { unknown: 'road' };
const RAIL = { standard_gauge: 'rail', light_rail: 'light_rail', subway: 'subway', tram: 'tram', narrow_gauge: 'narrow_gauge', monorail: 'monorail', funicular: 'rail', unknown: 'rail' };
const WATERWAY = /^(river|stream|canal|ditch|drain)$/;
const LAND_USE = {
  park: { leisure: 'park' }, dog_park: { leisure: 'park' }, garden: { leisure: 'garden' }, grass: { landuse: 'grass' }, flowerbed: { landuse: 'grass' },
  cemetery: { landuse: 'cemetery' }, allotments: { landuse: 'allotments' }, meadow: { landuse: 'meadow' }, recreation_ground: { landuse: 'recreation_ground' },
  village_green: { landuse: 'village_green' }, golf_course: { landuse: 'grass' },
};
const LAND = { forest: { landuse: 'forest' }, wood: { natural: 'wood' }, scrub: { natural: 'scrub' }, shrubbery: { natural: 'scrub' }, grass: { landuse: 'grass' }, grassland: { natural: 'grassland' }, heath: { natural: 'heath' } };

/**
 * Модель местности из Overture вместо Overpass: здания, дороги и ж/д (с мостами и уровнями), вода с морем,
 * зелень, отдельные деревья и аллеи — в формате ответа Overpass ({ elements }).
 */
export async function fetchOvertureOSM(frame, { signal, pad = 300 } = {}) {
  const release = await latestRelease();
  const mLat = frame.size / (frame.north - frame.south), mLon = frame.size / (frame.east - frame.west);
  const toLL = ([x, y]) => ({ lat: frame.lat + y / mLat, lon: frame.lon + x / mLon });
  const toLocal = (z, tx, ty, ext) => (p) => frame.toLocal(latAtZ(ty + p.y / ext, z), lonAtZ(tx + p.x / ext, z));
  const polys = new Map();   // id → { tags, pieces: [[outer, ...holes]] }
  const lines = new Map();   // id → { tags, rules, pieces: [[x, y]...] }
  const nodes = [];
  const islands = []; // суша внутри воды (острова, крепость во рву) — в Overture отдельными полигонами
  const addPoly = (id, tags, f, conv) => {
    const rings = f.loadGeometry().map((r) => r.map(conv));
    const ps = [];
    const outerSign = Math.sign(area(rings.find((r) => r.length >= 4) ?? [[0, 0]]));
    for (const r of rings) {
      if (r.length < 4) continue;
      if (Math.sign(area(r)) === outerSign || !ps.length) ps.push([r]);
      else ps.at(-1).push(r);
    }
    if (!polys.has(id)) polys.set(id, { tags, pieces: [] });
    polys.get(id).pieces.push(...ps);
  };
  const addLine = (id, tags, f, conv, ext, rules = []) => {
    for (const raw of f.loadGeometry())
      for (const part of clipToTile(raw, ext)) {
        if (!lines.has(id)) lines.set(id, { tags, rules, pieces: [] });
        lines.get(id).pieces.push(part.map(conv));
      }
  };

  const z14 = 14, z13 = 13;
  await Promise.all([
    readTiles(release, 'buildings', frame, z14, pad, signal, (layer, f, tx, ty, ext) => {
      const p = f.properties;
      if (p.is_underground === true || f.type !== 3) return;
      const tags = layer === 'building_part' ? { 'building:part': 'yes' } : { building: p.class ?? 'yes' };
      if (p.height != null) tags.height = p.height;
      if (p.min_height != null) tags.min_height = p.min_height;
      if (p.num_floors != null) tags['building:levels'] = p.num_floors;
      if (p.roof_shape) tags['roof:shape'] = p.roof_shape;
      if (p.roof_height != null) tags['roof:height'] = p.roof_height;
      addPoly(`b-${p.id ?? `${tx}/${ty}/${Math.random()}`}`, tags, f, toLocal(z14, tx, ty, ext));
    }),
    readTiles(release, 'transportation', frame, z14, pad, signal, (layer, f, tx, ty, ext) => {
      if (layer !== 'segment' || f.type !== 2) return;
      const p = f.properties;
      let tags;
      if (p.subtype === 'road') tags = { highway: ROAD[p.class] ?? p.class ?? 'road' };
      else if (p.subtype === 'rail') tags = { railway: RAIL[p.class] ?? 'rail' };
      else return;
      // мосты, тоннели и уровни Overture задаёт долями длины всего сегмента
      const rules = [
        ...parseJson(p.road_flags).map((r) => ({ between: r.between, bridge: r.values?.includes('is_bridge'), tunnel: r.values?.includes('is_tunnel') })),
        ...parseJson(p.rail_flags).map((r) => ({ between: r.between, bridge: r.values?.includes('is_bridge'), tunnel: r.values?.includes('is_tunnel') })),
        ...parseJson(p.level_rules).map((r) => ({ between: r.between, level: r.value })),
      ];
      addLine(`s-${p.id}`, tags, f, toLocal(z14, tx, ty, ext), ext, rules);
    }),
    readTiles(release, 'base', frame, z13, pad, signal, (layer, f, tx, ty, ext) => {
      const p = f.properties;
      const conv = toLocal(z13, tx, ty, ext);
      if (layer === 'water') {
        if (f.type === 3) addPoly(`w-${p.id}`, { natural: 'water', water: p.class ?? 'water' }, f, conv);
        else if (f.type === 2 && WATERWAY.test(p.class ?? '')) addLine(`w-${p.id}`, { waterway: p.class }, f, conv, ext);
      } else if (layer === 'land_use') {
        if (f.type === 3 && LAND_USE[p.class]) addPoly(`u-${p.id}`, LAND_USE[p.class], f, conv);
      } else if (layer === 'land') {
        if (f.type === 3 && /^(island|islet|land)$/.test(p.class ?? '')) {
          for (const r of f.loadGeometry()) if (r.length > 3) islands.push(r.map(conv));
        } else if (f.type === 3 && LAND[p.class]) addPoly(`l-${p.id}`, LAND[p.class], f, conv);
        else if (f.type === 2 && p.class === 'tree_row') addLine(`l-${p.id}`, { natural: 'tree_row' }, f, conv, ext);
        else if (f.type === 1 && p.class === 'tree')
          for (const pts of f.loadGeometry()) for (const pt of pts)
            if (pt.x >= 0 && pt.x < ext && pt.y >= 0 && pt.y < ext) nodes.push({ type: 'node', id: `t-${p.id}`, ...toLL(conv(pt)), tags: { natural: 'tree' } });
      }
    }),
  ]);

  const elements = [...nodes];
  // многоугольники: куски из соседних тайлов сливаются; с дырами — как relation (outer/inner)
  for (const [id, { tags, pieces }] of polys) {
    let merged = pieces.length > 1 ? unionAll(pieces) : pieces;
    // из воды вычитается суша-острова: иначе остров внутри водоёма тоже «вода»
    if (tags.natural === 'water' && islands.length) {
      // только суша внутри водоёма (материк, в котором лежит озеро, не трогаем)
      const inside = islands.filter((r) => Math.abs(area(r)) < merged.reduce((sum, ps) => sum + Math.abs(area(ps[0])), 0)
        && merged.some((ps) => [r[0], r[Math.floor(r.length / 2)]].every((pt) => pointIn(pt, ps[0]))));
      if (inside.length) merged = subtractRings(merged, inside);
    }
    const closed = (r) => [...r, r[0]].map(toLL);
    const hasHoles = merged.length > 1 || merged.some((ps) => ps.length > 1);
    if (!hasHoles && merged[0]) elements.push({ type: 'way', id, tags, geometry: closed(merged[0][0]) });
    else if (merged.length) elements.push({
      type: 'relation', id, tags,
      members: merged.flatMap((ps) => ps.map((r, k) => ({ type: 'way', role: k ? 'inner' : 'outer', geometry: closed(r) }))),
    });
  }
  // линии: куски из тайлов склеиваются, затем делятся на мосты, тоннели и обычные участки
  for (const [id, { tags, rules, pieces }] of lines)
    joinPieces(pieces).forEach((line, n) => {
      const parts = rules.length ? splitByRules(line, rules) : [{ pts: line, active: [] }];
      parts.forEach((part, k) => {
        if (part.pts.length < 2) return;
        const t = { ...tags };
        if (part.active.some((r) => r.bridge)) t.bridge = 'yes';
        if (part.active.some((r) => r.tunnel)) t.tunnel = 'yes';
        const lvl = part.active.find((r) => r.level != null);
        if (lvl) t.layer = lvl.level;
        elements.push({ type: 'way', id: `${id}-${n}-${k}`, tags: t, geometry: part.pts.map(toLL) });
      });
    });
  return { elements, source: 'overture', release };
}

// слияние многоугольников (куски из соседних тайлов перекрываются на запас тайла)
function unionAll(polysList) {
  const S = 100;
  const c = new ClipperLib.Clipper();
  for (const rings of polysList)
    rings.forEach((r, i) => {
      const p = r.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) }));
      if (ClipperLib.Clipper.Orientation(p) !== (i === 0)) p.reverse();
      c.AddPath(p, ClipperLib.PolyType.ptSubject, true);
    });
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const out = [];
  const walk = (node) => {
    for (const outer of node.Childs()) {
      out.push([outer.Contour(), ...outer.Childs().map((h) => h.Contour())].map((r) => r.map(({ X, Y }) => [X / S, Y / S])));
      for (const hole of outer.Childs()) walk(hole);
    }
  };
  walk(tree);
  return out;
}

// многоугольники минус кольца суши
function subtractRings(polysList, rings) {
  const S = 100;
  const toP = (r, positive) => {
    const p = r.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) }));
    if (ClipperLib.Clipper.Orientation(p) !== positive) p.reverse();
    return p;
  };
  const c = new ClipperLib.Clipper();
  for (const ps of polysList) ps.forEach((r, i) => c.AddPath(toP(r, i === 0), ClipperLib.PolyType.ptSubject, true));
  for (const r of rings) c.AddPath(toP(r, true), ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctDifference, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const out = [];
  const walk = (node) => {
    for (const outer of node.Childs()) {
      out.push([outer.Contour(), ...outer.Childs().map((h) => h.Contour())].map((r) => r.map(({ X, Y }) => [X / S, Y / S])));
      for (const hole of outer.Childs()) walk(hole);
    }
  };
  walk(tree);
  return out;
}

function pointIn([x, y], ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
