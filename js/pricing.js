// Тарифы urban:EXPORT — общий модуль для страницы и сервера (Cloudflare Pages Functions),
// чтобы цена, которую видит человек, и цена, которую списывает сервер, всегда совпадали.

export const FREE_PER_DAY = 3;        // бесплатных участков в день на устройство
export const FREE_AREA_KM2 = 5;       // бесплатно — до 5 км²
export const MAX_AREA_KM2 = 20;       // предел площади (браузер дальше не вытягивает)
export const BLOCK_KM2 = 5;           // каждые следующие 5 км²…
export const CREDITS_PER_BLOCK = 4;   // …стоят 4 кредита
export const CREDITS_PER_EXTRA = 1;   // участок сверх дневного лимита — 1 кредит
export const MAX_SIDE_M = Math.floor(Math.sqrt(MAX_AREA_KM2) * 1000 / 10) * 10;
export const FREE_SIDE_M = Math.floor(Math.sqrt(FREE_AREA_KM2) * 1000 / 10) * 10;

// Пакеты кредитов: id пакета → price_id в Paddle задаётся на сервере (переменная PADDLE_PACKS)
export const PACKS = [
  { id: 'small', credits: 10, usd: 5 },
  { id: 'medium', credits: 30, usd: 12 },
  { id: 'large', credits: 100, usd: 30 },
];

export function areaKm2(size, shape) {
  const s = size / 1000;
  return shape === 'circle' ? (Math.PI * s * s) / 4 : s * s;
}

// id модели: `${lat}_${lon}_${size}_${shape}`; разрез — `sec:…`
export function parseModelId(id) {
  const m = /^(-?\d+\.\d+)_(-?\d+\.\d+)_(\d+)_(square|circle)$/.exec(String(id));
  if (!m) return null;
  return { lat: Number(m[1]), lon: Number(m[2]), size: Number(m[3]), shape: m[4] };
}

export function areaOfModel(id) {
  if (String(id).startsWith('sec:')) return 0;
  const p = parseModelId(id);
  return p ? areaKm2(p.size, p.shape) : null;
}

// Участок уже оплачен, если он целиком лежит внутри оплаченного раньше: сдвинули карту в его пределах,
// уменьшили размер или сменили форму — второй раз не платится. Допуск 1 м.
export function coveredBy(id, paidIds = []) {
  if (paidIds.includes(id)) return true;
  const a = parseModelId(id);
  if (!a) return false;
  const ha = a.size / 2;
  for (const pid of paidIds) {
    const b = parseModelId(pid);
    if (!b) continue;
    const hb = b.size / 2;
    const dy = (a.lat - b.lat) * 111320;
    let dl = a.lon - b.lon;
    if (dl > 180) dl -= 360; else if (dl < -180) dl += 360;
    const dx = dl * 111320 * Math.cos((b.lat * Math.PI) / 180);
    if (b.shape === 'square') {
      if (Math.abs(dx) + ha <= hb + 1 && Math.abs(dy) + ha <= hb + 1) return true;
    } else if (Math.hypot(dx, dy) + (a.shape === 'circle' ? ha : ha * Math.SQRT2) <= hb + 1) return true;
  }
  return false;
}

export function sizeCredits(area) {
  if (!(area > FREE_AREA_KM2 + 1e-9)) return 0;
  return Math.ceil((area - FREE_AREA_KM2) / BLOCK_KM2 - 1e-9) * CREDITS_PER_BLOCK;
}

/**
 * Стоимость скачивания участка.
 * @param {{ area: number, freeLeft: number, counted: boolean, paid: boolean }} s
 *   counted — участок уже засчитан сегодня (бесплатно), paid — уже оплачен кредитами
 */
export function quote({ area, freeLeft, counted = false, paid = false }) {
  if (paid) return { size: 0, daily: 0, total: 0, usesFree: false };
  const size = sizeCredits(area);
  const usesFree = !counted && freeLeft > 0;
  const daily = counted || usesFree ? 0 : CREDITS_PER_EXTRA;
  return { size, daily, total: size + daily, usesFree };
}

// цена кредита в самом маленьком пакете — для подписи «≈ $2»
export const USD_PER_CREDIT = PACKS[0].usd / PACKS[0].credits;
