import earcut from 'https://cdn.jsdelivr.net/npm/earcut@3.0.1/+esm';

// Векторная иллюстрация модели: аксонометрия или перспектива, отрисовка методом художника.
// Одна и та же сцена рисуется на canvas (превью и PNG) и выгружается в SVG для Illustrator.

export const VIEWS = {
  'iso-sw': { az: 225, el: 35.264 },
  'iso-se': { az: 315, el: 35.264 },
  'iso-ne': { az: 45, el: 35.264 },
  'iso-nw': { az: 135, el: 35.264 },
  top: { az: 270, el: 89.9 },
  eye: { az: 225, el: 12 },
};

export const STYLES = {
  // без обводки, цвет
  flat: {
    bg: '#f3f0e8', stroke: null, width: 0, contours: false,
    terrain: '#e3ded0', building: '#f0e3d6', water: '#9cc6e0', green: '#c3d9a8', tree: '#82ac67',
    road: '#d6d1c4', roadMajor: '#c3bcab', bridge: '#a9a396', contour: '#d5cfbd', site: '#b4341f', shade: 0.5,
  },
  // тонкая обводка только по настоящим рёбрам, рельеф — горизонталями
  line: {
    bg: '#ffffff', stroke: '#2b2b2d', width: 0.4, contours: true,
    terrain: '#f6f3ea', building: '#f6ece2', water: '#c3ddf0', green: '#dbe9c9', tree: '#a3c98c',
    road: '#ffffff', roadMajor: '#f4f0e5', bridge: '#d9d3c4', contour: '#c6bfad', site: '#b4341f', shade: 0.24,
  },
  // без обводки, чёрно-белая
  mono: {
    bg: '#ffffff', stroke: null, width: 0, contours: false,
    terrain: '#dadada', building: '#ffffff', water: '#b6b6b6', green: '#e6e6e6', tree: '#bdbdbd',
    road: '#f4f4f4', roadMajor: '#e8e8e8', bridge: '#bdbdbd', contour: '#c9c9c9', site: '#000000', shade: 0.58,
  },
};

// мягкие оттенки для раскраски по типам зданий
export const CLASS_TINT = {
  residential: '#e4b79a',
  public: '#a8c0cc',
  commercial: '#e8cf9e',
  industrial: '#bfb5ab',
  utility: '#d6d2c8',
  other: '#e2dbd0',
};

// в чёрно-белом пресете типы различаются светлотой, а не цветом
export const CLASS_GRAY = {
  residential: '#fbfbfb',
  public: '#d9d9d9',
  commercial: '#eeeeee',
  industrial: '#cacaca',
  utility: '#e3e3e3',
  other: '#f2f2f2',
};

const LIGHT = (() => {
  const v = [-0.45, -0.75, 0.85];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();

const shadeColor = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `#${((1 << 24) + (m(r) << 16) + (m(g) << 8) + m(b)).toString(16).slice(1)}`;
};

// четырёхугольник → сетка ячеек не крупнее step; видимость рёбер сохраняется по контуру
function subdivide(P, vis, step) {
  if (P.length !== 4) return [[P, vis]];
  const [a, b, c, d] = P;
  const len = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
  const nu = Math.max(1, Math.ceil(Math.max(len(a, b), len(d, c)) / step));
  const nv = Math.max(1, Math.ceil(Math.max(len(a, d), len(b, c)) / step));
  if (nu * nv === 1) return [[P, vis]];
  const mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  const at = (u, v) => mix(mix(a, b, u), mix(d, c, u), v);
  const out = [];
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const u0 = i / nu, u1 = (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv;
      const e = vis ? [j === 0 && vis[0], i === nu - 1 && vis[1], j === nv - 1 && vis[2], i === 0 && vis[3]].map(Number) : null;
      out.push([[at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)], e]);
    }
  return out;
}

export function createIllustrator(canvas, model) {
  const state = {
    view: 'iso-sw', style: 'flat', perspective: false,
    az: VIEWS['iso-sw'].az, el: VIEWS['iso-sw'].el,
    zoom: 1, pan: [0, 0], labels: [], quick: false, labelColor: '#111114', byType: false, legend: true, lang: 'en',
    colors: {}, classColors: {},
    layers: { terrain: true, buildings: true, trees: true, roads: true, nature: true, contours: false },
  };
  let list = null, listKey = '';
  // текущая палитра: пресет графики с поправками пользователя
  const palette = () => ({ ...STYLES[state.style], ...state.colors });
  const classPalette = () => ({ ...(state.style === 'mono' ? CLASS_GRAY : CLASS_TINT), ...state.classColors });
  // верх модели для вписывания кадра
  const zTop = (() => {
    let z = model.grid.maxH;
    for (const b of model.buildings ?? []) for (const v of b.verts) z = Math.max(z, v[2]);
    for (const t of model.trees ?? []) z = Math.max(z, t.z + t.h);
    return z;
  })();

  /* --- геометрия сцены в мировых координатах, кэшируется --- */
  function buildList() {
    const key = JSON.stringify([state.layers, state.style, model.site?.length ?? 0]);
    if (list && listKey === key) return list;
    const items = [];
    const add = (kind, pts, opts) => items.push({ kind, pts, ...opts });

    if (state.layers.terrain && model.terrain) {
      const t = model.terrain;
      for (const { v } of t.faces) {
        const poly = v.map((i) => t.verts[i]);
        add('poly', poly, { color: 'terrain', noStroke: true, order: 0 });
      }
    }
    if (state.layers.terrain && model.terrain?.boundary) {
      // борт основания: модель читается как плита
      const t = model.terrain;
      const base = -Math.max(6, model.size * 0.012);
      const loop = t.boundary;
      for (let i = 0; i < loop.length; i++) {
        const a = t.verts[loop[i]], b = t.verts[loop[(i + 1) % loop.length]];
        add('poly', [[a[0], a[1], base], [b[0], b[1], base], b, a], { color: 'terrain', side: true, order: 0 });
      }
      // контур плиты одной линией, чтобы борт не распадался на полоски
      add('line', [...loop.map((i) => [t.verts[i][0], t.verts[i][1], base]), [t.verts[loop[0]][0], t.verts[loop[0]][1], base]], { color: 'edge', weight: 1, edge: true });
      add('line', [...loop.map((i) => t.verts[i]), t.verts[loop[0]]], { color: 'edge', weight: 1, edge: true });
    }
    if (state.layers.nature) {
      for (const w of model.water ?? []) {
        let cx = 0, cy = 0, cz = 0;
        for (const v of w.verts) { cx += v[0]; cy += v[1]; cz += v[2]; }
        const g = [cx / w.verts.length, cy / w.verts.length, cz / w.verts.length];
        for (const { v } of w.faces)
          add('poly', v.map((i) => { const p = w.verts[i]; return [p[0], p[1], p[2] + 0.4]; }), { color: 'water', flat: true, noStroke: true, bias: 0.6, order: 1 });
      }
      // зелёные зоны рисуются треугольниками: после обрезки контур бывает самопересекающимся
      for (const ring of model.areas?.GREEN ?? []) {
        if (ring.length < 3) continue;
        const flat = [];
        for (const [x, y] of ring) flat.push(x, y);
        const tri = earcut(flat, [], 2);
        let cx = 0, cy = 0, cz = 0;
        for (const p of ring) { cx += p[0]; cy += p[1]; cz += p[2]; }
        const g = [cx / ring.length, cy / ring.length, cz / ring.length];
        for (let i = 0; i < tri.length; i += 3)
          add('area', [ring[tri[i]], ring[tri[i + 1]], ring[tri[i + 2]]].map((p) => [p[0], p[1], p[2] + 0.15]), { color: 'green', flat: true, noStroke: true, bias: 0.5, order: 1 });
      }
    }
    if (state.layers.roads) {
      // дороги реальной ширины — заливкой поверх рельефа, осевые линии тогда не нужны
      const wide = Boolean(model.roadMeshes?.length);
      for (const rm of model.roadMeshes ?? []) {
        const color = rm.layer === 'ROADS_AREA' ? 'roadMajor' : 'road';
        for (const { v, vis } of rm.faces)
          add('area', v.map((i) => { const p = rm.verts[i]; return [p[0], p[1], p[2] + 0.1]; }), { color, flat: true, edges: vis, bias: 0.55, order: 1 });
      }
      for (const [layer, lines] of Object.entries(model.lines ?? {})) {
        if (layer === 'WATER' && !state.layers.nature) continue;
        if (wide && (layer === 'ROADS_MAJOR' || layer === 'ROADS_MINOR' || layer === 'PATHS')) continue;
        const color = layer === 'ROADS_MAJOR' ? 'roadMajor' : layer === 'WATER' ? 'water' : layer === 'BRIDGES' ? 'bridge' : 'road';
        const w = layer === 'ROADS_MAJOR' || layer === 'BRIDGES' ? 2.2 : layer === 'ROADS_MINOR' ? 1.4 : 0.9;
        for (const pts of lines) add('line', pts, { color, weight: w });
      }
    }
    if (state.layers.contours || STYLES[state.style].contours)
      for (const c of model.contours ?? []) add('line', c.pts, { color: 'contour', weight: 0.6 });
    // граница участка, нарисованная на карте
    if (model.site?.length) add('line', [...model.site, model.site[0]], { color: 'site', weight: 2.2, site: true });
    if (state.layers.buildings) {
      for (const b of model.buildings) {
        // общий центр здания: все его грани сортируются как одно тело — крыши не «ломаются»
        let cx = 0, cy = 0, cz = 0;
        for (const v of b.verts) { cx += v[0]; cy += v[1]; cz += v[2]; }
        const g = [cx / b.verts.length, cy / b.verts.length, cz / b.verts.length];
        for (const f of b.faces) {
          const poly = f.v.map((i) => b.verts[i]);
          add('poly', poly, { color: 'building', cls: b.cls, edges: f.vis, g });
        }
      }
    }
    // эстакады — объёмные полотна с опорами
    if (state.layers.roads)
      for (const br of model.bridges ?? []) {
        // полотно длинное и изогнутое: общий центр путает порядок на развязках.
        // Грани дробятся на ячейки ~3 м и сортируются по своим центрам —
        // так верхний ярус всегда ложится поверх нижнего
        for (const f of br.faces) {
          const poly = f.v.map((i) => br.verts[i]);
          for (const [q, vis] of subdivide(poly, f.vis, 3)) add('poly', q, { color: 'bridge', edges: vis, sub: true });
        }
      }
    if (state.layers.trees) for (const tr of model.trees ?? []) add('tree', [[tr.x, tr.y, tr.z], [tr.x, tr.y, tr.z + tr.h]], { color: 'tree', r: tr.r });
    list = items;
    listKey = key;
    return items;
  }

  /* --- камера --- */
  function camera(width, height) {
    const rad = Math.PI / 180;
    const az = state.az * rad, el = state.el * rad;
    const dir = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
    const target = [0, 0, model.grid.maxH * 0.3];
    const span = model.size;
    const dist = span * 2.2;
    const eye = [target[0] + dir[0] * dist, target[1] + dir[1] * dist, target[2] + dir[2] * dist];
    const f = dir.map((v) => -v);
    const rx = f[1] * 1 - f[2] * 0, ry = f[2] * 0 - f[0] * 1, rz = f[0] * 0 - f[1] * 0; // f × (0,0,1)
    const rl = Math.hypot(rx, ry, rz) || 1;
    const right0 = [rx / rl, ry / rl, rz / rl];
    const up0 = [right0[1] * f[2] - right0[2] * f[1], right0[2] * f[0] - right0[0] * f[2], right0[0] * f[1] - right0[1] * f[0]];
    const right = right0, up = up0;
    const h0 = -Math.max(6, span * 0.012), h1 = zTop;
    const corners = [];
    for (const z of [h0, h1])
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) corners.push([(sx * span) / 2, (sy * span) / 2, z]);
    const view = (p) => {
      const dx = p[0] - (target[0] + dir[0] * dist), dy = p[1] - (target[1] + dir[1] * dist), dz = p[2] - (target[2] + dir[2] * dist);
      return [dx * right0[0] + dy * right0[1] + dz * right0[2], dx * up0[0] + dy * up0[1] + dz * up0[2]];
    };
    // кадр вписывается по габаритам модели на экране и центрируется по ним
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of corners) {
      const [vx, vy] = view(c);
      x0 = Math.min(x0, vx); x1 = Math.max(x1, vx); y0 = Math.min(y0, vy); y1 = Math.max(y1, vy);
    }
    const fit = Math.min(width / ((x1 - x0) * 1.1 || 1), height / ((y1 - y0) * 1.14 || 1));
    const scale = fit * state.zoom;
    const focal = dist * scale;
    const cx = width / 2 + state.pan[0] - ((x0 + x1) / 2) * scale;
    const cy = height / 2 + state.pan[1] + ((y0 + y1) / 2) * scale;
    const project = (p) => {
      const dx = p[0] - eye[0], dy = p[1] - eye[1], dz = p[2] - eye[2];
      const vx = dx * right[0] + dy * right[1] + dz * right[2];
      const vy = dx * up[0] + dy * up[1] + dz * up[2];
      const vz = dx * f[0] + dy * f[1] + dz * f[2];
      if (state.perspective) {
        const s = focal / Math.max(vz, 1e-3);
        return [cx + vx * s, cy - vy * s, vz];
      }
      return [cx + vx * scale, cy - vy * scale, vz];
    };
    return { project, eye, scale, focal, dir, cx, cy };
  }

  /* --- список примитивов в экранных координатах, отсортированный по глубине --- */
  function scene(width, height) {
    const cam = camera(width, height);
    const st = palette();
    const out = [];
    // во время вращения часть мелочи пропускается, чтобы кадр оставался быстрым
    const quick = state.quick;
    const minArea = quick ? 4 : 0.35;
    const treeStep = quick && (model.trees?.length ?? 0) > 6000 ? 3 : 1;
    let treeIndex = 0;
    for (const it of buildList()) {
      if (it.kind === 'tree') {
        if (treeStep > 1 && treeIndex++ % treeStep) continue;
        const [b, top] = it.pts.map(cam.project);
        if (b[2] <= 0) continue;
        const unit = state.perspective ? cam.focal / Math.max(b[2], 1e-3) : cam.scale;
        const r = Math.max(1.2, it.r * unit);
        out.push({ kind: 'tree', x: (b[0] + top[0]) / 2, y: (b[1] + top[1]) / 2 - r * 0.15, r, gdepth: b[2], depth: b[2], order: 2, fill: st.tree, trunk: [b, top] });
        continue;
      }
      if (it.kind === 'line') {
        if (it.edge && !st.stroke) continue;
        const pts = it.pts.map(cam.project);
        if (pts.some((p) => p[2] <= 0)) continue;
        // граница участка всегда поверх модели, пунктиром — как на подачах
        if (it.site) {
          out.push({ kind: 'line', pts, gdepth: -1e9, depth: -1e9, order: 3, stroke: st.site, weight: it.weight, dash: [9, 6] });
          continue;
        }
        const stroke = it.edge ? st.stroke : st[it.color];
        const weight = it.edge ? Math.max(0.6, st.width * 1.4) : it.weight;
        // линии, лежащие на рельефе, сортируются по звеньям: иначе дальний конец утягивает всю линию под землю
        if (quick) {
          let depth = 0;
          for (const p of pts) depth = Math.max(depth, p[2]);
          out.push({ kind: 'line', pts, gdepth: depth - 0.5, depth: depth - 0.5, order: 1, stroke, weight });
          continue;
        }
        for (let i = 0; i < pts.length - 1; i++) {
          const a2 = pts[i], b2 = pts[i + 1];
          if (Math.abs(a2[0] - b2[0]) < 0.25 && Math.abs(a2[1] - b2[1]) < 0.25) continue;
          const d2 = (a2[2] + b2[2]) / 2 - 0.4;
          out.push({ kind: 'line', pts: [a2, b2], gdepth: d2, depth: d2, order: 1, stroke, weight });
        }
        continue;
      }
      const world = it.pts;
      const pts = world.map(cam.project);
      if (pts.some((p) => p[2] <= 0)) continue;
      // нормаль грани и отбрасывание задних
      const [a, b, c] = world;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      const facing = nx * cam.dir[0] + ny * cam.dir[1] + nz * cam.dir[2];
      if (it.kind === 'poly' && facing < 0) continue;
      // площадь на экране: мелкие грани не рисуем
      let area = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        area += p[0] * q[1] - q[0] * p[1];
      }
      if (!it.sub && Math.abs(area) / 2 < minArea) continue; // ячейки полотна не выбрасываем — иначе дыры
      const lam = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const k = 1 - st.shade + st.shade * lam;
      // глубина грани — по её центру, а не по дальнему углу: меньше ошибок перекрытия
      let depth = 0;
      for (const p of pts) depth += p[2];
      depth = depth / pts.length - (it.bias ?? 0); // вода и зелень чуть «ближе» рельефа, на котором лежат
      const gdepth = it.g ? cam.project(it.g)[2] : depth;
      const tint = classPalette();
      const base = it.cls && state.byType ? (tint[it.cls] ?? st[it.color]) : st[it.color];
      out.push({ kind: 'poly', pts, gdepth, depth, order: it.order ?? 2, fill: shadeColor(base, it.flat ? 1 : it.side ? 0.88 : k) });
      // обводятся только настоящие рёбра тела, а не рёбра триангуляции
      if (st.stroke && !it.noStroke && !it.side && it.edges) {
        for (let i = 0; i < pts.length; i++) {
          if (!it.edges[i]) continue;
          const a2 = pts[i], b2 = pts[(i + 1) % pts.length];
          out.push({ kind: 'line', pts: [a2, b2], gdepth, depth: depth - 0.15, order: it.order ?? 2, stroke: st.stroke, weight: st.width });
        }
      }
    }
    // Слои: земля → вода, зелень и дороги → объёмы → граница участка.
    // Внутри слоя — дальние объекты раньше, в объекте — дальние грани раньше.
    // Так крупные грани склона не закрашивают крыши зданий.
    out.sort((p, q) => ((p.order ?? 2) - (q.order ?? 2)) || ((q.gdepth ?? q.depth) - (p.gdepth ?? p.depth)) || (q.depth - p.depth));
    return { items: out, cam, st };
  }

  /* --- отрисовка на canvas --- */
  function draw(ctx, width, height, dpr = 1) {
    const { items, cam, st } = scene(width, height);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = st.bg;
    ctx.fillRect(0, 0, width, height);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const it of items) {
      if (it.kind === 'poly') {
        ctx.beginPath();
        it.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath();
        ctx.fillStyle = it.fill;
        ctx.fill();
        if (it.stroke) { ctx.strokeStyle = it.stroke; ctx.lineWidth = it.width; ctx.stroke(); }
      } else if (it.kind === 'line') {
        ctx.beginPath();
        it.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.strokeStyle = it.stroke;
        ctx.lineWidth = it.weight;
        if (it.dash) ctx.setLineDash(it.dash);
        ctx.stroke();
        if (it.dash) ctx.setLineDash([]);
      } else {
        ctx.beginPath();
        ctx.moveTo(it.trunk[0][0], it.trunk[0][1]);
        ctx.lineTo(it.trunk[1][0], it.trunk[1][1]);
        ctx.strokeStyle = shadeColor(it.fill, 0.75);
        ctx.lineWidth = Math.max(0.6, it.r * 0.18);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
        ctx.fillStyle = it.fill;
        ctx.fill();
        if (st.stroke) { ctx.strokeStyle = st.stroke; ctx.lineWidth = st.width; ctx.stroke(); }
      }
    }
    drawLabels(ctx, cam);
    drawLegend(ctx, width, height);
    ctx.restore();
    return cam;
  }

  function labelScreen(cam, l) {
    const p = cam.project(l.world);
    return { anchor: p, text: [p[0] + l.dx, p[1] + l.dy] };
  }

  const LABEL_FONT = '500 13px Roboto, sans-serif';
  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  // светлый фон плашки → тёмный текст, и наоборот
  const textOn = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.6 ? '#111114' : '#ffffff';
  };

  function labelBox(ctx, l) {
    ctx.font = LABEL_FONT;
    const w = Math.max(18, ctx.measureText(l.text || ' ').width) + 18;
    return { w, h: 26, r: 7 };
  }

  // легенда классов зданий
  const LEGEND_NAMES = {
    en: { residential: 'Residential', public: 'Public', commercial: 'Commercial', industrial: 'Industrial', utility: 'Utility', other: 'Other' },
    ru: { residential: 'Жильё', public: 'Общественные', commercial: 'Коммерция', industrial: 'Промышленность', utility: 'Хозпостройки', other: 'Прочее' },
  };
  function legendItems() {
    const counts = model.stats?.classes ?? {};
    const tint = classPalette();
    return Object.keys(tint)
      .filter((c) => counts[c])
      .map((c) => ({ color: tint[c], text: `${LEGEND_NAMES[state.lang]?.[c] ?? c} · ${counts[c]}` }));
  }

  function drawLegend(ctx, width, height) {
    if (!state.legend || !state.byType) return;
    const items = legendItems();
    if (!items.length) return;
    ctx.font = '400 12px Roboto, sans-serif';
    ctx.textBaseline = 'middle';
    const w = Math.max(...items.map((i) => ctx.measureText(i.text).width)) + 38;
    const h = items.length * 20 + 16;
    const x = 16, y = height - h - 16;
    const st = palette();
    ctx.fillStyle = st.bg;
    ctx.globalAlpha = 0.92;
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    items.forEach((it, i) => {
      const yy = y + 16 + i * 20;
      ctx.fillStyle = it.color;
      roundRect(ctx, x + 12, yy - 6, 12, 12, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.stroke();
      ctx.fillStyle = '#1d1d1f';
      ctx.fillText(it.text, x + 32, yy);
    });
  }

  function drawLabels(ctx, cam) {
    ctx.font = LABEL_FONT;
    ctx.textBaseline = 'middle';
    for (const l of state.labels) {
      const s = labelScreen(cam, l);
      const color = l.color ?? state.labelColor;
      const { w, h, r } = labelBox(ctx, l);
      const bx = s.text[0] - (l.dx < 0 ? w : 0), by = s.text[1] - h / 2;
      // выноска: прямая линия от плашки к точке на модели
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(l.dx < 0 ? bx + w : bx, s.text[1]);
      ctx.lineTo(s.anchor[0], s.anchor[1]);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s.anchor[0], s.anchor[1], 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      roundRect(ctx, bx, by, w, h, r);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = textOn(color);
      ctx.textAlign = 'center';
      ctx.fillText(l.text, bx + w / 2, s.text[1]);
      ctx.textAlign = 'left';
    }
  }

  function render() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    draw(ctx, w, h, dpr);
  }

  /* --- выгрузка --- */
  const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);
  const n1 = (v) => Math.round(v * 10) / 10;

  function toSVG({ width = 2000 } = {}) {
    const ratio = canvas.clientHeight / canvas.clientWidth;
    const height = Math.round(width * ratio);
    const k = width / canvas.clientWidth;
    const { items, cam, st } = scene(canvas.clientWidth, canvas.clientHeight);
    const parts = [`<rect width="${width}" height="${height}" fill="${st.bg}"/>`];
    const P = (p) => `${n1(p[0] * k)},${n1(p[1] * k)}`;
    for (const it of items) {
      if (it.kind === 'poly')
        parts.push(`<polygon points="${it.pts.map(P).join(' ')}" fill="${it.fill}"${it.stroke ? ` stroke="${it.stroke}" stroke-width="${n1(it.width * k)}"` : ''}/>`);
      else if (it.kind === 'line')
        parts.push(`<polyline points="${it.pts.map(P).join(' ')}" fill="none" stroke="${it.stroke}" stroke-width="${n1(it.weight * k)}" stroke-linejoin="round" stroke-linecap="round"${it.dash ? ` stroke-dasharray="${it.dash.map((v) => n1(v * k)).join(' ')}"` : ''}/>`);
      else {
        parts.push(`<line x1="${n1(it.trunk[0][0] * k)}" y1="${n1(it.trunk[0][1] * k)}" x2="${n1(it.trunk[1][0] * k)}" y2="${n1(it.trunk[1][1] * k)}" stroke="${shadeColor(it.fill, 0.75)}" stroke-width="${n1(Math.max(0.6, it.r * 0.18) * k)}"/>`);
        parts.push(`<circle cx="${n1(it.x * k)}" cy="${n1(it.y * k)}" r="${n1(it.r * k)}" fill="${it.fill}"${st.stroke ? ` stroke="${st.stroke}" stroke-width="${n1(st.width * k)}"` : ''}/>`);
      }
    }
    const meter = document.createElement('canvas').getContext('2d');
    const labels = state.labels.map((l) => {
      const sc = labelScreen(cam, l);
      const color = l.color ?? state.labelColor;
      meter.font = LABEL_FONT;
      const w = (Math.max(18, meter.measureText(l.text || ' ').width) + 18) * k;
      const h = 26 * k, r = 7 * k;
      const bx = (sc.text[0] - (l.dx < 0 ? w / k : 0)) * k, by = sc.text[1] * k - h / 2;
      const side = l.dx < 0 ? bx + w : bx;
      return `<g><line x1="${n1(side)}" y1="${n1(sc.text[1] * k)}" x2="${n1(sc.anchor[0] * k)}" y2="${n1(sc.anchor[1] * k)}" stroke="${color}" stroke-width="${n1(1.1 * k)}"/>`
        + `<circle cx="${n1(sc.anchor[0] * k)}" cy="${n1(sc.anchor[1] * k)}" r="${n1(3 * k)}" fill="${color}"/>`
        + `<rect x="${n1(bx)}" y="${n1(by)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(r)}" fill="${color}"/>`
        + `<text x="${n1(bx + w / 2)}" y="${n1(sc.text[1] * k)}" font-family="Roboto, sans-serif" font-size="${n1(13 * k)}" font-weight="500" text-anchor="middle" dominant-baseline="central" fill="${textOn(color)}">${esc(l.text)}</text></g>`;
    });
    let legend = '';
    if (state.legend && state.byType) {
      const items = legendItems();
      if (items.length) {
        meter.font = '400 12px Roboto, sans-serif';
        const lw = (Math.max(...items.map((i) => meter.measureText(i.text).width)) + 38) * k;
        const lh = (items.length * 20 + 16) * k;
        const lx = 16 * k, ly = height - lh - 16 * k;
        legend = `<g id="LEGEND"><rect x="${n1(lx)}" y="${n1(ly)}" width="${n1(lw)}" height="${n1(lh)}" rx="${n1(8 * k)}" fill="${st.bg}" stroke="rgba(0,0,0,0.15)" stroke-width="${n1(0.8 * k)}"/>`
          + items.map((it, i) => {
            const yy = ly + (16 + i * 20) * k;
            return `<rect x="${n1(lx + 12 * k)}" y="${n1(yy - 6 * k)}" width="${n1(12 * k)}" height="${n1(12 * k)}" rx="${n1(3 * k)}" fill="${it.color}" stroke="rgba(0,0,0,0.25)" stroke-width="${n1(0.8 * k)}"/>`
              + `<text x="${n1(lx + 32 * k)}" y="${n1(yy)}" font-family="Roboto, sans-serif" font-size="${n1(12 * k)}" dominant-baseline="central" fill="#1d1d1f">${esc(it.text)}</text>`;
          }).join('') + '</g>';
      }
    }
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<g id="SCENE">${parts.join('')}</g>
${legend}
${labels.length ? `<g id="LABELS">${labels.join('')}</g>` : ''}
</svg>`;
    return new Blob([svg], { type: 'image/svg+xml' });
  }

  function toPNG({ width = 3000 } = {}) {
    const ratio = canvas.clientHeight / canvas.clientWidth;
    const height = Math.round(width * ratio);
    const k = width / canvas.clientWidth;
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const ctx = off.getContext('2d');
    ctx.scale(k, k);
    draw(ctx, canvas.clientWidth, canvas.clientHeight, 1);
    return new Promise((res) => off.toBlob(res, 'image/png'));
  }

  /* --- выбор точки для подписи --- */
  function pick(x, y) {
    const { items, cam } = scene(canvas.clientWidth, canvas.clientHeight);
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.kind === 'tree') {
        if (Math.hypot(x - it.x, y - it.y) <= it.r) return { depth: it.depth, screen: [it.x, it.y] };
        continue;
      }
      if (it.kind !== 'poly') continue;
      let inside = false;
      const p = it.pts;
      for (let a = 0, b = p.length - 1; a < p.length; b = a++) {
        if (p[a][1] > y !== p[b][1] > y && x < ((p[b][0] - p[a][0]) * (y - p[a][1])) / (p[b][1] - p[a][1]) + p[a][0]) inside = !inside;
      }
      if (inside) return { depth: it.depth, screen: [x, y] };
    }
    return null;
  }

  // экранная точка + глубина → мировые координаты (для привязки подписи)
  function unproject(x, y, depth) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const cam = camera(w, h);
    const rad = Math.PI / 180;
    const az = state.az * rad, el = state.el * rad;
    const dir = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
    const f = dir.map((v) => -v);
    const rl = Math.hypot(f[1], -f[0]) || 1;
    const right = [f[1] / rl, -f[0] / rl, 0];
    const up = [right[1] * f[2] - right[2] * f[1], right[2] * f[0] - right[0] * f[2], right[0] * f[1] - right[1] * f[0]];
    const { cx, cy } = cam;
    const scale = cam.scale;
    let vx, vy;
    if (state.perspective) {
      const focal = cam.focal;
      vx = ((x - cx) * depth) / focal;
      vy = ((cy - y) * depth) / focal;
    } else {
      vx = (x - cx) / scale;
      vy = (cy - y) / scale;
    }
    return [0, 1, 2].map((i) => cam.eye[i] + right[i] * vx + up[i] * vy + f[i] * depth);
  }

  return {
    state,
    render,
    setView(name) {
      if (VIEWS[name]) { state.view = name; state.az = VIEWS[name].az; state.el = VIEWS[name].el; }
      render();
    },
    orbit(dx, dy) {
      state.view = 'free';
      state.az = (state.az - dx * 0.4 + 360) % 360;
      state.el = Math.max(2, Math.min(89.9, state.el + dy * 0.3));
      render();
    },
    pan(dx, dy) { state.pan[0] += dx; state.pan[1] += dy; render(); },
    zoomBy(k) { state.zoom = Math.max(0.2, Math.min(12, state.zoom * k)); render(); },
    setPerspective(on) { state.perspective = on; render(); },
    setQuick(on) { state.quick = on; if (!on) render(); },
    setLabelColor(color) { state.labelColor = color; for (const l of state.labels) l.color = color; render(); },
    setByType(on) { state.byType = on; render(); },
    setLegend(on) { state.legend = on; render(); },
    setLang(lang) { state.lang = lang; render(); },
    setSite(ring) { model.site = ring; list = null; render(); },
    setStyle(name) {
      if (STYLES[name]) state.style = name;
      state.colors = {};      // новый пресет — со своими цветами
      state.classColors = {};
      render();
    },
    setColor(key, value) { state.colors[key] = value; render(); },
    setClassColor(cls, value) { state.classColors[cls] = value; render(); },
    resetColors() { state.colors = {}; state.classColors = {}; render(); },
    colors: () => ({ base: palette(), classes: classPalette() }),
    setLayer(name, on) { state.layers[name] = on; list = null; render(); },
    reset() { state.zoom = 1; state.pan = [0, 0]; render(); },
    addLabel(x, y, text) {
      const hit = pick(x, y);
      if (!hit) return null;
      const world = unproject(hit.screen[0], hit.screen[1], hit.depth);
      const l = { world, text, dx: 48, dy: -52, color: state.labelColor };
      state.labels.push(l);
      render();
      return l;
    },
    removeLabel(l) {
      state.labels = state.labels.filter((x) => x !== l);
      render();
    },
    labels: () => state.labels,
    toSVG,
    toPNG,
    invalidate() { list = null; render(); },
  };
}
