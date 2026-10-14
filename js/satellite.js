// Спутниковый снимок участка (Esri World Imagery) и распознавание крон деревьев по нему.
const IMAGERY_URL = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const MAX_PX = 4096;
export const MAX_TREES = 30000;

const lonToPx = (lon, z) => ((lon + 180) / 360) * 256 * 2 ** z;
const latToPx = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * 2 ** z;
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('imagery'));
    img.src = url;
  });
}

// Снимок ровно по рамке участка: квадрат N×N пикселей, верх — север.
export async function fetchImagery(frame) {
  const cosLat = Math.cos((frame.lat * Math.PI) / 180);
  let z = 18;
  while (z > 12 && frame.size / ((156543.03 * cosLat) / 2 ** z) > MAX_PX) z--;
  const px0 = lonToPx(frame.west, z), px1 = lonToPx(frame.east, z);
  const py0 = latToPx(frame.north, z), py1 = latToPx(frame.south, z);
  const tx0 = Math.floor(px0 / 256), tx1 = Math.floor(px1 / 256);
  const ty0 = Math.floor(py0 / 256), ty1 = Math.floor(py1 / 256);

  const mosaic = document.createElement('canvas');
  mosaic.width = (tx1 - tx0 + 1) * 256;
  mosaic.height = (ty1 - ty0 + 1) * 256;
  const mctx = mosaic.getContext('2d');
  const queue = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) queue.push([tx, ty]);
  let failed = 0;
  const worker = async () => {
    while (queue.length) {
      const [tx, ty] = queue.shift();
      try {
        mctx.drawImage(await loadImage(IMAGERY_URL(z, tx, ty)), (tx - tx0) * 256, (ty - ty0) * 256);
      } catch {
        try {
          // Retry with lower zoom level tile if high zoom is unavailable
          const img2 = await loadImage(IMAGERY_URL(z - 1, Math.floor(tx / 2), Math.floor(ty / 2)));
          mctx.drawImage(img2, (tx % 2) * 128, (ty % 2) * 128, 128, 128, (tx - tx0) * 256, (ty - ty0) * 256, 256, 256);
        } catch {
          failed++;
        }
      }
    }
  };
  const total = queue.length;
  await Promise.all(Array.from({ length: 12 }, worker));
  if (failed > total * 0.7) throw new Error('imagery');

  const n = Math.round(Math.max(px1 - px0, py1 - py0));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mosaic, px0 - tx0 * 256, py0 - ty0 * 256, px1 - px0, py1 - py0, 0, 0, n, n);
  return { canvas, zoom: z, metersPerPixel: frame.size / n };
}

/**
 * Кроны деревьев по снимку.
 * 1. Растительность — индекс избыточного зелёного (ExG) по нормированным каналам.
 * 2. Деревья отделяются от газона текстурой (разброс яркости в окне ~5 м) и тенью: крона пёстрая и темнее травы.
 * 3. Здания и вода вырезаются по контурам OSM, проезжая часть — по осям дорог (там стоят машины).
 * 4. Карта расстояний до края маски: центр кроны — локальный максимум, радиус — значение расстояния.
 * Чувствительность 0…1 сдвигает пороги: выше — больше мелких и светлых крон, ниже — только уверенные.
 */
// Детерминированный шум: при повторном распознавании деревья не «прыгают».
const noise = (x, y) => (((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % 1000) / 1000;

export function detectTrees(imagery, frame, { exclude = [], excludeLines = [], sensitivity = 0.5 } = {}) {
  const lerp = (a, b) => a + (b - a) * Math.min(1, Math.max(0, sensitivity));
  const EXG = lerp(0.11, 0.025), STD = lerp(20, 7), DARK = lerp(50, 90), BLUE = lerp(1.12, 1.0);
  const size = frame.size, h = frame.half;
  const cell = Math.max(0.8, size / 2000); // метров на ячейку анализа
  const m = Math.round(size / cell);
  const cv = document.createElement('canvas');
  cv.width = cv.height = m;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imagery.canvas, 0, 0, m, m);
  const { data } = ctx.getImageData(0, 0, m, m);

  // маска исключений: здания, вода
  const ex = document.createElement('canvas');
  ex.width = ex.height = m;
  const ectx = ex.getContext('2d', { willReadFrequently: true });
  ectx.fillStyle = '#fff';
  ectx.beginPath();
  for (const ring of exclude) {
    ring.forEach(([x, y], i) => {
      const px = ((x + h) / size) * m, py = ((h - y) / size) * m;
      i ? ectx.lineTo(px, py) : ectx.moveTo(px, py);
    });
    ectx.closePath();
  }
  // nonzero: контуры обходятся согласованно (внешние против часовой, дыры по часовой),
  // поэтому перекрывающиеся водоёмы и здания складываются, а острова остаются сушей
  ectx.fill('nonzero');
  ectx.strokeStyle = '#fff';
  ectx.lineCap = ectx.lineJoin = 'round';
  for (const { pts, width } of excludeLines) {
    ectx.lineWidth = width / cell;
    ectx.beginPath();
    pts.forEach(([x, y], i) => {
      const px = ((x + h) / size) * m, py = ((h - y) / size) * m;
      i ? ectx.lineTo(px, py) : ectx.moveTo(px, py);
    });
    ectx.stroke();
  }
  const exData = ectx.getImageData(0, 0, m, m).data;

  const N = m * m;
  const lum = new Float32Array(N), veg = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const r = data[4 * i], g = data[4 * i + 1], b = data[4 * i + 2];
    const sum = r + g + b + 1;
    lum[i] = 0.3 * r + 0.59 * g + 0.11 * b;
    const exg = (2 * g - r - b) / sum;
    veg[i] = exg > EXG && g >= r && g >= b * BLUE && sum > 45 && exData[4 * i] < 128 ? 1 : 0;
  }

  // локальный разброс яркости через интегральные изображения
  const win = Math.max(2, Math.round(2.5 / cell));
  const I = new Float64Array((m + 1) * (m + 1)), I2 = new Float64Array((m + 1) * (m + 1));
  for (let y = 0; y < m; y++) {
    let s = 0, s2 = 0;
    for (let x = 0; x < m; x++) {
      const v = lum[y * m + x];
      s += v; s2 += v * v;
      I[(y + 1) * (m + 1) + x + 1] = I[y * (m + 1) + x + 1] + s;
      I2[(y + 1) * (m + 1) + x + 1] = I2[y * (m + 1) + x + 1] + s2;
    }
  }
  const tree = new Uint8Array(N);
  for (let y = 0; y < m; y++)
    for (let x = 0; x < m; x++) {
      const i = y * m + x;
      if (!veg[i]) continue;
      const x0 = Math.max(0, x - win), x1 = Math.min(m, x + win + 1), y0 = Math.max(0, y - win), y1 = Math.min(m, y + win + 1);
      const cnt = (x1 - x0) * (y1 - y0);
      const at = (A, yy, xx) => A[yy * (m + 1) + xx];
      const s = at(I, y1, x1) - at(I, y0, x1) - at(I, y1, x0) + at(I, y0, x0);
      const s2 = at(I2, y1, x1) - at(I2, y0, x1) - at(I2, y1, x0) + at(I2, y0, x0);
      const mean = s / cnt, std = Math.sqrt(Math.max(0, s2 / cnt - mean * mean));
      tree[i] = std > STD || lum[i] < DARK ? 1 : 0;
    }

  // расстояние до края маски (фаска 3-4), в метрах
  const INF = 1e9, dt = new Float32Array(N);
  for (let i = 0; i < N; i++) dt[i] = tree[i] ? INF : 0;
  for (let y = 0; y < m; y++)
    for (let x = 0; x < m; x++) {
      const i = y * m + x;
      if (!dt[i]) continue;
      let v = dt[i];
      if (x > 0) v = Math.min(v, dt[i - 1] + 3); else v = Math.min(v, 3);
      if (y > 0) v = Math.min(v, dt[i - m] + 3); else v = Math.min(v, 3);
      if (x > 0 && y > 0) v = Math.min(v, dt[i - m - 1] + 4);
      if (x < m - 1 && y > 0) v = Math.min(v, dt[i - m + 1] + 4);
      dt[i] = v;
    }
  for (let y = m - 1; y >= 0; y--)
    for (let x = m - 1; x >= 0; x--) {
      const i = y * m + x;
      if (!dt[i]) continue;
      let v = dt[i];
      if (x < m - 1) v = Math.min(v, dt[i + 1] + 3); else v = Math.min(v, 3);
      if (y < m - 1) v = Math.min(v, dt[i + m] + 3); else v = Math.min(v, 3);
      if (x < m - 1 && y < m - 1) v = Math.min(v, dt[i + m + 1] + 4);
      if (x > 0 && y < m - 1) v = Math.min(v, dt[i + m - 1] + 4);
      dt[i] = v;
    }

  const R_MIN = lerp(2.4, 1.2), R_MAX = 5;
  const cand = [];
  for (let y = 1; y < m - 1; y++)
    for (let x = 1; x < m - 1; x++) {
      const i = y * m + x;
      const r = (dt[i] / 3) * cell;
      if (r < R_MIN) continue;
      let peak = true;
      for (let dy = -1; dy <= 1 && peak; dy++)
        for (let dx = -1; dx <= 1; dx++) if (dt[i + dy * m + dx] > dt[i]) { peak = false; break; }
      if (peak) cand.push({ x, y, r: Math.min(R_MAX, r), key: Math.min(R_MAX, r) + noise(x, y) * 0.6 });
    }
  cand.sort((a, b) => b.key - a.key);

  // жадный отбор с разнесением крон
  const bucket = 12, hash = new Map(), trees = [];
  for (const c of cand) {
    const wx = (c.x + 0.5) * cell - h, wy = h - (c.y + 0.5) * cell;
    const bx = Math.floor(wx / bucket), by = Math.floor(wy / bucket);
    let ok = true;
    for (let dy = -1; dy <= 1 && ok; dy++)
      for (let dx = -1; dx <= 1 && ok; dx++)
        for (const t of hash.get(`${bx + dx},${by + dy}`) ?? [])
          if (Math.hypot(t.x - wx, t.y - wy) < (t.r + c.r) * 0.8) { ok = false; break; }
    if (!ok) continue;
    const t = { x: wx, y: wy, r: c.r, h: Math.min(22, Math.max(4, c.r * 2.6 + noise(c.y, c.x) * 2)), src: 'sat' };
    trees.push(t);
    const k = `${bx},${by}`;
    (hash.get(k) ?? hash.set(k, []).get(k)).push(t);
    if (trees.length >= MAX_TREES) break;
  }
  return trees;
}

export function imageryBlob(imagery) {
  return new Promise((resolve) => imagery.canvas.toBlob(resolve, 'image/jpeg', 0.9));
}
