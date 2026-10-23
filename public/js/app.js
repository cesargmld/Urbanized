import { buildModel, redetectTrees } from './data.js?v=6.0';
import { FORMATS, stlScale } from './exporters.js?v=6.0';
import { setCameraView, toggleMaquetaMode, isMaquetaModeActive, setLayerVisibility, getLayerStats, setWalkRings, setFloraZoneHighlight, updateSatelliteTexture, setContourOptions, setBuildingFinish, renderFeasibilityVolume, loadProject3DFile, studioState } from './preview.js?v=6.0';
import { pinStore, PIN_COLORS, PIN_TYPES } from './pins.js?v=1.0';
import { feasibilityStore } from './feasibility.js?v=1.0';
import { MAP_GRID_STEPS } from './mapplan.js?v=6.0';
import { classifyEcosystem } from './biodiversity.js?v=6.0';
import { t, lang, applyLang, onLangChange, locale, LANGS } from './i18n.js?v=6.0';
import { buildSection, sectionLength, SECTION_FORMATS, MAX_SECTION_KM } from './section.js?v=6.0';
window.buildSection = buildSection;
import { createIllustrator } from './illustrate.js?v=6.0';
import { viewsManager } from './viewsManager.js?v=6.0';
import * as billing from './billing.js?v=6.0';
import { quote, areaOfModel, areaKm2 as areaOf, sizeCredits, coveredBy, parseModelId, MAX_SIDE_M, FREE_AREA_KM2, USD_PER_CREDIT } from './pricing.js?v=6.0';
// цена кредитов в долларах — по малому пакету ($0,50 за кредит); в больших пакетах дешевле
const creditsUsd = (n) => {
  const v = n * USD_PER_CREDIT;
  return `≈ $${v % 1 ? v.toFixed(2) : v}`;
};

const $ = (s) => document.querySelector(s);
let mode = 'model';
const store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } },
};

/* ---------------- Карта ---------------- */

let start = store.get('ue:view') ?? { lat: 41.6938, lon: 44.8015, zoom: 15 };
if (!start.lat || !start.lon || (start.lat === 0 && start.lon === 0)) {
  start = { lat: 41.6938, lon: 44.8015, zoom: 15 };
}
start.zoom = Math.max(12, start.zoom);
const map = L.map('map', {  zoomControl: true, attributionControl: true, worldCopyJump: true , minZoom: 12 }).setView([start.lat, start.lon], start.zoom);
window.appMap = map;
window.map = map;
map.zoomControl.setPosition('topright');
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const tiles = (name, native) => L.tileLayer(`${ESRI}/${name}/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, maxNativeZoom: native, attribution: 'Esri, Maxar, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' });

// Official Esri Canvas Dark Gray tiles for high-end architectural matte dark map (Axiom style)
const bases = {
  monochrome: L.layerGroup([
    tiles('World_Imagery', 18),
    tiles('Reference/World_Boundaries_and_Places', 18)
  ]),
  sat: L.layerGroup([
    tiles('World_Imagery', 18),
    tiles('Reference/World_Boundaries_and_Places', 18)
  ]),
  map: L.layerGroup([
    tiles('Canvas/World_Dark_Gray_Base', 16),
    tiles('Canvas/World_Dark_Gray_Reference', 16)
  ]),
};
bases.bwnoise = bases.monochrome;
let baseName = 'monochrome';
store.set('ue:base', 'monochrome');
bases[baseName].addTo(map);
document.getElementById('map')?.classList.add('map-style-monochrome');
map.attributionControl.setPrefix(false);

function setBaseMap(name) {
  if (name === 'bwnoise') name = 'monochrome';
  if (name === baseName) return;
  map.removeLayer(bases[baseName]);
  baseName = name;
  bases[baseName].addTo(map);
  store.set('ue:base', baseName);

  const isMono = baseName === 'monochrome';
  document.getElementById('map')?.classList.toggle('map-style-monochrome', isMono);
  document.getElementById('map')?.classList.remove('map-style-bwnoise');

  // Coordinates, scale, and subtle overlays remain available and active across all 3 modes!
  const grid = document.getElementById('map-grid-overlay');
  if (grid) grid.style.display = 'block';
  const coordsNw = document.getElementById('map-coord-nw');
  if (coordsNw) coordsNw.style.display = 'block';
  const coordsSw = document.getElementById('map-coord-sw');
  if (coordsSw) coordsSw.style.display = 'block';
  const archScale = document.getElementById('map-arch-scale');
  if (archScale) archScale.style.display = 'block';

  document.querySelectorAll('[data-base]').forEach((b) => {
    const isThis = b.dataset.base === baseName || (baseName === 'monochrome' && b.dataset.base === 'bwnoise');
    b.setAttribute('aria-pressed', String(isThis));
    b.classList.toggle('active', isThis);
  });
}
window.setBaseMap = setBaseMap;

// Toggle buttons for section tools (buildings & trees)
document.getElementById('btn-sec-bldgs')?.addEventListener('click', function() {
  this.classList.toggle('active');
  const cb = document.getElementById('sec-buildings');
  if (cb) cb.checked = this.classList.contains('active');
});
document.getElementById('btn-sec-trees')?.addEventListener('click', function() {
  this.classList.toggle('active');
  const cb = document.getElementById('sec-trees');
  if (cb) cb.checked = this.classList.contains('active');
});

function toDMS(val, isLat) {
  const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
  const abs = Math.abs(val);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  return `${deg}°${min}'${sec}"${dir}`;
}

document.querySelectorAll('[data-base]').forEach((b) => {
  b.setAttribute('aria-pressed', String(b.dataset.base === baseName));
  b.addEventListener('click', () => setBaseMap(b.dataset.base));
});

const sizeInput = $('#size');
let shape = store.get('ue:shape') === 'circle' ? 'circle' : 'square';
const frame = $('#frame');
const sizeKm = () => (Number(sizeInput.value) / 1000).toFixed(sizeInput.value % 100 ? 2 : 1);
const areaKm2 = () => ((Number(sizeInput.value) / 1000) ** 2).toFixed(2);

function drawFrame() {
  const size = Number(sizeInput.value);
  const c = map.getCenter();
  const mpp = (40075016.686 * Math.cos((c.lat * Math.PI) / 180)) / 2 ** (map.getZoom() + 8);
  const px = Math.max(50, size / mpp);
  frame.style.width = frame.style.height = `${px}px`;
  frame.classList.toggle('circle', shape === 'circle');
  $('#frame-label').textContent = `${sizeKm()} × ${sizeKm()} ${t('km')}`;
  $('#size-out').textContent = `${sizeKm()} ${t('km')}`;

  // 1. Image 1 Bold Center DMS GPS Coordinate
  const frameDms = $('#frame-dms');
  if (frameDms) {
    frameDms.textContent = `${toDMS(c.lat, true)}, ${toDMS(c.lng, false)}`;
  }

  // 2. Image 1 Corner DMS Coordinates
  try {
    const bounds = map.getBounds();
    const nw = bounds.getNorthWest();
    const sw = bounds.getSouthWest();
    const nwEl = $('#map-coord-nw');
    if (nwEl) nwEl.textContent = `${toDMS(nw.lat, true)}, ${toDMS(nw.lng, false)}`;
    const swEl = $('#map-coord-sw');
    if (swEl) swEl.textContent = `${toDMS(sw.lat, true)}, ${toDMS(sw.lng, false)}`;
  } catch (e) {}

  // 3. Image 1 Dynamic Architectural Scale Indicator
  try {
    const metersPerCm = mpp * 38;
    const rawRatio = metersPerCm * 100;
    const scales = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000];
    const closest = scales.reduce((prev, curr) => Math.abs(curr - rawRatio) < Math.abs(prev - rawRatio) ? curr : prev);
    const ratioEl = $('#arch-scale-ratio');
    if (ratioEl) ratioEl.textContent = `1:${closest.toLocaleString()}`;
    const metricEl = $('#arch-scale-metric');
    if (metricEl) metricEl.textContent = `1 cm = ${(closest / 100).toFixed(0)} m`;

    const barMeters = closest >= 5000 ? 500 : closest >= 2000 ? 200 : closest >= 1000 ? 100 : 50;
    const barPx = Math.max(30, Math.min(180, Math.round(barMeters / mpp)));
    const barLine = $('#arch-scale-bar-line');
    if (barLine) barLine.style.width = `${barPx}px`;
    const barLabel = $('#arch-scale-bar-label');
    if (barLabel) barLabel.textContent = `${barMeters} m`;
  } catch (e) {}

  // цена площади: бесплатно до 5 км², дальше — кредиты при скачивании
  const costEl = $('#size-cost');
  const extra = billing.state.billing ? sizeCredits(areaOf(size, shape)) : 0;
  costEl.hidden = !billing.state.billing;
  costEl.textContent = extra
    ? t('size.cost', { c: billing.creditsLabel(extra), usd: creditsUsd(extra) })
    : t('size.free', { km: FREE_AREA_KM2 });
  const over = extra > 0;
  if (over !== frame.classList.contains('over') && costEl.dataset.ready) {
    costEl.classList.remove('flash');
    void costEl.offsetWidth;
    costEl.classList.add('flash');
  }
  costEl.dataset.ready = '1';
  frame.classList.toggle('over', over);
  costEl.classList.toggle('paid', over);
  sizeInput.classList.toggle('over', over);
  const freeSide = (shape === 'circle' ? Math.sqrt((FREE_AREA_KM2 * 4) / Math.PI) : Math.sqrt(FREE_AREA_KM2)) * 1000;
  const lo = Number(sizeInput.min), hi = Number(sizeInput.max);
  sizeInput.style.setProperty('--free', `${Math.min(100, Math.max(0, ((freeSide - lo) / (hi - lo)) * 100)).toFixed(2)}%`);
  sizeInput.classList.toggle('has-free', billing.state.billing && hi > freeSide);
}
document.querySelectorAll('[data-shape]').forEach((b) => {
  b.setAttribute('aria-pressed', String(b.dataset.shape === shape));
  b.addEventListener('click', () => {
    shape = b.dataset.shape;
    store.set('ue:shape', shape);
    document.querySelectorAll('[data-shape]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    drawFrame();
  });
});
map.on('move zoom resize viewreset zoomend moveend', drawFrame);
map.on('moveend', () => { const c = map.getCenter(); store.set('ue:view', { lat: c.lat, lon: c.lng, zoom: map.getZoom() }); });
// если рамка не помещается — отдаляем карту
function fitFrame() {
  drawFrame();
  const box = map.getContainer();
  if (!box.clientWidth || !box.clientHeight) return; // карта ещё не видна
  while (frame.offsetWidth > Math.min(box.clientWidth, box.clientHeight) * 0.85 && map.getZoom() > 3) {
    map.setZoom(map.getZoom() - 1, { animate: false });
    drawFrame();
  }
}
sizeInput.addEventListener('input', fitFrame);
fitFrame();
setTimeout(() => { map.invalidateSize(); fitFrame(); }, 200);
setTimeout(() => { map.invalidateSize(); fitFrame(); }, 800);
window.addEventListener('resize', () => { map.invalidateSize(); fitFrame(); });

/* ---------------- Поиск (Nominatim) ---------------- */

const q = $('#q'), results = $('#results');
let searchTimer, searchAbort;
q.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const text = q.value.trim();
  const coords = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coords) {
    results.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'search-preview-item';
    li.innerHTML = `
      <div class="search-item-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>
      </div>
      <div class="search-item-info">
        <div class="search-item-title">${t('search.goto', { lat: coords[1], lon: coords[2] })}</div>
        <div class="search-item-subtitle">Coordenadas geográficas directas</div>
        <div class="search-item-meta">
          <span class="search-badge-type">GPS</span>
          <span class="search-badge-coords">${coords[1]}, ${coords[2]}</span>
        </div>
      </div>
    `;
    li.onclick = () => goTo(Number(coords[1]), Number(coords[2]), `Coord ${coords[1]}, ${coords[2]}`);
    results.append(li);
    results.hidden = false;
    return;
  }
  if (text.length < 3) { results.hidden = true; return; }
  searchTimer = setTimeout(async () => {
    searchAbort?.abort();
    searchAbort = new AbortController();
    try {
      const url = `/api/search?q=${encodeURIComponent(text)}&lang=${lang}`;
      let list;
      try {
        list = await (await fetch(url, { signal: searchAbort.signal })).json();
      } catch {
        const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=${lang}&q=${encodeURIComponent(text)}`;
        list = await (await fetch(fallbackUrl, { signal: searchAbort.signal })).json();
      }
      results.innerHTML = '';
      for (const r of list) {
        const li = document.createElement('li');
        li.className = 'search-preview-item';
        const parts = (r.display_name || '').split(',').map((s) => s.trim());
        const mainTitle = parts[0] || 'Ubicación';
        const subtitle = parts.slice(1, 4).join(', ');
        const placeType = r.type ? r.type.replace(/_/g, ' ') : (r.class || 'Lugar');
        const latVal = Number(r.lat).toFixed(4);
        const lonVal = Number(r.lon).toFixed(4);

        li.innerHTML = `
          <div class="search-item-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div class="search-item-info">
            <div class="search-item-title">${mainTitle}</div>
            <div class="search-item-subtitle">${subtitle || parts.slice(1).join(', ')}</div>
            <div class="search-item-meta">
              <span class="search-badge-type">${placeType}</span>
              <span class="search-badge-coords">${latVal}°, ${lonVal}°</span>
            </div>
          </div>
        `;
        li.onclick = () => goTo(Number(r.lat), Number(r.lon), r.display_name);
        results.append(li);
      }
      results.hidden = !list.length;
    } catch { /* прервано */ }
  }, 350);
});
q.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); results.querySelector('li')?.click(); }
  if (e.key === 'Escape') results.hidden = true;
});
document.addEventListener('click', (e) => { if (!e.target.closest('.search')) results.hidden = true; });
function goTo(lat, lon, title) {
  results.hidden = true;
  if (title) {
    q.value = title.split(',')[0].trim();
  }
  map.setView([lat, lon], Math.max(map.getZoom(), 15));
}

/* ---------------- Лимит: 3 участка в сутки на устройство, сверх — кредиты ---------------- */
// С сервером кредитов (Cloudflare + D1) лимит и цену считает он; без него — прежний режим в браузере.

const LIMIT = 3;
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // Москва
function localUsed() {
  const s = store.get('ue:quota');
  return s?.date === today() ? s.ids : [];
}
const isCounted = (id) => (billing.state.billing ? billing.state.counted.includes(id) || coveredBy(id, billing.state.paid) : localUsed().includes(id));
async function quotaStatus() {
  return 999;
}
async function consume(modelId) {
  // Totalmente desbloqueado: descargas 100% ilimitadas y gratuitas
  return { ok: true, remaining: 999 };
}
let quotaState = null;
function renderQuota(remaining, current) {
  const el = $('#quota');
  if (el) {
    el.innerHTML = '';
  }
}

/* ---------------- Сборка модели ---------------- */

const panel = $('#panel'), status = $('#status'), buildBtn = $('#build');
let model = null, building = null;

const terrainToggle = panel.elements?.terrain, contoursToggle = panel.elements?.contours;
if (terrainToggle && contoursToggle) {
  terrainToggle.addEventListener('change', () => {
    contoursToggle.disabled = !terrainToggle.checked;
    if (!terrainToggle.checked) contoursToggle.checked = false;
  });
}
const sens = $('#sens');
function syncTreeControls() {
  if (panel.elements?.detect && panel.elements?.trees) {
    panel.elements.detect.disabled = !panel.elements.trees.checked;
    $('#sens-field')?.classList.toggle('off', !panel.elements.trees.checked || !panel.elements.detect.checked);
  }
  if (sens && $('#sens-out')) {
    $('#sens-out').textContent = `${sens.value}%`;
  }
}
panel.elements?.trees?.addEventListener?.('change', syncTreeControls);
panel.elements?.buildings?.addEventListener?.('change', () => { if (panel.elements?.extraBuildings) panel.elements.extraBuildings.disabled = !panel.elements.buildings.checked; });
panel.elements?.roads?.addEventListener?.('change', () => { if (panel.elements?.bridges) panel.elements.bridges.disabled = !panel.elements.roads.checked; if (panel.elements?.roadWidth) panel.elements.roadWidth.disabled = !panel.elements.roads.checked; });
panel.elements?.detect?.addEventListener?.('change', syncTreeControls);
sens?.addEventListener?.('input', syncTreeControls);
// после сборки ползунок пересчитывает деревья на готовой модели, без повторной загрузки
sens?.addEventListener?.('change', async () => {
  if (!model?.detection?.enabled || building) return;
  redetectTrees(model, sens.value / 100);
  renderMeta(model);
  const { showModel } = await import('./preview.js?v=4.1');
  showModel($('#viewer'), model, { keepCamera: true });
  await refreshPlan(model);
});
syncTreeControls();

let noticeTimeout = null;
function showMapNotice(message, isError = true) {
  const notice = $('#axiom-map-notice');
  const msgEl = $('#axiom-notice-msg');
  if (!notice || !msgEl) return;
  msgEl.textContent = message;
  const dot = notice.querySelector('.axiom-notice-dot');
  if (dot) {
    dot.style.background = isError ? '#f87171' : '#e06d44';
    dot.style.boxShadow = isError ? '0 0 10px rgba(248, 113, 113, 0.8)' : '0 0 10px rgba(224, 109, 68, 0.8)';
  }
  notice.hidden = false;
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => {
    notice.hidden = true;
  }, 10000);
}

function hideMapNotice() {
  const notice = $('#axiom-map-notice');
  if (notice) notice.hidden = true;
  clearTimeout(noticeTimeout);
}

document.getElementById('axiom-notice-close')?.addEventListener('click', hideMapNotice);

let loadingInterval = null;
let currentLoadingPct = 15;

function renderLoadingProgress(pct) {
  currentLoadingPct = Math.min(100, Math.max(0, pct));
  const fill = $('#axiom-laser-fill');
  const pctEl = $('#loading-pct');
  const badge = $('#loading-pct-badge');
  if (fill) fill.style.width = `${currentLoadingPct}%`;
  if (pctEl) pctEl.textContent = `${Math.round(currentLoadingPct)}%`;
  if (badge) badge.textContent = `${Math.round(currentLoadingPct)}%`;

  // Circular tick dial stroke-dashoffset (Circumference: 2 * PI * 42 ≈ 263.89)
  const dialCircle = document.getElementById('tech-dial-progress-circle');
  if (dialCircle) {
    const circ = 263.89;
    dialCircle.style.strokeDasharray = `${circ}`;
    dialCircle.style.strokeDashoffset = `${circ - (circ * currentLoadingPct) / 100}`;
  }

  // Update barcode bars
  const barcodeTrack = document.getElementById('tech-barcode-track');
  if (barcodeTrack && !barcodeTrack.children.length) {
    let barsHtml = '';
    for (let i = 0; i < 24; i++) {
      barsHtml += `<span class="tech-barcode-tick" data-bar-idx="${i}"></span>`;
    }
    barcodeTrack.innerHTML = barsHtml;
  }
  if (barcodeTrack) {
    const activeCount = Math.round((currentLoadingPct / 100) * 24);
    barcodeTrack.querySelectorAll('.tech-barcode-tick').forEach((bar, idx) => {
      bar.classList.toggle('active', idx < activeCount);
    });
  }

  // Telemetry values
  const volEl = $('#tech-hud-volume');
  if (volEl) volEl.textContent = `${Math.round((currentLoadingPct / 100) * 4890).toLocaleString()} / 4,890 PTS`;
  const etaEl = $('#tech-hud-eta');
  if (etaEl) {
    const remainingSec = Math.max(0, ((100 - currentLoadingPct) * 0.04)).toFixed(1);
    etaEl.textContent = `ETA: ${remainingSec}S`;
  }

  // Center Coordinates & Frame
  const c = map.getCenter();
  const latEl = $('#hud-coord-lat');
  const lonEl = $('#hud-coord-lon');
  const dimEl = $('#hud-frame-dim');
  if (latEl) latEl.textContent = toDMS(c.lat, true);
  if (lonEl) lonEl.textContent = toDMS(c.lng, false);
  if (dimEl) dimEl.textContent = `${sizeKm()} × ${sizeKm()} KM`;

  const sOsm = $('#load-src-osm');
  const sDem = $('#load-src-dem');
  const sRoads = $('#load-src-roads');
  const sWater = $('#load-src-water');
  if (sOsm) {
    if (currentLoadingPct > 35) { sOsm.style.color = '#ffffff'; sOsm.textContent = 'ONLINE [OK]'; }
    else { sOsm.style.color = 'rgba(255,255,255,0.7)'; sOsm.textContent = 'STREAMING...'; }
  }
  if (sDem) {
    if (currentLoadingPct > 65) { sDem.style.color = '#ffffff'; sDem.textContent = 'ONLINE [OK]'; }
    else if (currentLoadingPct > 35) { sDem.style.color = 'rgba(255,255,255,0.7)'; sDem.textContent = 'DEM MESHING...'; }
    else { sDem.style.color = 'rgba(255,255,255,0.3)'; sDem.textContent = 'WAITING'; }
  }
  if (sRoads) {
    if (currentLoadingPct > 82) { sRoads.style.color = '#ffffff'; sRoads.textContent = 'ONLINE [OK]'; }
    else if (currentLoadingPct > 65) { sRoads.style.color = 'rgba(255,255,255,0.7)'; sRoads.textContent = 'TRACING AXES...'; }
    else { sRoads.style.color = 'rgba(255,255,255,0.3)'; sRoads.textContent = 'WAITING'; }
  }
  if (sWater) {
    if (currentLoadingPct >= 96) { sWater.style.color = '#ffffff'; sWater.textContent = 'SYNCHRONIZED'; }
    else if (currentLoadingPct > 82) { sWater.style.color = 'rgba(255,255,255,0.7)'; sWater.textContent = 'PROCESSING...'; }
    else { sWater.style.color = 'rgba(255,255,255,0.3)'; sWater.textContent = 'STANDBY'; }
  }
}

function updateLoadingModal(stepKey) {
  const modal = $('#axiom-loading-modal');
  if (!modal) return;
  modal.hidden = false;

  let title = 'Extrayendo datos cartográficos...';
  let sub = 'Conectando con servidores OpenStreetMap';
  let telemetry = '<span>OSM</span> · <span>OVERTURE</span> · <span>COPERNICUS GLO-30</span>';
  let targetPct = Math.max(currentLoadingPct, 20);

  if (stepKey === 'status.loading') {
    title = 'Descargando geometría urbana';
    sub = 'Consultando edificios, vías y usos de suelo de OpenStreetMap...';
    telemetry = '<span>OVERPASS OSM</span> · <span>VÍAS Y CALZADAS</span> · <span>POLÍGONOS</span>';
    targetPct = Math.max(currentLoadingPct, 38);
  } else if (stepKey === 'status.fallback') {
    title = 'Conectando con fuente secundaria';
    sub = 'Descargando capas optimizadas de Overture Maps...';
    telemetry = '<span>OVERTURE MAPS</span> · <span>EDIFICACIÓN GLO-30</span>';
    targetPct = Math.max(currentLoadingPct, 54);
  } else if (stepKey === 'status.geometry') {
    title = 'Construyendo modelo 3D y relieve';
    sub = 'Generando mallas tridimensionales, alturas y topografía...';
    telemetry = '<span>COPERNICUS DEM</span> · <span>EARCUT TRIANGULATION</span> · <span>RELIEVE</span>';
    targetPct = Math.max(currentLoadingPct, 72);
  } else if (stepKey === 'status.imagery') {
    title = 'Sincronizando ortofoto satelital';
    sub = 'Descargando teselas satelitales de alta resolución...';
    telemetry = '<span>SATELLITE ORTHOMOSAIC</span> · <span>ALTA RESOLUCIÓN</span>';
    targetPct = Math.max(currentLoadingPct, 86);
  } else if (stepKey === 'status.trees') {
    title = 'Detectando masa arbórea';
    sub = 'Calculando vegetación y arbolado urbano...';
    telemetry = '<span>ARBOLADO SATELITAL</span> · <span>BIODIVERSIDAD</span>';
    targetPct = Math.max(currentLoadingPct, 94);
  } else if (stepKey === 'status.done' || (typeof stepKey === 'string' && stepKey.includes('done'))) {
    title = 'Finalizando modelo 3D';
    sub = 'Optimizando escena y preparando exportadores CAD/GIS...';
    telemetry = '<span>COMPLETO</span> · <span>AUTOCAD · RHINO · SKETCHUP · GIS</span>';
    targetPct = 100;
  }

  const titleEl = $('#loading-title');
  const subEl = $('#loading-sub');
  const telEl = $('#loading-telemetry');
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub;
  if (telEl) telEl.innerHTML = telemetry;

  renderLoadingProgress(targetPct);

  if (!loadingInterval && targetPct < 96) {
    loadingInterval = setInterval(() => {
      if (currentLoadingPct < 94) {
        renderLoadingProgress(currentLoadingPct + 1);
      }
    }, 450);
  }
}

function hideLoadingModal() {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  currentLoadingPct = 15;
  const modal = $('#axiom-loading-modal');
  if (modal) modal.hidden = true;
}

let statusState = ['status.hint', {}];
function setStatus(key, opts = {}) {
  statusState = [key, opts];
  const { busy = false, error = false, vars } = opts;
  if (status) {
    status.className = 'status' + (error ? ' error' : '');
    const msg = key.split('|').map((k) => t(k, vars)).join('. ');
    status.textContent = msg;
  }

  if (busy) {
    updateLoadingModal(key);
  } else if (error) {
    hideLoadingModal();
    const errorMsg = key.includes('busy') || key.includes('error')
      ? 'No se pudo descargar el área seleccionada. El servidor de OpenStreetMap está saturado — prueba con un área menor o espera un momento.'
      : key.split('|').map((k) => t(k, vars)).join('. ');
    showMapNotice(errorMsg, true);
  } else if (key === 'status.done' || (typeof key === 'string' && key.includes('done'))) {
    updateLoadingModal('status.done');
    setTimeout(() => {
      hideLoadingModal();
    }, 350);
  }
}

panel.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (building) return;
  hideMapNotice();
  const c = map.getCenter().wrap();
  const layerKeys = ['buildings', 'extraBuildings', 'roads', 'roadWidth', 'bridges', 'terrain', 'contours', 'nature', 'trees', 'detect', 'satellite'];
  const layers = Object.fromEntries(layerKeys.map((k) => [k, panel.elements[k] ? panel.elements[k].checked : true]));
  building = new AbortController();
  buildBtn.disabled = true;
  const btnSpan = buildBtn.querySelector('span');
  if (btnSpan) btnSpan.textContent = t('build.busy');
  else buildBtn.textContent = t('build.busy');

  let m = null;
  try {
    m = await buildModel({ lat: c.lat, lon: c.lng, size: Number(sizeInput.value), shape, layers, sensitivity: sens.value / 100 }, (s) => setStatus(s, { busy: true }), building.signal);

    // Apply granular POI filters on the finished model
    if (panel.elements.poi_schools && !panel.elements.poi_schools.checked) {
      m.buildings = m.buildings.filter(b => b.cls !== 'public');
    }
    if (panel.elements.poi_commercial && !panel.elements.poi_commercial.checked) {
      m.buildings = m.buildings.filter(b => b.cls !== 'commercial');
    }
    if (panel.elements.poi_residential && !panel.elements.poi_residential.checked) {
      m.buildings = m.buildings.filter(b => b.cls !== 'residential');
    }
    if (m.lines) {
      if (panel.elements.roads_major && !panel.elements.roads_major.checked) {
        m.lines.ROADS_MAJOR = [];
      }
      if (panel.elements.roads_minor && !panel.elements.roads_minor.checked) {
        m.lines.ROADS_MINOR = [];
        m.lines.PATHS = [];
      }
    }

    model = m;
    setStatus(m.warnings.join('|') || 'status.done');
    billing.track('build');
  } catch (err) {
    console.error('Data fetch/build error:', err);
    setStatus('status.error', { error: true });
    building = null;
    buildBtn.disabled = false;
    if (btnSpan) btnSpan.textContent = t('build.idle');
    else buildBtn.textContent = t('build.idle');
    return;
  }

  try {
    await showResult(m);
  } catch (uiErr) {
    console.error('UI render warning in showResult:', uiErr);
    if (window.switchWorkspaceView) window.switchWorkspaceView('result');
  } finally {
    building = null;
    buildBtn.disabled = false;
    if (btnSpan) btnSpan.textContent = t('build.idle');
    else buildBtn.textContent = t('build.idle');
  }
});

function renderMeta(m) {
  const loc = locale();
  const coords = $('#coords');
  if (coords) {
    coords.textContent =
      t(m.shape === 'circle' ? 'result.metaCircle' : 'result.meta', { lat: m.center.lat.toFixed(5), lon: m.center.lon.toFixed(5), size: m.size }) +
      (m.contourInterval ? t('result.contours', { n: m.contourInterval }) : '') +
      (m.extraBuildings ? t('result.overture', { n: m.extraBuildings.toLocaleString(loc) }) : '') +
      (m.dataSource === 'overture' ? t('result.sourceOverture') : '') +
      (m.grid.source ? ` · ${t(`terrain.${m.grid.source}`, { res: m.grid.res < 1 ? m.grid.res.toFixed(1) : Math.round(m.grid.res) })}` : '');
  }
  const stBld = $('#st-buildings'); if (stBld) stBld.textContent = m.stats.buildings.toLocaleString(loc);
  const stRd = $('#st-roads'); if (stRd) stRd.textContent = m.stats.roadsKm.toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const stTr = $('#st-trees'); if (stTr) stTr.textContent = m.stats.trees.toLocaleString(loc);
  const lidarNote = $('#lidar-note'); if (lidarNote) lidarNote.hidden = m.grid.source !== 'dtm';
  const sc = stlScale(m.size);
  const stlNote = $('#stl-note'); if (stlNote) stlNote.textContent = t('dl.stlNote', { scale: sc, mm: Math.round((m.size * 1000) / sc) });
  const stRelief = $('#st-relief'); if (stRelief) stRelief.textContent = Math.round(m.stats.relief);
}

async function showResult(m) {
  hideLoadingModal();
  setMode('model');
  renderMeta(m);
  updateBiodiversity();
  try { viewsManager.addRecentProject(m); } catch { /* ignore */ }

  // Switch to result screen first so #viewer has non-zero dimensions when Three.js initializes
  $('#view-btn-studio')?.classList.remove('disabled');
  $('#view-btn-mapper')?.classList.remove('disabled');
  $('#view-btn-illu')?.classList.remove('disabled');

  if (window.switchWorkspaceView) {
    window.switchWorkspaceView('result');
  }

  const { showModel, triggerResize } = await import('./preview.js?v=6.0');
  showModel($('#viewer'), m);
  setTimeout(() => triggerResize?.(), 60);
  setTimeout(() => triggerResize?.(), 220);

  await preparePreviews(m);
  applySite();
  if (illuOpened) openIllustrator();
  if (mapOpened) renderMap(true);
  const remaining = await quotaStatus();
  const counted = isCounted(m.id);
  renderQuota(remaining, counted);
  lockDownloads(remaining <= 0 && !counted);

  if (walkState.active) {
    setWalkRings(true, walkState.minutes);
  }
  if (floraState.zonesActive) {
    setFloraZoneHighlight(true, floraState.selectedSpecies);
  }

  // Live GIS Stats Badge & Counts (Axiom Inspector)
  try {
    const stats = getLayerStats(m);
    const totalEl = $('#gis-total-badge');
    if (totalEl) totalEl.textContent = stats.totalBuildings + stats.trees;
    const headerBadge = $('#gis-header-badge');
    if (headerBadge) headerBadge.textContent = stats.totalBuildings + stats.trees;
    const eduEl = $('#count-education'); if (eduEl) eduEl.textContent = stats.education;
    const comEl = $('#count-commercial'); if (comEl) comEl.textContent = stats.commercial;
    const heaEl = $('#count-health'); if (heaEl) heaEl.textContent = stats.health;
    const resEl = $('#count-residential'); if (resEl) resEl.textContent = stats.residential;
    const rMaj = $('#count-roads-major'); if (rMaj) rMaj.textContent = stats.roadsMajorKm + ' km';
    const rMin = $('#count-roads-minor'); if (rMin) rMin.textContent = stats.roadsMinorKm + ' km';
    const relEl = $('#count-relief'); if (relEl) relEl.textContent = stats.relief + ' m';
    const trEl = $('#count-trees'); if (trEl) trEl.textContent = stats.trees;
    const heroSum = $('#hero-model-summary');
    const loc = locale();
    if (heroSum) heroSum.textContent = `${m.stats.buildings.toLocaleString(loc)} edif. · ${Math.round(m.stats.relief)}m desnivel · ${m.stats.roadsKm.toFixed(1)} km`;
  } catch (err) {
    console.warn('GIS stats error:', err);
  }
}
window.loadModelDirectly = async (customModel) => {
  model = customModel;
  await showResult(model);
};
window.flyToTemplateLocation = (lat, lon, size = 1200) => {
  if (sizeInput) sizeInput.value = String(size);
  map.setView([lat, lon], 15, { animate: true });
  setTimeout(() => { map.invalidateSize(); fitFrame(); }, 100);
};
window.loadHydratedUrbnzModel = async (res) => {
  if (!res || !res.model) return;
  model = res.model;
  if (res.vectorMap) {
    await loadMapMod();
    mapOpts = res.vectorMap;
    syncMapControls();
  }
  await showResult(model);
  if (res.illustrate) {
    openIllustrator();
    if (illu && illu.applyState) illu.applyState(res.illustrate);
  }
};

function lockDownloads(locked) {
  document.querySelectorAll('.dl').forEach((b) => {
    b.disabled = (b.dataset.format === 'jpg' && !model?.imagery);
  });
}

/* ---------------- Превью: 3D, чертёж, спутник ---------------- */

const flatUrls = {};
async function refreshPlan(m) {
  if (flatUrls.plan) URL.revokeObjectURL(flatUrls.plan);
  flatUrls.plan = URL.createObjectURL(FORMATS.svg.make(m));
  const planImg = $('#view-plan img');
  if (planImg) planImg.src = flatUrls.plan;
}
async function preparePreviews(m) {
  illu = null;
  illuModel = null;
  const labelList = $('#illu-label-list');
  if (labelList) labelList.innerHTML = '';
  for (const k of Object.keys(flatUrls)) if (flatUrls[k]) URL.revokeObjectURL(flatUrls[k]);
  flatUrls.plan = URL.createObjectURL(FORMATS.svg.make(m));
  flatUrls.sat = m.imagery ? URL.createObjectURL(await FORMATS.jpg.make(m)) : null;
  const satTab = document.querySelector('[data-view="sat"]');
  if (satTab) satTab.hidden = !m.imagery;
  for (const view of ['plan', 'sat']) {
    const img = $(`#view-${view} img`);
    if (img && flatUrls[view]) img.src = flatUrls[view];
  }
  selectView('model');
}

let currentView = 'model';
function selectView(view) {
  currentView = view;
  document.querySelectorAll('.stage-tabs button, .tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === view)));
  const viewerEl = $('#viewer'); if (viewerEl) viewerEl.hidden = view !== 'model';
  const planEl = $('#view-plan'); if (planEl) planEl.hidden = view !== 'plan';
  const satEl = $('#view-sat'); if (satEl) satEl.hidden = view !== 'sat';
  const hintEl = $('#viewer-hint'); if (hintEl) hintEl.textContent = t(view === 'model' ? 'viewer.hint' : 'viewer.hintFlat');
  if (view !== 'model') fitFlat($(`#view-${view}`));
}
document.querySelectorAll('.stage-tabs button, .tabs button').forEach((b) => b.addEventListener('click', () => selectView(b.dataset.view)));

// Плоское превью: колесо — масштаб к курсору, перетаскивание — сдвиг.
const flatState = new WeakMap();
function applyFlat(box) {
  const st = flatState.get(box);
  box.querySelector('img').style.transform = `translate(${st.x}px, ${st.y}px) scale(${st.k})`;
}
function fitFlat(box) {
  if (!box) return;
  const img = box.querySelector('img');
  if (!img) return;
  const go = () => {
    if (!box.clientWidth || !box.clientHeight || !img.naturalWidth || !img.naturalHeight) {
      setTimeout(() => fitFlat(box), 50);
      return;
    }
    const k = Math.min(box.clientWidth / img.naturalWidth, box.clientHeight / img.naturalHeight) * 0.94;
    flatState.set(box, { k, minK: k, x: (box.clientWidth - img.naturalWidth * k) / 2, y: (box.clientHeight - img.naturalHeight * k) / 2 });
    applyFlat(box);
  };
  img.complete && img.naturalWidth ? go() : (img.onload = go);
}
const flatResizeObs = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const box = entry.target;
    if (box.clientWidth > 0 && box.clientHeight > 0 && flatState.get(box)) {
      fitFlat(box);
    }
  }
});
for (const box of document.querySelectorAll('.flat')) {
  box.addEventListener('wheel', (e) => {
    e.preventDefault();
    const st = flatState.get(box);
    if (!st) return;
    const r = box.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const minK = st.minK || (st.k * 0.9);
    const k = Math.min(st.k * 30, Math.max(minK, st.k * Math.exp(-e.deltaY * 0.0015)));
    st.x = mx - ((mx - st.x) * k) / st.k;
    st.y = my - ((my - st.y) * k) / st.k;
    st.k = k;
    applyFlat(box);
  }, { passive: false });
  const pointers = new Map();
  let pinch = null;
  box.addEventListener('pointerdown', (e) => { box.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]); });
  box.addEventListener('pointermove', (e) => {
    const st = flatState.get(box), prev = pointers.get(e.pointerId);
    if (!st || !prev) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) {
        const r = box.getBoundingClientRect(), mx = (a[0] + b[0]) / 2 - r.left, my = (a[1] + b[1]) / 2 - r.top;
        const k = st.k * (d / pinch);
        st.x = mx - ((mx - st.x) * k) / st.k;
        st.y = my - ((my - st.y) * k) / st.k;
        st.k = k;
      }
      pinch = d;
    } else {
      st.x += e.clientX - prev[0];
      st.y += e.clientY - prev[1];
    }
    applyFlat(box);
  });
  const up = (e) => { pointers.delete(e.pointerId); pinch = null; };
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', up);
  box.addEventListener('dblclick', () => fitFlat(box));
  flatResizeObs.observe(box);
}

/* ---------------- Скачивание ---------------- */

function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

document.querySelectorAll('.dl').forEach((btn) =>
  btn.addEventListener('click', async () => {
    if (!model || btn.classList.contains('busy')) return;
    const fmt = FORMATS[btn.dataset.format];
    btn.querySelector('span').dataset.busy = t('dl.busy');
    btn.classList.add('busy');
    try {
      // сначала файл, потом списание: если сборка файла упала, кредиты остаются на месте
      const blob = await fmt.make(model);
      const q = await consume(model.id);
      if (!q.ok) { renderQuota(0, false); lockDownloads(true); return; }
      const name = `urbanized_${model.center.lat.toFixed(4)}_${model.center.lon.toFixed(4)}_${model.size}m.${fmt.ext}`;
      save(blob, name);
      billing.track(`dl:${fmt.ext}`);
    } catch (err) {
      console.error(err);
      setStatus('status.fileError', { error: true, vars: { ext: fmt.ext.toUpperCase() } });
    } finally {
      btn.classList.remove('busy');
      renderQuota(await quotaStatus(), true);
    }
  }),
);

/* ---------------- Разрез по линии на карте ---------------- */

const secState = { points: [], line: null, dots: [], drawing: false, model: null, url: null };
const secLenKm = () => sectionLengthCache / 1000;
let sectionLengthCache = 0;

function secRedraw() {
  secState.dots.forEach((d) => d.remove());
  secState.dots = [];
  secState.line?.remove();
  secState.line = null;
  const visible = mode === 'section';
  if (visible && secState.points.length > 1) {
    secState.line = L.polyline(secState.points, {
      color: 'rgba(255, 255, 255, 0.92)',
      weight: 1.5,
      dashArray: '4 4',
      className: 'sec-line'
    }).addTo(map);
  }
  secState.dots = (visible ? secState.points : []).map((p, i) => {
    const label = i === 0 ? 'A' : (i === 1 ? 'B' : `${i + 1}`);
    const icon = L.divIcon({
      className: 'sec-marker-wrapper',
      html: `<div class="sec-terminal-pin">${label}</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    return L.marker(p, { icon, interactive: false }).addTo(map);
  }); 
  const len = secState.points.length > 1 ? sectionLength(secState.points) : 0;
  sectionLengthCache = len;
  const secLenEl = $('#sec-len');
  if (secLenEl) secLenEl.textContent = `${(len / 1000).toFixed(2)} ${t('km')}`;
  const tooLong = len > MAX_SECTION_KM * 1000;
  const secBuildEl = $('#sec-build');
  if (secBuildEl) secBuildEl.disabled = secState.points.length < 2 || tooLong || secBusy;
  const secUndoEl = $('#sec-undo');
  if (secUndoEl) secUndoEl.disabled = !secState.points.length;
  const secClearEl = $('#sec-clear');
  if (secClearEl) secClearEl.disabled = !secState.points.length;
  
  // Section guidance message
  const guidance = $('#section-guidance');
  const guidanceMsg = $('#guidance-msg');
  if (guidance) {
    guidance.hidden = !visible || secState.points.length >= 2;
    if (guidanceMsg) {
      if (secState.points.length === 0) guidanceMsg.textContent = 'Haz clic en el mapa para marcar el Punto A del corte';
      else if (secState.points.length === 1) guidanceMsg.textContent = 'Haz clic para marcar el Punto B y trazar el perfil';
    }
  }

  if (tooLong) setSecStatus('section.tooLong', { error: true });
  else if (secState.drawing) setSecStatus('section.hint');
  else if (!secState.points.length) setSecStatus('');
}

let secStatusState = ['', {}];
function setSecStatus(key, opts = {}) {
  secStatusState = [key, opts];
  const el = $('#sec-status');
  if (!el) return;
  el.className = 'status' + (opts.error ? ' error' : '');
  el.textContent = key ? t(key, opts.vars) : '';
  if (opts.busy) el.insertAdjacentHTML('beforeend', '<span class="progress"></span>');
}

let secBusy = false;
$('#sec-draw')?.addEventListener('click', () => {
  secState.drawing = !secState.drawing;
  $('#sec-draw')?.setAttribute('aria-pressed', String(secState.drawing));
  const sd = $('#sec-draw'); if (sd) sd.textContent = t(secState.drawing ? 'section.drawing' : 'section.draw');
  const sitd = $('#site-draw'); if (sitd) sitd.textContent = t(site.drawing ? 'site.drawing' : 'site.draw');
  siteRedraw();
  map.getContainer().parentElement.classList.toggle('drawing', secState.drawing);
  secRedraw();
});
$('#sec-undo')?.addEventListener('click', () => { secState.points.pop(); secRedraw(); });
$('#sec-clear')?.addEventListener('click', () => { secState.points = []; secRedraw(); });
map.on('click', (e) => {
  if (site.drawing) { site.points.push([e.latlng.lat, e.latlng.lng]); siteRedraw(); return; }
  if (!secState.drawing) return;
  secState.points.push([e.latlng.lat, e.latlng.lng]);
  secRedraw();
  // DO NOT auto-trigger section build! Let the user review and click "Generar Perfil"
});

$('#sec-build')?.addEventListener('click', async () => {
  if (secBusy || secState.points.length < 2) return;
  secBusy = true;
  const sb = $('#sec-build'); if (sb) sb.disabled = true;
  try {
    const exaggeration = Number($('#sec-exag')?.value || 1);
    const sec = await buildSection(secState.points, { exaggeration }, (k) => setSecStatus(k, { busy: true }));
    sec.flip = $('#sec-dir')?.value === '1';
    secState.model = sec;
    billing.track('section');
    await showSection(sec);
    setSecStatus('');
  } catch (err) {
    console.error(err);
    setSecStatus(String(err).includes('too long') ? 'section.tooLong' : 'status.error', { error: true });
  } finally {
    secBusy = false;
    secRedraw();
  }
});

const secRefresh = async () => {
  if (!secState.model) return;
  secState.model.exaggeration = Number($('#sec-exag')?.value || 1);
  secState.model.flip = $('#sec-dir')?.value === '1';
  await showSection(secState.model);
};

// Topographic Section Layer Toggles (Terrain, Buildings, Grid, Vegetation)
document.querySelectorAll('[data-seclayer]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (!secState.model) return;
    if (!secState.model.layers) {
      secState.model.layers = { ground: true, buildings: true, grid: true, trees: true };
    }
    const l = btn.dataset.seclayer;
    secState.model.layers[l] = !secState.model.layers[l];
    btn.classList.toggle('active', !!secState.model.layers[l]);
    await showSection(secState.model);
  });
});

$('#btn-section-modal-done')?.addEventListener('click', () => {
  const modal = $('#section-modal');
  if (modal) { modal.hidden = true; modal.style.display = 'none'; }
});
$('#section-modal-close')?.addEventListener('click', () => {
  const modal = $('#section-modal');
  if (modal) { modal.hidden = true; modal.style.display = 'none'; }
});
$('#sec-exag')?.addEventListener('change', secRefresh);
$('#sec-dir')?.addEventListener('change', secRefresh);

async function showSection(sec) {
  window.showSection = showSection;
  if (secState.url) URL.revokeObjectURL(secState.url);
  secState.url = URL.createObjectURL(SECTION_FORMATS.svg.make(sec));

  // Show topographic section analysis modal immediately
  const modal = $('#section-modal');
  if (modal) {
    modal.hidden = false;
    modal.removeAttribute('hidden');
    modal.style.display = 'flex';
  }

  const readyPill = $('#section-ready-pill');
  if (readyPill) {
    readyPill.hidden = false;
    readyPill.removeAttribute('hidden');
  }

  const metaDrawer = $('#sec-meta-drawer');
  if (metaDrawer) {
    metaDrawer.textContent = `${(sec.length / 1000).toFixed(2)} km · Cota ${Math.round(sec.minZ)} m a ${Math.round(sec.maxZ)} m · ${sec.buildings.length} estructuras`;
  }

  const statLen = $('#sec-stat-len');
  if (statLen) statLen.textContent = `${(sec.length / 1000).toFixed(2)} km`;
  const statMax = $('#sec-stat-max');
  if (statMax) statMax.textContent = `${Math.round(sec.maxZ)} m`;
  const statMin = $('#sec-stat-min');
  if (statMin) statMin.textContent = `${Math.round(sec.minZ)} m`;
  const statDrop = $('#sec-stat-drop');
  if (statDrop) statDrop.textContent = `${Math.round(sec.maxZ - sec.minZ)} m`;
  const statExag = $('#sec-stat-exag');
  if (statExag) statExag.textContent = `${(sec.exaggeration || 1).toFixed(1)}×`;

  const imgDrawer = $('#view-section-drawer img');
  if (imgDrawer) {
    imgDrawer.src = secState.url;
  }

  // Legacy container sync
  const box = $('#section-result');
  if (box) {
    box.hidden = false;
    $('#sec-meta').textContent = `${(sec.length / 1000).toFixed(2)} km · ${Math.round(sec.minZ)} - ${Math.round(sec.maxZ)} m`;
    const img = $('#view-section img');
    if (img) {
      img.src = secState.url;
      img.onload = () => fitFlat($('#view-section'));
    }
  }
  renderSecQuota();
}

// ---------------- Biodiversity, Flora & Fauna Engine + Flora Zones on Map & 3D ----------------
const floraState = {
  zonesActive: false,
  selectedSpecies: -1,
  layerGroup: L.layerGroup().addTo(map)
};

function generateZonePolygonCoords(centerLat, centerLon, distM, angleDeg, radiusM, seed = 1) {
  const earthRadius = 6378137;
  const radAngle = (angleDeg * Math.PI) / 180;
  const dLatCenter = (distM * Math.sin(radAngle)) / earthRadius;
  const dLonCenter = (distM * Math.cos(radAngle)) / (earthRadius * Math.cos((Math.PI * centerLat) / 180));
  const zoneLat = centerLat + (dLatCenter * 180) / Math.PI;
  const zoneLon = centerLon + (dLonCenter * 180) / Math.PI;

  const pts = [];
  const vertices = 10;
  for (let i = 0; i < vertices; i++) {
    const theta = (i / vertices) * Math.PI * 2;
    const wobble = 0.78 + 0.32 * Math.sin(theta * 3 + seed * 1.7);
    const r = radiusM * wobble;
    const pLat = zoneLat + ((r * Math.sin(theta)) / earthRadius) * (180 / Math.PI);
    const pLon = zoneLon + ((r * Math.cos(theta)) / (earthRadius * Math.cos((Math.PI * zoneLat) / 180))) * (180 / Math.PI);
    pts.push([pLat, pLon]);
  }
  return { center: [zoneLat, zoneLon], pts };
}

function updateFloraZonesOnMap() {
  floraState.layerGroup.clearLayers();
  const sw1 = $('#flora-zones-switch');
  const sw2 = $('#map-flora-switch');
  if (sw1) sw1.checked = floraState.zonesActive;
  if (sw2) sw2.checked = floraState.zonesActive;
  $('#map-btn-flora')?.classList.toggle('active', floraState.zonesActive);

  if (!floraState.zonesActive) {
    setFloraZoneHighlight(false);
    return;
  }

  const center = map.getCenter();
  const elev = (typeof model !== 'undefined' && model?.grid) ? model.grid.maxH : 0;
  const placeName = $('#q')?.value || '';
  const eco = classifyEcosystem(center.lat, center.lng, elev, placeName);
  const palette = ['#4ade80', '#2dd4bf', '#a3e635', '#34d399', '#38bdf8'];

  // Conversión de coordenadas métricas locales a coordenadas geográficas Lat/Lng reales
  const localToLatLng = (x, y, frame) => {
    const phi = (frame.lat * Math.PI) / 180;
    const mLat = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
    const mLon = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
    return [frame.lat + y / mLat, frame.lon + x / mLon];
  };

  const realGreenAreas = [];
  if (typeof model !== 'undefined' && model?.areas?.GREEN && model.areas.GREEN.length > 0) {
    for (const ring of model.areas.GREEN) {
      if (!ring || ring.length < 3) continue;
      const latLngs = ring.map(([x, y]) => localToLatLng(x, y, model.frame));
      let sumLat = 0, sumLng = 0;
      latLngs.forEach(([la, lo]) => { sumLat += la; sumLng += lo; });
      const cLat = sumLat / latLngs.length;
      const cLng = sumLng / latLngs.length;
      realGreenAreas.push({ latLngs, center: [cLat, cLng], ptsCount: ring.length });
    }
  }

  // 1. Si el modelo cuenta con polígonos verdes reales de OpenStreetMap (parques, jardines, reservas)
  if (realGreenAreas.length > 0) {
    realGreenAreas.sort((a, b) => b.ptsCount - a.ptsCount);

    eco.flora.forEach((sp, idx) => {
      if (floraState.selectedSpecies >= 0 && floraState.selectedSpecies !== idx) return;
      const area = realGreenAreas[idx % realGreenAreas.length];
      const color = palette[idx % palette.length];

      L.polygon(area.latLngs, {
        color,
        weight: 2,
        opacity: 0.95,
        fillColor: color,
        fillOpacity: 0.28,
        dashArray: '3 3'
      }).addTo(floraState.layerGroup);

      const badgeHtml = `
        <div class="flora-zone-pin" style="--flora-color:${color}">
          <span class="flora-zone-dot"></span>
          <div class="flora-zone-info">
            <b>${sp.name}</b>
            <i>${sp.latin}</i>
          </div>
        </div>
      `;
      const icon = L.divIcon({
        html: badgeHtml,
        className: 'flora-zone-icon-wrap',
        iconSize: [160, 36],
        iconAnchor: [80, 18]
      });
      L.marker(area.center, { icon, interactive: false }).addTo(floraState.layerGroup);
    });
  } else if (typeof model !== 'undefined' && model?.trees && model.trees.length > 0) {
    // 2. Si no hay polígonos delimitados pero existen árboles reales mapeados o detectados
    const step = Math.max(1, Math.floor(model.trees.length / (eco.flora.length + 1)));
    eco.flora.forEach((sp, idx) => {
      if (floraState.selectedSpecies >= 0 && floraState.selectedSpecies !== idx) return;
      const tree = model.trees[idx * step] || model.trees[0];
      const treeLatLng = localToLatLng(tree.x, tree.y, model.frame);
      const color = palette[idx % palette.length];

      L.circle(treeLatLng, {
        radius: Math.max(20, (tree.r || 5) * 4),
        color,
        weight: 1.8,
        fillColor: color,
        fillOpacity: 0.26,
        dashArray: '4 4'
      }).addTo(floraState.layerGroup);

      const badgeHtml = `
        <div class="flora-zone-pin" style="--flora-color:${color}">
          <span class="flora-zone-dot"></span>
          <div class="flora-zone-info">
            <b>${sp.name}</b>
            <i>${sp.latin}</i>
          </div>
        </div>
      `;
      const icon = L.divIcon({
        html: badgeHtml,
        className: 'flora-zone-icon-wrap',
        iconSize: [160, 36],
        iconAnchor: [80, 18]
      });
      L.marker(treeLatLng, { icon, interactive: false }).addTo(floraState.layerGroup);
    });
  }

  if (typeof model !== 'undefined' && model) {
    setFloraZoneHighlight(floraState.zonesActive, floraState.selectedSpecies);
  }
}
window.updateFloraZonesOnMap = updateFloraZonesOnMap;

function setFloraZonesActive(active, speciesIdx = -1) {
  floraState.zonesActive = active;
  floraState.selectedSpecies = speciesIdx;
  updateFloraZonesOnMap();
}
window.setFloraZonesActive = setFloraZonesActive;

$('#flora-zones-switch')?.addEventListener('change', (e) => {
  setFloraZonesActive(e.target.checked, -1);
});
$('#map-btn-flora')?.addEventListener('click', () => {
  setFloraZonesActive(!floraState.zonesActive, -1);
});

function updateBiodiversity() {
  const center = map.getCenter();
  const elev = (typeof model !== 'undefined' && model?.grid) ? model.grid.maxH : 0;
  const placeName = $('#q')?.value || '';
  const eco = classifyEcosystem(center.lat, center.lng, elev, placeName);

  const biomeTitle = $('#bio-biome-name');
  if (biomeTitle) biomeTitle.textContent = eco.name;

  const coordsEl = $('#bio-coords');
  if (coordsEl) coordsEl.textContent = `■ ${Math.abs(center.lat).toFixed(4)}° ${center.lat >= 0 ? 'N' : 'S'}, ${Math.abs(center.lng).toFixed(4)}° ${center.lng >= 0 ? 'E' : 'W'}`;

  const summary = $('#bio-summary');
  if (summary) summary.textContent = `${eco.soil}. ${eco.climate}`;

  const palette = ['#4ade80', '#2dd4bf', '#a3e635', '#34d399', '#38bdf8'];
  const zoneCodes = ['Zona A · Dosel', 'Zona B · Corredor', 'Zona C · Estrato', 'Zona D · Riparia', 'Zona E · Núcleo'];

  const floraList = $('#bio-flora-list');
  if (floraList) {
    floraList.innerHTML = eco.flora.map((f, idx) => `
      <div class="bio-card-entry flora-interactive-entry ${floraState.selectedSpecies === idx ? 'active' : ''}" data-flora-idx="${idx}" title="Haz clic para localizar y marcar la zona de esta especie en el mapa y modelo 3D">
        <div class="bio-entry-top">
          <span class="flora-entry-title-wrap">
            <span class="flora-zone-swatch" style="background:${palette[idx % palette.length]}"></span>
            <b class="bio-entry-name">${f.name}</b>
          </span>
          <i class="bio-entry-latin">${f.latin}</i>
        </div>
        <div class="bio-entry-bottom">
          <span class="bio-entry-badge">${f.type} · ${zoneCodes[idx % zoneCodes.length]}</span>
          <span class="bio-entry-note">${f.note}</span>
        </div>
      </div>
    `).join('');

    floraList.querySelectorAll('.flora-interactive-entry').forEach((card) => {
      card.addEventListener('click', () => {
        const idx = Number(card.getAttribute('data-flora-idx'));
        const isSame = floraState.zonesActive && floraState.selectedSpecies === idx;
        if (isSame) {
          setFloraZonesActive(true, -1);
        } else {
          setFloraZonesActive(true, idx);
        }
        floraList.querySelectorAll('.flora-interactive-entry').forEach((c, i) => {
          c.classList.toggle('active', floraState.selectedSpecies === i);
        });
      });
    });
  }

  const faunaList = $('#bio-fauna-list');
  if (faunaList) {
    faunaList.innerHTML = eco.fauna.map(f => `
      <div class="bio-card-entry">
        <div class="bio-entry-top">
          <b class="bio-entry-name">${f.name}</b>
          <i class="bio-entry-latin">${f.latin}</i>
        </div>
        <div class="bio-entry-bottom">
          <span class="bio-entry-badge">${f.class}</span>
          <span class="bio-entry-note">${f.status}</span>
        </div>
      </div>
    `).join('');
  }

  const climateEl = $('#bio-climate');
  if (climateEl) climateEl.textContent = eco.climate.split('(')[0].trim();

  const canopyEl = $('#bio-canopy');
  if (canopyEl) canopyEl.textContent = eco.canopy;

  const soilEl = $('#bio-soil');
  if (soilEl) soilEl.textContent = eco.soil;

  if (floraState.zonesActive) {
    updateFloraZonesOnMap();
  }
}

window.updateBiodiversityCard = updateBiodiversity;
map.on('moveend', () => {
  const bioDrawer = $('#drawer-bio');
  if ((bioDrawer && !bioDrawer.hidden) || floraState.zonesActive) updateBiodiversity();
});

// Biodiversity Card Subtabs & Close
document.querySelectorAll('.bio-subtab').forEach((tab) => {
  tab.addEventListener('click', (e) => {
    document.querySelectorAll('.bio-subtab').forEach((t) => t.classList.remove('active'));
    e.currentTarget.classList.add('active');
    const tabKey = e.currentTarget.getAttribute('data-biotab');
    ['flora', 'fauna', 'climate'].forEach((k) => {
      const panel = $(`#panel-bio-${k}`);
      if (panel) panel.style.display = k === tabKey ? 'flex' : 'none';
    });
  });
});

// Studio Toolbar: Render Mode Buttons (Urbano GIS | Maqueta 3D Monocromática | Nolli B/N)
$('#btn-render-model')?.addEventListener('click', () => {
  $('#btn-render-maqueta')?.classList.remove('active');
  $('#btn-render-nolli-3d')?.classList.remove('active');
  $('#btn-render-model')?.classList.add('active');
  $('#btn-render-model .axiom-island-dot, #btn-render-model .axiom-dot')?.classList.add('active');
  $('#btn-render-maqueta .axiom-island-dot, #btn-render-maqueta .axiom-dot, #btn-render-nolli-3d .axiom-island-dot')?.classList.remove('active');
  selectView('model');
  if (window.set3DNolliMode) window.set3DNolliMode(false);
  toggleMaquetaMode(false);
});

$('#btn-render-maqueta')?.addEventListener('click', () => {
  $('#btn-render-model')?.classList.remove('active');
  $('#btn-render-nolli-3d')?.classList.remove('active');
  $('#btn-render-maqueta')?.classList.add('active');
  $('#btn-render-maqueta .axiom-island-dot, #btn-render-maqueta .axiom-dot')?.classList.add('active');
  $('#btn-render-model .axiom-island-dot, #btn-render-model .axiom-dot, #btn-render-nolli-3d .axiom-island-dot')?.classList.remove('active');
  selectView('model');
  if (window.set3DNolliMode) window.set3DNolliMode(false);
  toggleMaquetaMode(true);
});

$('#btn-render-nolli-3d')?.addEventListener('click', () => {
  $('#btn-render-model')?.classList.remove('active');
  $('#btn-render-maqueta')?.classList.remove('active');
  $('#btn-render-nolli-3d')?.classList.add('active');
  $('#btn-render-nolli-3d .axiom-island-dot')?.classList.add('active');
  $('#btn-render-model .axiom-island-dot, #btn-render-model .axiom-dot, #btn-render-maqueta .axiom-island-dot, #btn-render-maqueta .axiom-dot')?.classList.remove('active');
  selectView('model');
  if (window.set3DNolliMode) window.set3DNolliMode(true, false);
});

// Studio Toolbar: Camera Orbit 3D, Isométrica 45° & Cenital
$('#cam-persp')?.addEventListener('click', (e) => {
  document.querySelectorAll('#cam-persp, #cam-iso45, #cam-top').forEach((b) => b.classList.remove('active'));
  e.currentTarget.classList.add('active');
  selectView('model');
  setCameraView('persp');
});
$('#cam-iso45')?.addEventListener('click', (e) => {
  document.querySelectorAll('#cam-persp, #cam-iso45, #cam-top').forEach((b) => b.classList.remove('active'));
  e.currentTarget.classList.add('active');
  selectView('model');
  setCameraView('iso45');
});
$('#cam-top')?.addEventListener('click', (e) => {
  document.querySelectorAll('#cam-persp, #cam-iso45, #cam-top').forEach((b) => b.classList.remove('active'));
  e.currentTarget.classList.add('active');
  selectView('model');
  setCameraView('top');
});

// Studio Top Bar / Left Dock Openers for Full Vector Map & Axonometric Illustrator
window.openVectorMapStudio = async () => {
  if (!model) return;
  await loadMapMod();
  syncMapControls();
  renderMap(true);
};
window.openIllustratorStudio = () => {
  if (!model) return;
  openIllustrator();
};

/* ---------------- Walking Distance / Radios de Proximidad (2D Map + 3D Studio) ---------------- */

const walkState = {
  active: false,
  minutes: '15',
  speedKmh: 4.8,
  mode: '4.8',
  customRadiusM: 1200,
  customOrigin: null,
  pickingOrigin: false,
  layerGroup: L.layerGroup().addTo(map)
};

function getCenterCoords() {
  if (walkState.customOrigin) return walkState.customOrigin;
  if (model && model.center) return [model.center.lat, model.center.lon];
  const c = map.getCenter();
  return [c.lat, c.lng];
}

function offsetLatLon(lat, lon, distMeters, bearingDeg) {
  const earthRadius = 6378137;
  const brng = (bearingDeg * Math.PI) / 180;
  const dLat = (distMeters * Math.cos(brng)) / earthRadius;
  const dLon = (distMeters * Math.sin(brng)) / (earthRadius * Math.cos((Math.PI * lat) / 180));
  return [lat + (dLat * 180) / Math.PI, lon + (dLon * 180) / Math.PI];
}

function updateWalkingDistanceDisplay() {
  walkState.layerGroup.clearLayers();
  const walkPill = $('#walk-distance-pill');

  if (!walkState.active) {
    if (walkPill) walkPill.hidden = true;
    $('#map-btn-walk')?.classList.remove('active');
    $('#btn-toggle-radii')?.classList.remove('active');
    setWalkRings(false);
    return;
  }

  if (walkPill) walkPill.hidden = false;
  $('#map-btn-walk')?.classList.add('active');
  $('#btn-toggle-radii')?.classList.add('active');

  const [lat, lon] = getCenterCoords();
  let rMax = 1200;
  let tMax = Number(walkState.minutes) || 15;
  if (walkState.mode === 'custom') {
    rMax = walkState.customRadiusM || 1200;
  } else {
    const spd = walkState.speedKmh || 4.8;
    rMax = Math.round((spd * (tMax / 60)) * 1000);
  }

  const r1 = Math.max(50, Math.round(rMax / 3));
  const r2 = Math.max(100, Math.round((rMax * 2) / 3));
  const r3 = rMax;

  const t1 = Math.max(1, Math.round(tMax / 3));
  const t2 = Math.max(2, Math.round((tMax * 2) / 3));
  const t3 = tMax;

  const rings = [
    { r: r1, min: t1, color: '#ffffff', weight: 2.2, op: 0.92, fillColor: '#e2e8f0', fillOp: 0.12, label: `${t1} min · ${r1 >= 1000 ? (r1 / 1000).toFixed(1) + ' km' : r1 + ' m'}` },
    { r: r2, min: t2, color: '#cbd5e1', weight: 1.8, op: 0.78, fillColor: '#cbd5e1', fillOp: 0.07, label: `${t2} min · ${r2 >= 1000 ? (r2 / 1000).toFixed(1) + ' km' : r2 + ' m'}` },
    { r: r3, min: t3, color: '#94a3b8', weight: 1.5, op: 0.65, fillColor: '#94a3b8', fillOp: 0.04, label: `${t3} min · ${r3 >= 1000 ? (r3 / 1000).toFixed(1) + ' km' : r3 + ' m'}` }
  ];

  rings.forEach(({ r, color, weight, op, fillColor, fillOp, label }) => {
    L.circle([lat, lon], {
      radius: r,
      color,
      weight,
      opacity: op,
      fillColor,
      fillOpacity: fillOp,
      dashArray: '6 4',
      interactive: false
    }).addTo(walkState.layerGroup);

    // Floating distance/time tag directly on top of each concentric circle
    const labelPos = offsetLatLon(lat, lon, r, 0);
    const ringBadge = L.divIcon({
      html: `<div class="isochrone-ring-tag">${label}</div>`,
      className: 'isochrone-ring-tag-wrap',
      iconSize: [110, 22],
      iconAnchor: [55, 11]
    });
    L.marker(labelPos, { icon: ringBadge, interactive: false }).addTo(walkState.layerGroup);
  });

  // Center pin badge marker
  const placeName = $('#q')?.value?.split(',')?.[0]?.trim() || (model ? 'Origen Isócrona' : 'Punto de Origen');
  const pinHtml = `
    <div class="walk-pin-wrapper">
      <div class="walk-pin-tag">${placeName}</div>
      <div class="walk-pin-dot"></div>
    </div>
  `;
  const pinIcon = L.divIcon({ html: pinHtml, className: 'walk-center-icon', iconSize: [140, 44], iconAnchor: [70, 44] });
  L.marker([lat, lon], { icon: pinIcon, interactive: false }).addTo(walkState.layerGroup);

  // Sync 3D preview rings
  setWalkRings(true, walkState.minutes);

  // Update metrics chips inside radii-card
  const wp5 = $('#walk-pois-5'); if (wp5) wp5.textContent = `${r1} m`;
  const wp10 = $('#walk-pois-10'); if (wp10) wp10.textContent = `${r2} m`;
  const wp15 = $('#walk-pois-15'); if (wp15) wp15.textContent = `${r3 >= 1000 ? (r3 / 1000).toFixed(1) + ' km' : r3 + ' m'}`;
  const tag1 = $('#walk-tag-1'); if (tag1) tag1.textContent = `${t1} min · Proximidad inmediata`;
  const tag2 = $('#walk-tag-2'); if (tag2) tag2.textContent = `${t2} min · Barrio caminable`;
  const tag3 = $('#walk-tag-3'); if (tag3) tag3.textContent = `${t3} min · Radio extendido`;
  const timeDisp = $('#walk-time-display'); if (timeDisp) timeDisp.textContent = `${tMax} min`;
  const distDisp = $('#walk-dist-display'); if (distDisp) distDisp.textContent = `${rMax.toLocaleString()} m`;
  const radiiCoords = $('#radii-coords'); if (radiiCoords) radiiCoords.textContent = walkState.mode === 'custom' ? `Radio directo a ${rMax} m` : `Isócronas a ${walkState.speedKmh} km/h`;
}
window.updateWalkingDistanceDisplay = updateWalkingDistanceDisplay;

function setWalkActive(active) {
  walkState.active = active;
  const sw1 = $('#walk-switch-active');
  const sw2 = $('#map-walk-switch');
  if (sw1) sw1.checked = active;
  if (sw2) sw2.checked = active;
  updateWalkingDistanceDisplay();
}

function setWalkMinutes(min) {
  walkState.minutes = String(min);
  const slider = $('#walk-time-slider');
  if (slider) slider.value = String(min);
  document.querySelectorAll('[data-walk], [data-walktime]').forEach((b) => {
    const val = b.dataset.walk || b.dataset.walktime;
    b.classList.toggle('active', val === walkState.minutes);
  });
  updateWalkingDistanceDisplay();
}

$('#walk-speed-select')?.addEventListener('change', (e) => {
  const val = e.target.value;
  walkState.mode = val;
  if (val === 'custom') {
    $('#walk-time-row')?.setAttribute('hidden', '');
    $('#walk-dist-row')?.removeAttribute('hidden');
  } else {
    walkState.speedKmh = Number(val);
    $('#walk-time-row')?.removeAttribute('hidden');
    $('#walk-dist-row')?.setAttribute('hidden', '');
  }
  updateWalkingDistanceDisplay();
});

$('#walk-time-slider')?.addEventListener('input', (e) => {
  const val = Number(e.target.value);
  walkState.minutes = String(val);
  const timeDisp = $('#walk-time-display'); if (timeDisp) timeDisp.textContent = `${val} min`;
  document.querySelectorAll('[data-walk], [data-walktime]').forEach((b) => {
    const bVal = b.dataset.walk || b.dataset.walktime;
    b.classList.toggle('active', bVal === walkState.minutes);
  });
  updateWalkingDistanceDisplay();
});

$('#walk-distance-slider')?.addEventListener('input', (e) => {
  const val = Number(e.target.value);
  walkState.customRadiusM = val;
  const distDisp = $('#walk-dist-display'); if (distDisp) distDisp.textContent = `${val.toLocaleString()} m`;
  updateWalkingDistanceDisplay();
});

$('#map-btn-walk')?.addEventListener('click', () => {
  const next = !walkState.active;
  setWalkActive(next);
});
$('#map-walk-switch')?.addEventListener('change', (e) => {
  setWalkActive(e.target.checked);
});
$('#walk-switch-active')?.addEventListener('change', (e) => {
  setWalkActive(e.target.checked);
});

$('#btn-pick-walk-origin')?.addEventListener('click', () => {
  walkState.pickingOrigin = !walkState.pickingOrigin;
  const btn = $('#btn-pick-walk-origin');
  if (btn) {
    btn.classList.toggle('active', walkState.pickingOrigin);
    btn.textContent = walkState.pickingOrigin ? 'Haz clic en el mapa para fijar origen...' : 'Fijar punto de origen en mapa';
  }
});

map.on('click', (e) => {
  if (walkState.pickingOrigin) {
    walkState.customOrigin = [e.latlng.lat, e.latlng.lng];
    walkState.pickingOrigin = false;
    const btn = $('#btn-pick-walk-origin');
    if (btn) {
      btn.classList.remove('active');
      btn.textContent = 'Cambiar punto de origen en mapa';
    }
    setWalkActive(true);
  }
});

document.querySelectorAll('[data-walk]').forEach((b) => {
  b.addEventListener('click', () => setWalkMinutes(b.dataset.walk));
});
document.querySelectorAll('[data-walktime]').forEach((b) => {
  b.addEventListener('click', () => setWalkMinutes(b.dataset.walktime));
});

// GeoJSON Isochrone Exporter for QGIS
function createCirclePolygon(centerLat, centerLon, radiusMeters, properties) {
  const points = 64;
  const coords = [];
  const earthRadius = 6378137;
  const dLat = radiusMeters / earthRadius;
  const dLon = radiusMeters / (earthRadius * Math.cos(Math.PI * centerLat / 180));
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const pLat = centerLat + (dLat * Math.sin(theta)) * (180 / Math.PI);
    const pLon = centerLon + (dLon * Math.cos(theta)) * (180 / Math.PI);
    coords.push([Number(pLon.toFixed(6)), Number(pLat.toFixed(6))]);
  }
  return {
    type: 'Feature',
    properties,
    geometry: {
      type: 'Polygon',
      coordinates: [coords]
    }
  };
}

$('#btn-export-isochrones')?.addEventListener('click', () => {
  const [lat, lon] = getCenterCoords();
  const speed = walkState.speedKmh || 4.8;
  const tMax = Number(walkState.minutes) || 15;
  const rMax = walkState.mode === 'custom' ? walkState.customRadiusM : Math.round((speed * (tMax / 60)) * 1000);
  const r1 = Math.max(50, Math.round(rMax / 3));
  const r2 = Math.max(100, Math.round((rMax * 2) / 3));
  const r3 = rMax;
  const t1 = Math.max(1, Math.round(tMax / 3));
  const t2 = Math.max(2, Math.round((tMax * 2) / 3));
  const t3 = tMax;

  const featureCollection = {
    type: 'FeatureCollection',
    name: 'Urbanized_Walking_Distance_Isochrones',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
    features: [
      createCirclePolygon(lat, lon, r1, { time_min: t1, radius_m: r1, speed_kmh: speed, label: `${t1} min Isochrone` }),
      createCirclePolygon(lat, lon, r2, { time_min: t2, radius_m: r2, speed_kmh: speed, label: `${t2} min Isochrone` }),
      createCirclePolygon(lat, lon, r3, { time_min: t3, radius_m: r3, speed_kmh: speed, label: `${t3} min Isochrone` })
    ]
  };
  const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: 'application/geo+json' });
  save(blob, `urbanized_isocronas_${lat.toFixed(4)}_${lon.toFixed(4)}.geojson`);
});

map.on('move', () => {
  if (walkState.active && !walkState.customOrigin && !model) {
    updateWalkingDistanceDisplay();
  }
});

// GIS Layer Visibility Checkboxes & Axiom Dot-List Buttons
document.querySelectorAll('[data-gislayer]').forEach((el) => {
  if (el.tagName === 'INPUT') {
    el.addEventListener('change', (e) => {
      const layerKey = e.target.getAttribute('data-gislayer');
      setLayerVisibility(layerKey, e.target.checked);
    });
  } else {
    el.addEventListener('click', () => {
      const layerKey = el.getAttribute('data-gislayer');
      const nextActive = !el.classList.contains('active');
      el.classList.toggle('active', nextActive);
      el.setAttribute('aria-pressed', String(nextActive));
      setLayerVisibility(layerKey, nextActive);
    });
  }
});

// Direct QGIS GeoJSON Export
$('#btn-export-qgis-direct')?.addEventListener('click', async () => {
  if (!model) return;
  try {
    const blob = await FORMATS.geojson.make(model);
    const name = `urbanized_qgis_${model.center.lat.toFixed(4)}_${model.center.lon.toFixed(4)}_${model.size}m.geojson`;
    save(blob, name);
  } catch (err) {
    console.error('GeoJSON export error:', err);
  }
});

// ---------------- 3D Studio: Real Aerial Satellite & Contour Tools (Imagen 1) ----------------
function syncSatelliteDrawer() {
  const st = studioState.satellite;
  const ct = studioState.contours;
  const bd = studioState.buildings;
  const satSw = $('#sat-active-toggle'); if (satSw) satSw.checked = st.enabled;
  const satS = $('#sat-saturation'); if (satS) satS.value = st.saturation;
  const satC = $('#sat-contrast'); if (satC) satC.value = st.contrast;
  const satB = $('#sat-brightness'); if (satB) satB.value = st.brightness;
  const satI = $('#sat-invert'); if (satI) satI.value = st.invert;
  const valS = $('#sat-val-saturation'); if (valS) valS.textContent = st.saturation === 0 ? '0% (B/N)' : `${st.saturation}%`;
  const valC = $('#sat-val-contrast'); if (valC) valC.textContent = `${st.contrast}%`;
  const valB = $('#sat-val-brightness'); if (valB) valB.textContent = `${st.brightness}%`;
  const valI = $('#sat-val-invert'); if (valI) valI.textContent = `${st.invert}%`;
  document.querySelectorAll('[data-satbldg]').forEach((b) => b.classList.toggle('active', b.dataset.satbldg === bd.finish));
  const cVis = $('#sat-contour-visible'); if (cVis) cVis.checked = ct.visible;
  const cLab = $('#sat-contour-labels'); if (cLab) cLab.checked = ct.labels;
  const cCol = $('#sat-contour-color'); if (cCol) cCol.value = ct.color;
}
window.syncSatelliteDrawer = syncSatelliteDrawer;

$('#sat-active-toggle')?.addEventListener('change', (e) => {
  updateSatelliteTexture({ enabled: e.target.checked });
});
$('#sat-saturation')?.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  const out = $('#sat-val-saturation'); if (out) out.textContent = v === 0 ? '0% (B/N)' : `${v}%`;
  updateSatelliteTexture({ saturation: v });
});
$('#sat-contrast')?.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  const out = $('#sat-val-contrast'); if (out) out.textContent = `${v}%`;
  updateSatelliteTexture({ contrast: v });
});
$('#sat-brightness')?.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  const out = $('#sat-val-brightness'); if (out) out.textContent = `${v}%`;
  updateSatelliteTexture({ brightness: v });
});
$('#sat-invert')?.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  const out = $('#sat-val-invert'); if (out) out.textContent = `${v}%`;
  updateSatelliteTexture({ invert: v });
});
document.querySelectorAll('[data-satbldg]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-satbldg]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    setBuildingFinish(btn.dataset.satbldg);
  });
});
$('#sat-contour-visible')?.addEventListener('change', (e) => {
  setContourOptions({ visible: e.target.checked });
});
$('#sat-contour-labels')?.addEventListener('change', (e) => {
  setContourOptions({ labels: e.target.checked });
});
$('#sat-contour-color')?.addEventListener('change', (e) => {
  setContourOptions({ color: e.target.value });
});
$('#sat-btn-reset')?.addEventListener('click', () => {
  updateSatelliteTexture({ enabled: true, saturation: 100, contrast: 100, brightness: 100, invert: 0 });
  setBuildingFinish('gis');
  setContourOptions({ visible: true, labels: true, color: '#ffffff' });
  syncSatelliteDrawer();
});
$('#sat-btn-bn-arch')?.addEventListener('click', () => {
  updateSatelliteTexture({ enabled: true, saturation: 0, contrast: 150, brightness: 75, invert: 0 });
  setBuildingFinish('white');
  setContourOptions({ visible: true, labels: true, color: '#ffffff' });
  syncSatelliteDrawer();
});

// ---------------- Custom Pins & Markers Engine (Imagen 3) ----------------
const pinMapLayer = L.layerGroup().addTo(map);

function updatePinsOnMap() {
  pinMapLayer.clearLayers();
  const pins = pinStore.getPins();
  const badge = $('#pins-count-badge');
  if (badge) badge.textContent = String(pins.length);

  for (const p of pins) {
    if (!p.visible) continue;
    const icon = L.divIcon({
      html: `
        <div class="map-custom-pin" style="--pin-color:${p.color}; --pin-border-color:${p.color};">
          <div class="pin-label-pill">${p.label}</div>
          <div class="pin-stem"></div>
          <div class="pin-dot-anchor"></div>
        </div>
      `,
      className: 'map-custom-pin-wrap',
      iconSize: [120, 48],
      iconAnchor: [60, 48]
    });
    L.marker([p.lat, p.lon], { icon, interactive: true }).addTo(pinMapLayer);
  }
}

function renderPinsDrawerList() {
  const listEl = $('#studio-pins-list');
  const emptyNotice = $('#pins-empty-notice');
  const badge = $('#pins-count-badge');
  const paletteEl = $('#pin-color-palette');
  if (!listEl) return;

  // Render color swatches
  if (paletteEl && !paletteEl.children.length) {
    for (const c of PIN_COLORS) {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = `pin-color-swatch ${c.hex === pinStore.activeColor ? 'active' : ''}`;
      sw.style.setProperty('--swatch-color', c.hex);
      sw.title = c.name;
      sw.addEventListener('click', () => {
        pinStore.activeColor = c.hex;
        paletteEl.querySelectorAll('.pin-color-swatch').forEach((s) => s.classList.remove('active'));
        sw.classList.add('active');
      });
      paletteEl.appendChild(sw);
    }
  }

  const pins = pinStore.getPins();
  if (badge) badge.textContent = String(pins.length);

  if (!pins.length) {
    if (emptyNotice) emptyNotice.hidden = false;
    listEl.innerHTML = '';
    if (emptyNotice) listEl.appendChild(emptyNotice);
    return;
  }

  listEl.innerHTML = '';
  for (const pin of pins) {
    const row = document.createElement('div');
    row.className = 'studio-pin-row';
    const isVis = pin.visible !== false;
    const curStyle = pin.style || 'glass';
    const curHeight = pin.needleHeight || 45;

    row.innerHTML = `
      <div class="studio-pin-main-row">
        <button type="button" class="studio-pin-vis-btn ${isVis ? 'active' : ''}" title="${isVis ? 'Ocultar hito' : 'Mostrar hito'}">
          ${isVis ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'}
        </button>
        <input type="color" class="studio-pin-color-pick" value="${pin.color}" title="Cambiar color del hito">
        <input type="text" class="studio-pin-name-input" value="${pin.label}">
        <select class="studio-pin-style-select" title="Estilo gráfico del cartel">
          <option value="glass" ${curStyle === 'glass' ? 'selected' : ''}>Glass</option>
          <option value="white" ${curStyle === 'white' ? 'selected' : ''}>Blanco</option>
          <option value="accent" ${curStyle === 'accent' ? 'selected' : ''}>Acento</option>
          <option value="wire" ${curStyle === 'wire' ? 'selected' : ''}>Línea</option>
        </select>
        <button type="button" class="studio-pin-del" title="Eliminar marcador">&times;</button>
      </div>
      <div class="studio-pin-height-row">
        <span class="axiom-label" style="font-size:9.5px;">Mástil:</span>
        <input type="range" min="10" max="150" step="5" value="${curHeight}" class="studio-pin-height-slider axiom-range" title="Estirar mástil del hito">
        <span class="studio-pin-height-val">${curHeight} m</span>
      </div>
    `;

    const visBtn = row.querySelector('.studio-pin-vis-btn');
    visBtn.addEventListener('click', () => {
      pinStore.updatePin(pin.id, { visible: !isVis });
    });

    const colInp = row.querySelector('.studio-pin-color-pick');
    colInp.addEventListener('input', (e) => {
      pinStore.updatePin(pin.id, { color: e.target.value });
    });

    const inp = row.querySelector('.studio-pin-name-input');
    inp.addEventListener('change', (e) => {
      pinStore.updatePin(pin.id, { label: e.target.value });
    });

    const selStyle = row.querySelector('.studio-pin-style-select');
    selStyle.addEventListener('change', (e) => {
      pinStore.updatePin(pin.id, { style: e.target.value });
    });

    const hSlider = row.querySelector('.studio-pin-height-slider');
    const hVal = row.querySelector('.studio-pin-height-val');
    hSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      if (hVal) hVal.textContent = `${val} m`;
      pinStore.updatePin(pin.id, { needleHeight: val });
    });

    const del = row.querySelector('.studio-pin-del');
    del.addEventListener('click', () => {
      pinStore.removePin(pin.id);
    });

    listEl.appendChild(row);
  }
}
window.renderPinsDrawerList = renderPinsDrawerList;

pinStore.subscribe(() => {
  updatePinsOnMap();
  renderPinsDrawerList();
});

$('#btn-pin-place-toggle')?.addEventListener('click', () => {
  const next = !pinStore.isPlacing();
  pinStore.setPlacingMode(next);
  const btn = $('#btn-pin-place-toggle');
  if (btn) {
    btn.classList.toggle('active', next);
    const span = btn.querySelector('span');
    if (span) span.textContent = next ? 'Haz clic en el modelo para colocar Pin...' : 'Hacer clic en el modelo para colocar Pin';
  }
});

$('#pin-type-select')?.addEventListener('change', (e) => {
  pinStore.activeType = e.target.value;
});

$('#btn-pins-clear-all')?.addEventListener('click', () => {
  if (confirm('¿Eliminar todos los pines colocados?')) pinStore.clearPins();
});

$('#btn-export-pins-geojson')?.addEventListener('click', () => {
  pinStore.exportGeoJSONFile();
});

// Map island pins toggle
$('#map-btn-pins')?.addEventListener('click', () => {
  const next = !pinStore.isPlacing();
  pinStore.setPlacingMode(next);
  $('#map-btn-pins')?.classList.toggle('active', next);
  if (next) {
    if (window.toggleLeftPanel) window.toggleLeftPanel('pins', true);
  }
});

// Leaflet map click to drop pin when in placing mode
map.on('click', (e) => {
  if (pinStore.isPlacing()) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    let x = 0, y = 0, z = 0;
    if (model && model.center) {
      x = (lon - model.center.lon) * (111319.49 * Math.cos((model.center.lat * Math.PI) / 180));
      y = (lat - model.center.lat) * 111319.49;
    }
    pinStore.addPin({ x, y, z, lat, lon });
    pinStore.setPlacingMode(false);
    $('#map-btn-pins')?.classList.remove('active');
    const btn = $('#btn-pin-place-toggle');
    if (btn) {
      btn.classList.remove('active');
      const span = btn.querySelector('span');
      if (span) span.textContent = 'Hacer clic en el modelo para colocar Pin';
    }
  }
});

async function renderSecQuota() {
  const counted = isCounted(`sec:${secState.model?.id}`);
  const remaining = await quotaStatus();
  const el = $('#sec-quota');
  if (!el) return;
  const vars = { n: remaining, limit: LIMIT };
  if (billing.state.billing) {
    // с кредитами: сверх дневного лимита разрез стоит 1 кредит — показываем цену, а не «лимит»
    const id = `sec:${secState.model?.id}`;
    const paid = coveredBy(id, billing.state.paid);
    const q = quote({ area: 0, freeLeft: billing.state.freeLeft, counted, paid });
    el.textContent = paid ? t('quota.paid')
      : q.total ? t('quota.cost', { c: billing.creditsLabel(q.total), usd: creditsUsd(q.total) })
      : counted ? t('quota.counted', vars) : t('quota.left', vars);
    if (billing.state.user) el.textContent += ` · ${t('quota.creditsLeft', { c: billing.creditsLabel(billing.state.user.credits) })}`;
  } else {
    el.textContent = counted ? t('quota.counted', vars) : remaining > 0 ? t('quota.left', vars) : t('quota.none');
  }
  document.querySelectorAll('.dl[data-section]').forEach((b) => { b.disabled = !billing.state.billing && remaining <= 0 && !counted; });
}

document.querySelectorAll('.dl[data-section]').forEach((btn) =>
  btn.addEventListener('click', async () => {
    const sec = secState.model;
    if (!sec || btn.classList.contains('busy')) return;
    const fmt = SECTION_FORMATS[btn.dataset.section];
    btn.querySelector('span').dataset.busy = t('dl.busy');
    btn.classList.add('busy');
    try {
      const blob = await fmt.make(sec);
      const q = await consume(`sec:${sec.id}`);
      if (!q.ok) return;
      save(blob, `urbanized_section_${(sec.length / 1000).toFixed(2)}km.${fmt.ext}`);
      billing.track(`sec:${fmt.ext}`);
    } catch (err) {
      console.error(err);
      setSecStatus('status.fileError', { error: true, vars: { ext: fmt.ext.toUpperCase() } });
    } finally {
      btn.classList.remove('busy');
      renderSecQuota();
    }
  }),
);

/* ---------------- Режим панели: модель или разрез ---------------- */


function setMode(next) {
  mode = next;
  document.querySelectorAll('[data-mode]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.mode === next));
    b.classList.toggle('active', b.dataset.mode === next);
  });
  const modelTools = $('#model-tools');
  if (modelTools) modelTools.hidden = next !== 'model';
  const sectionTools = $('#section-tools');
  if (sectionTools) sectionTools.hidden = next !== 'section';
  if (frame) frame.hidden = next !== 'model';

  // Automatically enable drawing when switching to section mode
  if (next === 'section') {
    secState.drawing = true;
    $('#sec-draw')?.setAttribute('aria-pressed', 'true');
    const guidance = $('#section-guidance');
    if (guidance && secState.points.length < 2) guidance.hidden = false;
  } else {
    secState.drawing = false;
    $('#sec-draw')?.setAttribute('aria-pressed', 'false');
    const guidance = $('#section-guidance');
    if (guidance) guidance.hidden = true;
  }

  siteRedraw();
  secRedraw();
  map.getContainer().parentElement?.classList.toggle('drawing', (next === 'section' && secState.drawing) || (next === 'model' && site.drawing));
  setTimeout(() => map.invalidateSize(), 50);
}
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

/* ---------------- Граница участка ---------------- */

const site = { points: [], shape: null, dots: [], drawing: false };

function siteRedraw() {
  site.shape?.remove();
  site.dots.forEach((d) => d.remove());
  site.dots = [];
  site.shape = null;
  const shown = mode === 'model' ? site.points : [];
  if (shown.length > 2) site.shape = L.polygon(shown, { color: 'rgba(255, 255, 255, 0.85)', weight: 1.5, fillOpacity: 0.06 }).addTo(map);
  else if (shown.length === 2) site.shape = L.polyline(shown, { color: 'rgba(255, 255, 255, 0.85)', weight: 1.5, dashArray: '4 4' }).addTo(map);
  site.dots = shown.map((p) => L.circleMarker(p, { radius: 3.5, color: '#ffffff', weight: 1.5, fillColor: '#0a0a0c', fillOpacity: 1 }).addTo(map));
  const siteClear = $('#site-clear'); if (siteClear) siteClear.disabled = !site.points.length;
  const siteInfo = $('#site-info'); if (siteInfo) siteInfo.textContent = site.points.length > 2 ? `${site.points.length} ${t('site.points')}` : '—';
  applySite();
}

// граница переводится в координаты модели и кладётся на рельеф
function applySite() {
  if (!model) return;
  const ring = site.points.length > 2
    ? site.points.map(([la, lo]) => {
      const [x, y] = model.frame.toLocal(la, lo);
      return [x, y, model.grid.heightAt(x, y) + 0.5];
    })
    : null;
  model.site = ring;
  illu?.setSite(ring);
  renderFeasibilityVolume();
  syncFeasibilityDrawer();
  const resEl = $('#result');
  if (resEl && !resEl.hidden) refreshPlan(model);
}

// ---------------- Factibilidad Paramétrica (Turf.js + Gemini Flash-Lite) ----------------
function syncFeasibilityDrawer() {
  const p = feasibilityStore.params;
  const m = feasibilityStore.compute(model);
  const loc = locale();

  const sw = $('#feas-enabled-toggle'); if (sw) sw.checked = p.enabled;
  const sCos = $('#feas-cos'); if (sCos) sCos.value = p.cos;
  const sCus = $('#feas-cus'); if (sCus) sCus.value = p.cus;
  const sLvl = $('#feas-levels'); if (sLvl) sLvl.value = p.max_levels;
  const sFrt = $('#feas-front'); if (sFrt) sFrt.value = p.front_setback_m;
  const sSid = $('#feas-side'); if (sSid) sSid.value = p.side_setback_m;

  const vCos = $('#feas-val-cos'); if (vCos) vCos.textContent = `${p.cos}%`;
  const vCus = $('#feas-val-cus'); if (vCus) vCus.textContent = Number(p.cus).toFixed(2);
  const vLvl = $('#feas-val-levels'); if (vLvl) vLvl.textContent = `${p.max_levels} niveles`;
  const vFrt = $('#feas-val-front'); if (vFrt) vFrt.textContent = `${Number(p.front_setback_m).toFixed(1)} m`;
  const vSid = $('#feas-val-side'); if (vSid) vSid.textContent = `${Number(p.side_setback_m).toFixed(1)} m`;

  // Modo de Geometría
  document.querySelectorAll('[data-feasmode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.feasmode === feasibilityStore.geometryMode);
  });

  // Rotación y dimensiones del lote
  const sRot = $('#feas-rot'); if (sRot) sRot.value = feasibilityStore.siteRotation;
  const vRot = $('#feas-val-rot'); if (vRot) vRot.textContent = `${feasibilityStore.siteRotation}°`;
  const inW = $('#feas-lot-w'); if (inW) inW.value = feasibilityStore.lotWidth;
  const inL = $('#feas-lot-l'); if (inL) inL.value = feasibilityStore.lotLength;

  // Botón de ubicar predio / lote
  const btnPick = $('#btn-feas-pick-location');
  if (btnPick) {
    if (feasibilityStore.isPlacingLot) {
      btnPick.style.background = '#0284c7';
      btnPick.style.color = '#ffffff';
      btnPick.innerHTML = '<span>📍 Clic en el terreno...</span>';
    } else {
      btnPick.style.background = '';
      btnPick.style.color = '';
      btnPick.innerHTML = '<span>📍 Ubicar Predio con Clic</span>';
    }
  }

  // Botón Paso 3: Clic en terreno para ubicar
  const btnClickPlace = $('#btn-feas-click-place');
  if (btnClickPlace) {
    if (feasibilityStore.isPlacingLot) {
      btnClickPlace.style.background = '#0284c7';
      btnClickPlace.style.color = '#ffffff';
      btnClickPlace.innerHTML = '<span>📍 Clic en el terreno para ubicar...</span>';
    } else {
      btnClickPlace.style.background = '';
      btnClickPlace.style.color = '';
      btnClickPlace.innerHTML = '<span data-i18n="feas.pickOnTerrain">📍 Clic en Terreno para Ubicar</span>';
    }
  }

  // Controles de proyecto 3D importado y manipulación libre
  const projName = $('#feas-project-name');
  if (projName) {
    projName.textContent = feasibilityStore.projectModel
      ? `Archivo cargado: ${feasibilityStore.projectModel.filename}`
      : '';
  }
  const sX = $('#feas-proj-x'); if (sX) sX.value = feasibilityStore.projectOffsetX;
  const vX = $('#feas-val-proj-x'); if (vX) vX.textContent = `${feasibilityStore.projectOffsetX} m`;
  const sY = $('#feas-proj-y'); if (sY) sY.value = feasibilityStore.projectOffsetY;
  const vY = $('#feas-val-proj-y'); if (vY) vY.textContent = `${feasibilityStore.projectOffsetY} m`;
  const sPZ = $('#feas-proj-z'); if (sPZ) sPZ.value = feasibilityStore.projectOffsetZ;
  const vPZ = $('#feas-val-proj-z'); if (vPZ) vPZ.textContent = `${Number(feasibilityStore.projectOffsetZ).toFixed(1)} m`;
  const sPRot = $('#feas-proj-rot'); if (sPRot) sPRot.value = feasibilityStore.projectRotY;
  const vPRot = $('#feas-val-proj-rot'); if (vPRot) vPRot.textContent = `${feasibilityStore.projectRotY}°`;
  const sScale = $('#feas-proj-scale'); if (sScale) sScale.value = feasibilityStore.projectScale;
  const vScale = $('#feas-val-proj-scale'); if (vScale) vScale.textContent = `${Number(feasibilityStore.projectScale).toFixed(2)}x`;

  // Acabado del proyecto
  document.querySelectorAll('#feas-project-finish-group [data-projfinish]').forEach((b) => {
    b.classList.toggle('active', b.dataset.projfinish === (feasibilityStore.projectFinish || 'white'));
  });

  const oLot = $('#feas-out-lot'); if (oLot) oLot.textContent = m.lotAreaM2.toLocaleString(loc);
  const oFp = $('#feas-out-footprint'); if (oFp) oFp.textContent = m.footprintAreaM2.toLocaleString(loc);
  const oGfa = $('#feas-out-gfa'); if (oGfa) oGfa.textContent = m.maxBuildableM2.toLocaleString(loc);
  const oH = $('#feas-out-height'); if (oH) oH.textContent = `${m.maxHeightM} m · ${m.effectiveLevels}N`;
}
window.syncFeasibilityDrawer = syncFeasibilityDrawer;

feasibilityStore.subscribe(() => {
  syncFeasibilityDrawer();
});

$('#feas-enabled-toggle')?.addEventListener('change', (e) => {
  feasibilityStore.setParams({ enabled: e.target.checked });
});
$('#feas-cos')?.addEventListener('input', (e) => {
  feasibilityStore.setParams({ cos: Number(e.target.value) });
});
$('#feas-cus')?.addEventListener('input', (e) => {
  feasibilityStore.setParams({ cus: Number(e.target.value) });
});
$('#feas-levels')?.addEventListener('input', (e) => {
  feasibilityStore.setParams({ max_levels: Number(e.target.value) });
});
$('#feas-front')?.addEventListener('input', (e) => {
  feasibilityStore.setParams({ front_setback_m: Number(e.target.value) });
});
$('#feas-side')?.addEventListener('input', (e) => {
  feasibilityStore.setParams({ side_setback_m: Number(e.target.value) });
});

// Selector de modo de geometría (envolvente, levantamiento, proyecto)
document.querySelectorAll('[data-feasmode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    feasibilityStore.setGeometryMode(btn.dataset.feasmode);
    renderFeasibilityVolume();
  });
});

// Ubicación y alineación
$('#btn-feas-pick-location')?.addEventListener('click', () => {
  feasibilityStore.setPlacingMode(!feasibilityStore.isPlacingLot);
  syncFeasibilityDrawer();
});
$('#btn-feas-click-place')?.addEventListener('click', () => {
  feasibilityStore.setPlacingMode(!feasibilityStore.isPlacingLot);
  syncFeasibilityDrawer();
});
$('#btn-feas-snap-building')?.addEventListener('click', () => {
  const b = feasibilityStore.snapToNearestBuilding(model);
  if (b) {
    renderFeasibilityVolume();
  } else {
    alert('No se encontró un edificio cercano al origen del lote.');
  }
});
$('#feas-rot')?.addEventListener('input', (e) => {
  feasibilityStore.setSiteRotation(Number(e.target.value));
  renderFeasibilityVolume();
});
$('#feas-lot-w')?.addEventListener('change', (e) => {
  feasibilityStore.setLotDimensions(e.target.value, $('#feas-lot-l')?.value);
  renderFeasibilityVolume();
});
$('#feas-lot-l')?.addEventListener('change', (e) => {
  feasibilityStore.setLotDimensions($('#feas-lot-w')?.value, e.target.value);
  renderFeasibilityVolume();
});

// Carga de archivo 3D de proyecto (.skp, .glb, .gltf, .obj)
$('#btn-feas-browse-file')?.addEventListener('click', () => {
  $('#feas-project-file-input')?.click();
});
$('#feas-project-file-input')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (file) {
    try {
      await loadProject3DFile(file);
      renderFeasibilityVolume();
      syncFeasibilityDrawer();
    } catch (err) {
      alert(`Error al cargar modelo 3D: ${err.message}`);
    }
  }
});

// Manipulación libre en terreno (Paso 3)
$('#feas-proj-x')?.addEventListener('input', (e) => {
  feasibilityStore.setProjectAdjustments({ offsetX: Number(e.target.value) });
  renderFeasibilityVolume();
});
$('#feas-proj-y')?.addEventListener('input', (e) => {
  feasibilityStore.setProjectAdjustments({ offsetY: Number(e.target.value) });
  renderFeasibilityVolume();
});
$('#feas-proj-z')?.addEventListener('input', (e) => {
  feasibilityStore.setProjectAdjustments({ offsetZ: Number(e.target.value) });
  renderFeasibilityVolume();
});
$('#feas-proj-rot')?.addEventListener('input', (e) => {
  feasibilityStore.setProjectAdjustments({ rotY: Number(e.target.value) });
  renderFeasibilityVolume();
});
$('#feas-proj-scale')?.addEventListener('input', (e) => {
  feasibilityStore.setProjectAdjustments({ scale: Number(e.target.value) });
  renderFeasibilityVolume();
});

// Selector de acabado del proyecto
document.querySelectorAll('#feas-project-finish-group [data-projfinish]').forEach((btn) => {
  btn.addEventListener('click', () => {
    feasibilityStore.setProjectAdjustments({ finish: btn.dataset.projfinish });
    renderFeasibilityVolume();
  });
});

$('#btn-parse-zoning')?.addEventListener('click', async () => {
  const inputEl = $('#feas-zoning-input');
  const statusEl = $('#feas-parse-status');
  const btn = $('#btn-parse-zoning');
  if (!inputEl || !inputEl.value.trim()) return;
  try {
    if (btn) btn.disabled = true;
    if (statusEl) statusEl.textContent = 'Analizando extracto con Gemini Flash-Lite...';
    const parsed = await feasibilityStore.parseZoningExtract(inputEl.value);
    if (statusEl) {
      statusEl.textContent = `✓ Aplicado: COS ${parsed.cos}% · CUS ${parsed.cus} · ${parsed.max_levels}N · Frontal ${parsed.front_setback_m}m · Lat ${parsed.side_setback_m}m`;
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = `⚠ ${err.message}`;
  } finally {
    if (btn) btn.disabled = false;
  }
});

$('#site-draw')?.addEventListener('click', () => {
  site.drawing = !site.drawing;
  if (site.drawing) { secState.drawing = false; if ($('#sec-draw')) $('#sec-draw').textContent = t('section.draw'); }
  $('#site-draw')?.setAttribute('aria-pressed', String(site.drawing));
  const sd = $('#site-draw'); if (sd) sd.textContent = t(site.drawing ? 'site.drawing' : 'site.draw');
  map.getContainer().parentElement?.classList.toggle('drawing', site.drawing || secState.drawing);
});
$('#site-clear')?.addEventListener('click', () => { site.points = []; siteRedraw(); });

/* ---------------- Иллюстрация ---------------- */

let illu = null, illuModel = null, placing = false, illuOpened = false;

$('#open-editor')?.addEventListener('click', () => {
  const box = $('#illustrator');
  illuOpened = true;
  billing.track('editor:illu');
  if (box) {
    box.hidden = false;
    openIllustrator();
    box.scrollIntoView({ behavior: 'smooth' });
  }
});

function openIllustrator() {
  if (!model) return;
  const canvas = $('#illu-canvas');
  if (!canvas) return;
  if (!illu || illuModel !== model) {
    illu = createIllustrator(canvas, model);
    illuModel = model;
    illu.setLang(lang);
    renderLabelList();
    renderSwatches();
  }
  const soilBadge = $('#illu-soil-badge');
  if (soilBadge && model.ecosystem?.soil) {
    soilBadge.textContent = model.ecosystem.soil;
  }
  renderIlluLayerStackControls();
  illu.render();
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => illu.render());
  }
}
window.openIllustratorStudio = openIllustrator;

const ILLU_LAYERS_INFO = [
  { key: 'buildings', name: 'Edificios 3D', icon: '🏛️' },
  { key: 'trees', name: 'Arbolado Urbano', icon: '🌳' },
  { key: 'roads', name: 'Red Vial y Puentes', icon: '🛣️' },
  { key: 'nature', name: 'Agua y Áreas Verdes', icon: '💧' },
  { key: 'contours', name: 'Curvas de Nivel Topográficas', icon: '🏔️' }
];
let illuLayerOrder = ['buildings', 'trees', 'roads', 'nature', 'contours'];

function renderIlluLayerStackControls() {
  const container = document.getElementById('illu-layer-stack');
  if (!container || !illu) return;

  container.innerHTML = illuLayerOrder.map((key, idx) => {
    const info = ILLU_LAYERS_INFO.find((l) => l.key === key) || { key, name: key, icon: '' };
    const isVisible = illu.state?.layers?.[key] !== false;

    return `
      <div class="axiom-layer-item" data-illukey="${key}" draggable="true">
        <div class="axiom-layer-head">
          <span class="layer-drag-handle" title="Arrastrar para sobreponer capa">⠿</span>
          <label class="axiom-layer-left">
            <input type="checkbox" class="layer-vis-cb" ${isVisible ? 'checked' : ''}>
            <span class="axiom-layer-icon">${info.icon}</span>
            <span class="axiom-layer-name">${info.name}</span>
          </label>
          <div class="axiom-layer-actions">
            <button type="button" class="layer-reorder-btn btn-layer-up" ${idx === 0 ? 'disabled' : ''} title="Subir nivel visual">▲</button>
            <button type="button" class="layer-reorder-btn btn-layer-down" ${idx === illuLayerOrder.length - 1 ? 'disabled' : ''} title="Bajar nivel visual">▼</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  let draggedIdx = null;
  container.querySelectorAll('.axiom-layer-item').forEach((itemEl, idx) => {
    const key = itemEl.getAttribute('data-illukey');
    const cb = itemEl.querySelector('.layer-vis-cb');
    const btnUp = itemEl.querySelector('.btn-layer-up');
    const btnDown = itemEl.querySelector('.btn-layer-down');

    cb?.addEventListener('change', () => {
      illu.setLayer(key, cb.checked);
      document.querySelectorAll(`[data-illlayer="${key}"]`).forEach(c => c.checked = cb.checked);
      if (window.showCadToast) window.showCadToast(`Capa ${key} ${cb.checked ? 'visible' : 'oculta'}`);
    });

    itemEl.addEventListener('dragstart', (e) => {
      if (e.target.closest('input, select, button')) { e.preventDefault(); return; }
      draggedIdx = idx;
      itemEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx));
    });
    itemEl.addEventListener('dragend', () => {
      itemEl.classList.remove('dragging');
      container.querySelectorAll('.axiom-layer-item').forEach(el => el.classList.remove('drag-over'));
    });
    itemEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      itemEl.classList.add('drag-over');
    });
    itemEl.addEventListener('dragleave', () => {
      itemEl.classList.remove('drag-over');
    });
    itemEl.addEventListener('drop', (e) => {
      e.preventDefault();
      itemEl.classList.remove('drag-over');
      if (draggedIdx === null || draggedIdx === idx) return;
      const moved = illuLayerOrder.splice(draggedIdx, 1)[0];
      illuLayerOrder.splice(idx, 0, moved);
      renderIlluLayerStackControls();
      illu.render();
      if (window.showCadToast) window.showCadToast('✓ Capa axonométrica sobrepuesta');
    });

    btnUp?.addEventListener('click', () => {
      if (idx > 0) {
        const temp = illuLayerOrder[idx];
        illuLayerOrder[idx] = illuLayerOrder[idx - 1];
        illuLayerOrder[idx - 1] = temp;
        renderIlluLayerStackControls();
        illu.render();
      }
    });

    btnDown?.addEventListener('click', () => {
      if (idx < illuLayerOrder.length - 1) {
        const temp = illuLayerOrder[idx];
        illuLayerOrder[idx] = illuLayerOrder[idx + 1];
        illuLayerOrder[idx + 1] = temp;
        renderIlluLayerStackControls();
        illu.render();
      }
    });
  });
}

// палитры редактора: основные цвета и, при раскраске по типам, цвета классов
const SWATCHES = ['bg', 'terrain', 'building', 'water', 'green', 'tree', 'road', 'roadMajor', 'bridge'];
const CLASSES = ['residential', 'public', 'commercial', 'industrial', 'utility', 'other'];
function renderSwatches() {
  if (!illu) return;
  const { base, classes } = illu.colors();
  const make = (box, keys, labelKey, current, onPick) => {
    if (!box) return;
    box.innerHTML = '';
    for (const key of keys) {
      if (!current[key]) continue;
      const label = document.createElement('label');
      label.className = 'swatch';
      const input = document.createElement('input');
      input.type = 'color';
      input.value = current[key];
      input.addEventListener('input', () => onPick(key, input.value));
      const span = document.createElement('span');
      span.textContent = t(`${labelKey}.${key}`);
      label.append(input, span);
      box.append(label);
    }
  };
  make($('#illu-swatches'), SWATCHES, 'color', base, (k, v) => illu.setColor(k, v));
  const byType = $('#illu-bytype')?.checked;
  if (byType) make($('#illu-class-swatches'), CLASSES, 'class', classes, (k, v) => illu.setClassColor(k, v));
  else if ($('#illu-class-swatches')) $('#illu-class-swatches').innerHTML = '';
}

function renderLabelList() {
  const ul = $('#illu-label-list');
  if (!ul || !illu) return;
  ul.innerHTML = '';
  for (const l of illu.labels()) {
    const li = document.createElement('li');
    const input = document.createElement('input');
    input.value = l.text;
    input.addEventListener('input', () => { l.text = input.value; illu.render(); });
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '×';
    del.addEventListener('click', () => { illu.removeLabel(l); renderLabelList(); });
    li.append(input, del);
    ul.append(li);
  }
}

{
  const canvas = $('#illu-canvas');
  if (canvas) {
    let drag = null;
    let draggingLabel = null;
    let dragLabelStart = null;

    canvas.addEventListener('pointerdown', (e) => {
      if (!illu) return;
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;

      if (placing) {
        const l = illu.addLabel(mx, my, t('illu.labelDefault'));
        placing = false;
        canvas.classList.remove('picking');
        $('#illu-label')?.setAttribute('aria-pressed', 'false');
        if ($('#illu-label')) $('#illu-label').textContent = t('illu.addLabel');
        if (l) { renderLabelList(); $('#illu-label-list input:last-of-type')?.focus(); }
        return;
      }

      // Comprobar si se hace clic sobre una etiqueta para moverla libremente
      const hit = illu.hitLabel ? illu.hitLabel(mx, my) : null;
      if (hit && e.button === 0) {
        canvas.setPointerCapture(e.pointerId);
        draggingLabel = hit.label;
        dragLabelStart = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
        return;
      }

      canvas.setPointerCapture(e.pointerId);
      illu.setQuick(true);
      drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2 };
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!illu) return;
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;

      if (draggingLabel && dragLabelStart) {
        const dx = e.clientX - dragLabelStart.x;
        const dy = e.clientY - dragLabelStart.y;
        dragLabelStart = { x: e.clientX, y: e.clientY };
        illu.dragLabel(draggingLabel, dx, dy);
        return;
      }

      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.x = e.clientX;
        drag.y = e.clientY;
        if (drag.pan) illu.pan(dx, dy);
        else illu.orbit(dx, dy);
        document.querySelectorAll('[data-illview]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.illview === illu.state.view)));
        return;
      }

      // Cursor inteligente según si sobrevuela etiqueta o modelo
      if (!placing && illu.hitLabel) {
        const hit = illu.hitLabel(mx, my);
        canvas.style.cursor = hit ? 'grab' : 'crosshair';
      }
    });

    const stop = () => {
      if (draggingLabel) {
        draggingLabel = null;
        dragLabelStart = null;
        canvas.style.cursor = 'crosshair';
      }
      drag = null;
      illu?.setQuick(false);
    };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      if (!illu) return;
      e.preventDefault();
      illu.zoomBy(Math.exp(-e.deltaY * 0.0012));
    }, { passive: false });
    canvas.addEventListener('dblclick', () => illu?.reset());

    document.querySelectorAll('[data-illview]').forEach((b) => b.addEventListener('click', () => {
      const targetView = b.dataset.illview;
      illu?.setView(targetView);
      document.querySelectorAll('[data-illview]').forEach((x) => {
        const isCurrent = x.dataset.illview === targetView;
        x.setAttribute('aria-pressed', String(isCurrent));
        x.classList.toggle('active', isCurrent);
      });
    }));

    $('#illu-persp-pill')?.addEventListener('click', (e) => {
      if (!illu) return;
      const next = !illu.state.perspective;
      illu.setPerspective(next);
      e.currentTarget.classList.toggle('active', next);
      e.currentTarget.setAttribute('aria-pressed', String(next));
      const cb = $('#illu-persp');
      if (cb) cb.checked = next;
    });

    $('#illu-exploded-pill')?.addEventListener('click', (e) => {
      if (!illu) return;
      const next = !illu.state.exploded;
      illu.setExploded(next);
      e.currentTarget.classList.toggle('active', next);
      e.currentTarget.setAttribute('aria-pressed', String(next));
      const sw = $('#illu-exploded-switch');
      if (sw) sw.checked = next;
      const opts = $('#illu-exploded-options');
      if (opts) opts.hidden = !next;
    });

    document.querySelectorAll('[data-illstyle]').forEach((b) => b.addEventListener('click', () => {
      const st = b.dataset.illstyle;
      illu?.setStyle(st);
      document.querySelectorAll('[data-illstyle]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const isStipple = st === 'stipple';
      const stRow = $('#illu-stipple-row');
      if (stRow) stRow.hidden = !isStipple;
      if (illu) {
        document.querySelectorAll('[data-illlayer]').forEach((c) => { c.checked = illu.state.layers[c.dataset.illlayer]; });
        const hm = $('#illu-hatch-mode');
        if (hm) hm.value = illu.state.hatchMode || (isStipple ? 'dots' : 'none');
      }
      renderSwatches();
    }));

    // Multimapas temáticos: Tipología GIS, Alturas, Isócronas, Flora, Fauna
    $('#illu-bytype')?.addEventListener('change', (e) => {
      illu?.setByType(e.target.checked);
      if (e.target.checked && $('#illu-byheight')) $('#illu-byheight').checked = false;
      renderSwatches();
    });
    $('#illu-byheight')?.addEventListener('change', (e) => {
      illu?.setByHeight(e.target.checked);
      if (e.target.checked && $('#illu-bytype')) $('#illu-bytype').checked = false;
      renderSwatches();
    });
    $('#illu-hatch-mode')?.addEventListener('change', (e) => {
      illu?.setHatchMode(e.target.value);
    });
    $('#illu-isochrones')?.addEventListener('change', (e) => {
      illu?.setThematic('isochrones', e.target.checked);
    });
    $('#illu-flora')?.addEventListener('change', (e) => {
      illu?.setThematic('flora', e.target.checked);
    });
    $('#illu-fauna')?.addEventListener('change', (e) => {
      illu?.setThematic('fauna', e.target.checked);
    });

    // Material de base maqueta & zócalo
    document.querySelectorAll('[data-illbase]').forEach((b) => b.addEventListener('click', () => {
      illu?.setBaseMaterial(b.dataset.illbase);
      document.querySelectorAll('[data-illbase]').forEach((x) => {
        x.setAttribute('aria-pressed', String(x === b));
        x.classList.toggle('active', x === b);
      });
    }));
    $('#illu-base-depth')?.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      illu?.setBaseDepth(v);
      const out = $('#illu-base-depth-out');
      if (out && model) out.textContent = `${Math.round(v * model.size)} m`;
    });

    // Sol y Sombras dinámicas
    $('#illu-sun-az')?.addEventListener('input', (e) => {
      const az = Number(e.target.value);
      const alt = Number($('#illu-sun-alt')?.value || 42);
      illu?.setSun(az, alt);
      const out = $('#illu-sun-az-out');
      if (out) out.textContent = `${az}°`;
    });
    $('#illu-sun-alt')?.addEventListener('input', (e) => {
      const alt = Number(e.target.value);
      const az = Number($('#illu-sun-az')?.value || 315);
      illu?.setSun(az, alt);
      const out = $('#illu-sun-alt-out');
      if (out) out.textContent = `${alt}°`;
    });

    // Elementos arquitectónicos de lámina (Norte, Escala, Retícula, Grosor, Árboles, Etiquetas)
    $('#illu-north')?.addEventListener('change', (e) => illu?.setOverlay('north', e.target.checked));
    $('#illu-north-style')?.addEventListener('change', (e) => illu?.setOverlay('northStyle', e.target.value));
    $('#illu-tree-style')?.addEventListener('change', (e) => illu?.setTreeStyle(e.target.value));
    $('#illu-toggle-labels')?.addEventListener('change', (e) => illu?.setShowLabels(e.target.checked));
    $('#illu-scalebar')?.addEventListener('change', (e) => illu?.setOverlay('scalebar', e.target.checked));
    $('#illu-grid')?.addEventListener('change', (e) => illu?.setOverlay('grid', e.target.checked));
    $('#illu-grid-style')?.addEventListener('change', (e) => illu?.setOverlay('gridStyle', e.target.value));
    $('#illu-line-width')?.addEventListener('input', (e) => {
      const w = Number(e.target.value);
      illu?.setLineWidth(w);
      const out = $('#illu-line-width-out');
      if (out) out.textContent = `${w.toFixed(2)} pt`;
    });

    // Selector de tinta Stipple / Risograph
    $('#illu-stipple-ink')?.addEventListener('input', (e) => {
      illu?.setStippleInk(e.target.value);
    });
    document.querySelectorAll('.stipple-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.stipple-swatch').forEach((s) => s.classList.remove('active'));
        btn.classList.add('active');
        const color = btn.dataset.stipple;
        const inkInput = $('#illu-stipple-ink');
        if (inkInput) inkInput.value = color;
        illu?.setStippleInk(color);
      });
    });

    // Resaltado de Edificio Héroe / Proyecto (Referencias 1, 2, 3)
    $('#illu-hero-enable')?.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      const opts = $('#illu-hero-options');
      if (opts) opts.hidden = !enabled;
      const color = $('#illu-hero-color')?.value || '#1e3a8a';
      const texture = $('#illu-hero-texture')?.value || 'solid';
      illu?.setHeroBuilding({ enabled, color, texture });
      if (window.setProjectModelStyle) window.setProjectModelStyle({ color, texture });
    });
    $('#illu-hero-color')?.addEventListener('input', (e) => {
      const enabled = $('#illu-hero-enable')?.checked;
      const texture = $('#illu-hero-texture')?.value || 'solid';
      illu?.setHeroBuilding({ enabled, color: e.target.value, texture });
      if (window.setProjectModelStyle) window.setProjectModelStyle({ color: e.target.value, texture });
    });
    $('#illu-hero-texture')?.addEventListener('change', (e) => {
      const enabled = $('#illu-hero-enable')?.checked;
      const color = $('#illu-hero-color')?.value || '#1e3a8a';
      illu?.setHeroBuilding({ enabled, color, texture: e.target.value });
      if (window.setProjectModelStyle) window.setProjectModelStyle({ color, texture: e.target.value });
    });

    // Exploded Layers Diagram (Imagen 4)
    $('#illu-exploded-switch')?.addEventListener('change', (e) => {
      const active = e.target.checked;
      const opts = $('#illu-exploded-options');
      if (opts) opts.hidden = !active;
      const pill = $('#illu-exploded-pill');
      if (pill) {
        pill.classList.toggle('active', active);
        pill.setAttribute('aria-pressed', String(active));
      }
      illu?.setExploded(active);
    });
    $('#illu-explode-offset')?.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      const out = $('#illu-explode-offset-out'); if (out) out.textContent = `${val} m`;
      illu?.setExplodeOffset(val);
    });
    document.querySelectorAll('[data-illutier]').forEach((cb) => {
      cb.addEventListener('change', () => {
        illu?.setExplodedTier(cb.dataset.illutier, cb.checked);
      });
    });
    document.querySelectorAll('[data-illutiercolor]').forEach((inp) => {
      inp.addEventListener('input', () => {
        illu?.setTierColor(inp.dataset.illutiercolor, inp.value);
      });
    });
    $('#illu-exploded-guides')?.addEventListener('change', (e) => {
      illu?.setOverlay('explodedGuides', e.target.checked);
    });
    $('#illu-contour-labels')?.addEventListener('change', (e) => {
      illu?.setContourLabels(e.target.checked);
    });
    $('#illu-corner-labels')?.addEventListener('change', (e) => {
      illu?.setOverlay('explodedCornerLabels', e.target.checked);
    });
    $('#illu-pins-toggle')?.addEventListener('change', (e) => {
      illu?.setOverlay('pins', e.target.checked);
    });

    document.querySelectorAll('[data-illlayer]').forEach((c) => c.addEventListener('change', () => illu?.setLayer(c.dataset.illlayer, c.checked)));
    $('#illu-persp')?.addEventListener('change', (e) => {
      illu?.setPerspective(e.target.checked);
      const pill = $('#illu-persp-pill');
      if (pill) {
        pill.classList.toggle('active', e.target.checked);
        pill.setAttribute('aria-pressed', String(e.target.checked));
      }
    });
    $('#illu-legend')?.addEventListener('change', (e) => illu?.setLegend(e.target.checked));
    $('#illu-reset-colors')?.addEventListener('click', () => { illu?.resetColors(); renderSwatches(); });
    $('#illu-color')?.addEventListener('input', (e) => illu?.setLabelColor(e.target.value));
    $('#illu-label')?.addEventListener('click', () => {
      placing = !placing;
      canvas.classList.toggle('picking', placing);
      $('#illu-label')?.setAttribute('aria-pressed', String(placing));
      const il = $('#illu-label'); if (il) il.textContent = t(placing ? 'illu.placing' : 'illu.addLabel');
    });
    document.querySelectorAll('[data-illexport]').forEach((b) => b.addEventListener('click', async () => {
      if (!illu || !model) return;
      const kind = b.dataset.illexport;
      b.disabled = true;
      try {
        const blob = kind === 'svg' ? illu.toSVG({ width: 2400 }) : await illu.toPNG({ width: 3200 });
        const q = await consume(model.id);
        if (!q.ok) { renderQuota(0, false); lockDownloads(true); return; }
        save(blob, `urbanized_illustration_${model.center.lat.toFixed(4)}_${model.center.lon.toFixed(4)}.${kind}`);
        billing.track(`illu:${kind}`);
      } finally {
        b.disabled = false;
        renderQuota(await quotaStatus(), true);
      }
    }));
    new ResizeObserver(() => {
      const viewIllu = $('#view-illu');
      if (illu && viewIllu && !viewIllu.hidden) illu.render();
    }).observe(canvas);
  }
}

/* ---------------- Векторная карта (Cartografía 2D QGIS) ---------------- */

let mapOpened = false, mapMod = null, mapOpts = null, mapUrl = null, mapQueued = false, mapSize = '';
const mapBox = $('#map-flat');
const getPath = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
const setPath = (o, path, v) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

async function loadMapMod() {
  mapMod ??= await import('./mapplan.js?v=6.0');
  mapOpts ??= mapMod.presetOptions('classic');
  return mapMod;
}

$('#open-map')?.addEventListener('click', async () => {
  const box = $('#mapper');
  mapOpened = true;
  billing.track('editor:map');
  if (box) {
    box.hidden = false;
    await loadMapMod();
    syncMapControls();
    renderMap(true);
    box.scrollIntoView({ behavior: 'smooth' });
  }
});

// перерисовка не чаще одного раза за кадр: ползунки шлют событие на каждый пиксель
function renderMap(refit = false) {
  if (!model || !mapMod || !mapBox) return;
  if (mapQueued && !refit) return;
  mapQueued = true;
  const doRender = () => {
    if (!mapQueued && !refit) return;
    mapQueued = false;
    try {
      const svg = mapMod.mapSVG(model, mapOpts);
      if (mapUrl) URL.revokeObjectURL(mapUrl);
      mapUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const img = mapBox.querySelector('img');
      if (!img) return;
      img.onload = () => {
        // размер листа изменился (масштаб, поля сетки) — вписываем заново, иначе сохраняем вид
        const sz = `${img.naturalWidth}x${img.naturalHeight}`;
        if (refit || sz !== mapSize || !flatState.get(mapBox)) fitFlat(mapBox);
        mapSize = sz;
      };
      img.src = mapUrl;
    } catch (err) {
      console.error('Error in renderMap SVG generation:', err);
    }
  };
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(doRender);
    setTimeout(() => { if (mapQueued) doRender(); }, 40);
  } else {
    doRender();
  }
}
window.debugMapStatus = () => ({
  model: Boolean(model),
  mapMod: Boolean(mapMod),
  mapBox: Boolean(mapBox),
  mapOpts: Boolean(mapOpts),
  mapQueued,
  mapSize
});

function syncMapControls() {
  if (!mapOpts) return;
  document.querySelectorAll('[data-mapopt]').forEach((el) => {
    const v = getPath(mapOpts, el.dataset.mapopt);
    if (el.type === 'checkbox') el.checked = Boolean(v);
    else el.value = v;
  });
  document.querySelectorAll('[data-mappreset]').forEach((b) => {
    const isActive = b.dataset.mappreset === mapOpts.preset;
    b.setAttribute('aria-pressed', String(isActive));
    b.classList.toggle('active', isActive);
  });
  const hm = $('#map-hatch-mode');
  if (hm) hm.value = mapOpts.hatchMode || 'none';
  const nStyle = $('#map-north-style');
  if (nStyle && mapOpts.overlays?.northStyle) nStyle.value = mapOpts.overlays.northStyle;
  const tStyle = $('#map-tree-style');
  if (tStyle && mapOpts.overlays?.treeStyle) tStyle.value = mapOpts.overlays.treeStyle;
  const lToggle = $('#map-toggle-labels');
  if (lToggle) lToggle.checked = mapOpts.overlays?.labels !== false;
  const gStyle = $('#map-grid-style');
  if (gStyle && mapOpts.overlays?.gridStyle) gStyle.value = mapOpts.overlays.gridStyle;
  const gStep = $('#map-grid-step');
  if (gStep) gStep.value = String(mapOpts.gridStep || 'auto');
  const grainEl = $('#map-grain');
  if (grainEl) {
    grainEl.value = String(mapOpts.grain || 0);
    const out = $('#map-grain-out'); if (out) out.textContent = `${mapOpts.grain || 0}%`;
  }
  const pinsEl = $('#map-pins-toggle');
  if (pinsEl) pinsEl.checked = Boolean(mapOpts.overlays?.pins ?? true);
  const scStyle = $('#map-scale-style');
  if (scStyle && mapOpts.overlays?.scalebarStyle) scStyle.value = mapOpts.overlays.scalebarStyle;
  // ползунки силы доступны, только когда эффект включён
  const dep = { 'shadows.azimuth': 'shadows.on', 'shadows.altitude': 'shadows.on', 'shadows.strength': 'shadows.on', 'relief.hillshadeStrength': 'relief.hillshade', 'relief.depthStrength': 'relief.depth' };
  for (const [k, on] of Object.entries(dep)) {
    const depEl = document.querySelector(`[data-mapopt="${k}"]`);
    if (depEl) depEl.disabled = !getPath(mapOpts, on);
  }
  renderMapScale();
  renderMapSwatches();
  renderLayerStackControls();
}

const MAP_LAYERS_INFO = [
  { key: 'satellite', name: 'Foto Satelital (Ortofoto)', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>' },
  { key: 'buildings', name: 'Edificios / Huellas', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="2" width="16" height="20" rx="1"/><line x1="9" y1="6" x2="10" y2="6"/><line x1="14" y1="6" x2="15" y2="6"/><line x1="9" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="15" y2="10"/></svg>' },
  { key: 'roads', name: 'Vialidades y Ejes', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19L10 5"/><path d="M20 19L14 5"/><line x1="12" y1="8" x2="12" y2="10" stroke-dasharray="2 2"/><line x1="12" y1="14" x2="12" y2="16" stroke-dasharray="2 2"/></svg>' },
  { key: 'green', name: 'Áreas Verdes y Parques', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22v-7"/><path d="M17 10a5 5 0 0 0-10 0c0 4 5 7 5 7s5-3 5-7z"/></svg>' },
  { key: 'flora', name: 'Zonas de Flora Nativa', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>' },
  { key: 'fauna', name: 'Corredores de Fauna', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12c4-4 8 4 12 0s4-4 4-4"/></svg>' },
  { key: 'water', name: 'Cuerpos de Agua', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12c2.5-2 5 2 7.5 0s5 2 7.5 0 5-2 5-2"/></svg>' },
  { key: 'contours', name: 'Curvas de Nivel', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 16c4-3 7 1 11-2s5-1 7-3"/></svg>' },
  { key: 'relief', name: 'Relieve e Hipsometría', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 20L10 7l5 9 3-4 3 8z"/></svg>' },
  { key: 'shadows', name: 'Sombras Arrojadas', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41"/></svg>' },
  { key: 'trees', name: 'Masa Arbórea (Árboles)', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="10" r="6"/><line x1="12" y1="16" x2="12" y2="22"/></svg>' },
  { key: 'rail', name: 'Ferrocarriles', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="4" y1="19" x2="20" y2="19"/><line x1="4" y1="5" x2="20" y2="5"/><line x1="6" y1="3" x2="6" y2="21"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="18" y1="3" x2="18" y2="21"/></svg>' },
  { key: 'site', name: 'Polígono del Predio', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="3,3 21,5 18,21 5,19"/></svg>' },
  { key: 'labels', name: 'Etiquetas & Cotas de Texto', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1"/></svg>' },
];

function renderLayerStackControls() {
  const container = document.getElementById('map-layer-stack');
  if (!container || !mapOpts) return;

  if (!Array.isArray(mapOpts.layerOrder) || !mapOpts.layerOrder.length) {
    mapOpts.layerOrder = ['satellite', 'relief', 'contours', 'green', 'flora', 'water', 'fauna', 'rail', 'roads', 'shadows', 'trees', 'buildings', 'site', 'labels'];
  }
  if (!mapOpts.layerOpacities) {
    mapOpts.layerOpacities = {};
  }
  if (!mapOpts.layerHatches) {
    mapOpts.layerHatches = { buildings: 'none', green: 'none' };
  }

  container.innerHTML = mapOpts.layerOrder.map((key, idx) => {
    const info = MAP_LAYERS_INFO.find((l) => l.key === key) || { key, name: key, icon: '' };
    const isVisible = key === 'relief' ? Boolean(mapOpts.relief?.hillshade || mapOpts.relief?.depth)
                    : key === 'shadows' ? Boolean(mapOpts.shadows?.on)
                    : key === 'satellite' ? Boolean(mapOpts.layers?.satellite)
                    : key === 'labels' ? mapOpts.overlays?.labels !== false
                    : mapOpts.layers?.[key] !== false;
    const opacity = mapOpts.layerOpacities[key] !== undefined ? mapOpts.layerOpacities[key] : 1.0;
    const opPercent = Math.round(opacity * 100);
    const hasHatchOption = key === 'buildings' || key === 'green';
    const curHatch = mapOpts.layerHatches[key] || 'none';

    return `
      <div class="axiom-layer-item" data-layerkey="${key}" draggable="true">
        <div class="axiom-layer-head">
          <span class="layer-drag-handle" title="Arrastrar para reordenar capa">⠿</span>
          <label class="axiom-layer-left">
            <input type="checkbox" class="layer-vis-cb" ${isVisible ? 'checked' : ''}>
            <span class="axiom-layer-icon">${info.icon}</span>
            <span class="axiom-layer-name">${info.name}</span>
          </label>
          <div class="axiom-layer-actions">
            ${hasHatchOption ? `
              <select class="layer-hatch-select" title="Trama / Hatch de capa">
                <option value="none" ${curHatch === 'none' ? 'selected' : ''}>Sólido</option>
                <option value="dots" ${curHatch === 'dots' ? 'selected' : ''}>Puntos</option>
                <option value="diag" ${curHatch === 'diag' ? 'selected' : ''}>Diag 45°</option>
                <option value="cross" ${curHatch === 'cross' ? 'selected' : ''}>Cruzado</option>
              </select>
            ` : ''}
            <button type="button" class="layer-reorder-btn btn-layer-up" ${idx === 0 ? 'disabled' : ''} title="Subir nivel visual">▲</button>
            <button type="button" class="layer-reorder-btn btn-layer-down" ${idx === mapOpts.layerOrder.length - 1 ? 'disabled' : ''} title="Bajar nivel visual">▼</button>
          </div>
        </div>
        <div class="axiom-layer-op-row">
          <input type="range" min="0" max="100" step="5" value="${opPercent}" class="axiom-range axiom-layer-op-slider" title="Opacidad de capa">
          <span class="axiom-layer-op-val">${opPercent}%</span>
        </div>
      </div>
    `;
  }).join('');

  let draggedLayerIdx = null;

  container.querySelectorAll('.axiom-layer-item').forEach((itemEl, idx) => {
    const key = itemEl.getAttribute('data-layerkey');
    const visCb = itemEl.querySelector('.layer-vis-cb');
    const slider = itemEl.querySelector('.axiom-layer-op-slider');
    const valText = itemEl.querySelector('.axiom-layer-op-val');
    const hatchSel = itemEl.querySelector('.layer-hatch-select');
    const btnUp = itemEl.querySelector('.btn-layer-up');
    const btnDown = itemEl.querySelector('.btn-layer-down');

    // Drag and Drop Layer Reordering
    itemEl.addEventListener('dragstart', (e) => {
      if (e.target.closest('input, select, button')) { e.preventDefault(); return; }
      draggedLayerIdx = idx;
      itemEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx));
    });
    itemEl.addEventListener('dragend', () => {
      itemEl.classList.remove('dragging');
      container.querySelectorAll('.axiom-layer-item').forEach(el => el.classList.remove('drag-over'));
    });
    itemEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      itemEl.classList.add('drag-over');
    });
    itemEl.addEventListener('dragleave', () => {
      itemEl.classList.remove('drag-over');
    });
    itemEl.addEventListener('drop', (e) => {
      e.preventDefault();
      itemEl.classList.remove('drag-over');
      if (draggedLayerIdx === null || draggedLayerIdx === idx) return;
      const movedItem = mapOpts.layerOrder.splice(draggedLayerIdx, 1)[0];
      mapOpts.layerOrder.splice(idx, 0, movedItem);
      renderLayerStackControls();
      renderMap();
      if (window.showCadToast) window.showCadToast('✓ Capa reordenada');
    });

    hatchSel?.addEventListener('change', () => {
      if (!mapOpts.layerHatches) mapOpts.layerHatches = {};
      mapOpts.layerHatches[key] = hatchSel.value;
      renderMap();
    });

    visCb?.addEventListener('change', () => {
      if (key === 'relief') {
        if (!mapOpts.relief) mapOpts.relief = {};
        mapOpts.relief.hillshade = visCb.checked;
      } else if (key === 'shadows') {
        if (!mapOpts.shadows) mapOpts.shadows = {};
        mapOpts.shadows.on = visCb.checked;
      } else if (key === 'labels') {
        if (!mapOpts.overlays) mapOpts.overlays = {};
        mapOpts.overlays.labels = visCb.checked;
        const cb = $('#map-toggle-labels'); if (cb) cb.checked = visCb.checked;
      } else {
        if (!mapOpts.layers) mapOpts.layers = {};
        mapOpts.layers[key] = visCb.checked;
      }
      renderMap();
    });

    slider?.addEventListener('pointerdown', (e) => e.stopPropagation());
    slider?.addEventListener('mousedown', (e) => e.stopPropagation());
    slider?.addEventListener('dragstart', (e) => { e.preventDefault(); e.stopPropagation(); });
    slider?.addEventListener('input', () => {
      const val = Number(slider.value) / 100;
      mapOpts.layerOpacities[key] = val;
      if (valText) valText.textContent = `${slider.value}%`;
      renderMap();
    });

    btnUp?.addEventListener('click', () => {
      if (idx > 0) {
        const temp = mapOpts.layerOrder[idx];
        mapOpts.layerOrder[idx] = mapOpts.layerOrder[idx - 1];
        mapOpts.layerOrder[idx - 1] = temp;
        renderLayerStackControls();
        renderMap();
      }
    });

    btnDown?.addEventListener('click', () => {
      if (idx < mapOpts.layerOrder.length - 1) {
        const temp = mapOpts.layerOrder[idx];
        mapOpts.layerOrder[idx] = mapOpts.layerOrder[idx + 1];
        mapOpts.layerOrder[idx + 1] = temp;
        renderLayerStackControls();
        renderMap();
      }
    });
  });
}
window.openVectorMapStudio = async () => {
  await loadMapMod();
  syncMapControls();
  renderMap(true);
};

function renderMapScale() {
  const sel = $('#map-scale');
  if (!sel || !mapMod || !model) return;
  const auto = mapMod.autoScale(model.size);
  sel.innerHTML = '';
  for (const k of mapMod.MAP_SCALES) {
    const op = document.createElement('option');
    op.value = String(k);
    op.textContent = `1:${k.toLocaleString(locale())} · ${Math.round((model.size * 1000) / k)} ${t('mm')}`;
    sel.append(op);
  }
  sel.value = String(mapOpts.scale ?? auto);
}

function renderMapSwatches() {
  const box = $('#map-swatches');
  if (!box || !mapMod) return;
  box.innerHTML = '';
  for (const key of mapMod.MAP_COLOR_KEYS) {
    const label = document.createElement('label');
    label.className = 'swatch';
    const input = document.createElement('input');
    input.type = 'color';
    input.value = mapOpts.colors[key];
    input.addEventListener('input', () => { mapOpts.colors[key] = input.value; renderMap(); });
    const span = document.createElement('span');
    span.textContent = t(`mapcolor.${key}`);
    label.append(input, span);
    box.append(label);
  }
}

document.querySelectorAll('[data-mappreset]').forEach((b) => b.addEventListener('click', async () => {
  await loadMapMod();
  if (!mapMod) return;
  const scale = mapOpts?.scale ?? null, overlays = mapOpts?.overlays;
  mapOpts = mapMod.presetOptions(b.dataset.mappreset);
  mapOpts.scale = scale;
  if (overlays) mapOpts.overlays = { ...overlays, ...mapOpts.overlays };
  syncMapControls();
  renderMap();
}));

window.setMapPreset = async (presetName) => {
  await loadMapMod();
  if (!mapMod) return;
  const scale = mapOpts?.scale ?? null, overlays = mapOpts?.overlays;
  mapOpts = mapMod.presetOptions(presetName);
  mapOpts.scale = scale;
  if (overlays) mapOpts.overlays = { ...overlays, ...mapOpts.overlays };
  syncMapControls();
  renderMap();
  const sel = $('#inspector-map-preset-select');
  if (sel) sel.value = presetName.startsWith('figure') ? 'figure' : presetName;
};

window.setMapPen = (penVal) => {
  if (!mapOpts) return;
  mapOpts.outlineWidth = penVal;
  renderMap();
};
$('#map-hatch-mode')?.addEventListener('change', (e) => {
  if (mapOpts) {
    mapOpts.hatchMode = e.target.value;
    renderMap();
  }
});
document.querySelectorAll('[data-mapopt]').forEach((el) => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
  if (!mapOpts) return;
  const path = el.dataset.mapopt;
  setPath(mapOpts, path, el.type === 'checkbox' ? el.checked : Number(el.value));
  if (path === 'layers.byType' && el.checked) {
    setPath(mapOpts, 'layers.byHeight', false);
  } else if (path === 'layers.byHeight' && el.checked) {
    setPath(mapOpts, 'layers.byType', false);
  }
  if (el.type === 'checkbox') syncMapControls();
  renderMap();
}));
$('#map-north-style')?.addEventListener('change', (e) => {
  if (mapOpts) {
    if (!mapOpts.overlays) mapOpts.overlays = {};
    mapOpts.overlays.northStyle = e.target.value;
    renderMap();
  }
});
$('#map-tree-style')?.addEventListener('change', (e) => {
  if (mapOpts) {
    if (!mapOpts.overlays) mapOpts.overlays = {};
    mapOpts.overlays.treeStyle = e.target.value;
    renderMap();
  }
});
$('#map-toggle-labels')?.addEventListener('change', (e) => {
  if (mapOpts) {
    if (!mapOpts.overlays) mapOpts.overlays = {};
    mapOpts.overlays.labels = e.target.checked;
    renderMap();
  }
});
$('#map-grid-style')?.addEventListener('change', (e) => {
  if (mapOpts) {
    if (!mapOpts.overlays) mapOpts.overlays = {};
    mapOpts.overlays.gridStyle = e.target.value;
    renderMap();
  }
});
$('#map-grid-step')?.addEventListener('change', (e) => {
  if (mapOpts) {
    if (!mapOpts.overlays) mapOpts.overlays = {};
    const val = e.target.value === 'auto' ? 'auto' : Number(e.target.value);
    mapOpts.gridStep = val;
    mapOpts.overlays.gridStep = val;
    renderMap();
  }
});
$('#map-grain')?.addEventListener('input', (e) => {
  if (mapOpts) {
    mapOpts.grain = Number(e.target.value);
    const out = $('#map-grain-out'); if (out) out.textContent = `${mapOpts.grain}%`;
    renderMap();
  }
});
$('#map-pins-toggle')?.addEventListener('change', (e) => {
  if (mapOpts) {
    if (!mapOpts.overlays) mapOpts.overlays = {};
    mapOpts.overlays.pins = e.target.checked;
    renderMap();
  }
});
$('#map-scale')?.addEventListener('change', (e) => { if (mapOpts) { mapOpts.scale = Number(e.target.value); renderMap(true); } });
$('#map-reset-colors')?.addEventListener('click', () => {
  if (!mapMod) return;
  mapOpts.colors = structuredClone(mapMod.MAP_PRESETS[mapOpts.preset].colors);
  renderMapSwatches();
  renderMap();
});
$('#btn-reset-layer-stack')?.addEventListener('click', () => {
  if (!mapOpts) return;
  mapOpts.layerOrder = ['satellite', 'relief', 'contours', 'green', 'flora', 'water', 'fauna', 'rail', 'roads', 'shadows', 'trees', 'buildings', 'site', 'labels'];
  mapOpts.layerOpacities = {};
  mapOpts.layerHatches = { buildings: 'none', green: 'none' };
  renderLayerStackControls();
  renderMap();
});
$('#map-scale-style')?.addEventListener('change', (e) => {
  if (mapOpts) {
    if (!mapOpts.overlays) mapOpts.overlays = {};
    mapOpts.overlays.scalebarStyle = e.target.value;
    renderMap();
  }
});
$('#illu-scale-style')?.addEventListener('change', (e) => {
  if (window.setIllustrateScaleStyle) {
    window.setIllustrateScaleStyle(e.target.value);
  }
});

// Interconexión Cartografía 2D -> Axonometría Arquitectónica
async function projectCartographyToAxonometry() {
  if (!model) return;
  if (!illu) openIllustrator();
  if (illu && illu.setState) {
    const tierColors = {};
    if (mapOpts.colors?.water) tierColors.water = mapOpts.colors.water;
    if (mapOpts.colors?.green) tierColors.green = mapOpts.colors.green;
    if (mapOpts.colors?.roads) tierColors.roads = mapOpts.colors.roads;
    if (mapOpts.colors?.buildings) tierColors.buildings = mapOpts.colors.buildings;

    illu.setState({
      hatchMode: mapOpts.hatchMode || 'none',
      stippleInk: mapOpts.colors?.buildings || '#1e3a8a',
      tierColors: {
        ...(illu.getState?.()?.tierColors || {}),
        ...tierColors
      },
      layers: {
        terrain: mapOpts.layers?.relief ?? true,
        buildings: mapOpts.layers?.buildings ?? true,
        trees: mapOpts.layers?.trees ?? true,
        roads: mapOpts.layers?.roads ?? true,
        nature: mapOpts.layers?.green ?? true,
        contours: mapOpts.layers?.contours ?? false
      }
    });
    illu.render();
  }
  if (window.switchView) window.switchView('illustrator', true);
  if (window.showCadToast) window.showCadToast('✓ Estilos y capas de Cartografía 2D proyectados a Axonometría');
}
$('#btn-apply-carto-to-3d')?.addEventListener('click', projectCartographyToAxonometry);
$('#btn-island-apply-carto')?.addEventListener('click', projectCartographyToAxonometry);
$('#btn-inspector-apply-carto-3d')?.addEventListener('click', projectCartographyToAxonometry);

// Exponer datos y estados del modelo activo para vistas guardadas e interconexión
window.hasActiveModel = () => Boolean(model);
window.getActiveModelData = () => model;
window.getVectorMapState = () => (mapOpts ? structuredClone(mapOpts) : null);
window.applyVectorMapConfig = (cfg) => {
  if (cfg) {
    mapOpts = structuredClone(cfg);
    syncMapControls();
    renderMap();
  }
};

document.querySelectorAll('[data-mapexport]').forEach((b) => b.addEventListener('click', async () => {
  if (!model || !mapMod) return;
  const kind = b.dataset.mapexport;
  b.disabled = true;
  try {
    const svg = mapMod.mapSVG(model, mapOpts);
    const blob = kind === 'svg' ? new Blob([svg], { type: 'image/svg+xml' }) : await mapMod.mapPNG(svg, 4000);
    const q = await consume(model.id);
    if (!q.ok) { renderQuota(0, false); lockDownloads(true); return; }
    save(blob, `urbanized_map_${model.center.lat.toFixed(4)}_${model.center.lon.toFixed(4)}.${kind}`);
    billing.track(`map:${kind}`);
  } catch (err) {
    console.error(err);
  } finally {
    b.disabled = false;
    renderQuota(await quotaStatus(), true);
  }
}));

/* ---------------- Язык ---------------- */

// wyпадающий список языков
window.applyLang = applyLang;
window.t = t;
for (const sel of document.querySelectorAll('.lang-select, .lang-pill')) {
  sel.innerHTML = LANGS.map((l) => `<option value="${l.code}">${l.name}</option>`).join('');
  sel.value = lang;
  sel.addEventListener('change', () => applyLang(sel.value));
}
onLangChange(() => {
  drawFrame();
  const btnSpan = buildBtn?.querySelector('span');
  if (btnSpan) {
    btnSpan.textContent = building ? t('build.busy') : t('build.idle');
  } else if (buildBtn) {
    buildBtn.textContent = building ? t('build.busy') : t('build.idle');
  }
  setStatus(...statusState);
  if (model) renderMeta(model);
  showChannel();
  if (mapMod && mapOpts) { renderMapSwatches(); renderMapScale(); }
  if (illu) {
    const il = $('#illu-label');
    if (il) il.textContent = t(placing ? 'illu.placing' : 'illu.addLabel');
    illu.setLang(lang);
    renderSwatches();
  }
  const vh = $('#viewer-hint'); if (vh) vh.textContent = t(currentView === 'model' ? 'viewer.hint' : 'viewer.hintFlat');
  const sd = $('#sec-draw'); if (sd) sd.textContent = t(secState.drawing ? 'section.drawing' : 'section.draw');
  const sitd = $('#site-draw'); if (sitd) sitd.textContent = t(site.drawing ? 'site.drawing' : 'site.draw');
  siteRedraw();
  setSecStatus(...secStatusState);
  secRedraw();
  if (secState.model) showSection(secState.model);
  if (quotaState) renderQuota(...quotaState);
});
/* ---------------- Телеграм-панель: каналы чередуются от визита к визиту ---------------- */

function showChannel() {}



/* ---------------- Кредиты: кнопка аккаунта, вход по ссылке ---------------- */

const acctBtn = $('#acct-btn');
if (acctBtn) {
  acctBtn.addEventListener('click', () => billing.open('buy'));
}
function renderAccount() {
  if (acctBtn) acctBtn.hidden = true;
  sizeInput.max = String(MAX_SIDE_M);
  drawFrame();
  if (quotaState) renderQuota(...quotaState);
  if (secState.model) renderSecQuota();
  billing.rerender();
}
billing.onChange(renderAccount);
onLangChange(renderAccount);
// «Мои участки»: та же рамка, форма и размер — модель собирается заново, скачивание без списания
billing.onOpenArea((id) => {
  const p = parseModelId(id);
  if (!p) return;
  if (mode !== 'model') setMode('model');
  shape = p.shape;
  store.set('ue:shape', shape);
  document.querySelectorAll('.shape button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.shape === shape)));
  sizeInput.value = String(p.size);
  map.setView([p.lat, p.lon], map.getZoom(), { animate: false });
  fitFrame();
  $('#app')?.scrollIntoView({ behavior: 'smooth' });
  if (!building) panel.requestSubmit();
});
billing.refresh().then(() => billing.handleLoginLink());

// применяем язык последним: к этому моменту все обработчики и данные готовы
applyLang();


