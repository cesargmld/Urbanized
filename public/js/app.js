import { buildModel, redetectTrees } from './data.js?v=5.7';
import { FORMATS, stlScale } from './exporters.js?v=5.7';
import { setCameraView, toggleMaquetaMode, isMaquetaModeActive, setLayerVisibility, getLayerStats, setWalkRings, setFloraZoneHighlight, updateSatelliteTexture, setContourOptions, setBuildingFinish, renderFeasibilityVolume, loadProject3DFile, studioState } from './preview.js?v=5.7';
import { pinStore, PIN_COLORS, PIN_TYPES } from './pins.js?v=1.0';
import { feasibilityStore } from './feasibility.js?v=1.0';
import { MAP_GRID_STEPS } from './mapplan.js?v=5.7';
import { classifyEcosystem } from './biodiversity.js?v=5.7';
import { t, lang, applyLang, onLangChange, locale, LANGS } from './i18n.js?v=5.7';
import { buildSection, sectionLength, SECTION_FORMATS, MAX_SECTION_KM } from './section.js?v=5.7';
import { createIllustrator } from './illustrate.js?v=5.7';
import * as billing from './billing.js?v=5.7';
import { quote, areaOfModel, areaKm2 as areaOf, sizeCredits, coveredBy, parseModelId, MAX_SIDE_M, FREE_AREA_KM2, USD_PER_CREDIT } from './pricing.js?v=5.7';
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

const start = store.get('ue:view') ?? { lat: 41.6938, lon: 44.8015, zoom: 15 };
start.zoom = Math.max(12, start.zoom);
const map = L.map('map', { zoomControl: true, attributionControl: true, worldCopyJump: true }).setView([start.lat, start.lon], start.zoom);
window.appMap = map;
map.zoomControl.setPosition('bottomright');
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const tiles = (name, native) => L.tileLayer(`${ESRI}/${name}/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, maxNativeZoom: native, attribution: 'Esri, Maxar, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' });

// Official Esri Canvas Dark Gray tiles for high-end architectural matte dark map (Axiom style)
const bases = {
  map: L.layerGroup([
    tiles('Canvas/World_Dark_Gray_Base', 16),
    tiles('Canvas/World_Dark_Gray_Reference', 16)
  ]),
  sat: L.layerGroup([
    tiles('World_Imagery', 18),
    tiles('Reference/World_Boundaries_and_Places', 18)
  ]),
};
let baseName = 'sat';
store.set('ue:base', 'sat');
bases[baseName].addTo(map);
map.attributionControl.setPrefix(false);

function setBaseMap(name) {
  if (name === baseName) return;
  map.removeLayer(bases[baseName]);
  baseName = name;
  bases[baseName].addTo(map);
  store.set('ue:base', baseName);
  document.querySelectorAll('[data-base]').forEach((b) => {
    const isThis = b.dataset.base === baseName;
    b.setAttribute('aria-pressed', String(isThis));
    b.classList.toggle('active', isThis);
    const dot = b.querySelector('.axiom-dot');
    if (dot) dot.classList.toggle('active', isThis);
  });
}
window.setBaseMap = setBaseMap;

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
  const px = size / mpp;
  frame.style.width = frame.style.height = `${px}px`;
  frame.classList.toggle('circle', shape === 'circle');
  $('#frame-label').textContent = `${sizeKm()} × ${sizeKm()} ${t('km')}`;
  $('#size-out').textContent = `${sizeKm()} ${t('km')}`;
  // цена площади: бесплатно до 5 км², дальше — кредиты при скачивании
  const costEl = $('#size-cost');
  const extra = billing.state.billing ? sizeCredits(areaOf(size, shape)) : 0;
  costEl.hidden = !billing.state.billing;
  costEl.textContent = extra
    ? t('size.cost', { c: billing.creditsLabel(extra), usd: creditsUsd(extra) })
    : t('size.free', { km: FREE_AREA_KM2 });
  // за бесплатной рамкой рамка, подпись и ползунок краснеют; при переходе строка цены вспыхивает
  const over = extra > 0;
  if (over !== frame.classList.contains('over') && costEl.dataset.ready) {
    costEl.classList.remove('flash');
    void costEl.offsetWidth; // перезапуск анимации
    costEl.classList.add('flash');
  }
  costEl.dataset.ready = '1';
  frame.classList.toggle('over', over);
  costEl.classList.toggle('paid', over);
  sizeInput.classList.toggle('over', over);
  // граница бесплатной зоны на шкале ползунка
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
    li.textContent = t('search.goto', { lat: coords[1], lon: coords[2] });
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
        li.textContent = r.display_name;
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

buildBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  if (panel.requestSubmit) {
    panel.requestSubmit();
  } else {
    panel.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  }
});

const terrainToggle = panel.elements.terrain, contoursToggle = panel.elements.contours;
terrainToggle.addEventListener('change', () => {
  contoursToggle.disabled = !terrainToggle.checked;
  if (!terrainToggle.checked) contoursToggle.checked = false;
});
const sens = $('#sens');
function syncTreeControls() {
  panel.elements.detect.disabled = !panel.elements.trees.checked;
  $('#sens-field').classList.toggle('off', !panel.elements.trees.checked || !panel.elements.detect.checked);
  $('#sens-out').textContent = `${sens.value}%`;
}
panel.elements.trees.addEventListener('change', syncTreeControls);
panel.elements.buildings.addEventListener('change', () => { panel.elements.extraBuildings.disabled = !panel.elements.buildings.checked; });
panel.elements.roads.addEventListener('change', () => { panel.elements.bridges.disabled = panel.elements.roadWidth.disabled = !panel.elements.roads.checked; });
panel.elements.detect.addEventListener('change', syncTreeControls);
sens.addEventListener('input', syncTreeControls);
// после сборки ползунок пересчитывает деревья на готовой модели, без повторной загрузки
sens.addEventListener('change', async () => {
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
    dot.style.background = isError ? '#f87171' : '#38bdf8';
    dot.style.boxShadow = isError ? '0 0 10px rgba(248, 113, 113, 0.8)' : '0 0 10px rgba(56, 189, 248, 0.8)';
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
  if (fill) fill.style.width = `${currentLoadingPct}%`;
  if (pctEl) pctEl.textContent = `${Math.round(currentLoadingPct)}%`;
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

  // Switch to result screen first so #viewer has non-zero dimensions when Three.js initializes
  $('#view-btn-studio')?.classList.remove('disabled');
  $('#view-btn-mapper')?.classList.remove('disabled');
  $('#view-btn-illu')?.classList.remove('disabled');

  if (window.switchWorkspaceView) {
    window.switchWorkspaceView('result');
  }

  const { showModel, triggerResize } = await import('./preview.js?v=5.7');
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
$('#sec-exag')?.addEventListener('change', secRefresh);
$('#sec-dir')?.addEventListener('change', secRefresh);

async function showSection(sec) {
  if (secState.url) URL.revokeObjectURL(secState.url);
  secState.url = URL.createObjectURL(SECTION_FORMATS.svg.make(sec));

  // Populate focused section modal and non-intrusive trigger pill
  const readyPill = $('#section-ready-pill');
  if (readyPill) readyPill.hidden = false;

  const modal = $('#section-modal');
  if (modal) modal.hidden = false;

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
  const sizeM = Number(sizeInput?.value || 1000);
  const palette = ['#4ade80', '#2dd4bf', '#a3e635', '#34d399', '#38bdf8'];
  const zoneConfigs = [
    { dist: sizeM * 0.22, angle: 35, r: sizeM * 0.14, label: 'Zona Ecológica A · Dosel Principal' },
    { dist: sizeM * 0.26, angle: 145, r: sizeM * 0.13, label: 'Zona Ecológica B · Corredor Vegetal' },
    { dist: sizeM * 0.20, angle: 235, r: sizeM * 0.15, label: 'Zona Ecológica C · Estrato Arbóreo' },
    { dist: sizeM * 0.28, angle: 315, r: sizeM * 0.12, label: 'Zona Ecológica D · Reserva Riparia' },
    { dist: sizeM * 0.06, angle: 90, r: sizeM * 0.11, label: 'Zona Ecológica Central · Microclima' }
  ];

  eco.flora.forEach((sp, idx) => {
    if (floraState.selectedSpecies >= 0 && floraState.selectedSpecies !== idx) return;
    const cfg = zoneConfigs[idx % zoneConfigs.length];
    const color = palette[idx % palette.length];
    const poly = generateZonePolygonCoords(center.lat, center.lng, cfg.dist, cfg.angle, cfg.r, idx + 1);

    L.polygon(poly.pts, {
      color,
      weight: 2,
      opacity: 0.9,
      fillColor: color,
      fillOpacity: 0.22,
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
    L.marker(poly.center, { icon, interactive: false }).addTo(floraState.layerGroup);
  });

  setFloraZoneHighlight(true, floraState.selectedSpecies);
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

// Studio Toolbar: Render Mode Buttons (Urbano GIS | Maqueta 3D Monocromática)
$('#btn-render-model')?.addEventListener('click', () => {
  $('#btn-render-maqueta')?.classList.remove('active');
  $('#btn-render-model')?.classList.add('active');
  $('#btn-render-model .axiom-island-dot, #btn-render-model .axiom-dot')?.classList.add('active');
  $('#btn-render-maqueta .axiom-island-dot, #btn-render-maqueta .axiom-dot')?.classList.remove('active');
  selectView('model');
  toggleMaquetaMode(false);
});

$('#btn-render-maqueta')?.addEventListener('click', () => {
  $('#btn-render-model')?.classList.remove('active');
  $('#btn-render-maqueta')?.classList.add('active');
  $('#btn-render-maqueta .axiom-island-dot, #btn-render-maqueta .axiom-dot')?.classList.add('active');
  $('#btn-render-model .axiom-island-dot, #btn-render-model .axiom-dot')?.classList.remove('active');
  selectView('model');
  toggleMaquetaMode(true);
});

// Studio Toolbar: Camera Orbit 3D & Cenital
$('#cam-persp')?.addEventListener('click', (e) => {
  document.querySelectorAll('#cam-persp, #cam-top').forEach((b) => b.classList.remove('active'));
  e.currentTarget.classList.add('active');
  selectView('model');
  setCameraView('persp');
});
$('#cam-top')?.addEventListener('click', (e) => {
  document.querySelectorAll('#cam-persp, #cam-top').forEach((b) => b.classList.remove('active'));
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
  const rings = [
    { r: 400, min: 5, color: '#ffffff', weight: 2.2, op: 0.92, fillColor: '#e2e8f0', fillOp: 0.12, label: '5 min · 400 m' },
    { r: 800, min: 10, color: '#cbd5e1', weight: 1.8, op: 0.78, fillColor: '#cbd5e1', fillOp: 0.07, label: '10 min · 800 m' },
    { r: 1200, min: 15, color: '#94a3b8', weight: 1.5, op: 0.65, fillColor: '#94a3b8', fillOp: 0.04, label: '15 min · 1.2 km' }
  ];

  rings.forEach(({ r, min, color, weight, op, fillColor, fillOp, label }) => {
    if (walkState.minutes !== 'all' && min > Number(walkState.minutes)) return;
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
      iconSize: [100, 22],
      iconAnchor: [50, 11]
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
  const stats = getLayerStats(model);
  const totalBld = stats.totalBuildings || 120;
  const wp5 = $('#walk-pois-5'); if (wp5) wp5.textContent = `~${Math.round(totalBld * 0.18)} POIs (400m)`;
  const wp10 = $('#walk-pois-10'); if (wp10) wp10.textContent = `~${Math.round(totalBld * 0.55)} POIs (800m)`;
  const wp15 = $('#walk-pois-15'); if (wp15) wp15.textContent = `~${totalBld} POIs (1.2km)`;
  if ($('#radii-coords')) $('#radii-coords').textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)} · 4.8 km/h`;
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
  document.querySelectorAll('[data-walk], [data-walktime]').forEach((b) => {
    const val = b.dataset.walk || b.dataset.walktime;
    b.classList.toggle('active', val === walkState.minutes);
  });
  updateWalkingDistanceDisplay();
}

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
  const featureCollection = {
    type: 'FeatureCollection',
    name: 'Urbanized_Walking_Distance_Isochrones',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
    features: [
      createCirclePolygon(lat, lon, 400, { time_min: 5, radius_m: 400, speed_kmh: 4.8, label: '5 min Walk' }),
      createCirclePolygon(lat, lon, 800, { time_min: 10, radius_m: 800, speed_kmh: 4.8, label: '10 min Walk' }),
      createCirclePolygon(lat, lon, 1200, { time_min: 15, radius_m: 1200, speed_kmh: 4.8, label: '15 min Walk' })
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
    row.innerHTML = `
      <span class="studio-pin-dot" style="background:${pin.color}; color:${pin.color};"></span>
      <input type="text" class="studio-pin-name-input" value="${pin.label}">
      <span class="studio-pin-type-tag">${pin.type}</span>
      <button type="button" class="studio-pin-del" title="Eliminar marcador">&times;</button>
    `;

    const inp = row.querySelector('.studio-pin-name-input');
    inp.addEventListener('change', (e) => {
      pinStore.updatePin(pin.id, { label: e.target.value });
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
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === next)));
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

  // Botón de ubicar
  const btnPick = $('#btn-feas-pick-location');
  if (btnPick) {
    if (feasibilityStore.isPlacingLot) {
      btnPick.style.background = '#0284c7';
      btnPick.style.color = '#ffffff';
      btnPick.innerHTML = '<span>📍 Clic en el terreno...</span>';
    } else {
      btnPick.style.background = '';
      btnPick.style.color = '';
      btnPick.innerHTML = '<span>📍 Ubicar con Clic</span>';
    }
  }

  // Controles de proyecto 3D importado
  const projControls = $('#feas-project-controls');
  const projName = $('#feas-project-name');
  if (feasibilityStore.projectModel) {
    if (projControls) projControls.hidden = false;
    if (projName) projName.textContent = `Archivo: ${feasibilityStore.projectModel.filename}`;
    const sScale = $('#feas-proj-scale'); if (sScale) sScale.value = feasibilityStore.projectScale;
    const vScale = $('#feas-val-proj-scale'); if (vScale) vScale.textContent = `${feasibilityStore.projectScale.toFixed(2)}x`;
    const sPRot = $('#feas-proj-rot'); if (sPRot) sPRot.value = feasibilityStore.projectRotY;
    const vPRot = $('#feas-val-proj-rot'); if (vPRot) vPRot.textContent = `${feasibilityStore.projectRotY}°`;
    const sPZ = $('#feas-proj-z'); if (sPZ) sPZ.value = feasibilityStore.projectOffsetZ;
    const vPZ = $('#feas-val-proj-z'); if (vPZ) vPZ.textContent = `${feasibilityStore.projectOffsetZ.toFixed(1)} m`;
  } else {
    if (projControls) projControls.hidden = true;
  }

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

// Carga de archivo 3D de proyecto (.glb, .gltf, .obj)
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
$('#feas-proj-scale')?.addEventListener('input', (e) => {
  feasibilityStore.setProjectAdjustments({ scale: Number(e.target.value) });
  renderFeasibilityVolume();
});
$('#feas-proj-rot')?.addEventListener('input', (e) => {
  feasibilityStore.setProjectAdjustments({ rotY: Number(e.target.value) });
  renderFeasibilityVolume();
});
$('#feas-proj-z')?.addEventListener('input', (e) => {
  feasibilityStore.setProjectAdjustments({ offsetZ: Number(e.target.value) });
  renderFeasibilityVolume();
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
  requestAnimationFrame(() => illu.render());
}
window.openIllustratorStudio = openIllustrator;

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
      illu?.setView(b.dataset.illview);
      document.querySelectorAll('[data-illview]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));

    document.querySelectorAll('[data-illstyle]').forEach((b) => b.addEventListener('click', () => {
      illu?.setStyle(b.dataset.illstyle);
      document.querySelectorAll('[data-illstyle]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (illu) document.querySelectorAll('[data-illlayer]').forEach((c) => { c.checked = illu.state.layers[c.dataset.illlayer]; });
      renderSwatches();
    }));

    // Multimapas temáticos: Tipología GIS, Isócronas, Flora, Fauna
    $('#illu-bytype')?.addEventListener('change', (e) => {
      illu?.setByType(e.target.checked);
      renderSwatches();
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

    // Elementos arquitectónicos de lámina (Norte, Escala, Retícula, Grosor)
    $('#illu-north')?.addEventListener('change', (e) => illu?.setOverlay('north', e.target.checked));
    $('#illu-north-style')?.addEventListener('change', (e) => illu?.setOverlay('northStyle', e.target.value));
    $('#illu-scalebar')?.addEventListener('change', (e) => illu?.setOverlay('scalebar', e.target.checked));
    $('#illu-grid')?.addEventListener('change', (e) => illu?.setOverlay('grid', e.target.checked));
    $('#illu-grid-style')?.addEventListener('change', (e) => illu?.setOverlay('gridStyle', e.target.value));
    $('#illu-line-width')?.addEventListener('input', (e) => {
      const w = Number(e.target.value);
      illu?.setLineWidth(w);
      const out = $('#illu-line-width-out');
      if (out) out.textContent = `${w.toFixed(2)} pt`;
    });

    // Exploded Layers Diagram (Imagen 4)
    $('#illu-exploded-switch')?.addEventListener('change', (e) => {
      const active = e.target.checked;
      const opts = $('#illu-exploded-options');
      if (opts) opts.hidden = !active;
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
    $('#illu-persp')?.addEventListener('change', (e) => illu?.setPerspective(e.target.checked));
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

/* ---------------- Векторная карта ---------------- */

let mapOpened = false, mapMod = null, mapOpts = null, mapUrl = null, mapQueued = false, mapSize = '';
const mapBox = $('#map-flat');
const getPath = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
const setPath = (o, path, v) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

async function loadMapMod() {
  mapMod ??= await import('./mapplan.js?v=5.6');
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
  requestAnimationFrame(() => {
    mapQueued = false;
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
  });
}

function syncMapControls() {
  if (!mapOpts) return;
  document.querySelectorAll('[data-mapopt]').forEach((el) => {
    const v = getPath(mapOpts, el.dataset.mapopt);
    if (el.type === 'checkbox') el.checked = Boolean(v);
    else el.value = v;
  });
  document.querySelectorAll('[data-mappreset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mappreset === mapOpts.preset)));
  const nStyle = $('#map-north-style');
  if (nStyle && mapOpts.overlays?.northStyle) nStyle.value = mapOpts.overlays.northStyle;
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
  // ползунки силы доступны, только когда эффект включён
  const dep = { 'shadows.azimuth': 'shadows.on', 'shadows.altitude': 'shadows.on', 'shadows.strength': 'shadows.on', 'relief.hillshadeStrength': 'relief.hillshade', 'relief.depthStrength': 'relief.depth' };
  for (const [k, on] of Object.entries(dep)) {
    const depEl = document.querySelector(`[data-mapopt="${k}"]`);
    if (depEl) depEl.disabled = !getPath(mapOpts, on);
  }
  renderMapScale();
  renderMapSwatches();
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

document.querySelectorAll('[data-mappreset]').forEach((b) => b.addEventListener('click', () => {
  if (!mapMod) return;
  // пресет меняет графику, а настройки листа (сетка, линейка, север, масштаб) остаются
  const scale = mapOpts?.scale ?? null, overlays = mapOpts?.overlays;
  mapOpts = mapMod.presetOptions(b.dataset.mappreset);
  mapOpts.scale = scale;
  if (overlays) mapOpts.overlays = { ...overlays };
  syncMapControls();
  renderMap();
}));
document.querySelectorAll('[data-mapopt]').forEach((el) => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
  if (!mapOpts) return;
  setPath(mapOpts, el.dataset.mapopt, el.type === 'checkbox' ? el.checked : Number(el.value));
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

// выпадающий список языков
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


