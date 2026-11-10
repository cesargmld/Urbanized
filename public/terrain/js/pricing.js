// Prices of LANDFORM: one module for the page and the server (Cloudflare Pages Functions), so the price the page
// shows and the price the server charges are always the same. Building a site and exploring it is free: the model
// is computed in the browser. Credits pay once per site for its downloads (every format, every layer, laser sheets).
// Credits are those of the one ildar.space account: urban:EXPORT, urban:SCAN, urban:STREET, Planimetric, LANDFORM.

// a site is priced by its longest side (the diameter of a circle); its first paid download unlocks all of them.
// Sites up to 5 km for now (the app's sliders stop there too).
export const TIERS = [
  { key: 'small', name: 'Small', max: 1000, credits: 10, note: 'Sites up to 1 km', free: 'One site a day free' },
  { key: 'medium', name: 'Medium', max: 3000, credits: 20, note: 'Sites from 1 to 3 km' },
  { key: 'large', name: 'Large', max: 5000, credits: 30, note: 'Sites from 3 to 5 km' },
];
export const MAX_SIDE_M = TIERS[TIERS.length - 1].max;
// the first Small site of a (UTC) day is free for a signed-in account
export const FREE_TIER = 'small';

// credit packs: the same Paddle prices as urban:EXPORT (the price ids come from its checkout settings)
export const PACKS = [
  { id: 'small', credits: 10, usd: 5 },
  { id: 'medium', credits: 30, usd: 12 },
  { id: 'large', credits: 100, usd: 30 },
  { id: 'xl', credits: 200, usd: 50 },
];
export const USD_PER_CREDIT = PACKS[0].usd / PACKS[0].credits;

const side = ({ w, h, shape }) => (shape === 'circle' ? w : Math.max(w, h));
export const tierOf = (site) => TIERS.find((t) => side(site) <= t.max + 1e-6) ?? TIERS[TIERS.length - 1];

// a site's id: `${lat}_${lon}_${w}_${h}_${shape}` (rect | circle); the server reads the size from it
export function siteId({ lat, lon, w, h, shape }) {
  const circle = shape === 'circle';
  return `${(+lat).toFixed(5)}_${(+lon).toFixed(5)}_${Math.round(w)}_${Math.round(circle ? w : h)}_${circle ? 'circle' : 'rect'}`;
}
export function parseSite(id) {
  const m = /^(-?\d{1,3}\.\d{5})_(-?\d{1,3}\.\d{5})_(\d{2,5})_(\d{2,5})_(rect|circle)$/.exec(String(id));
  if (!m) return null;
  const s = { lat: +m[1], lon: +m[2], w: +m[3], h: +m[4], shape: m[5] };
  return Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180 && side(s) <= MAX_SIDE_M + 1e-6 ? s : null;
}
