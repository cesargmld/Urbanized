// Загрузка данных местности и сборка модели.
// Здания, дороги, вода, зелень — OpenStreetMap (Overpass API).
// Рельеф — Terrain Tiles (Mapzen / AWS Open Data, формат terrarium).
import earcut from 'https://cdn.jsdelivr.net/npm/earcut@3.0.1/+esm';
import { fetchImagery, detectTrees, MAX_TREES } from './satellite.js?v=4.1';

// Публичные серверы Overpass. z — отдельная машина overpass-api.de:
// когда общий адрес перегружен, она часто отвечает (lz4 теперь только для белого списка).
const OVERPASS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const OSM_CACHE = 'ue-osm-v1';
const OSM_CACHE_DAYS = 7;
const TERRAIN_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const LEVEL_HEIGHT = 3.2;

export const LAYERS = {
  BUILDINGS: 'BUILDINGS',
  TERRAIN: 'TERRAIN',
  ROADS_MAJOR: 'ROADS_MAJOR',
  ROADS_MINOR: 'ROADS_MINOR',
  PATHS: 'PATHS',
  RAILWAYS: 'RAILWAYS',
  WATER: 'WATER',
  GREEN: 'GREEN',
  CONTOURS: 'CONTOURS',
  BRIDGES: 'BRIDGES',
  ROADS_AREA: 'ROADS_AREA',
  PATHS_AREA: 'PATHS_AREA',
  TREES: 'TREES',
  SITE: 'SITE',
};

/* ---------- Система координат: метры от центра участка, X — восток, Y — север ---------- */

export function makeFrame(lat, lon, size, shape = 'square') {
  const phi = (lat * Math.PI) / 180;
  const mLat = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
  const mLon = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
  const half = size / 2;
  // границы участка как полуплоскости n·p <= d: квадрат — 4 штуки, круг — 128 касательных
  const planes = shape === 'circle'
    ? Array.from({ length: 128 }, (_, i) => {
      const a = (i / 128) * 2 * Math.PI;
      return [Math.cos(a), Math.sin(a), half];
    })
    : [[1, 0, half], [-1, 0, half], [0, 1, half], [0, -1, half]];
  return {
    lat, lon, size, half, shape, planes,
    south: lat - half / mLat, north: lat + half / mLat,
    west: lon - half / mLon, east: lon + half / mLon,
    toLocal: (la, lo) => [(lo - lon) * mLon, (la - lat) * mLat],
    inside: (x, y) => (shape === 'circle' ? Math.hypot(x, y) <= half : Math.abs(x) <= half && Math.abs(y) <= half),
    area: shape === 'circle' ? Math.PI * half * half : size * size,
  };
}

/* ---------- OpenStreetMap ---------- */

async function fetchDirectOSM(frame, signal) {
  // Official OpenStreetMap API (api.openstreetmap.org/api/0.6/map?bbox=minLon,minLat,maxLon,maxLat)
  // Has native CORS support and 99.99% availability, bypassing Overpass mirror downtime
  const margin = Math.min(0.003, (frame.north - frame.south) * 0.15);
  const minLon = (frame.west - margin).toFixed(6);
  const minLat = (frame.south - margin).toFixed(6);
  const maxLon = (frame.east + margin).toFixed(6);
  const maxLat = (frame.north + margin).toFixed(6);
  const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${minLon},${minLat},${maxLon},${maxLat}`;

  const fetchSignal = signal
    ? (AbortSignal.any ? AbortSignal.any([signal, AbortSignal.timeout(22000)]) : signal)
    : (AbortSignal.timeout ? AbortSignal.timeout(22000) : undefined);
  const res = await fetch(url, { signal: fetchSignal });
  if (!res.ok) throw new Error(`OSM Direct API ${res.status}`);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('OSM XML parse error');

  const nodes = new Map();
  const wayMap = new Map();
  const elements = [];

  // 1. Nodes
  const nodeEls = doc.getElementsByTagName('node');
  for (let i = 0; i < nodeEls.length; i++) {
    const n = nodeEls[i];
    const id = Number(n.getAttribute('id'));
    const lat = Number(n.getAttribute('lat'));
    const lon = Number(n.getAttribute('lon'));
    nodes.set(id, { lat, lon });

    const tagEls = n.getElementsByTagName('tag');
    if (tagEls.length > 0) {
      const tags = {};
      for (let t = 0; t < tagEls.length; t++) {
        tags[tagEls[t].getAttribute('k')] = tagEls[t].getAttribute('v');
      }
      elements.push({ type: 'node', id, lat, lon, tags });
    }
  }

  // 2. Ways
  const wayEls = doc.getElementsByTagName('way');
  for (let i = 0; i < wayEls.length; i++) {
    const w = wayEls[i];
    const id = Number(w.getAttribute('id'));
    const ndEls = w.getElementsByTagName('nd');
    const geometry = [];
    for (let k = 0; k < ndEls.length; k++) {
      const ref = Number(ndEls[k].getAttribute('ref'));
      const pt = nodes.get(ref);
      if (pt) geometry.push(pt);
    }
    wayMap.set(id, geometry);

    const tagEls = w.getElementsByTagName('tag');
    const tags = {};
    for (let t = 0; t < tagEls.length; t++) {
      tags[tagEls[t].getAttribute('k')] = tagEls[t].getAttribute('v');
    }
    elements.push({ type: 'way', id, tags, geometry });
  }

  // 3. Relations (multipolygons)
  const relEls = doc.getElementsByTagName('relation');
  for (let i = 0; i < relEls.length; i++) {
    const r = relEls[i];
    const id = Number(r.getAttribute('id'));
    const tagEls = r.getElementsByTagName('tag');
    const tags = {};
    for (let t = 0; t < tagEls.length; t++) {
      tags[tagEls[t].getAttribute('k')] = tagEls[t].getAttribute('v');
    }
    const memberEls = r.getElementsByTagName('member');
    const members = [];
    for (let m = 0; m < memberEls.length; m++) {
      const type = memberEls[m].getAttribute('type');
      const ref = Number(memberEls[m].getAttribute('ref'));
      const role = memberEls[m].getAttribute('role') || '';
      members.push({
        type,
        ref,
        role,
        geometry: type === 'way' ? (wayMap.get(ref) || []) : []
      });
    }
    elements.push({ type: 'relation', id, tags, members });
  }

  return { elements, source: 'osm_direct' };
}

async function fetchOSM(frame, signal) {
  const b = `${frame.south},${frame.west},${frame.north},${frame.east}`;
  const o = Math.min(400, frame.size * 0.6);
  const dLatO = (frame.north - frame.south) * (o / frame.size), dLonO = (frame.east - frame.west) * (o / frame.size);
  const bo = `${frame.south - dLatO},${frame.west - dLonO},${frame.north + dLatO},${frame.east + dLonO}`;
  const m = 2500;
  const dLat = (frame.north - frame.south) * (m / frame.size), dLon = (frame.east - frame.west) * (m / frame.size);
  const bb = `${frame.south - dLat},${frame.west - dLon},${frame.north + dLat},${frame.east + dLon}`;
  const WATER_AREA = '["natural"="water"]';
  const query = `[out:json][timeout:120];
(
  way["building"](${bo});
  relation["building"](${bo});
  way["building:part"](${bo});
  relation["building:part"](${bo});
  way["highway"](${bo});
  way["railway"~"^(rail|light_rail|subway|tram|narrow_gauge|monorail)$"](${bo});
  way["waterway"~"^(river|stream|canal|ditch|drain)$"](${b});
  way["natural"="coastline"](${bo});
  way["leisure"~"^(park|garden)$"](${b});
  way["landuse"~"^(grass|recreation_ground|village_green|cemetery|allotments)$"](${b});
  way["natural"~"^(scrub|grassland|heath|sand|beach)$"](${b});
  node["natural"="tree"](${b});
  node["man_made"="minaret"](${b});
  node["tower:type"="minaret"](${b});
  way["man_made"="minaret"](${b});
  way["natural"="tree_row"](${b});
);
out geom;
(
  way${WATER_AREA}(${bb});
  relation${WATER_AREA}(${bb});
  way["waterway"~"^(riverbank|dock)$"](${bb});
  relation["waterway"="riverbank"](${bb});
  way["landuse"~"^(reservoir|basin)$"](${bb});
  way["landuse"~"^(forest|meadow)$"](${bb});
  relation["landuse"="forest"](${bb});
  way["natural"="wood"](${bb});
  relation["natural"="wood"](${bb});
);
out geom;`;

  const cacheKey = `direct:${bo}`;
  const cached = await osmCacheGet(cacheKey);
  if (cached) return cached;

  // 1. Primary: Direct official OpenStreetMap API (instant response, 99.99% uptime, no mirror bottlenecks)
  try {
    const json = await fetchDirectOSM(frame, signal);
    if (json && json.elements && json.elements.length > 0) {
      osmCachePut(cacheKey, json);
      return json;
    }
  } catch (directErr) {
    console.warn('Direct OSM API busy or limit reached, falling back to Overpass mirrors...', directErr);
  }

  // 2. Fallback: Overpass mirrors
  const urls = mirrorOrder();
  const ctrls = urls.map(() => new AbortController());
  const abortAll = () => ctrls.forEach((c) => c.abort());
  signal?.addEventListener('abort', abortAll);
  const attempt = async (url, i) => {
    const t0 = performance.now();
    try {
      const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), signal: AbortSignal.any([ctrls[i].signal, AbortSignal.timeout(90000)]) });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = await res.json();
      if (json.remark && /runtime error|timed out|out of memory|rate_limited/i.test(json.remark)) throw new Error(json.remark);
      mirrorScore(url, true, performance.now() - t0);
      return json;
    } catch (err) {
      if (!ctrls[i].signal.aborted) mirrorScore(url, false);
      throw err;
    }
  };
  const dedupe = (json) => {
    const seen = new Set();
    json.elements = (json.elements ?? []).filter((e) => {
      const k = `${e.type}/${e.id}`;
      return seen.has(k) ? false : seen.add(k);
    });
    return json;
  };
  try {
    const json = dedupe(await race(urls, attempt, { first: 2, gap: 2000, signal }));
    osmCachePut(cacheKey, json);
    return json;
  } catch (overpassErr) {
    console.warn('Overpass mirrors also failed:', overpassErr);
    throw new Error('Overpass and OSM unavailable');
  } finally {
    abortAll();
    signal?.removeEventListener('abort', abortAll);
  }
}

// Запуск попыток лесенкой: first сразу, дальше по одной каждые gap мс или сразу после ошибки.
function race(items, run, { first = 2, gap = 4000, signal } = {}) {
  return new Promise((resolve, reject) => {
    let next = 0, failed = 0, done = false, timer = null;
    const finish = (fn, v) => { if (done) return; done = true; clearTimeout(timer); fn(v); };
    const launch = () => {
      if (done || next >= items.length) return;
      const i = next++;
      run(items[i], i).then((v) => finish(resolve, v), (err) => {
        if (++failed === items.length) finish(reject, err);
        else launch();
      });
    };
    const tick = () => { launch(); if (!done && next < items.length) timer = setTimeout(tick, gap); };
    signal?.addEventListener('abort', () => finish(reject, new Error('cancelled')));
    for (let k = 0; k < first; k++) launch();
    timer = setTimeout(tick, gap);
  });
}

// Статистика серверов в браузере: быстрые и живые — первыми, недавно упавшие — в конец.
function mirrorStats() {
  try { return JSON.parse(localStorage.getItem('ue:overpass')) ?? {}; } catch { return {}; }
}
function mirrorScore(url, ok, ms) {
  const st = mirrorStats();
  const r = st[url] ?? { ms: 15000, fail: 0 };
  if (ok) { r.ms = Math.round(r.ms * 0.5 + ms * 0.5); r.fail = 0; r.at = Date.now(); }
  else { r.fail = (r.fail ?? 0) + 1; r.failAt = Date.now(); }
  st[url] = r;
  try { localStorage.setItem('ue:overpass', JSON.stringify(st)); } catch { /* приватный режим */ }
}
function mirrorOrder() {
  const st = mirrorStats(), now = Date.now();
  const cost = (url, i) => {
    const r = st[url];
    if (!r) return 20000 + i; // неизвестные — в исходном порядке после проверенных быстрых
    const recentFail = r.failAt && now - r.failAt < 15 * 60000 ? 60000 * Math.min(3, r.fail) : 0;
    return r.ms + recentFail + i;
  };
  return OVERPASS.map((u, i) => [u, cost(u, i)]).sort((a, b) => a[1] - b[1]).map(([u]) => u);
}

// Кэш ответов OSM в браузере: повторная сборка того же участка (другие слои, форма) — без сети.
async function osmKey(query) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(query));
  return `https://osm-cache.local/${[...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}
async function osmCacheGet(query) {
  try {
    const cache = await caches.open(OSM_CACHE);
    const res = await cache.match(await osmKey(query));
    if (!res) return null;
    if (Date.now() - Number(res.headers.get('x-saved')) > OSM_CACHE_DAYS * 86400000) return null;
    return await res.json();
  } catch { return null; }
}
async function osmCachePut(query, json) {
  try {
    const cache = await caches.open(OSM_CACHE);
    await cache.put(await osmKey(query), new Response(JSON.stringify(json), { headers: { 'content-type': 'application/json', 'x-saved': String(Date.now()) } }));
  } catch { /* нет Cache API или нет места */ }
}

/* ---------- Рельеф ----------
 * Основной источник — Mapterhorn (открытые тайлы, terrarium, 512 px):
 *   глобально Copernicus GLO-30 (~30 м), в десятках стран — лидарные модели рельефа 0,25–10 м (без зданий и деревьев).
 * Запасной — Terrain Tiles на AWS (SRTM и др.).
 * GLO-30 и SRTM — модели поверхности: здания и лес в них «поднимают» землю, поэтому грубый рельеф очищается (cleanSurface).
 */
const MAPTERHORN_URL = (z, x, y) => `https://tiles.mapterhorn.com/${z}/${x}/${y}.webp`;
const MAPTERHORN_MIN_Z = 12;

const worldPx = (frame, z, ts) => {
  const lon = (l) => ((l + 180) / 360) * ts * 2 ** z;
  const lat = (a) => {
    const s = Math.sin((a * Math.PI) / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * ts * 2 ** z;
  };
  return { lon, lat, x0: lon(frame.west), x1: lon(frame.east), y0: lat(frame.north), y1: lat(frame.south) };
};

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Terrain tile unavailable'));
    img.src = url;
  });
}

// Мозаика тайлов вокруг участка → функция высоты (lat, lon) с билинейной интерполяцией.
// Нет тайла на нужном уровне — берётся четверть родительского (до minZ).
async function terrariumSampler(frame, z, ts, url, minZ) {
  const P = worldPx(frame, z, ts);
  const tx0 = Math.floor(P.x0 / ts) , tx1 = Math.floor(P.x1 / ts);
  const ty0 = Math.floor(P.y0 / ts), ty1 = Math.floor(P.y1 / ts);
  const canvas = document.createElement('canvas');
  canvas.width = (tx1 - tx0 + 1) * ts;
  canvas.height = (ty1 - ty0 + 1) * ts;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false; // значения высот нельзя смешивать при масштабировании родителя
  let coarsest = z;
  const draw = async (tx, ty) => {
    for (let zz = z; zz >= minZ; zz--) {
      const k = 2 ** (z - zz);
      try {
        const img = await loadImage(url(zz, Math.floor(tx / k), Math.floor(ty / k)));
        const part = ts / k;
        ctx.drawImage(img, (tx % k) * part, (ty % k) * part, part, part, (tx - tx0) * ts, (ty - ty0) * ts, ts, ts);
        coarsest = Math.min(coarsest, zz);
        return;
      } catch { /* пробуем уровень грубее */ }
    }
    throw new Error('Terrain tile unavailable');
  };
  const jobs = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push(draw(tx, ty));
  await Promise.all(jobs);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const at = (px, py) => {
    const i = (Math.min(height - 1, Math.max(0, py)) * width + Math.min(width - 1, Math.max(0, px))) * 4;
    return data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
  };
  const sampler = (lat, lon) => {
    const fx = P.lon(lon) - tx0 * ts - 0.5, fy = P.lat(lat) - ty0 * ts - 0.5;
    const ix = Math.floor(fx), iy = Math.floor(fy), dx = fx - ix, dy = fy - iy;
    return (at(ix, iy) * (1 - dx) + at(ix + 1, iy) * dx) * (1 - dy) + (at(ix, iy + 1) * (1 - dx) + at(ix + 1, iy + 1) * dx) * dy;
  };
  // метров на пиксель источника в худшем месте участка
  const res = (156543.03 * Math.cos((frame.lat * Math.PI) / 180)) / 2 ** coarsest / (ts / 256);
  return { sampler, res, coarsest };
}

async function fetchElevation(frame) {
  // Mapterhorn: максимальный уровень для участка ищем по центральному тайлу
  try {
    const target = frame.size <= 900 ? 16 : 15;
    const cz = (z) => {
      const P = worldPx(frame, z, 512);
      return [Math.floor((P.x0 + P.x1) / 2 / 512), Math.floor((P.y0 + P.y1) / 2 / 512)];
    };
    let z = target;
    for (; z > MAPTERHORN_MIN_Z; z--) {
      const [x, y] = cz(z);
      const ok = await loadImage(MAPTERHORN_URL(z, x, y)).then(() => true, () => false);
      if (ok) break;
    }
    const { sampler, res, coarsest } = await terrariumSampler(frame, z, 512, MAPTERHORN_URL, MAPTERHORN_MIN_Z);
    // глобальный GLO-30 есть только до z12; всё детальнее — национальные лидарные модели земли
    return { sampler, res, source: coarsest > MAPTERHORN_MIN_Z ? 'dtm' : 'glo30' };
  } catch { /* Mapterhorn недоступен */ }
  const z = frame.size <= 900 ? 15 : 14;
  const { sampler, res } = await terrariumSampler(frame, z, 256, TERRAIN_URL, z);
  return { sampler, res: Math.max(res, 30), source: 'srtm' };
}

/**
 * Высоты в произвольных точках (для разрезов): грузятся только тайлы, накрывающие точки.
 * Зум подбирается по длине линии, при отсутствии детального тайла берётся родительский.
 */
export async function elevationAt(points, zoom) {
  const ts = 512;
  const gx = (lon, z) => ((lon + 180) / 360) * ts * 2 ** z;
  const gy = (lat, z) => {
    const s = Math.sin((lat * Math.PI) / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * ts * 2 ** z;
  };
  for (let z = zoom; z >= MAPTERHORN_MIN_Z; z--) {
    const tiles = new Map();
    for (const [lat, lon] of points) {
      const tx = Math.floor(gx(lon, z) / ts), ty = Math.floor(gy(lat, z) / ts);
      tiles.set(`${tx}/${ty}`, [tx, ty]);
    }
    if (tiles.size > 120) continue; // слишком мелкий масштаб для такой длины
    const data = new Map();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = ts;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    let ok = true;
    for (const [key, [tx, ty]] of tiles) {
      let drawn = false;
      for (let zz = z; zz >= MAPTERHORN_MIN_Z && !drawn; zz--) {
        const k = 2 ** (z - zz);
        try {
          const img = await loadImage(MAPTERHORN_URL(zz, Math.floor(tx / k), Math.floor(ty / k)));
          const part = ts / k;
          ctx.clearRect(0, 0, ts, ts);
          ctx.drawImage(img, (tx % k) * part, (ty % k) * part, part, part, 0, 0, ts, ts);
          data.set(key, ctx.getImageData(0, 0, ts, ts).data);
          drawn = true;
        } catch { /* уровень грубее */ }
      }
      if (!drawn) { ok = false; break; }
    }
    if (!ok) continue;
    const px = (fx, fy) => {
      const tx = Math.floor(fx / ts), ty = Math.floor(fy / ts);
      const d = data.get(`${tx}/${ty}`);
      if (!d) return null;
      const i = ((Math.min(ts - 1, Math.max(0, Math.floor(fy - ty * ts))) * ts) + Math.min(ts - 1, Math.max(0, Math.floor(fx - tx * ts)))) * 4;
      return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768;
    };
    const res = (156543.03 * Math.cos((points[0][0] * Math.PI) / 180)) / 2 ** z / (ts / 256);
    return {
      zoom: z,
      res,
      at: (lat, lon) => {
        const fx = gx(lon, z) - 0.5, fy = gy(lat, z) - 0.5;
        const x0 = Math.floor(fx), y0 = Math.floor(fy), dx = fx - x0, dy = fy - y0;
        const a = px(x0, y0), b = px(x0 + 1, y0), c = px(x0, y0 + 1), d = px(x0 + 1, y0 + 1);
        if (a == null) return 0;
        return (a * (1 - dx) + (b ?? a) * dx) * (1 - dy) + ((c ?? a) * (1 - dx) + (d ?? a) * dx) * dy;
      },
    };
  }
  throw new Error('Terrain unavailable');
}

/**
 * Очистка модели поверхности до рельефа земли (для GLO-30 / SRTM).
 * Ячейки под зданиями (с запасом на размытие 30-метрового пикселя) и под лесом помечаются,
 * их высота заменяется гармонической интерполяцией от открытых ячеек вокруг
 * (стартовое приближение — морфологическое «открытие», снимающее объекты уже ~80 м).
 * Высота только понижается: рельеф никогда не поднимается.
 */
function cleanSurface(h, w, step, half, masks) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = w;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const px = ([x, y]) => [(x + half) / step + 0.5, (y + half) / step + 0.5];
  ctx.fillStyle = ctx.strokeStyle = '#fff';
  ctx.lineJoin = 'round';
  for (const { ring, buffer } of masks) {
    ctx.beginPath();
    ring.forEach((p, i) => (i ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
    ctx.closePath();
    ctx.fill();
    if (buffer) { ctx.lineWidth = (2 * buffer) / step; ctx.stroke(); }
  }
  const md = ctx.getImageData(0, 0, w, w).data;
  const mask = new Uint8Array(w * w);
  let masked = 0;
  for (let i = 0; i < w * w; i++) if (md[4 * i] > 100) { mask[i] = 1; masked++; }
  if (!masked) return { h, stats: null };

  const r = Math.max(1, Math.round(40 / step));
  const filt = (src, op) => {
    const tmp = new Float32Array(w * w), out = new Float32Array(w * w);
    for (let j = 0; j < w; j++)
      for (let i = 0; i < w; i++) {
        let v = src[j * w + i];
        for (let d = -r; d <= r; d++) { const a = i + d; if (a >= 0 && a < w) v = op(v, src[j * w + a]); }
        tmp[j * w + i] = v;
      }
    for (let j = 0; j < w; j++)
      for (let i = 0; i < w; i++) {
        let v = tmp[j * w + i];
        for (let d = -r; d <= r; d++) { const b = j + d; if (b >= 0 && b < w) v = op(v, tmp[b * w + i]); }
        out[j * w + i] = v;
      }
    return out;
  };
  const opened = filt(filt(h, Math.min), Math.max);
  const g = Float32Array.from(h, (v, i) => (mask[i] ? Math.min(v, opened[i]) : v));
  if (masked < w * w) {
    for (let it = 0; it < 400; it++)
      for (let j = 0; j < w; j++)
        for (let i = 0; i < w; i++) {
          const k = j * w + i;
          if (!mask[k]) continue;
          let s = 0, c = 0;
          if (i > 0) { s += g[k - 1]; c++; }
          if (i < w - 1) { s += g[k + 1]; c++; }
          if (j > 0) { s += g[k - w]; c++; }
          if (j < w - 1) { s += g[k + w]; c++; }
          g[k] = Math.min(h[k], s / c);
        }
  }
  let drop = 0, maxDrop = 0;
  for (let i = 0; i < w * w; i++) if (mask[i]) { drop += h[i] - g[i]; maxDrop = Math.max(maxDrop, h[i] - g[i]); }
  return { h: g, stats: { maskedShare: masked / (w * w), meanDrop: drop / masked, maxDrop } };
}

function buildGrid(frame, elev, masks = []) {
  const target = elev ? (elev.source === 'dtm' ? Math.max(4, elev.res * 2) : 15) : 30;
  const n = Math.max(32, Math.min(180, Math.round(frame.size / target)));
  const step = frame.size / n;
  const w = n + 1;
  const half = frame.half;
  let h = new Float32Array(w * w), cleaning = null, offset = 0;
  if (elev) {
    const invLat = (frame.north - frame.south) / frame.size, invLon = (frame.east - frame.west) / frame.size;
    for (let j = 0; j < w; j++)
      for (let i = 0; i < w; i++) h[j * w + i] = elev.sampler(frame.south + j * step * invLat, frame.west + i * step * invLon);
    if (elev.source !== 'dtm') ({ h, stats: cleaning } = cleanSurface(h, w, step, half, masks));
    // лёгкое сглаживание ступенек исходного растра
    const s = new Float32Array(w * w);
    for (let j = 0; j < w; j++)
      for (let i = 0; i < w; i++) {
        let sum = 0, cnt = 0;
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const a = i + di, b = j + dj;
            if (a >= 0 && b >= 0 && a < w && b < w) { sum += h[b * w + a]; cnt++; }
          }
        s[j * w + i] = sum / cnt;
      }
    h = s;
    let min = Infinity;
    for (const v of h) min = Math.min(min, v);
    for (let k = 0; k < h.length; k++) h[k] = Math.round((h[k] - min) * 100) / 100;
    offset = min; // абсолютная отметка нуля модели
  }
  const heightAt = (x, y) => {
    const fx = Math.min(n, Math.max(0, (x + half) / step)), fy = Math.min(n, Math.max(0, (y + half) / step));
    const i = Math.min(n - 1, Math.floor(fx)), j = Math.min(n - 1, Math.floor(fy));
    const dx = fx - i, dy = fy - j;
    const a = h[j * w + i], b = h[j * w + i + 1], c = h[(j + 1) * w + i], d = h[(j + 1) * w + i + 1];
    return (a * (1 - dx) + b * dx) * (1 - dy) + (c * (1 - dx) + d * dx) * dy;
  };
  let maxH = 0;
  for (const v of h) maxH = Math.max(maxH, v);
  return { n, step, w, heights: h, heightAt, half, maxH, offset, source: elev?.source ?? null, res: elev?.res ?? null, cleaning };
}

// Маска для очистки поверхности: здания (с запасом) и лес из сырых данных OSM.
function surfaceMasks(osm, frame) {
  const local = (g) => g.map((p) => frame.toLocal(p.lat, p.lon));
  const masks = [];
  const forest = (t) => t.landuse === 'forest' || t.natural === 'wood';
  for (const el of osm.elements ?? []) {
    const t = el.tags ?? {};
    const isBuilding = t.building && t.building !== 'no' && t.location !== 'underground';
    if (!isBuilding && !forest(t)) continue;
    const buffer = isBuilding ? 12 : 0;
    if (el.type === 'way' && el.geometry) masks.push({ ring: local(el.geometry), buffer });
    else if (el.type === 'relation' && el.members)
      for (const r of joinWays(el.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => local(m.geometry)))) masks.push({ ring: r, buffer });
  }
  return masks;
}

/* ---------- Геометрия ---------- */

const signedArea = (r) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return a / 2;
};

function insideRing([x, y], r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function cleanRing(r) {
  const out = [];
  for (const p of r) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.01) out.push(p);
  }
  while (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 0.01) out.pop();
  return out;
}

// Отсечение многоугольника границей участка (Сазерленд — Ходжмен по полуплоскостям).
function clipRing(ring, frame) {
  let out = ring;
  for (const [nx, ny, d] of frame.planes) {
    if (!out.length) break;
    const input = out;
    out = [];
    const side = (p) => nx * p[0] + ny * p[1] - d;
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i + input.length - 1) % input.length];
      const sc = side(cur), sp = side(prev);
      if (sc <= 0) {
        if (sp > 0) {
          const t = sp / (sp - sc);
          out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
        }
        out.push(cur);
      } else if (sp <= 0) {
        const t = sp / (sp - sc);
        out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
      }
    }
  }
  return cleanRing(out);
}

// Отсечение ломаной границей участка (Сайрус — Бек по каждому звену).
function clipLine(pts, frame) {
  const parts = [];
  let cur = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    let t0 = 0, t1 = 1, ok = true;
    for (const [nx, ny, d] of frame.planes) {
      const den = nx * dx + ny * dy;
      const num = d - (nx * a[0] + ny * a[1]);
      if (Math.abs(den) < 1e-12) { if (num < 0) { ok = false; break; } continue; }
      const r = num / den;
      if (den > 0) { if (r < t0) { ok = false; break; } if (r < t1) t1 = r; }
      else { if (r > t1) { ok = false; break; } if (r > t0) t0 = r; }
    }
    if (!ok) { cur = null; continue; }
    const p0 = [a[0] + t0 * dx, a[1] + t0 * dy], p1 = [a[0] + t1 * dx, a[1] + t1 * dy];
    if (!cur || t0 > 0) { cur = [p0]; parts.push(cur); }
    cur.push(p1);
    if (t1 < 1) cur = null;
  }
  return parts.filter((p) => p.length > 1 && (Math.abs(p[0][0] - p[1][0]) > 1e-9 || Math.abs(p[0][1] - p[1][1]) > 1e-9));
}

// Уплотнение ломаной, чтобы линии следовали рельефу.
function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const k = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step);
    for (let s = 1; s <= k; s++) out.push([a[0] + ((b[0] - a[0]) * s) / k, a[1] + ((b[1] - a[1]) * s) / k]);
  }
  return out;
}

// Сборка колец мультиполигона из отрезков-путей.
function joinWays(ways) {
  const rings = [];
  const pool = ways.filter((w) => w.length > 1).map((w) => w.slice());
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  while (pool.length) {
    let ring = pool.shift();
    let grown = true;
    while (!same(ring[0], ring[ring.length - 1]) && grown) {
      grown = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i], end = ring[ring.length - 1];
        if (same(end, w[0])) ring = ring.concat(w.slice(1));
        else if (same(end, w[w.length - 1])) ring = ring.concat(w.slice(0, -1).reverse());
        else continue;
        pool.splice(i, 1);
        grown = true;
        break;
      }
    }
    if (ring.length > 3) rings.push(ring);
  }
  return rings;
}

const num = (s) => {
  if (s == null) return null;
  const v = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

// Тип здания по тегам OSM — шесть спокойных классов вместо сотни значений building=*.
export const BUILDING_CLASSES = ['residential', 'public', 'commercial', 'industrial', 'utility', 'other'];

export function buildingClass(t) {
  const b = (t.building ?? '').toLowerCase();
  const use = (t['building:use'] ?? '').toLowerCase();
  if (/^(house|detached|residential|apartments|terrace|semidetached_house|dormitory|bungalow|cabin|farm|static_caravan|hut)$/.test(b) || use === 'residential') return 'residential';
  if (/^(church|cathedral|chapel|mosque|synagogue|temple|shrine|monastery|civic|government|public|school|university|college|kindergarten|hospital|clinic|museum|train_station|transportation|stadium|sports_hall|fire_station|toilets)$/.test(b)) return 'public';
  if (t.amenity && /^(school|university|college|kindergarten|hospital|clinic|townhall|library|theatre|museum|place_of_worship|courthouse|police|fire_station)$/.test(t.amenity)) return 'public';
  if (/^(commercial|retail|supermarket|kiosk|office|hotel|motel|restaurant|mall)$/.test(b) || t.office || t.shop || /^(hotel|hostel|guest_house)$/.test(t.tourism ?? '')) return 'commercial';
  if (/^(industrial|warehouse|factory|manufacture|works|hangar|silo|storage_tank|digester)$/.test(b) || t.industrial || t.man_made === 'works') return 'industrial';
  if (/^(garage|garages|carport|shed|roof|service|hut|barn|greenhouse|stable|transformer_tower|container|bunker|parking)$/.test(b)) return 'utility';
  return 'other';
}

export function buildingHeight(t) {
  let top = num(t.height) ?? num(t['building:height']);
  const levels = num(t['building:levels']);
  if (top == null && levels != null) top = levels * LEVEL_HEIGHT + (num(t['roof:levels']) ?? 0) * LEVEL_HEIGHT * 0.5;
  if (top == null) {
    const type = t.man_made === 'minaret' ? 'minaret' : t.building;
    top = { minaret: 40, house: 6, detached: 6, garage: 3, garages: 3, shed: 3, hut: 3, roof: 4, kiosk: 3, industrial: 9, warehouse: 9, apartments: 15, church: 15, cathedral: 25 }[type] ?? 9;
  }
  let base = num(t.min_height);
  if (base == null && num(t['building:min_level']) != null) base = num(t['building:min_level']) * LEVEL_HEIGHT;
  base = base ?? 0;
  if (top <= base) top = base + 3;
  return { base, top };
}

// Замкнутое тело здания: вершины, грани (стены — четырёхугольники, крыша и низ — треугольники)
// и признаки видимости рёбер (для полигональных сеток DXF без диагоналей).
function extrude(rings, z0, z1) {
  const flat = [], holes = [], next = [];
  let n = 0;
  rings.forEach((r, k) => {
    if (k > 0) holes.push(n);
    r.forEach((p, i) => { flat.push(p[0], p[1]); next.push(n + ((i + 1) % r.length)); });
    n += r.length;
  });
  const verts = [];
  for (let i = 0; i < n; i++) verts.push([flat[2 * i], flat[2 * i + 1], z0]);
  for (let i = 0; i < n; i++) verts.push([flat[2 * i], flat[2 * i + 1], z1]);
  const faces = [];
  for (let i = 0; i < n; i++) faces.push({ v: [i, next[i], n + next[i], n + i], vis: [1, 1, 1, 1] });
  const tri = earcut(flat, holes, 2);
  const onRing = (a, b) => next[a] === b || next[b] === a;
  for (let i = 0; i < tri.length; i += 3) {
    let [a, b, c] = [tri[i], tri[i + 1], tri[i + 2]];
    const cross = (flat[2 * b] - flat[2 * a]) * (flat[2 * c + 1] - flat[2 * a + 1]) - (flat[2 * b + 1] - flat[2 * a + 1]) * (flat[2 * c] - flat[2 * a]);
    if (cross < 0) [b, c] = [c, b];
    faces.push({ v: [n + a, n + b, n + c], vis: [onRing(a, b), onRing(b, c), onRing(c, a)].map(Number) });
    faces.push({ v: [a, c, b], vis: [onRing(a, c), onRing(c, b), onRing(b, a)].map(Number) });
  }
  return { verts, faces };
}

/**
 * Форма крыши по тегам OSM (roof:shape). Скатные крыши строятся по описанному
 * прямоугольнику и только если контур действительно близок к прямоугольному,
 * иначе крыша остаётся плоской — лучше честно плоская, чем сломанная.
 */
function orientedBox(ring) {
  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of ring) {
      const u = p[0] * ux + p[1] * uy, v = -p[0] * uy + p[1] * ux;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u);
      minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) best = { area, ux, uy, minU, maxU, minV, maxV };
  }
  if (!best) return null;
  const { ux, uy, minU, maxU, minV, maxV } = best;
  const toXY = (u, v) => [u * ux - v * uy, u * uy + v * ux];
  const cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
  let halfU = (maxU - minU) / 2, halfV = (maxV - minV) / 2;
  let axisU = [ux, uy], axisV = [-uy, ux];
  if (halfV > halfU) { // U — длинная сторона
    [halfU, halfV] = [halfV, halfU];
    [axisU, axisV] = [axisV, axisU.map((c) => -c)];
  }
  return { area: best.area, center: toXY(cu, cv), axisU, axisV, halfU, halfV };
}

const ROOF_DEFAULT_H = { conical: 0.5, pyramidal: 0.3, dome: 0.35, onion: 0.4, gabled: 0.28, hipped: 0.26, 'half-hipped': 0.26, gambrel: 0.3, round: 0.3, skillion: 0.22, mansard: 0.28 };

// Если форма крыши не размечена, она угадывается по типу здания:
// мечеть — купол, минарет и башня — конус, церковь — скат. Только для узнаваемых типов.
function guessedShape(t) {
  const b = (t.building ?? '').toLowerCase();
  const religion = (t.religion ?? '').toLowerCase();
  if (b === 'minaret' || t.man_made === 'minaret' || t['building:part'] === 'minaret' || t['tower:type'] === 'minaret' || b === 'tower' || t.man_made === 'tower' || b === 'water_tower') return 'conical';
  if (b === 'mosque' || (t.amenity === 'place_of_worship' && religion === 'muslim')) return 'dome';
  if (/^(church|cathedral|chapel|monastery)$/.test(b) || (t.amenity === 'place_of_worship' && /^(christian|orthodox|catholic)$/.test(religion))) return 'gabled';
  if (b === 'synagogue' || b === 'temple' || b === 'shrine') return 'pyramidal';
  return null;
}

function roofSpec(t, height) {
  let shape = (t['roof:shape'] ?? '').toLowerCase();
  let guessed = false;
  if (!shape || shape === 'flat') {
    if (shape === 'flat') return null;
    shape = guessedShape(t) ?? '';
    guessed = Boolean(shape);
  }
  if (!shape) return null;
  let h = num(t['roof:height']);
  if (h == null && num(t['roof:levels']) != null) h = num(t['roof:levels']) * 2.6;
  if (h == null) h = Math.min(height * 0.45, Math.max(2, height * (ROOF_DEFAULT_H[shape] ?? 0.25)));
  if (guessed) h = Math.min(h, height * 0.4);
  h = Math.max(0.8, Math.min(h, height * 0.8));
  const dir = num(t['roof:direction']);
  return { shape, height: h, guessed, direction: dir, acrossRidge: (t['roof:orientation'] ?? '') === 'across' };
}

// Крыша поверх стен: возвращает вершины и грани в мировых координатах.
function roofGeometry(ring, zw, zt, spec) {
  const verts = [], faces = [];
  const n = ring.length;
  const push = (p) => verts.push(p) - 1;
  const base = ring.map(([x, y]) => push([x, y, zw]));
  const shape = spec.shape;

  if (/^(pyramidal|dome|onion|round|conical)$/.test(shape)) {
    let cx = 0, cy = 0;
    for (const [x, y] of ring) { cx += x; cy += y; }
    cx /= n; cy /= n;
    if (shape === 'pyramidal' || shape === 'conical') {
      const apex = push([cx, cy, zt]);
      for (let i = 0; i < n; i++) faces.push({ v: [base[i], base[(i + 1) % n], apex], vis: [1, 1, 1] });
      return { verts, faces };
    }
    // купол: два яруса по дуге
    const levels = [0.55, 0.85];
    const radii = shape === 'onion' ? [1.05, 0.55] : [0.86, 0.5];
    let prev = base;
    levels.forEach((lv, k) => {
      const ringK = ring.map(([x, y]) => push([cx + (x - cx) * radii[k], cy + (y - cy) * radii[k], zw + (zt - zw) * lv]));
      for (let i = 0; i < n; i++) faces.push({ v: [prev[i], prev[(i + 1) % n], ringK[(i + 1) % n], ringK[i]], vis: [0, 1, 0, 1] });
      prev = ringK;
    });
    const apex = push([cx, cy, zt]);
    for (let i = 0; i < n; i++) faces.push({ v: [prev[i], prev[(i + 1) % n], apex], vis: [0, 1, 1] });
    return { verts, faces };
  }

  const box = orientedBox(ring);
  if (!box) return null;
  const ringArea = Math.abs(signedArea(ring));
  if (ringArea / box.area < 0.82) return null; // контур не прямоугольный — плоская крыша
  const { center, axisU, axisV, halfU, halfV } = box;
  const along = spec.acrossRidge ? axisV : axisU;
  const across = spec.acrossRidge ? axisU : axisV;
  const hAlong = spec.acrossRidge ? halfV : halfU;
  const hAcross = spec.acrossRidge ? halfU : halfV;
  const corner = (a, b) => [center[0] + along[0] * a + across[0] * b, center[1] + along[1] * a + across[1] * b];
  const c = [corner(-hAlong, -hAcross), corner(hAlong, -hAcross), corner(hAlong, hAcross), corner(-hAlong, hAcross)].map((p) => push([p[0], p[1], zw]));

  if (shape === 'skillion') {
    const low = c[0], low2 = c[3];
    const up1 = push([...corner(hAlong, -hAcross), zt]);
    const up2 = push([...corner(hAlong, hAcross), zt]);
    faces.push({ v: [low, up1, up2, low2], vis: [1, 1, 1, 1] });
    faces.push({ v: [low, c[1], up1], vis: [1, 1, 1] });
    faces.push({ v: [low2, up2, c[2]], vis: [1, 1, 1] });
    return { verts, faces };
  }
  if (shape === 'gabled' || shape === 'gambrel' || shape === 'mansard') {
    const r1 = push([...corner(-hAlong, 0), zt]);
    const r2 = push([...corner(hAlong, 0), zt]);
    faces.push({ v: [c[0], c[1], r2, r1], vis: [1, 1, 1, 1] });
    faces.push({ v: [c[2], c[3], r1, r2], vis: [1, 1, 1, 1] });
    faces.push({ v: [c[1], c[2], r2], vis: [1, 1, 1] });
    faces.push({ v: [c[3], c[0], r1], vis: [1, 1, 1] });
    return { verts, faces };
  }
  if (shape === 'hipped' || shape === 'half-hipped') {
    const inset = shape === 'hipped' ? Math.min(hAcross, hAlong * 0.6) : hAlong * 0.25;
    const r1 = push([...corner(-hAlong + inset, 0), zt]);
    const r2 = push([...corner(hAlong - inset, 0), zt]);
    faces.push({ v: [c[0], c[1], r2, r1], vis: [1, 1, 1, 1] });
    faces.push({ v: [c[2], c[3], r1, r2], vis: [1, 1, 1, 1] });
    faces.push({ v: [c[1], c[2], r2], vis: [1, 1, 1] });
    faces.push({ v: [c[3], c[0], r1], vis: [1, 1, 1] });
    return { verts, faces };
  }
  return null;
}

// Купол по центру здания: мечеть — это плоская кровля с куполом, а не купол во весь контур.
function domeOnTop(ring, zTop) {
  const box = orientedBox(ring);
  if (!box) return null;
  const r = Math.min(box.halfU, box.halfV) * 0.78;
  if (r < 2) return null;
  const [cx, cy] = box.center;
  const h = r * 1.15;
  const seg = 24;
  const verts = [], faces = [];
  const circle = (rad, z) => {
    const start = verts.length;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      verts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, z]);
    }
    return Array.from({ length: seg }, (_, i) => start + i);
  };
  const levels = [[1, 0], [0.92, 0.45], [0.62, 0.8]];
  let prev = null;
  for (const [rad, t] of levels) {
    const ringIdx = circle(r * rad, zTop + h * t);
    if (prev) for (let i = 0; i < seg; i++) faces.push({ v: [prev[i], prev[(i + 1) % seg], ringIdx[(i + 1) % seg], ringIdx[i]], vis: [0, 1, 0, 1] });
    prev = ringIdx;
  }
  const apex = verts.push([cx, cy, zTop + h]) - 1;
  for (let i = 0; i < seg; i++) faces.push({ v: [prev[i], prev[(i + 1) % seg], apex], vis: [0, 1, 1] });
  return { verts, faces };
}

// Эстакада: полотно заданной ширины и толщины вдоль оси, с опорами до земли.
const DECK_WIDTH = { motorway: 14, trunk: 12, primary: 10, secondary: 8, tertiary: 7, rail: 6 };
function bridgeDeck(pts, width, ground) {
  const n = pts.length;
  if (n < 2) return null;
  const half = width / 2, thick = 1.2;
  const verts = [], faces = [];
  const side = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    side.push([-dy, dx]);
  }
  // четыре вершины сечения на каждой точке оси: верх слева/справа, низ справа/слева
  for (let i = 0; i < n; i++) {
    const [x, y, z] = pts[i], [sx, sy] = side[i];
    const lx = x + sx * half, ly = y + sy * half, rx = x - sx * half, ry = y - sy * half;
    const bottom = Math.max(Math.min(ground(lx, ly), ground(rx, ry)) + 0.05, z - thick);
    verts.push([lx, ly, z], [rx, ry, z], [rx, ry, bottom], [lx, ly, bottom]);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 4, b = (i + 1) * 4;
    faces.push({ v: [a, a + 1, b + 1, b], vis: [0, 1, 0, 1] });           // верх
    faces.push({ v: [a + 3, b + 3, b + 2, a + 2], vis: [0, 1, 0, 1] });   // низ
    faces.push({ v: [a, b, b + 3, a + 3], vis: [1, 0, 1, 0] });           // левая кромка
    faces.push({ v: [a + 1, a + 2, b + 2, b + 1], vis: [0, 1, 0, 1] });   // правая кромка
  }
  const e = (n - 1) * 4;
  faces.push({ v: [0, 3, 2, 1], vis: [1, 1, 1, 1] });
  faces.push({ v: [e, e + 1, e + 2, e + 3], vis: [1, 1, 1, 1] });
  // опоры каждые ~35 м там, где полотно заметно выше земли
  let walked = 0;
  for (let i = 1; i < n; i++) {
    walked += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (walked < 35 || i === n - 1) continue;
    walked = 0;
    const [x, y, z] = pts[i];
    const g = ground(x, y);
    if (z - thick - g < 2.5) continue;
    const r = Math.min(1.2, half * 0.4);
    const ring = [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]];
    const pier = extrude([ring], g, z - thick);
    const off = verts.length;
    for (const v of pier.verts) verts.push(v);
    for (const f of pier.faces) faces.push({ v: f.v.map((k) => k + off), vis: f.vis });
  }
  return { verts, faces };
}

// Сшивка отрезков мостов одного уровня в непрерывные цепочки.
function chainBridges(parts, tol) {
  const pool = parts.map((p) => ({ ...p, pts: p.pts.slice() }));
  const close = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
  const chains = [];
  while (pool.length) {
    const chain = pool.shift();
    let grown = true;
    while (grown) {
      grown = false;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (Math.abs(p.lift - chain.lift) > 0.5) continue;
        const head = chain.pts[0], tail = chain.pts[chain.pts.length - 1];
        const s0 = p.pts[0], s1 = p.pts[p.pts.length - 1];
        if (close(tail, s0)) chain.pts = chain.pts.concat(p.pts.slice(1));
        else if (close(tail, s1)) chain.pts = chain.pts.concat(p.pts.slice(0, -1).reverse());
        else if (close(head, s1)) chain.pts = p.pts.slice(0, -1).concat(chain.pts);
        else if (close(head, s0)) chain.pts = p.pts.slice(1).reverse().concat(chain.pts);
        else continue;
        chain.width = Math.max(chain.width, p.width);
        pool.splice(i, 1);
        grown = true;
        break;
      }
    }
    chains.push(chain);
  }
  return chains;
}

// Минарет, отмеченный в OSM точкой: восьмигранный ствол, балкон и острый конус.
function minaretBody(x, y, z, height, radius = 1.8) {
  const seg = 8;
  const ring = (r) => Array.from({ length: seg }, (_, i) => {
    const a = (i / seg) * Math.PI * 2 + Math.PI / 8;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r];
  });
  const shaftTop = z + height * 0.78;
  const body = extrude([ring(radius)], z, shaftTop);
  const add = (part) => {
    const off = body.verts.length;
    for (const v of part.verts) body.verts.push(v);
    for (const f of part.faces) body.faces.push({ v: f.v.map((i) => i + off), vis: f.vis });
  };
  add(extrude([ring(radius * 1.45)], shaftTop - height * 0.04, shaftTop)); // балкон шерефе
  const capBase = ring(radius * 0.95);
  const verts = capBase.map(([px, py]) => [px, py, shaftTop]);
  const apex = verts.push([x, y, z + height]) - 1;
  add({ verts, faces: capBase.map((_, i) => ({ v: [i, (i + 1) % seg, apex], vis: [1, 1, 1] })) });
  return body;
}

// Храм, у которого в OSM есть только общая высота (по кресту), а частей нет:
// вместо призмы на всю высоту — основной объём и центральная башня с шатром.
function tallWorshipBody(rings, z0, z1, t) {
  const H = z1 - z0;
  if (t['building:part'] || t['roof:shape'] || num(t.height) == null) return null;
  const b = (t.building ?? '').toLowerCase(), rel = (t.religion ?? '').toLowerCase();
  const worship = /^(church|cathedral|chapel|basilica|temple)$/.test(b) || (t.amenity === 'place_of_worship' && rel !== 'muslim' && b !== 'mosque');
  if (!worship) return null;
  const ring = rings[0];
  const area = Math.abs(signedArea(ring));
  const hb = Math.min(H * 0.45, Math.max(9, Math.sqrt(area) * 0.55));
  if (H < hb * 1.6) return null; // высота и так соразмерна объёму
  const box = orientedBox(ring);
  let [cx, cy] = box?.center ?? [0, 0];
  if (!box || !insideRing([cx, cy], ring)) {
    cx = 0; cy = 0;
    for (const p of ring) { cx += p[0]; cy += p[1]; }
    cx /= ring.length; cy /= ring.length;
    if (!insideRing([cx, cy], ring)) return null;
  }
  const short = box ? Math.min(box.halfU, box.halfV) * 2 : Math.sqrt(area);
  const r = Math.max(2.5, Math.min(9, short * 0.2));
  const { height: _h, ...rest } = t;
  const body = buildingBody(rings, z0, z0 + hb, rest);
  const seg = 8;
  const oct = (rad) => Array.from({ length: seg }, (_, i) => {
    const a = (i / seg) * Math.PI * 2 + Math.PI / 8;
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
  });
  const add = (part) => {
    const off = body.verts.length;
    for (const v of part.verts) body.verts.push(v);
    for (const f of part.faces) body.faces.push({ v: f.v.map((i) => i + off), vis: f.vis });
  };
  const drumTop = z0 + hb + (H - hb) * 0.45;
  add(extrude([oct(r)], z0 + hb * 0.8, drumTop)); // барабан
  const base = oct(r * 1.02);
  const verts = base.map(([x, y]) => [x, y, drumTop]);
  const apex = verts.push([cx, cy, z1]) - 1;
  add({ verts, faces: base.map((_, i) => ({ v: [i, (i + 1) % seg, apex], vis: [1, 1, 1] })) }); // шатёр
  return body;
}

// Тело здания: стены и, если задана форма крыши, скат поверх них.
function buildingBody(rings, z0, z1, tags) {
  const worship = tallWorshipBody(rings, z0, z1, tags);
  if (worship) return worship;
  const spec = roofSpec(tags, z1 - z0);
  if (!spec) return extrude(rings, z0, z1);
  if (spec.guessed && spec.shape === 'dome') {
    const body = extrude(rings, z0, z1);
    const dome = domeOnTop(rings[0], z1);
    if (dome) {
      const off = body.verts.length;
      for (const v of dome.verts) body.verts.push(v);
      for (const f of dome.faces) body.faces.push({ v: f.v.map((i) => i + off), vis: f.vis });
    }
    return body;
  }
  const zw = z1 - spec.height;
  const roof = roofGeometry(rings[0], zw, z1, spec);
  if (!roof) return extrude(rings, z0, z1);
  const body = extrude(rings, z0, zw);
  // верхнюю крышку стен заменяем скатом
  const n = body.verts.length / 2;
  body.faces = body.faces.filter((f) => !(f.v.length === 3 && f.v.every((i) => i >= n)));
  const off = body.verts.length;
  for (const v of roof.verts) body.verts.push(v);
  for (const f of roof.faces) body.faces.push({ v: f.v.map((i) => i + off), vis: f.vis });
  return body;
}

// Горизонтали методом «шагающих квадратов» с последующей сшивкой отрезков.
function contours(grid, interval) {
  const { n, w, heights: h, step, half } = grid;
  const out = [];
  const maxH = grid.maxH;
  for (let level = interval; level < maxH; level += interval) {
    const segs = [];
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        const v = c.map(([a, b]) => h[b * w + a]);
        const pts = [];
        for (let e = 0; e < 4; e++) {
          const a = v[e], b = v[(e + 1) % 4];
          if ((a < level) !== (b < level)) {
            const t = (level - a) / (b - a);
            const [pa, pb] = [c[e], c[(e + 1) % 4]];
            pts.push([(pa[0] + t * (pb[0] - pa[0])) * step - half, (pa[1] + t * (pb[1] - pa[1])) * step - half]);
          }
        }
        if (pts.length === 2) segs.push(pts);
        else if (pts.length === 4) segs.push([pts[0], pts[1]], [pts[2], pts[3]]);
      }
    const key = (p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
    const ends = new Map();
    segs.forEach((s, i) => {
      for (const p of s) { const k = key(p); (ends.get(k) ?? ends.set(k, []).get(k)).push(i); }
    });
    const used = new Uint8Array(segs.length);
    const walk = (line) => {
      for (;;) {
        const k = key(line[line.length - 1]);
        const nextSeg = (ends.get(k) ?? []).find((i) => !used[i]);
        if (nextSeg == null) return;
        used[nextSeg] = 1;
        const s = segs[nextSeg];
        line.push(key(s[0]) === k ? s[1] : s[0]);
      }
    };
    segs.forEach((s, i) => {
      if (used[i]) return;
      used[i] = 1;
      const line = [s[0], s[1]];
      walk(line);
      line.reverse();
      walk(line);
      const closed = line.length > 3 && key(line[0]) === key(line[line.length - 1]);
      if (closed) line.pop();
      out.push({ z: level, closed, pts: line.map((p) => [p[0], p[1], level]) });
    });
  }
  return out;
}

const contourInterval = (range) => (range < 15 ? 1 : range < 40 ? 2 : range < 120 ? 5 : range < 400 ? 10 : 25);

function roadLayer(t) {
  const hw = t.highway;
  if (/^(motorway|trunk|primary|secondary|tertiary)(_link)?$/.test(hw)) return LAYERS.ROADS_MAJOR;
  if (/^(footway|path|cycleway|steps|bridleway|corridor|pedestrian)$/.test(hw)) return LAYERS.PATHS;
  if (/^(proposed|construction|platform|elevator|bus_stop|raceway)$/.test(hw)) return null;
  return LAYERS.ROADS_MINOR;
}

/* ---------- Сборка модели ---------- */

export async function buildModel({ lat, lon, size, shape = 'square', layers, sensitivity = 0.5 }, onStep = () => {}, signal) {
  const frame = makeFrame(lat, lon, size, shape);
  const h = frame.half;
  const warnings = [];

  onStep('status.loading');
  // для проверки запасного источника: localStorage['ue:source'] = 'overture' — сразу Overture, без Overpass
  const forceOverture = (() => { try { return localStorage.getItem('ue:source') === 'overture'; } catch { return false; } })();
  const osmPromise = forceOverture ? Promise.reject(new Error('forced overture')) : fetchOSM(frame, signal);
  osmPromise.catch(() => {}); // ошибка обрабатывается ниже
  // здания Overture (Китай, машинные контуры) — параллельно с OSM, ошибка не мешает сборке
  const extraPromise = layers.buildings && layers.extraBuildings !== false
    ? import('./overture.js?v=4.1').then((m) => m.fetchOvertureBuildings(frame, { signal })).catch(() => null)
    : Promise.resolve(null);
  let elev = null;
  if (layers.terrain) {
    try { elev = await fetchElevation(frame); } catch { warnings.push('status.noTerrain'); }
  }
  const needImagery = layers.satellite || (layers.trees && layers.detect);
  const imageryPromise = needImagery ? fetchImagery(frame).catch(() => null) : Promise.resolve(null);
  // Servidores Overpass pueden estar saturados: fallback automático a OSM Direct API y Overture S3
  let osm, dataSource = 'osm';
  try {
    const wait = 45000;
    osm = await Promise.race([osmPromise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), wait))]);
  } catch (err) {
    if (signal?.aborted) throw err;
    onStep('status.fallback');
    try {
      osm = await fetchDirectOSM(frame, signal);
      dataSource = 'osm';
    } catch (directErr) {
      console.warn('Direct OSM failed, using Overture PMTiles fallback:', directErr);
      osm = await (await import('./overture.js?v=4.1')).fetchOvertureOSM(frame, { signal });
      dataSource = 'overture';
    }
  }
  onStep('status.geometry');

  // дополнение не должно задерживать модель: ждём его не дольше 20 с
  // в режиме Overture здания уже оттуда — дополнять нечем
  let extra = dataSource === 'osm' ? await Promise.race([extraPromise, new Promise((r) => setTimeout(() => r(null), 20000))]) : null;
  if (extra?.length) extra = dropCoveredByOSM(extra, osm, frame);
  const masks = elev && elev.source !== 'dtm' ? surfaceMasks(osm, frame) : [];
  if (masks && extra) for (const e of extra) masks.push({ ring: e.rings[0], buffer: 12 });
  const grid = buildGrid(frame, elev, masks);
  const ground = grid.heightAt;
  const local = (g) => g.map((p) => frame.toLocal(p.lat, p.lon));

  const model = {
    id: `${lat.toFixed(5)}_${lon.toFixed(5)}_${size}_${shape}`,
    center: { lat, lon }, size, shape, frame, grid, warnings,
    buildings: [], lines: {}, areas: {}, water: [], bridges: [], contours: [], terrain: null, trees: [], imagery: null,
  };
  const osmTrees = [];
  const footprints = [], parts = [], minarets = [], bridgeParts = [];
  // дороги реальной ширины: оси собираются с запасом за рамку, чтобы у края не было скруглённых торцов
  const wideRoads = Boolean(layers.roads && layers.roadWidth);
  const R = wideRoads ? await import('./roads.js?v=4.1').catch(() => null) : null;
  if (wideRoads && !R) warnings.push('status.noRoadWidth');
  const padFrame = makeFrame(lat, lon, size + 80, shape);
  const roadSegs = [];
  const coastWays = []; // береговая линия → полигоны моря после разбора
  const addLine = (layer, pts) => (model.lines[layer] ??= []).push(pts);
  const addArea = (layer, ring) => (model.areas[layer] ??= []).push(ring);

  for (const el of osm.elements ?? []) {
    const t = el.tags ?? {};

    // --- Минареты, отмеченные точкой ---
    if (el.type === 'node' && (t.man_made === 'minaret' || t['tower:type'] === 'minaret')) {
      if (!layers.buildings) continue;
      const [x, y] = frame.toLocal(el.lat, el.lon);
      if (frame.inside(x, y)) minarets.push({ x, y, height: num(t.height) ?? 40, name: `osm-node-${el.id}` });
      continue;
    }

    // --- Деревья OSM: отдельные и аллеи ---
    if (t.natural === 'tree' || t.natural === 'tree_row') {
      if (!layers.trees) continue;
      const crown = (num(t.diameter_crown) ?? 6) / 2;
      const height = num(t.height);
      const place = (x, y) => {
        if (!frame.inside(x, y)) return;
        osmTrees.push({ x, y, r: Math.min(8, Math.max(1.5, crown)), h: height ?? Math.min(20, Math.max(5, crown * 2.8)), src: 'osm' });
      };
      if (el.type === 'node') place(...frame.toLocal(el.lat, el.lon));
      else if (el.geometry) for (const part of clipLine(local(el.geometry), frame)) for (const [x, y] of densify(part, 8)) place(x, y);
      continue;
    }

    // --- Здания и их 3D-части ---
    const isPart = Boolean(t['building:part']) && t['building:part'] !== 'no';
    if ((t.building || isPart || t.man_made === 'minaret') && layers.buildings && t.building !== 'no' && t.location !== 'underground') {
      let polys = [];
      if (el.type === 'way' && el.geometry) polys = [[local(el.geometry)]];
      else if (el.type === 'relation' && el.members) {
        const outer = joinWays(el.members.filter((m) => (m.role === 'outer' || m.role === 'outline' || m.role === '') && m.geometry).map((m) => local(m.geometry)));
        const inner = joinWays(el.members.filter((m) => m.role === 'inner' && m.geometry).map((m) => local(m.geometry)));
        polys = outer.map((o) => [o, ...inner]);
      }
      const { base, top } = buildingHeight(t);
      for (const poly of polys) {
        let outer = clipRing(cleanRing(poly[0]), frame);
        if (outer.length < 3 || Math.abs(signedArea(outer)) < 1) continue;
        if (signedArea(outer) < 0) outer = outer.slice().reverse();
        const holes = poly
          .slice(1)
          .map((r) => clipRing(cleanRing(r), frame))
          .filter((r) => r.length >= 3 && Math.abs(signedArea(r)) > 0.5 && insideRing(r[0], outer))
          .map((r) => (signedArea(r) > 0 ? r.slice().reverse() : r));
        const rings = [outer, ...holes];
        let z = Infinity;
        for (const p of rings[0]) z = Math.min(z, ground(p[0], p[1]));
        const target = isPart ? parts : footprints;
        target.push({ name: `osm-${el.type}-${el.id}`, rings, tags: t, base, top, ground: z });
      }
      continue;
    }

    if (el.type !== 'way' && el.type !== 'relation') continue;

    // --- Дороги, ж/д, водотоки, береговая линия ---
    const closed = el.geometry && el.geometry.length > 3
      && Math.abs(el.geometry[0].lat - el.geometry.at(-1).lat) < 1e-9
      && Math.abs(el.geometry[0].lon - el.geometry.at(-1).lon) < 1e-9;
    const waterArea = t.natural === 'water' || t.water || /^(riverbank|dock)$/.test(t.waterway ?? '') || /^(reservoir|basin)$/.test(t.landuse ?? '');
    const greenArea = /^(park|garden)$/.test(t.leisure ?? '')
      || /^(grass|forest|meadow|recreation_ground|village_green|cemetery|allotments)$/.test(t.landuse ?? '')
      || /^(wood|scrub|grassland|heath)$/.test(t.natural ?? '');
    const isArea = (waterArea || greenArea) && (el.type === 'relation' || closed || t.area === 'yes');

    // море задано не полигоном, а береговой линией: собираем её и строим воду после разбора
    if (t.natural === 'coastline') {
      if (layers.nature && el.geometry) coastWays.push(local(el.geometry));
      continue;
    }

    if (!isArea) {
      const lineLayer = t.highway ? (layers.roads ? roadLayer(t) : null)
        : t.railway ? (layers.roads ? LAYERS.RAILWAYS : null)
        : (t.waterway || t.natural === 'coastline') ? (layers.nature ? LAYERS.WATER : null)
        : null;
      if (lineLayer && el.geometry) {
        // эстакады и тоннели: layer из OSM даёт этажность развязки
        const layerNo = num(t.layer) ?? 0;
        const bridge = t.bridge && t.bridge !== 'no' && layers.bridges !== false;
        const tunnel = t.tunnel && t.tunnel !== 'no';
        if (tunnel && layerNo < 0) continue; // подземное в модель не выводим
        const lift = bridge ? Math.max(5, Math.abs(layerNo || 1) * 5) : 0;
        const kind = (t.highway ?? '').replace('_link', '') || (t.railway ? 'rail' : '');
        if (R && t.highway && !bridge && !tunnel) {
          const isPath = R.PATH_KINDS.test(t.highway);
          if (t.area === 'yes' && closed) roadSegs.push({ pts: local(el.geometry), area: true, path: isPath });
          else for (const part of clipLine(local(el.geometry), padFrame)) roadSegs.push({ pts: part, width: R.roadWidth(t), path: isPath });
        }
        for (const part of clipLine(local(el.geometry), frame)) {
          // мосты собираются в цепочки после разбора: в OSM один мост часто нарезан на несколько отрезков
          if (bridge) { bridgeParts.push({ pts: part, lift, width: DECK_WIDTH[kind] ?? 6 }); continue; }
          addLine(lineLayer, densify(part, grid.step).map(([x, y]) => [x, y, ground(x, y)]));
        }
        continue;
      }
    }

    // --- Вода и зелень ---
    if (!layers.nature || !isArea) continue;
    const areaLayer = waterArea ? LAYERS.WATER : LAYERS.GREEN;
    let rings = [], inners = [];
    if (el.type === 'way' && el.geometry) rings = [local(el.geometry)];
    else if (el.members) {
      rings = joinWays(el.members.filter((mm) => mm.geometry && mm.role !== 'inner').map((mm) => local(mm.geometry)));
      // острова внутри водоёма (крепость во рву, остров в гавани) — дыры, а не вода
      if (areaLayer === LAYERS.WATER) inners = joinWays(el.members.filter((mm) => mm.geometry && mm.role === 'inner').map((mm) => local(mm.geometry)));
    }
    for (const r of rings) {
      // все внешние контуры обходятся против часовой, дыры — по часовой: перекрытия не гасят заливку
      const c = ccw(clipRing(cleanRing(r), frame));
      if (c.length < 3 || Math.abs(signedArea(c)) < 4) continue;
      const dense = densify([...c, c[0]], grid.step).slice(0, -1);
      if (areaLayer === LAYERS.WATER) {
        // гладь воды — горизонтальная поверхность по низкой отметке берега
        const zs = c.map((p) => ground(p[0], p[1])).sort((a, b) => a - b);
        const z = zs[Math.floor(zs.length * 0.15)] + 0.3; // чуть выше рельефа, чтобы не мерцало
        const holes = inners.map((hr) => cw(clipRing(cleanRing(hr), frame))).filter((hr) => hr.length >= 3 && Math.abs(signedArea(hr)) > 1 && insideRing(hr[0], c));
        const flat = [dense, ...holes.map((hr) => densify([...hr, hr[0]], grid.step).slice(0, -1))].map((ring) => ring.map(([x, y]) => [x, y, z]));
        for (const ring of flat) addArea(areaLayer, ring);
        model.water.push({ ring: c, z, ...(holes.length ? areaMesh([flat]) : flatMesh(c, z)) });
      } else {
        addArea(areaLayer, dense.map(([x, y]) => [x, y, ground(x, y) + 0.2]));
      }
    }
  }

  // --- Здания Overture: высота из данных (этажность), иначе типовая по площади ---
  let extraCount = 0;
  for (const e of extra ?? []) {
    let outer = clipRing(cleanRing(e.rings[0]), frame);
    if (outer.length < 3 || Math.abs(signedArea(outer)) < 8) continue;
    if (signedArea(outer) < 0) outer = outer.slice().reverse();
    const holes = e.rings.slice(1).map((r) => clipRing(cleanRing(r), frame))
      .filter((r) => r.length >= 3 && Math.abs(signedArea(r)) > 0.5 && insideRing(r[0], outer))
      .map((r) => (signedArea(r) > 0 ? r.slice().reverse() : r));
    let z = Infinity;
    for (const p of outer) z = Math.min(z, ground(p[0], p[1]));
    const a = Math.abs(signedArea(outer));
    // модели поверхности (GLO-30) высоту не доверяем: в Шэньчжэне башни 200 м дают в ней бугры до 9 м
    const top = e.height ?? (e.floors ? e.floors * LEVEL_HEIGHT : null) ?? (a < 60 ? 4.5 : a < 400 ? 9.6 : a < 2000 ? 16 : 12);
    footprints.push({ name: `overture-${e.id}`, rings: [outer, ...holes], tags: { building: e.cls ?? 'yes' }, base: Math.min(e.minHeight, top - 1), top, ground: z });
    extraCount++;
  }

  // --- Море: полигоны из береговой линии; гладь — по низкой отметке берега ---
  if (coastWays.length) {
    let sea = [];
    try { sea = (await import('./roads.js?v=4.1')).seaPolygons(coastWays, frame); } catch { sea = []; }
    for (const rings of sea) {
      const zs = rings[0].map(([x, y]) => ground(x, y)).sort((a, b) => a - b);
      const z = zs[Math.floor(zs.length * 0.1)] + 0.3;
      const flat = rings.map((r) => densify([...r, r[0]], grid.step).slice(0, -1).map(([x, y]) => [x, y, z]));
      for (const r of flat) addArea(LAYERS.WATER, r); // внешний контур и острова (обратный обход)
      model.water.push({ ring: rings[0], z, ...areaMesh([flat]) });
    }
    // построить море не вышло (неполные данные) — берег остаётся линией, как раньше
    if (!sea.length) for (const w of coastWays) for (const part of clipLine(w, frame)) addLine(LAYERS.WATER, densify(part, grid.step).map(([x, y]) => [x, y, ground(x, y)]));
  }

  // --- Здания: если у здания есть 3D-части, оно собирается из них ---
  const bbox = (rings) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of rings[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return [x0, y0, x1, y1];
  };
  const centroid = (ring) => {
    let x = 0, y = 0;
    for (const p of ring) { x += p[0]; y += p[1]; }
    return [x / ring.length, y / ring.length];
  };
  const boxes = footprints.map((f) => bbox(f.rings));
  const partArea = new Map();
  for (const part of parts) {
    const c = centroid(part.rings[0]);
    for (let i = 0; i < footprints.length; i++) {
      const [x0, y0, x1, y1] = boxes[i];
      if (c[0] < x0 || c[0] > x1 || c[1] < y0 || c[1] > y1) continue;
      if (!insideRing(c, footprints[i].rings[0])) continue;
      part.parent = footprints[i];
      partArea.set(footprints[i], (partArea.get(footprints[i]) ?? 0) + Math.abs(signedArea(part.rings[0])));
      break;
    }
  }
  // Здание заменяется частями, только если они покрывают его почти целиком.
  // Иначе (башня или купол над торговым центром) остаются и основной объём, и части.
  const hasParts = new Set();
  for (const [f, area] of partArea) if (area >= Math.abs(signedArea(f.rings[0])) * 0.6) hasParts.add(f);
  for (const f of [...footprints.filter((x) => !hasParts.has(x)), ...parts]) {
    const owner = f.parent ?? f;
    const z = f.ground;
    const body = buildingBody(f.rings, z + f.base, z + f.top, f.tags);
    const tags = owner.tags || {};
    let subtype = 'other';
    const amenity = (tags.amenity || '').toLowerCase();
    const bldgTag = (tags.building || '').toLowerCase();
    if (/^(school|university|college|kindergarten|research_institute)$/.test(amenity) || /^(school|university|college|kindergarten)$/.test(bldgTag)) {
      subtype = 'education';
    } else if (/^(hospital|clinic|doctors|pharmacy|dentist)$/.test(amenity) || /^(hospital|clinic)$/.test(bldgTag)) {
      subtype = 'health';
    } else if (tags.shop || /^(commercial|retail|supermarket|kiosk|office|hotel|motel|restaurant|bank|atm)$/.test(bldgTag) || /^(restaurant|cafe|fast_food|bank|atm)$/.test(amenity)) {
      subtype = 'commercial';
    } else if (/^(house|detached|residential|apartments|terrace|dormitory)$/.test(bldgTag) || (tags['building:use'] || '').toLowerCase() === 'residential') {
      subtype = 'residential';
    } else if (/^(industrial|warehouse|factory|works)$/.test(bldgTag) || tags.industrial) {
      subtype = 'industrial';
    }
    model.buildings.push({ name: f.name, height: f.top, cls: buildingClass(owner.tags), subtype, tags, rings: f.rings, ...body });
  }

  // --- Эстакады: отрезки одного уровня сшиваются в цепочки (зазоры до 3 м).
  // Высота над землёй вдоль цепочки — профиль с уклоном не круче 11 %:
  // свободный конец опускается к земле, конец у другой эстакады (любого яруса) встаёт на её высоту,
  // конец у края участка остаётся на полной высоте. Короткий мостик даёт небольшой горб, а не «пик».
  const chains = chainBridges(bridgeParts, 3);
  const SLOPE = 1 / 9;
  const nearEdge = ([x, y]) => frame.planes.some(([nx, ny, d]) => d - (nx * x + ny * y) < 1.5);
  // Каждая цепочка — точки, расстояния вдоль неё и высота над землёй в каждой точке
  for (const c of chains) {
    c.flat = densify(c.pts, grid.step);
    c.dist = [0];
    for (let i = 1; i < c.flat.length; i++) c.dist.push(c.dist[i - 1] + Math.hypot(c.flat[i][0] - c.flat[i - 1][0], c.flat[i][1] - c.flat[i - 1][1]));
    c.liftAt = c.flat.map(() => c.lift);
    // основание — земля, но над оврагом или каналом — прямая между берегами, без провала посередине
    const L = c.dist.at(-1);
    const g0 = ground(c.flat[0][0], c.flat[0][1]), g1 = ground(c.flat.at(-1)[0], c.flat.at(-1)[1]);
    c.base = c.flat.map(([x, y], i) => Math.max(ground(x, y), g0 + (g1 - g0) * (L ? c.dist[i] / L : 0)));
  }
  // Соседняя эстакада, в которую конец вливается: в пределах 6 м и почти по ходу (до 45°) или конец к концу.
  // Эстакада, просто проходящая над или под концом, соседом не считается.
  const joinLift = (self, atStart) => {
    const p = atStart ? self.flat[0] : self.flat.at(-1);
    const q = atStart ? self.flat[Math.min(1, self.flat.length - 1)] : self.flat.at(-2) ?? p;
    const dir = [q[0] - p[0], q[1] - p[1]];
    const dl = Math.hypot(...dir) || 1;
    let best = null, bd = 6;
    for (const c of chains) {
      if (c === self) continue;
      for (let i = 0; i < c.flat.length - 1; i++) {
        const a = c.flat[i], b = c.flat[i + 1];
        const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
        const d = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
        if (d >= bd) continue;
        const endToEnd = (i === 0 && t === 0) || (i === c.flat.length - 2 && t === 1);
        const cos = Math.abs(dir[0] * dx + dir[1] * dy) / (dl * Math.sqrt(l2));
        if (!endToEnd && cos < Math.cos((45 * Math.PI) / 180)) continue;
        bd = d;
        // абсолютная отметка соседа в точке стыка
        best = c.base[i] + c.liftAt[i] + (c.base[i + 1] + c.liftAt[i + 1] - c.base[i] - c.liftAt[i]) * t;
      }
    }
    return best;
  };
  // Профиль: полная высота, но с уклоном не круче 11 % к заданным высотам концов.
  // Свободный конец — к земле, конец у края участка — на полной высоте, у соседа — на его высоте.
  // Два прохода: во втором концы равняются на уже посчитанные профили соседей.
  for (let pass = 0; pass < 2; pass++)
    for (const c of chains) {
      const target = (atStart) => {
        const p = atStart ? c.flat[0] : c.flat.at(-1);
        const z = joinLift(c, atStart);
        if (z != null) return z - (atStart ? c.base[0] : c.base.at(-1));
        return nearEdge(p) ? c.lift : 0;
      };
      const a = target(true), b = target(false), L = c.dist.at(-1);
      // короткая перемычка между разными высотами: стык важнее уклона — прямая от a к b
      if (Math.abs(a - b) > L * SLOPE) { c.liftAt = c.dist.map((s) => a + (b - a) * (L ? s / L : 0)); continue; }
      c.liftAt = c.dist.map((s) => {
        const lo = Math.max(a - s * SLOPE, b - (L - s) * SLOPE);
        const hi = Math.min(a + s * SLOPE, b + (L - s) * SLOPE);
        return Math.min(hi, Math.max(lo, c.lift));
      });
    }
  for (const c of chains) {
    const pts = c.flat.map(([x, y], i) => [x, y, c.base[i] + c.liftAt[i]]);
    addLine(LAYERS.BRIDGES, pts);
    const deck = bridgeDeck(pts, c.width, ground);
    if (deck) model.bridges.push(deck);
  }

  for (const mn of minarets) {
    const body = minaretBody(mn.x, mn.y, ground(mn.x, mn.y), mn.height);
    model.buildings.push({ name: mn.name, height: mn.height, cls: 'public', rings: [body.verts.slice(0, 8).map((v) => [v[0], v[1]])], ...body });
  }

  // --- Спутник и распознанные деревья ---
  if (needImagery) {
    onStep('status.imagery');
    model.imagery = await imageryPromise;
    if (!model.imagery) warnings.push('status.noImagery');
  }
  const ROAD_WIDTH = { [LAYERS.ROADS_MAJOR]: 9, [LAYERS.ROADS_MINOR]: 5 };
  model.detection = {
    imagery: model.imagery,
    osmTrees,
    ground,
    enabled: Boolean(layers.trees && layers.detect && model.imagery),
    exclude: [...model.buildings.map((b) => b.rings[0]), ...(model.areas[LAYERS.WATER] ?? [])],
    excludeLines: Object.entries(ROAD_WIDTH).flatMap(([layer, width]) => (model.lines[layer] ?? []).map((pts) => ({ pts, width }))),
  };
  if (model.detection.enabled) {
    onStep('status.trees');
    await new Promise((r) => setTimeout(r, 30)); // дать интерфейсу обновиться
  }
  redetectTrees(model, sensitivity);
  if (!layers.satellite) model.imagery = null;

  model.terrain = terrainMesh(frame, grid, Boolean(elev));
  if (elev && layers.contours && grid.maxH > 0.5) {
    model.contourInterval = contourInterval(grid.maxH);
    model.contours = contours(grid, model.contourInterval).flatMap((c) =>
      clipLine(c.closed ? [...c.pts, c.pts[0]] : c.pts, frame).map((pts) => ({ z: c.z, closed: false, pts: pts.map(([x, y]) => [x, y, c.z]) })));
  }

  model.extraBuildings = extraCount;
  model.dataSource = dataSource;
  model.stats = {
    buildings: model.buildings.length,
    roadsKm: Object.entries(model.lines)
      .filter(([k]) => k !== LAYERS.WATER)
      .flatMap(([, ls]) => ls)
      .reduce((s, l) => s + l.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0), 0), 0) / 1000,
    relief: grid.maxH,
    trees: model.trees.length,
    classes: model.buildings.reduce((acc, b) => ({ ...acc, [b.cls]: (acc[b.cls] ?? 0) + 1 }), {}),
  };
  return model;
}

// Пересчёт распознанных деревьев с новой чувствительностью — без повторной загрузки данных.
export function redetectTrees(model, sensitivity) {
  const d = model.detection;
  let trees = d.osmTrees;
  if (d.enabled) {
    const found = detectTrees(d.imagery, model.frame, { exclude: d.exclude, excludeLines: d.excludeLines, sensitivity });
    const near = (a) => d.osmTrees.some((b) => Math.hypot(a.x - b.x, a.y - b.y) < Math.max(3, b.r));
    const inFrame = found.filter((t) => model.frame.inside(t.x, t.y));
    trees = d.osmTrees.concat(d.osmTrees.length ? inFrame.filter((t) => !near(t)) : inFrame).slice(0, MAX_TREES);
  }
  model.trees = trees.map((t) => ({ ...t, z: d.ground(t.x, t.y) }));
  if (model.stats) model.stats.trees = model.trees.length;
  return model;
}

// Здания Overture, которые уже есть в OSM (центр одного внутри другого), отбрасываются.
function dropCoveredByOSM(extra, osm, frame) {
  const CELL = 60;
  const index = new Map();
  const key = (x, y) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
  const centre = (r) => { let x = 0, y = 0; for (const p of r) { x += p[0]; y += p[1]; } return [x / r.length, y / r.length]; };
  for (const el of osm.elements ?? []) {
    const t = el.tags ?? {};
    if (!(t.building || t['building:part']) || t.building === 'no' || el.type !== 'way' || !el.geometry) continue;
    const ring = el.geometry.map((p) => frame.toLocal(p.lat, p.lon));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of ring) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const item = { ring, c: centre(ring) };
    for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++)
      for (let gy = Math.floor(y0 / CELL); gy <= Math.floor(y1 / CELL); gy++) {
        const k = `${gx},${gy}`;
        if (!index.has(k)) index.set(k, []);
        index.get(k).push(item);
      }
  }
  return extra.filter((e) => {
    const c = centre(e.rings[0]);
    for (const o of index.get(key(...c)) ?? []) if (insideRing(c, o.ring) || insideRing(o.c, e.rings[0])) return false;
    return true;
  });
}

// направление обхода: внешние контуры — против часовой, дыры — по часовой
const ccw = (r) => (signedArea(r) >= 0 ? r : r.slice().reverse());
const cw = (r) => (signedArea(r) <= 0 ? r : r.slice().reverse());

// Многоугольники с дырами, уложенные на рельеф (z у каждой вершины), — одной сеткой.
function areaMesh(polys) {
  const verts = [], faces = [];
  for (const rings of polys) {
    const flat = [], holes = [], base = verts.length, ringOf = [], start = [], len = [];
    rings.forEach((r, k) => {
      if (flat.length) holes.push(flat.length / 2);
      start.push(flat.length / 2); len.push(r.length);
      for (const p of r) { flat.push(p[0], p[1]); verts.push(p); ringOf.push(k); }
    });
    // видимы только рёбра контура, а не диагонали триангуляции
    const edge = (a, b) => {
      if (ringOf[a] !== ringOf[b]) return 0;
      const k = ringOf[a], n = len[k], ia = a - start[k], ib = b - start[k];
      return (ib - ia + n) % n === 1 || (ia - ib + n) % n === 1 ? 1 : 0;
    };
    const tri = earcut(flat, holes, 2);
    for (let i = 0; i < tri.length; i += 3) {
      const [a, b, c] = [tri[i], tri[i + 1], tri[i + 2]];
      faces.push({ v: [base + a, base + b, base + c], vis: [edge(a, b), edge(b, c), edge(c, a)] });
    }
  }
  return { verts, faces };
}

// Плоский многоугольник (гладь воды) как сетка.
function flatMesh(ring, z) {
  const flat = [];
  for (const [x, y] of ring) flat.push(x, y);
  const tri = earcut(flat, [], 2);
  const verts = ring.map(([x, y]) => [x, y, z]);
  const faces = [];
  const n = ring.length;
  for (let i = 0; i < tri.length; i += 3) {
    let [a, b, c] = [tri[i], tri[i + 1], tri[i + 2]];
    const cross = (flat[2 * b] - flat[2 * a]) * (flat[2 * c + 1] - flat[2 * a + 1]) - (flat[2 * b + 1] - flat[2 * a + 1]) * (flat[2 * c] - flat[2 * a]);
    if (cross < 0) [b, c] = [c, b];
    const onRing = (i1, i2) => (i1 + 1) % n === i2 || (i2 + 1) % n === i1;
    faces.push({ v: [a, b, c], vis: [onRing(a, b), onRing(b, c), onRing(c, a)].map(Number) });
  }
  return { verts, faces };
}

// Поверхность рельефа: прямоугольная сетка для квадрата, полярная — для круга (ровный край).
function terrainMesh(frame, grid, hasElevation) {
  const h = frame.half;
  const z = hasElevation ? grid.heightAt : () => 0;
  if (frame.shape === 'circle') {
    const rings = Math.max(8, Math.min(120, Math.round(grid.n * 0.6)));
    const sectors = 128;
    const verts = [[0, 0, z(0, 0)]];
    for (let r = 1; r <= rings; r++)
      for (let a = 0; a < sectors; a++) {
        const ang = (a / sectors) * 2 * Math.PI, rad = (r / rings) * h;
        verts.push([Math.cos(ang) * rad, Math.sin(ang) * rad, z(Math.cos(ang) * rad, Math.sin(ang) * rad)]);
      }
    const idx = (r, a) => 1 + (r - 1) * sectors + ((a % sectors) + sectors) % sectors;
    const faces = [];
    for (let a = 0; a < sectors; a++) faces.push({ v: [0, idx(1, a), idx(1, a + 1)], vis: [0, 1, 0] });
    for (let r = 1; r < rings; r++)
      for (let a = 0; a < sectors; a++)
        faces.push({ v: [idx(r, a), idx(r + 1, a), idx(r + 1, a + 1), idx(r, a + 1)], vis: [0, r === rings - 1 ? 1 : 0, 0, 0] });
    return { verts, faces, boundary: Array.from({ length: sectors }, (_, a) => idx(rings, a)) };
  }
  if (!hasElevation) return { verts: [[-h, -h, 0], [h, -h, 0], [h, h, 0], [-h, h, 0]], faces: [{ v: [0, 1, 2, 3], vis: [1, 1, 1, 1] }], boundary: [0, 1, 2, 3] };
  const { n, w, step, heights } = grid;
  const verts = [];
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) verts.push([i * step - h, j * step - h, heights[j * w + i]]);
  const faces = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++)
      faces.push({ v: [j * w + i, j * w + i + 1, (j + 1) * w + i + 1, (j + 1) * w + i], vis: [j === 0 ? 1 : 0, i === n - 1 ? 1 : 0, j === n - 1 ? 1 : 0, i === 0 ? 1 : 0] });
  const boundary = [];
  for (let i = 0; i < n; i++) boundary.push(i);
  for (let j = 0; j < n; j++) boundary.push(j * w + n);
  for (let i = n; i > 0; i--) boundary.push(n * w + i);
  for (let j = n; j > 0; j--) boundary.push(j * w);
  return { verts, faces, boundary };
}

// Треугольники грани (четырёхугольник делится на два).
export function triangulate(faces) {
  const out = [];
  for (const { v } of faces) {
    out.push(v[0], v[1], v[2]);
    if (v.length === 4) out.push(v[0], v[2], v[3]);
  }
  return out;
}

// Условное дерево: ствол (трёхгранная призма) и крона (шестигранная бипирамида).
// Размеры единичные: крона радиусом 1, высота 1 — масштабируется по r и h.
export const UNIT_TREE = (() => {
  const verts = [], faces = [];
  const tr = 0.07;
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; verts.push([Math.cos(a) * tr, Math.sin(a) * tr, 0]); }
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; verts.push([Math.cos(a) * tr, Math.sin(a) * tr, 0.38]); }
  for (let k = 0; k < 3; k++) faces.push({ v: [k, (k + 1) % 3, 3 + ((k + 1) % 3), 3 + k], vis: [1, 1, 1, 1] });
  faces.push({ v: [0, 2, 1], vis: [0, 0, 0] }); // дно ствола — тело замкнуто для 3D-печати
  const base = verts.length;
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; verts.push([Math.cos(a), Math.sin(a), 0.62]); }
  const bottom = verts.push([0, 0, 0.3]) - 1, top = verts.push([0, 0, 1]) - 1;
  for (let k = 0; k < 6; k++) {
    const a = base + k, b = base + ((k + 1) % 6);
    faces.push({ v: [a, b, top], vis: [1, 1, 1] });
    faces.push({ v: [b, a, bottom], vis: [1, 1, 1] });
  }
  return { verts, faces };
})();

export function treeBody(t) {
  return {
    verts: UNIT_TREE.verts.map(([x, y, z]) => [t.x + x * t.r, t.y + y * t.r, t.z + z * t.h]),
    faces: UNIT_TREE.faces,
  };
}

// Несколько тел в одну сетку (для DAE/3DM, где тысячи отдельных объектов неудобны).
export function mergeBodies(bodies) {
  const verts = [], faces = [];
  for (const b of bodies) {
    const off = verts.length;
    for (const v of b.verts) verts.push(v);
    for (const f of b.faces) faces.push({ v: f.v.map((i) => i + off), vis: f.vis });
  }
  return { verts, faces };
}
