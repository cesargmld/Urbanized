// Дороги реальной ширины: осевые линии OSM → полосы нужной ширины,
// слитые в одну сеть, со скруглёнными углами на перекрёстках (радиус бордюра).
import * as ClipperLib from 'https://cdn.jsdelivr.net/npm/clipper-lib@6.4.2/+esm';

const S = 100; // сантиметры: Clipper работает в целых числах

// ширина проезжей части по тегам OSM, метры
const DEFAULT_WIDTH = {
  motorway: 22, trunk: 18, primary: 14, secondary: 12, tertiary: 10,
  motorway_link: 7, trunk_link: 7, primary_link: 7, secondary_link: 6.5, tertiary_link: 6.5,
  residential: 7, unclassified: 6.5, living_street: 5.5, service: 4.5, road: 6, track: 3.5, busway: 7,
  pedestrian: 6, footway: 2.4, path: 1.8, cycleway: 2.5, bridleway: 2, steps: 2.5, corridor: 2.5,
};
export const PATH_KINDS = /^(footway|path|cycleway|steps|bridleway|corridor|pedestrian)$/;

export function roadWidth(t) {
  const w = parseFloat(String(t.width ?? '').replace(',', '.'));
  if (w > 1 && w < 80) return w;
  const kind = t.highway ?? '';
  const lanes = parseInt(t.lanes, 10);
  if (lanes > 0 && lanes < 16 && !PATH_KINDS.test(kind)) return Math.max(lanes * 3.3, 4);
  return DEFAULT_WIDTH[kind] ?? 6;
}

const toPath = (pts) => pts.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) }));
const fromPath = (p) => p.map(({ X, Y }) => [X / S, Y / S]);

function offset(paths, delta, open = false) {
  const co = new ClipperLib.ClipperOffset(2, 0.15 * S);
  co.AddPaths(paths, ClipperLib.JoinType.jtRound, open ? ClipperLib.EndType.etOpenRound : ClipperLib.EndType.etClosedPolygon);
  const out = new ClipperLib.Paths();
  co.Execute(out, delta * S);
  return out;
}

function boolean(type, subj, clip = []) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
  if (clip.length) c.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  const out = new ClipperLib.Paths();
  c.Execute(type, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return out;
}
const union = (paths) => boolean(ClipperLib.ClipType.ctUnion, paths);

// пути → многоугольники [наружный, ...дыры] в метрах; внешние — против часовой
function polygons(paths) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const out = [];
  const walk = (node) => {
    for (const outer of node.Childs()) {
      const rings = [fromPath(outer.Contour())];
      for (const hole of outer.Childs()) {
        rings.push(fromPath(hole.Contour()));
        walk(hole); // острова внутри дыр
      }
      if (rings[0].length >= 3) out.push(rings);
    }
  };
  walk(tree);
  return out;
}

// многоугольник рамки участка (квадрат или круг)
export function framePolygon(frame, pad = 0) {
  const h = frame.half + pad;
  if (frame.shape === 'circle') return Array.from({ length: 144 }, (_, i) => [Math.cos((i / 144) * Math.PI * 2) * h, Math.sin((i / 144) * Math.PI * 2) * h]);
  return [[-h, -h], [h, -h], [h, h], [-h, h]];
}

// segments: [{ pts: [[x, y]...], width, path: bool }] → { roads, paths } — многоугольники с дырами
export function roadAreas(segments, frame, { radius = 6, pathRadius = 1.5 } = {}) {
  const net = (list, r) => {
    if (!list.length) return [];
    const byWidth = new Map(), areas = [];
    for (const s of list) {
      if (s.area) {
        const p = toPath(s.pts);
        if (!ClipperLib.Clipper.Orientation(p)) p.reverse();
        areas.push(p);
        continue;
      }
      const w = Math.round(s.width * 2) / 2;
      if (!byWidth.has(w)) byWidth.set(w, []);
      byWidth.get(w).push(toPath(s.pts));
    }
    let all = areas;
    for (const [w, paths] of byWidth) all = all.concat(offset(paths, w / 2, true));
    let u = union(all);
    // скругление углов перекрёстков: «закрытие» — расширить на r и сжать обратно
    if (r > 0) u = offset(offset(u, r), -r);
    return u;
  };
  const clip = [toPath(framePolygon(frame))];
  const roads = boolean(ClipperLib.ClipType.ctIntersection, net(segments.filter((s) => !s.path), radius), clip);
  let paths = boolean(ClipperLib.ClipType.ctIntersection, net(segments.filter((s) => s.path), pathRadius), clip);
  if (paths.length && roads.length) paths = boolean(ClipperLib.ClipType.ctDifference, paths, roads); // тротуары не перекрывают проезжую часть
  return { roads: polygons(roads), paths: polygons(paths) };
}

/* ---------- Море по береговой линии OSM ----------
 * natural=coastline направлена так, что суша слева, вода справа. Цепочки обрезаются квадратом участка,
 * а куски замыкаются обходом его границы по часовой стрелке — так получается вода справа от берега.
 * Замкнутые цепочки внутри — острова (вычитаются). Итог обрезается рамкой участка (квадрат или круг).
 */
export function seaPolygons(ways, frame) {
  const h = frame.half + 2;
  const P = 8 * h;
  const eq = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  // 1. цепочки строго по направлению береговой линии (конец к началу)
  const pool = ways.filter((w) => w.length > 1).map((w) => w.slice());
  const chains = [];
  while (pool.length) {
    let c = pool.shift(), grown = true;
    while (grown && !eq(c[0], c.at(-1))) {
      grown = false;
      for (let i = 0; i < pool.length; i++) {
        if (eq(c.at(-1), pool[i][0])) { c = c.concat(pool[i].slice(1)); pool.splice(i, 1); grown = true; break; }
        if (eq(pool[i].at(-1), c[0])) { c = pool[i].concat(c.slice(1)); pool.splice(i, 1); grown = true; break; }
      }
    }
    chains.push(c);
  }
  const inside = ([x, y]) => Math.abs(x) <= h && Math.abs(y) <= h;
  // положение точки на границе квадрата, по часовой стрелке от левого верхнего угла
  const param = ([x, y]) => {
    const d = [[Math.abs(y - h), 0], [Math.abs(x - h), 1], [Math.abs(y + h), 2], [Math.abs(x + h), 3]].sort((a, b) => a[0] - b[0])[0][1];
    if (d === 0) return x + h;
    if (d === 1) return 2 * h + (h - y);
    if (d === 2) return 4 * h + (h - x);
    return 6 * h + (y + h);
  };
  const corners = [[0, [-h, h]], [2 * h, [h, h]], [4 * h, [h, -h]], [6 * h, [-h, -h]]];
  // отрезок a→b, обрезанный квадратом (Лианг — Барски): [t0, t1] или null
  const clipSeg = (a, b) => {
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    for (const [p, q] of [[-dx, a[0] + h], [dx, h - a[0]], [-dy, a[1] + h], [dy, h - a[1]]]) {
      if (Math.abs(p) < 1e-12) { if (q < 0) return null; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [t0, t1];
  };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // 2. куски цепочек внутри квадрата; учитываются только те, что входят и выходят через границу
  const pieces = [], islands = [];
  for (const c of chains) {
    if (eq(c[0], c.at(-1))) {
      if (c.every(inside)) { islands.push(c.slice(0, -1)); continue; }
    }
    let cur = null;
    for (let i = 0; i < c.length - 1; i++) {
      const a = c[i], b = c[i + 1];
      const r = clipSeg(a, b);
      if (!r) { cur = null; continue; }
      const [t0, t1] = r;
      const pa = lerp(a, b, t0), pb = lerp(a, b, t1);
      // кусок засчитывается, только если вошёл через границу (начало цепочки внутри — данные неполные)
      if (!cur) cur = { pts: [pa], entered: t0 > 1e-12 || Math.abs(Math.abs(a[0]) - h) < 1e-6 || Math.abs(Math.abs(a[1]) - h) < 1e-6 };
      cur.pts.push(pb);
      if (t1 < 1) { if (cur.entered) pieces.push(cur); cur = null; }
    }
  }
  // 3. вода: кусок берега, затем граница квадрата по часовой стрелке до входа следующего куска
  for (const p of pieces) { p.in = param(p.pts[0]); p.out = param(p.pts.at(-1)); }
  const used = new Set();
  const water = [];
  for (const start of pieces) {
    if (used.has(start)) continue;
    used.add(start);
    const ring = start.pts.slice();
    let cur = start;
    for (let guard = 0; guard <= pieces.length; guard++) {
      const from = cur.out;
      let next = null, best = Infinity;
      for (const q of pieces) {
        if (used.has(q) && q !== start) continue;
        let d = (q.in - from + P) % P;
        if (d < 1e-9 && q === cur) d = P;
        if (d < best) { best = d; next = q; }
      }
      if (!next) break;
      for (const [cp, pt] of corners.map(([cp0, pt0]) => [(cp0 - from + P) % P, pt0]).sort((a, b) => a[0] - b[0]))
        if (cp > 1e-9 && cp < best) ring.push(pt);
      if (next === start) break;
      used.add(next);
      ring.push(...next.pts);
      cur = next;
    }
    if (ring.length >= 3) water.push(ring);
  }
  // 4. нет пересечений с границей, но есть острова — значит участок в море
  if (!water.length && islands.length) water.push([[-h, h], [h, h], [h, -h], [-h, -h]]);
  if (!water.length) return [];
  const norm = (pts, positive) => {
    const p = toPath(pts);
    if (ClipperLib.Clipper.Orientation(p) !== positive) p.reverse();
    return p;
  };
  let sea = union(water.map((r) => norm(r, true)));
  if (islands.length) sea = boolean(ClipperLib.ClipType.ctDifference, sea, islands.map((r) => norm(r, true)));
  sea = boolean(ClipperLib.ClipType.ctIntersection, sea, [toPath(framePolygon(frame))]);
  return polygons(sea).filter((rings) => Math.abs(ClipperLib.Clipper.Area(toPath(rings[0]))) / (S * S) > 20);
}
