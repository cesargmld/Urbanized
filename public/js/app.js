import { buildModel, redetectTrees } from './data.js?v=4.0';
import { FORMATS, stlScale } from './exporters.js?v=4.0';
import { setCameraView, toggleChunkMode, isChunkModeActive } from './preview.js';
import { classifyEcosystem } from './biodiversity.js';
import { t, lang, applyLang, onLangChange, locale, LANGS } from './i18n.js?v=4.0';
import { buildSection, sectionLength, SECTION_FORMATS, MAX_SECTION_KM } from './section.js?v=4.0';
import { createIllustrator } from './illustrate.js?v=4.0';
import * as billing from './billing.js?v=4.0';
import { quote, areaOfModel, areaKm2 as areaOf, sizeCredits, coveredBy, parseModelId, MAX_SIDE_M, FREE_AREA_KM2, USD_PER_CREDIT } from './pricing.js?v=4.0';
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
const bases = {
  map: L.layerGroup([tiles('World_Street_Map', 18)]),
  sat: L.layerGroup([tiles('World_Imagery', 18), tiles('Reference/World_Boundaries_and_Places', 18)]),
};
let baseName = 'sat';
store.set('ue:base', 'sat');
bases[baseName].addTo(map);
map.attributionControl.setPrefix(false);
document.querySelectorAll('.maptype button').forEach((b) => {
  b.setAttribute('aria-pressed', String(b.dataset.base === baseName));
  b.addEventListener('click', () => {
    if (b.dataset.base === baseName) return;
    map.removeLayer(bases[baseName]);
    baseName = b.dataset.base;
    bases[baseName].addTo(map);
    store.set('ue:base', baseName);
    document.querySelectorAll('.maptype button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  });
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
  $('#size-out').textContent = `${sizeKm()} ${t('km')} · ${areaKm2()} ${t('km2')}`;
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
    li.onclick = () => goTo(Number(coords[1]), Number(coords[2]));
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
        li.onclick = () => goTo(Number(r.lat), Number(r.lon));
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
function goTo(lat, lon) {
  results.hidden = true;
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
  const { showModel } = await import('./preview.js?v=4.0');
  showModel($('#viewer'), model, { keepCamera: true });
  await refreshPlan(model);
});
syncTreeControls();

let statusState = ['status.hint', {}];
function setStatus(key, opts = {}) {
  statusState = [key, opts];
  const { busy = false, error = false, vars } = opts;
  status.className = 'status' + (error ? ' error' : '');
  const msg = key.split('|').map((k) => t(k, vars)).join('. ');
  status.textContent = msg;
  if (busy) status.insertAdjacentHTML('beforeend', '<span class="progress"></span>');

  // Topbar header loader sync
  const headerLoader = $('#header-loader');
  const headerLoaderText = $('#header-loader-text');
  const spinner = headerLoader?.querySelector('.mini-spinner');
  if (headerLoader) {
    headerLoader.hidden = !busy && !error;
    if (spinner) spinner.style.display = busy ? 'inline-block' : 'none';
    if (headerLoaderText) headerLoaderText.textContent = msg || 'Procesando datos cartográficos...';
    if (error) {
      setTimeout(() => {
        if (!building) headerLoader.hidden = true;
      }, 7000);
    }
  }
}

panel.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (building) return;
  const c = map.getCenter().wrap();
  const layerKeys = ['buildings', 'extraBuildings', 'roads', 'roadWidth', 'bridges', 'terrain', 'contours', 'nature', 'trees', 'detect', 'satellite'];
  const layers = Object.fromEntries(layerKeys.map((k) => [k, panel.elements[k] ? panel.elements[k].checked : true]));
  building = new AbortController();
  buildBtn.disabled = true;
  buildBtn.textContent = t('build.busy');
  try {
    const m = await buildModel({ lat: c.lat, lon: c.lng, size: Number(sizeInput.value), shape, layers, sensitivity: sens.value / 100 }, (s) => setStatus(s, { busy: true }), building.signal);

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
    await showResult(m);
  } catch (err) {
    console.error(err);
    setStatus('status.error', { error: true });
  } finally {
    building = null;
    buildBtn.disabled = false;
    buildBtn.textContent = t('build.idle');
  }
});

function renderMeta(m) {
  const loc = locale();
  $('#coords').textContent =
    t(m.shape === 'circle' ? 'result.metaCircle' : 'result.meta', { lat: m.center.lat.toFixed(5), lon: m.center.lon.toFixed(5), size: m.size }) +
    (m.contourInterval ? t('result.contours', { n: m.contourInterval }) : '') +
    (m.extraBuildings ? t('result.overture', { n: m.extraBuildings.toLocaleString(loc) }) : '') +
    (m.dataSource === 'overture' ? t('result.sourceOverture') : '') +
    (m.grid.source ? ` · ${t(`terrain.${m.grid.source}`, { res: m.grid.res < 1 ? m.grid.res.toFixed(1) : Math.round(m.grid.res) })}` : '');
  $('#st-buildings').textContent = m.stats.buildings.toLocaleString(loc);
  $('#st-roads').textContent = m.stats.roadsKm.toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  $('#st-trees').textContent = m.stats.trees.toLocaleString(loc);
  $('#lidar-note').hidden = m.grid.source !== 'dtm';
  const sc = stlScale(m.size);
  $('#stl-note').textContent = t('dl.stlNote', { scale: sc, mm: Math.round((m.size * 1000) / sc) });
  $('#st-relief').textContent = Math.round(m.stats.relief);
}

async function showResult(m) {
  setMode('model');
  renderMeta(m);
  const { showModel } = await import('./preview.js');
  showModel($('#viewer'), m);
  await preparePreviews(m);
  applySite();
  if (illuOpened) openIllustrator();
  if (mapOpened) renderMap(true);
  const remaining = await quotaStatus();
  const counted = isCounted(m.id);
  renderQuota(remaining, counted);
  lockDownloads(remaining <= 0 && !counted);

  // Enable Dock buttons & switch screen cleanly
  $('#dock-btn-studio')?.classList.remove('disabled');
  $('#dock-btn-map')?.classList.remove('disabled');
  $('#dock-btn-illu')?.classList.remove('disabled');

  if (window.switchWorkspaceView) {
    window.switchWorkspaceView('result');
    setTimeout(async () => {
      const p = await import('./preview.js');
      p.triggerResize?.();
    }, 80);
  }
}

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
  $('#view-plan img').src = flatUrls.plan;
}
async function preparePreviews(m) {
  illu = null;
  illuModel = null;
  $('#illu-label-list').innerHTML = '';
  for (const k of Object.keys(flatUrls)) if (flatUrls[k]) URL.revokeObjectURL(flatUrls[k]);
  flatUrls.plan = URL.createObjectURL(FORMATS.svg.make(m));
  flatUrls.sat = m.imagery ? URL.createObjectURL(await FORMATS.jpg.make(m)) : null;
  const satTab = document.querySelector('[data-view="sat"]');
  if (satTab) satTab.hidden = !m.imagery;
  for (const view of ['plan', 'sat']) {
    const img = $(`#view-${view} img`);
    if (flatUrls[view]) img.src = flatUrls[view];
  }
  selectView('model');
}

let currentView = 'model';
function selectView(view) {
  currentView = view;
  document.querySelectorAll('.stage-tabs button, .tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === view)));
  $('#viewer').hidden = view !== 'model';
  $('#view-plan').hidden = view !== 'plan';
  $('#view-sat').hidden = view !== 'sat';
  $('#viewer-hint').textContent = t(view === 'model' ? 'viewer.hint' : 'viewer.hintFlat');
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
  $('#sec-len').textContent = `${(len / 1000).toFixed(2)} ${t('km')}`;
  const tooLong = len > MAX_SECTION_KM * 1000;
  $('#sec-build').disabled = secState.points.length < 2 || tooLong || secBusy;
  $('#sec-undo').disabled = !secState.points.length;
  $('#sec-clear').disabled = !secState.points.length;
  
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
  el.className = 'status' + (opts.error ? ' error' : '');
  el.textContent = key ? t(key, opts.vars) : '';
  if (opts.busy) el.insertAdjacentHTML('beforeend', '<span class="progress"></span>');
}

let secBusy = false;
$('#sec-draw').addEventListener('click', () => {
  secState.drawing = !secState.drawing;
  $('#sec-draw').setAttribute('aria-pressed', String(secState.drawing));
  $('#sec-draw').textContent = t(secState.drawing ? 'section.drawing' : 'section.draw');
  $('#site-draw').textContent = t(site.drawing ? 'site.drawing' : 'site.draw');
  siteRedraw();
  map.getContainer().parentElement.classList.toggle('drawing', secState.drawing);
  secRedraw();
});
$('#sec-undo').addEventListener('click', () => { secState.points.pop(); secRedraw(); });
$('#sec-clear').addEventListener('click', () => { secState.points = []; secRedraw(); });
map.on('click', (e) => {
  if (site.drawing) { site.points.push([e.latlng.lat, e.latlng.lng]); siteRedraw(); return; }
  if (!secState.drawing) return;
  secState.points.push([e.latlng.lat, e.latlng.lng]);
  secRedraw();
});

$('#sec-build').addEventListener('click', async () => {
  if (secBusy || secState.points.length < 2) return;
  secBusy = true;
  $('#sec-build').disabled = true;
  try {
    const exaggeration = Number($('#sec-exag').value);
    const sec = await buildSection(secState.points, { exaggeration }, (k) => setSecStatus(k, { busy: true }));
    sec.flip = $('#sec-dir').value === '1';
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
  secState.model.exaggeration = Number($('#sec-exag').value);
  secState.model.flip = $('#sec-dir').value === '1';
  await showSection(secState.model);
};
$('#sec-exag').addEventListener('change', secRefresh);
$('#sec-dir').addEventListener('change', secRefresh);

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

// ---------------- Biodiversity, Flora & Fauna Engine ----------------
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

  const floraList = $('#bio-flora-list');
  if (floraList) {
    floraList.innerHTML = eco.flora.map(f => `
      <div class="bio-pill-item">
        <div class="bio-pill-header">
          <b class="bio-sp-name">${f.name}</b>
          <i class="bio-sp-latin">${f.latin}</i>
        </div>
        <div class="bio-pill-meta">
          <span class="bio-badge">${f.type}</span>
          <span class="bio-note">${f.note}</span>
        </div>
      </div>
    `).join('');
  }

  const faunaList = $('#bio-fauna-list');
  if (faunaList) {
    faunaList.innerHTML = eco.fauna.map(f => `
      <div class="bio-pill-item">
        <div class="bio-pill-header">
          <b class="bio-sp-name">${f.name}</b>
          <i class="bio-sp-latin">${f.latin}</i>
        </div>
        <div class="bio-pill-meta">
          <span class="bio-badge">${f.class}</span>
          <span class="bio-status-tag">${f.status}</span>
        </div>
      </div>
    `).join('');
  }

  const climateEl = $('#bio-climate');
  if (climateEl) climateEl.textContent = eco.climate.split('(')[0].trim();

  const canopyEl = $('#bio-canopy');
  if (canopyEl) canopyEl.textContent = eco.canopy;
}

window.updateBiodiversityCard = updateBiodiversity;
map.on('moveend', () => {
  const bioCard = $('#bio-card');
  if (bioCard && !bioCard.hidden) updateBiodiversity();
});

// Camera toolbar buttons
$('#cam-persp')?.addEventListener('click', (e) => {
  document.querySelectorAll('.cam-pill-btn, .cam-btn').forEach(b => b.classList.remove('active'));
  e.currentTarget.classList.add('active');
  setCameraView('persp');
});
$('#cam-iso')?.addEventListener('click', (e) => {
  document.querySelectorAll('.cam-pill-btn, .cam-btn').forEach(b => b.classList.remove('active'));
  e.currentTarget.classList.add('active');
  setCameraView('iso');
});
$('#cam-top')?.addEventListener('click', (e) => {
  document.querySelectorAll('.cam-pill-btn, .cam-btn').forEach(b => b.classList.remove('active'));
  e.currentTarget.classList.add('active');
  setCameraView('top');
});


async function renderSecQuota() {
  const counted = isCounted(`sec:${secState.model?.id}`);
  const remaining = await quotaStatus();
  const el = $('#sec-quota');
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
  $('#model-tools').hidden = next !== 'model';
  $('#section-tools').hidden = next !== 'section';
  frame.hidden = next !== 'model';

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
  map.getContainer().parentElement.classList.toggle('drawing', (next === 'section' && secState.drawing) || (next === 'model' && site.drawing));
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
  $('#site-clear').disabled = !site.points.length;
  $('#site-info').textContent = site.points.length > 2 ? `${site.points.length} ${t('site.points')}` : '—';
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
  if (!$('#result').hidden) refreshPlan(model);
}

$('#site-draw').addEventListener('click', () => {
  site.drawing = !site.drawing;
  if (site.drawing) { secState.drawing = false; $('#sec-draw').textContent = t('section.draw'); }
  $('#site-draw').setAttribute('aria-pressed', String(site.drawing));
  $('#site-draw').textContent = t(site.drawing ? 'site.drawing' : 'site.draw');
  map.getContainer().parentElement.classList.toggle('drawing', site.drawing || secState.drawing);
});
$('#site-clear').addEventListener('click', () => { site.points = []; siteRedraw(); });

/* ---------------- Иллюстрация ---------------- */

let illu = null, illuModel = null, placing = false, illuOpened = false;

$('#open-editor').addEventListener('click', () => {
  const box = $('#illustrator');
  illuOpened = true;
  billing.track('editor:illu');
  box.hidden = false;
  openIllustrator();
  box.scrollIntoView({ behavior: 'smooth' });
});

function openIllustrator() {
  if (!model) return;
  const canvas = $('#illu-canvas');
  if (!illu || illuModel !== model) {
    illu = createIllustrator(canvas, model);
    illuModel = model;
    illu.setLang(lang);
    renderLabelList();
    renderSwatches();
  }
  requestAnimationFrame(() => illu.render());
}

// палитры редактора: основные цвета и, при раскраске по типам, цвета классов
const SWATCHES = ['bg', 'terrain', 'building', 'water', 'green', 'tree', 'road', 'roadMajor', 'bridge'];
const CLASSES = ['residential', 'public', 'commercial', 'industrial', 'utility', 'other'];
function renderSwatches() {
  if (!illu) return;
  const { base, classes } = illu.colors();
  const make = (box, keys, labelKey, current, onPick) => {
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
  const byType = $('#illu-bytype').checked;
  if (byType) make($('#illu-class-swatches'), CLASSES, 'class', classes, (k, v) => illu.setClassColor(k, v));
  else $('#illu-class-swatches').innerHTML = '';
}

function renderLabelList() {
  const ul = $('#illu-label-list');
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
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!illu) return;
    if (placing) {
      const r = canvas.getBoundingClientRect();
      const l = illu.addLabel(e.clientX - r.left, e.clientY - r.top, t('illu.labelDefault'));
      placing = false;
      canvas.classList.remove('picking');
      $('#illu-label').setAttribute('aria-pressed', 'false');
      $('#illu-label').textContent = t('illu.addLabel');
      if (l) { renderLabelList(); $('#illu-label-list input:last-of-type')?.focus(); }
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    illu.setQuick(true);
    drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2 };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || !illu) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (drag.pan) illu.pan(dx, dy);
    else illu.orbit(dx, dy);
    document.querySelectorAll('[data-illview]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.illview === illu.state.view)));
  });
  const stop = () => { drag = null; illu?.setQuick(false); };
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
  document.querySelectorAll('[data-illlayer]').forEach((c) => c.addEventListener('change', () => illu?.setLayer(c.dataset.illlayer, c.checked)));
  $('#illu-persp').addEventListener('change', (e) => illu?.setPerspective(e.target.checked));
  $('#illu-bytype').addEventListener('change', (e) => { illu?.setByType(e.target.checked); renderSwatches(); });
  $('#illu-legend').addEventListener('change', (e) => illu?.setLegend(e.target.checked));
  $('#illu-reset-colors').addEventListener('click', () => { illu?.resetColors(); renderSwatches(); });
  $('#illu-color').addEventListener('input', (e) => illu?.setLabelColor(e.target.value));
  $('#illu-label').addEventListener('click', () => {
    placing = !placing;
    canvas.classList.toggle('picking', placing);
    $('#illu-label').setAttribute('aria-pressed', String(placing));
    $('#illu-label').textContent = t(placing ? 'illu.placing' : 'illu.addLabel');
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
  new ResizeObserver(() => { if (illu && !$('#view-illu').hidden) illu.render(); }).observe(canvas);
}

/* ---------------- Векторная карта ---------------- */

let mapOpened = false, mapMod = null, mapOpts = null, mapUrl = null, mapQueued = false, mapSize = '';
const mapBox = $('#map-flat');
const getPath = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
const setPath = (o, path, v) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

async function loadMapMod() {
  mapMod ??= await import('./mapplan.js?v=4.0');
  mapOpts ??= mapMod.presetOptions('classic');
  return mapMod;
}

$('#open-map').addEventListener('click', async () => {
  const box = $('#mapper');
  mapOpened = true;
  billing.track('editor:map');
  box.hidden = false;
  await loadMapMod();
  syncMapControls();
  renderMap(true);
  box.scrollIntoView({ behavior: 'smooth' });
});

// перерисовка не чаще одного раза за кадр: ползунки шлют событие на каждый пиксель
function renderMap(refit = false) {
  if (!model || !mapMod) return;
  if (mapQueued && !refit) return;
  mapQueued = true;
  requestAnimationFrame(() => {
    mapQueued = false;
    const svg = mapMod.mapSVG(model, mapOpts);
    if (mapUrl) URL.revokeObjectURL(mapUrl);
    mapUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = mapBox.querySelector('img');
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
  // ползунки силы доступны, только когда эффект включён
  const dep = { 'shadows.azimuth': 'shadows.on', 'shadows.altitude': 'shadows.on', 'shadows.strength': 'shadows.on', 'relief.hillshadeStrength': 'relief.hillshade', 'relief.depthStrength': 'relief.depth' };
  for (const [k, on] of Object.entries(dep)) document.querySelector(`[data-mapopt="${k}"]`).disabled = !getPath(mapOpts, on);
  renderMapScale();
  renderMapSwatches();
}

function renderMapScale() {
  const sel = $('#map-scale');
  if (!mapMod || !model) return;
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
$('#map-scale').addEventListener('change', (e) => { if (mapOpts) { mapOpts.scale = Number(e.target.value); renderMap(true); } });
$('#map-reset-colors').addEventListener('click', () => {
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
for (const sel of document.querySelectorAll('.lang-select')) {
  sel.innerHTML = LANGS.map((l) => `<option value="${l.code}">${l.name}</option>`).join('');
  sel.value = lang;
  sel.addEventListener('change', () => applyLang(sel.value));
}
onLangChange(() => {
  drawFrame();
  if (!building) buildBtn.textContent = t('build.idle');
  else buildBtn.textContent = t('build.busy');
  setStatus(...statusState);
  if (model) renderMeta(model);
  showChannel();
  if (mapMod && mapOpts) { renderMapSwatches(); renderMapScale(); }
  if (illu) { $('#illu-label').textContent = t(placing ? 'illu.placing' : 'illu.addLabel'); illu.setLang(lang); renderSwatches(); }
  $('#viewer-hint').textContent = t(currentView === 'model' ? 'viewer.hint' : 'viewer.hintFlat');
  $('#sec-draw').textContent = t(secState.drawing ? 'section.drawing' : 'section.draw');
  $('#site-draw').textContent = t(site.drawing ? 'site.drawing' : 'site.draw');
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
  $('#app').scrollIntoView({ behavior: 'smooth' });
  if (!building) panel.requestSubmit();
});
billing.refresh().then(() => billing.handleLoginLink());

// применяем язык последним: к этому моменту все обработчики и данные готовы
applyLang();


