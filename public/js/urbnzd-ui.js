/**
 * URBNZD Studio — Unified Architectural Workstation Controller
 * Phased Workflow (Select -> 3D Studio) + English/Spanish Bilingual + 100% Native Analysis & 2D Cartography
 */

(function () {
  'use strict';

  // --- 1. Bilingual Dictionary (English Default) ---
  const I18N = {
    en: {
      brand_sub: 'PRO · 20×',
      search_ph: 'Search address, place or coordinates...',
      tab_layers: '3D Layers',
      tab_styles: 'Styles',
      tab_analysis: 'Site Analysis',
      card_frame_title: 'Site Frame',
      lot_w: 'Width',
      lot_h: 'Length',
      area: 'Area',
      dem_res: 'Elevation DEM',
      dem_res_val: 'Copernicus GLO-30 (20× finer)',
      btn_build: 'Build 3D Model',
      btn_building: 'Generating 3D Model (DEM 20×)...',
      frame_hint: 'Drag the map to position your site. Max site size: 5 km.',
      tip_3d: '3D Studio (Terrain DEM 20×, Buildings, Trees, Water)',
      tip_2d: '2D Plan / Nolli (Figure-Ground, Blueprint, Contours)',
      tip_section: 'Section Cut (Live Elevation Profile)',
      tip_live: 'Live Simulation (Rain runoff, Sun & Wind)',
      tip_sheet: 'Presentation Sheet (Titleblock & Scale)',
      tip_export: 'Export Pro (SketchUp .skp, GLB, CAD, Rhino)',
      tip_new_site: 'New Site Frame',
      tip_drawer: 'Collapse / Expand Panel',
      style_arctic: 'Arctic Studio',
      style_arctic_desc: 'Nordic matte white architectural model with ambient shading.',
      style_nolli: 'Nolli Figure-Ground',
      style_nolli_desc: 'Historic urban solid-void black & white cartography.',
      style_blueprint: 'Cyanotype Blueprint',
      style_blueprint_desc: 'Architectural blueprint with crisp white vector linework.',
      style_analytic: 'Analytic GIS',
      style_analytic_desc: 'Zoning land-use classification and floor heights.',
      style_topo: 'CAD Topographic',
      style_topo_desc: 'Master elevation contours with numerical levels.',
      style_signal: 'Signal Dark',
      style_signal_desc: 'Obsidian stage with glowing water and road vectors.',
      report_title: 'Site Report & Analytics',
      report_sub: 'Click any figure to highlight on the 3D model',
      tb_project: 'URBAN ARCHITECTURAL PROJECT',
      tb_studio: 'STUDIO:',
      tb_scale: 'SCALE:',
      tb_date: 'DATE:',
      tb_datum: 'DATUM:'
    },
    es: {
      brand_sub: 'PRO · 20×',
      search_ph: 'Buscar dirección, lugar o coordenadas...',
      tab_layers: 'Capas 3D',
      tab_styles: 'Estilos',
      tab_analysis: 'Análisis del Sitio',
      card_frame_title: 'Encuadre del Sitio',
      lot_w: 'Ancho',
      lot_h: 'Largo',
      area: 'Superficie',
      dem_res: 'Elevación DEM',
      dem_res_val: 'Copernicus GLO-30 (20× más fino)',
      btn_build: 'Construir Modelo 3D',
      btn_building: 'Generando Modelo 3D (DEM 20×)...',
      frame_hint: 'Arrastra el mapa para encuadrar tu lote. Máximo 5 km.',
      tip_3d: '3D Studio (Terreno DEM 20×, Edificios, Árboles, Agua)',
      tip_2d: 'Plano 2D / Nolli (Figura-Fondo, Blueprint, Curvas)',
      tip_section: 'Corte & Sección (Perfil Altimétrico en Vivo)',
      tip_live: 'Simulación Viva (Escorrentía, Sol y Viento)',
      tip_sheet: 'Lámina de Entrega (Membrete y Escala)',
      tip_export: 'Exportar Pro (SketchUp .skp, GLB, CAD, Rhino)',
      tip_new_site: 'Nuevo Emplazamiento',
      tip_drawer: 'Colapsar / Expandir Panel',
      style_arctic: 'Arctic Studio',
      style_arctic_desc: 'Maqueta blanca nórdica mate y sombreado ambiental fino.',
      style_nolli: 'Figura-Fondo Nolli',
      style_nolli_desc: 'Cartografía histórica de llenos y vacíos urbanos.',
      style_blueprint: 'Blueprint Cianotipo',
      style_blueprint_desc: 'Cianotipo arquitectónico con líneas vectoriales blancas.',
      style_analytic: 'Analytic GIS',
      style_analytic_desc: 'Zonificación de usos de suelo y alturas.',
      style_topo: 'Topográfico CAD',
      style_topo_desc: 'Curvas de nivel maestras y cotas de nivel.',
      style_signal: 'Signal Dark',
      style_signal_desc: 'Obsidiana con resplandor en agua y vías.',
      report_title: 'Informe y Análisis del Sitio',
      report_sub: 'Haz clic en cualquier cifra para verla en el modelo 3D',
      tb_project: 'PROYECTO ARQUITECTÓNICO URBANO',
      tb_studio: 'ESTUDIO:',
      tb_scale: 'ESCALA:',
      tb_date: 'FECHA:',
      tb_datum: 'DATUM:'
    }
  };

  let currentLang = 'en';

  function t(key) {
    return I18N[currentLang]?.[key] || I18N.en[key] || key;
  }

  function initUrbnzdUI() {
    if (document.getElementById('uzRail')) return;

    // 1. Build Left Icon Rail (64px)
    const rail = document.createElement('nav');
    rail.id = 'uzRail';
    rail.setAttribute('aria-label', 'URBNZD Navigation');
    rail.innerHTML = `
      <div class="uz-rail-top">
        <button type="button" class="uz-rail-brand" id="uzBrandBtn" title="URBNZD Studio" aria-label="URBNZD Studio">
          <svg viewBox="0 0 40 40" width="30" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 4L34 12V28L20 36L6 28V12L20 4Z" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round"/>
            <path d="M20 4L20 20L34 28" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
            <path d="M20 20L6 28" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
            <circle cx="20" cy="20" r="3" fill="#ffffff"/>
          </svg>
        </button>
        <div class="uz-rail-nav">
          <!-- 3D Studio (Always available) -->
          <button type="button" class="uz-rail-btn active" id="uzNav3D" data-mode="3d" data-tip="${t('tip_3d')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>
          </button>
          
          <!-- Post-model tools (Hidden in select phase, unlocked in model phase) -->
          <button type="button" class="uz-rail-btn uz-post-model" id="uzNav2D" data-mode="2d" data-tip="${t('tip_2d')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          </button>
          <button type="button" class="uz-rail-btn uz-post-model" id="uzNavSection" data-mode="section" data-tip="${t('tip_section')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
          </button>
          <button type="button" class="uz-rail-btn uz-post-model" id="uzNavLive" data-mode="simulation" data-tip="${t('tip_live')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/><circle cx="12" cy="12" r="4"/></svg>
          </button>
          <button type="button" class="uz-rail-btn uz-post-model" id="uzNavSheet" data-mode="sheet" data-tip="${t('tip_sheet')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>
          </button>
          <div class="uz-rail-sep uz-post-model"></div>
          <button type="button" class="uz-rail-btn uz-post-model" id="uzNavExport" data-mode="export" data-tip="${t('tip_export')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        </div>
      </div>
      <div class="uz-rail-bottom">
        <!-- Language Switcher EN / ES -->
        <button type="button" class="uz-lang-btn" id="uzLangToggle" title="Switch Language / Cambiar Idioma">
          <span id="uzLangLbl">EN</span>
        </button>
        <button type="button" class="uz-rail-btn uz-post-model" id="uzRailNewSite" data-tip="${t('tip_new_site')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <button type="button" class="uz-rail-btn" id="uzRailToggleDrawer" data-tip="${t('tip_drawer')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
        </button>
      </div>
    `;

    // 2. Build Secondary Drawer Panel (320px) matching Knowledge Base layout
    const drawer = document.createElement('aside');
    drawer.id = 'uzDrawer';
    drawer.setAttribute('aria-label', 'URBNZD Explorer');
    drawer.innerHTML = `
      <div class="uz-drawer-header">
        <div class="uz-drawer-title-group">
          <img src="media/urbnzd-logo.png" alt="URBNZD" class="uz-drawer-brand-img">
          <span class="uz-drawer-badge">${t('brand_sub')}</span>
        </div>
        <div class="uz-drawer-actions">
          <button type="button" class="uz-lang-pill" id="uzDrawerLangToggle">
            <span class="uz-lang-opt active" data-lang="en">EN</span>
            <span class="uz-lang-sep">/</span>
            <span class="uz-lang-opt" data-lang="es">ES</span>
          </button>
          <button type="button" class="uz-icon-btn" id="uzDrawerClose" title="Close Panel">✕</button>
        </div>
      </div>

      <!-- Integrated Search -->
      <div class="uz-search-box">
        <div class="uz-search-wrapper">
          <svg class="uz-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="uz-search-input" id="uzSearchInput" placeholder="${t('search_ph')}" autocomplete="off">
        </div>
      </div>

      <!-- Segmented Tabs (Visible ONLY in model phase) -->
      <div class="uz-tabs-track uz-post-model" id="uzTabsTrack" role="tablist">
        <button type="button" class="uz-tab-btn active" data-tab="layers">${t('tab_layers')}</button>
        <button type="button" class="uz-tab-btn" data-tab="styles">${t('tab_styles')}</button>
        <button type="button" class="uz-tab-btn" data-tab="analysis">${t('tab_analysis')}</button>
      </div>

      <!-- Scrollable Content -->
      <div class="uz-drawer-content">
        <!-- Site Framing Card (VISIBLE ONLY IN SELECT PHASE) -->
        <div class="uz-card-section" id="uzFrameControls">
          <div class="uz-frame-card-h">
            <span class="uz-frame-h-t" id="uzTxtFrameTitle">${t('card_frame_title')}</span>
            <span class="uz-count-badge" id="uzValArea">100 ha</span>
          </div>
          <div class="uz-slider-row">
            <div class="uz-slider-label"><span id="uzTxtWidth">${t('lot_w')}</span><b id="uzValW">1,000 m</b></div>
            <input type="range" class="uz-range" id="uzRangeW" min="100" max="5000" step="50" value="1000">
          </div>
          <div class="uz-slider-row">
            <div class="uz-slider-label"><span id="uzTxtLength">${t('lot_h')}</span><b id="uzValH">1,000 m</b></div>
            <input type="range" class="uz-range" id="uzRangeH" min="100" max="5000" step="50" value="1000">
          </div>
          <div class="uz-dem-badge-row">
            <span id="uzTxtDem">${t('dem_res')}</span>
            <b id="uzTxtDemVal">${t('dem_res_val')}</b>
          </div>
          <button type="button" class="uz-btn-build" id="uzBtnBuildProxy">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/></svg>
            <span id="uzTxtBtnBuild">${t('btn_build')}</span>
          </button>
          <p class="uz-frame-hint" id="uzTxtFrameHint">${t('frame_hint')}</p>
        </div>

        <!-- Tab 1: 3D Layers (Real Interactive Layers Mount) -->
        <div class="uz-tab-pane uz-post-model active" id="uzPaneLayers">
          <div id="uzLayersMount" class="uz-layers-mount">
            <!-- The native #layerList is mounted here when model is ready -->
          </div>
        </div>

        <!-- Tab 2: Architectural Styles -->
        <div class="uz-tab-pane uz-post-model" id="uzPaneStyles" style="display:none;">
          <div class="uz-styles-grid">
            <div class="uz-style-card active" data-style-id="arctic">
              <span class="uz-style-icon">❄️</span>
              <span class="uz-style-name" id="uzStArctic">${t('style_arctic')}</span>
              <span class="uz-style-desc" id="uzStArcticDesc">${t('style_arctic_desc')}</span>
            </div>
            <div class="uz-style-card" data-style-id="nolli">
              <span class="uz-style-icon">⬛</span>
              <span class="uz-style-name" id="uzStNolli">${t('style_nolli')}</span>
              <span class="uz-style-desc" id="uzStNolliDesc">${t('style_nolli_desc')}</span>
            </div>
            <div class="uz-style-card" data-style-id="blueprint">
              <span class="uz-style-icon">🔷</span>
              <span class="uz-style-name" id="uzStBlueprint">${t('style_blueprint')}</span>
              <span class="uz-style-desc" id="uzStBlueprintDesc">${t('style_blueprint_desc')}</span>
            </div>
            <div class="uz-style-card" data-style-id="analytic">
              <span class="uz-style-icon">📊</span>
              <span class="uz-style-name" id="uzStAnalytic">${t('style_analytic')}</span>
              <span class="uz-style-desc" id="uzStAnalyticDesc">${t('style_analytic_desc')}</span>
            </div>
            <div class="uz-style-card" data-style-id="topo">
              <span class="uz-style-icon">📐</span>
              <span class="uz-style-name" id="uzStTopo">${t('style_topo')}</span>
              <span class="uz-style-desc" id="uzStTopoDesc">${t('style_topo_desc')}</span>
            </div>
            <div class="uz-style-card" data-style-id="signal">
              <span class="uz-style-icon">⚡</span>
              <span class="uz-style-name" id="uzStSignal">${t('style_signal')}</span>
              <span class="uz-style-desc" id="uzStSignalDesc">${t('style_signal_desc')}</span>
            </div>
          </div>
        </div>

        <!-- Tab 3: Complete Site Report & Analysis (100% of the Real Scientific Data) -->
        <div class="uz-tab-pane uz-post-model" id="uzPaneAnalysis" style="display:none;">
          <div id="uzAnalysisMount" class="uz-analysis-mount">
            <!-- The native #modelRight (cardRelief, cardHydro, cardCover, cardClimate, cardBuilt) is mounted here -->
          </div>
        </div>
      </div>
    `;

    // 3. Build Architectural Sheet Overlay (Membrete Lámina 2D)
    const sheetOverlay = document.createElement('div');
    sheetOverlay.id = 'uzSheetOverlay';
    sheetOverlay.innerHTML = `
      <div class="uz-titleblock">
        <div class="uz-tb-project" id="uzTbProj" contenteditable="true" spellcheck="false">${t('tb_project')}</div>
        <div class="uz-tb-site" id="uzTbCoords">48.1105° N, 11.5574° E · WGS84</div>
        <div class="uz-tb-grid">
          <div><span id="uzTbStudioLbl">${t('tb_studio')}</span> <b contenteditable="true">URBNZD STUDIO</b></div>
          <div><span id="uzTbScaleLbl">${t('tb_scale')}</span> <b id="uzTbScale">1:1,000</b></div>
          <div><span id="uzTbDateLbl">${t('tb_date')}</span> <b>${new Date().toLocaleDateString(currentLang === 'es' ? 'es-ES' : 'en-US')}</b></div>
          <div><span id="uzTbDatumLbl">${t('tb_datum')}</span> <b>COPERNICUS GLO-30</b></div>
        </div>
      </div>
    `;

    // Append to document body
    document.body.appendChild(rail);
    document.body.appendChild(drawer);
    document.body.appendChild(sheetOverlay);

    // Initial check of phase
    updatePhaseUI();

    // Wire events
    setupEventListeners();
  }

  function updatePhaseUI() {
    const appEl = document.getElementById('app');
    const phase = appEl ? appEl.getAttribute('data-phase') : 'select';

    const postModelEls = document.querySelectorAll('.uz-post-model');
    const frameControls = document.getElementById('uzFrameControls');
    const tabsTrack = document.getElementById('uzTabsTrack');

    if (phase === 'model') {
      // Unlocked: reveal tools, hide framing, show layers & analysis
      postModelEls.forEach(el => {
        el.style.display = '';
        el.classList.remove('uz-hidden');
      });
      if (frameControls) frameControls.style.display = 'none';
      if (tabsTrack) tabsTrack.style.display = 'flex';

      // Mount native layerList and modelRight into drawer
      mountNativePanels();
    } else {
      // Locked: only show framing and 3D creation
      postModelEls.forEach(el => {
        el.style.display = 'none';
        el.classList.add('uz-hidden');
      });
      if (frameControls) frameControls.style.display = 'flex';
      if (tabsTrack) tabsTrack.style.display = 'none';
    }
  }

  function mountNativePanels() {
    // 1. Mount Layer List into Tab 1
    const layersMount = document.getElementById('uzLayersMount');
    const nativeLayerList = document.getElementById('layerList');
    if (layersMount && nativeLayerList && !layersMount.contains(nativeLayerList)) {
      layersMount.appendChild(nativeLayerList);
    }

    // 2. Mount Site Report (#modelRight) into Tab 3
    const analysisMount = document.getElementById('uzAnalysisMount');
    const nativeModelRight = document.getElementById('modelRight');
    if (analysisMount && nativeModelRight && !analysisMount.contains(nativeModelRight)) {
      nativeModelRight.hidden = false;
      nativeModelRight.style.display = 'flex';
      nativeModelRight.style.position = 'static';
      nativeModelRight.style.width = '100%';
      analysisMount.appendChild(nativeModelRight);
    }
  }

  function setLanguage(lang) {
    if (lang !== 'en' && lang !== 'es') return;
    currentLang = lang;

    // Update Language Pills
    const langLbl = document.getElementById('uzLangLbl');
    if (langLbl) langLbl.textContent = lang.toUpperCase();

    document.querySelectorAll('.uz-lang-opt').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.lang === lang);
    });

    // Update Tooltips on Left Rail
    const btn3D = document.getElementById('uzNav3D');
    if (btn3D) btn3D.setAttribute('data-tip', t('tip_3d'));
    const btn2D = document.getElementById('uzNav2D');
    if (btn2D) btn2D.setAttribute('data-tip', t('tip_2d'));
    const btnSec = document.getElementById('uzNavSection');
    if (btnSec) btnSec.setAttribute('data-tip', t('tip_section'));
    const btnLive = document.getElementById('uzNavLive');
    if (btnLive) btnLive.setAttribute('data-tip', t('tip_live'));
    const btnSheet = document.getElementById('uzNavSheet');
    if (btnSheet) btnSheet.setAttribute('data-tip', t('tip_sheet'));
    const btnExp = document.getElementById('uzNavExport');
    if (btnExp) btnExp.setAttribute('data-tip', t('tip_export'));
    const btnNew = document.getElementById('uzRailNewSite');
    if (btnNew) btnNew.setAttribute('data-tip', t('tip_new_site'));
    const btnDrawer = document.getElementById('uzRailToggleDrawer');
    if (btnDrawer) btnDrawer.setAttribute('data-tip', t('tip_drawer'));

    // Update Drawer Elements
    const sInput = document.getElementById('uzSearchInput');
    if (sInput) sInput.placeholder = t('search_ph');

    const tabLayers = document.querySelector('.uz-tab-btn[data-tab="layers"]');
    if (tabLayers) tabLayers.textContent = t('tab_layers');
    const tabStyles = document.querySelector('.uz-tab-btn[data-tab="styles"]');
    if (tabStyles) tabStyles.textContent = t('tab_styles');
    const tabAnalysis = document.querySelector('.uz-tab-btn[data-tab="analysis"]');
    if (tabAnalysis) tabAnalysis.textContent = t('tab_analysis');

    const txtFrameTitle = document.getElementById('uzTxtFrameTitle');
    if (txtFrameTitle) txtFrameTitle.textContent = t('card_frame_title');
    const txtWidth = document.getElementById('uzTxtWidth');
    if (txtWidth) txtWidth.textContent = t('lot_w');
    const txtLength = document.getElementById('uzTxtLength');
    if (txtLength) txtLength.textContent = t('lot_h');
    const txtDem = document.getElementById('uzTxtDem');
    if (txtDem) txtDem.textContent = t('dem_res');
    const txtDemVal = document.getElementById('uzTxtDemVal');
    if (txtDemVal) txtDemVal.textContent = t('dem_res_val');
    const txtBtnBuild = document.getElementById('uzTxtBtnBuild');
    if (txtBtnBuild) txtBtnBuild.textContent = t('btn_build');
    const txtFrameHint = document.getElementById('uzTxtFrameHint');
    if (txtFrameHint) txtFrameHint.textContent = t('frame_hint');

    // Update Styles Grid
    const stArctic = document.getElementById('uzStArctic');
    if (stArctic) stArctic.textContent = t('style_arctic');
    const stArcticD = document.getElementById('uzStArcticDesc');
    if (stArcticD) stArcticD.textContent = t('style_arctic_desc');

    const stNolli = document.getElementById('uzStNolli');
    if (stNolli) stNolli.textContent = t('style_nolli');
    const stNolliD = document.getElementById('uzStNolliDesc');
    if (stNolliD) stNolliD.textContent = t('style_nolli_desc');

    const stBp = document.getElementById('uzStBlueprint');
    if (stBp) stBp.textContent = t('style_blueprint');
    const stBpD = document.getElementById('uzStBlueprintDesc');
    if (stBpD) stBpD.textContent = t('style_blueprint_desc');

    const stAn = document.getElementById('uzStAnalytic');
    if (stAn) stAn.textContent = t('style_analytic');
    const stAnD = document.getElementById('uzStAnalyticDesc');
    if (stAnD) stAnD.textContent = t('style_analytic_desc');

    const stTopo = document.getElementById('uzStTopo');
    if (stTopo) stTopo.textContent = t('style_topo');
    const stTopoD = document.getElementById('uzStTopoDesc');
    if (stTopoD) stTopoD.textContent = t('style_topo_desc');

    const stSig = document.getElementById('uzStSignal');
    if (stSig) stSig.textContent = t('style_signal');
    const stSigD = document.getElementById('uzStSignalDesc');
    if (stSigD) stSigD.textContent = t('style_signal_desc');

    // Update Titleblock
    const tbProj = document.getElementById('uzTbProj');
    if (tbProj) tbProj.textContent = t('tb_project');
    const tbStudio = document.getElementById('uzTbStudioLbl');
    if (tbStudio) tbStudio.textContent = t('tb_studio');
    const tbScale = document.getElementById('uzTbScaleLbl');
    if (tbScale) tbScale.textContent = t('tb_scale');
    const tbDate = document.getElementById('uzTbDateLbl');
    if (tbDate) tbDate.textContent = t('tb_date');
    const tbDatum = document.getElementById('uzTbDatumLbl');
    if (tbDatum) tbDatum.textContent = t('tb_datum');
  }

  function setupEventListeners() {
    // Brand Button -> Reset / Home
    const brandBtn = document.getElementById('uzBrandBtn');
    if (brandBtn) {
      brandBtn.addEventListener('click', () => {
        const btnHome = document.getElementById('btnHome');
        if (btnHome) btnHome.click();
      });
    }

    // Language Toggle Buttons
    const langBtn = document.getElementById('uzLangToggle');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        setLanguage(currentLang === 'en' ? 'es' : 'en');
      });
    }

    const drawerLangPill = document.getElementById('uzDrawerLangToggle');
    if (drawerLangPill) {
      drawerLangPill.addEventListener('click', (e) => {
        const target = e.target.closest('.uz-lang-opt');
        if (target && target.dataset.lang) {
          setLanguage(target.dataset.lang);
        }
      });
    }

    // Rail Navigation Items
    const navButtons = document.querySelectorAll('.uz-rail-btn[data-mode]');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        handleModeSwitch(mode);
      });
    });

    // Toggle Drawer Button
    const toggleBtn = document.getElementById('uzRailToggleDrawer');
    const closeBtn = document.getElementById('uzDrawerClose');
    [toggleBtn, closeBtn].forEach(el => {
      if (el) {
        el.addEventListener('click', () => {
          document.body.classList.toggle('drawer-collapsed');
        });
      }
    });

    // New Site
    const newSiteBtn = document.getElementById('uzRailNewSite');
    if (newSiteBtn) {
      newSiteBtn.addEventListener('click', () => {
        const nativeNew = document.getElementById('btnNew');
        if (nativeNew) nativeNew.click();
      });
    }

    // Search Input Sync
    const uzSearch = document.getElementById('uzSearchInput');
    const nativeSearch = document.getElementById('q');
    const searchForm = document.getElementById('searchForm');
    if (uzSearch && nativeSearch) {
      uzSearch.addEventListener('input', (e) => {
        nativeSearch.value = e.target.value;
        nativeSearch.dispatchEvent(new Event('input', { bubbles: true }));
      });
      uzSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          nativeSearch.value = uzSearch.value;
          if (searchForm) {
            searchForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }
        }
      });
    }

    // Segmented Tabs Switch
    const tabButtons = document.querySelectorAll('.uz-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tab = btn.dataset.tab;
        document.querySelectorAll('.uz-tab-pane').forEach(pane => pane.style.display = 'none');
        if (tab === 'layers') {
          const p = document.getElementById('uzPaneLayers');
          if (p) p.style.display = 'flex';
        } else if (tab === 'styles') {
          const p = document.getElementById('uzPaneStyles');
          if (p) p.style.display = 'block';
        } else if (tab === 'analysis') {
          const p = document.getElementById('uzPaneAnalysis');
          if (p) p.style.display = 'block';
        }
      });
    });

    // Site Frame Sliders Sync
    const uzRangeW = document.getElementById('uzRangeW');
    const uzRangeH = document.getElementById('uzRangeH');
    const nativeSW = document.getElementById('sW');
    const nativeSH = document.getElementById('sH');
    const uzValW = document.getElementById('uzValW');
    const uzValH = document.getElementById('uzValH');

    if (uzRangeW && nativeSW) {
      uzRangeW.addEventListener('input', (e) => {
        nativeSW.value = e.target.value;
        if (uzValW) uzValW.textContent = Number(e.target.value).toLocaleString() + ' m';
        nativeSW.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    if (uzRangeH && nativeSH) {
      uzRangeH.addEventListener('input', (e) => {
        nativeSH.value = e.target.value;
        if (uzValH) uzValH.textContent = Number(e.target.value).toLocaleString() + ' m';
        nativeSH.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }

    // Build Button Proxy
    const uzBuildBtn = document.getElementById('uzBtnBuildProxy');
    const nativeBuildBtn = document.getElementById('btnBuild');
    if (uzBuildBtn && nativeBuildBtn) {
      uzBuildBtn.addEventListener('click', () => {
        const txtBtnBuild = document.getElementById('uzTxtBtnBuild');
        if (txtBtnBuild) txtBtnBuild.textContent = t('btn_building');
        uzBuildBtn.style.opacity = '0.7';
        nativeBuildBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        try { nativeBuildBtn.click(); } catch (e) {}
      });
    }

    // Style Cards Click
    const styleCards = document.querySelectorAll('.uz-style-card');
    styleCards.forEach(card => {
      card.addEventListener('click', () => {
        styleCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        applyArchitecturalStyle(card.dataset.styleId);
      });
    });

    // Observer to update phase UI and metrics
    let lastArea = '', lastCoords = '', lastPhase = '';
    const observer = new MutationObserver(() => {
      const appEl = document.getElementById('app');
      const curPhase = appEl ? appEl.getAttribute('data-phase') : '';
      if (curPhase && curPhase !== lastPhase) {
        lastPhase = curPhase;
        updatePhaseUI();
      }

      const nativeArea = document.getElementById('valArea');
      const uzArea = document.getElementById('uzValArea');
      if (nativeArea && uzArea && nativeArea.textContent !== lastArea) {
        lastArea = nativeArea.textContent;
        uzArea.textContent = lastArea;
      }

      const coordsEl = document.getElementById('coords');
      const tbCoords = document.getElementById('uzTbCoords');
      if (coordsEl && tbCoords && coordsEl.textContent !== lastCoords) {
        lastCoords = coordsEl.textContent;
        tbCoords.textContent = lastCoords + ' · WGS84';
      }
    });

    const targetNode = document.getElementById('selectPanel') || document.body;
    observer.observe(targetNode, { childList: true, subtree: true, characterData: true });
    if (document.getElementById('app')) {
      observer.observe(document.getElementById('app'), { attributes: true, attributeFilter: ['data-phase'] });
    }

    // Fail-safe periodic sync for phase & metrics (every 250ms)
    setInterval(() => {
      const appEl = document.getElementById('app');
      const curPhase = appEl ? appEl.getAttribute('data-phase') : '';
      if (curPhase && curPhase !== lastPhase) {
        lastPhase = curPhase;
        updatePhaseUI();
      }

      const nativeArea = document.getElementById('valArea');
      const uzArea = document.getElementById('uzValArea');
      if (nativeArea && uzArea && nativeArea.textContent !== lastArea) {
        lastArea = nativeArea.textContent;
        uzArea.textContent = lastArea;
      }

      const coordsEl = document.getElementById('coords');
      const tbCoords = document.getElementById('uzTbCoords');
      if (coordsEl && tbCoords && coordsEl.textContent !== lastCoords) {
        lastCoords = coordsEl.textContent;
        tbCoords.textContent = lastCoords + ' · WGS84';
      }
    }, 250);
  }

  function handleModeSwitch(mode) {
    const sheet = document.getElementById('uzSheetOverlay');
    if (sheet) sheet.classList.remove('active');

    if (mode === '3d') {
      // Switch back to perspective 3D view
      const perspBtn = document.querySelector('[data-view="persp"]');
      if (perspBtn) perspBtn.click();
      const sectionCtl = document.getElementById('sectionCtl');
      if (sectionCtl) sectionCtl.hidden = true;
    } else if (mode === '2d') {
      // Orthographic 2D Cartography / Plan view natively on canvas
      const planBtn = document.querySelector('[data-view="plan"]');
      if (planBtn) planBtn.click();
    } else if (mode === 'section') {
      // Architectural Section Cut natively on canvas
      const secBtn = document.querySelector('[data-view="section"]');
      if (secBtn) secBtn.click();
      const sectionCtl = document.getElementById('sectionCtl');
      if (sectionCtl) sectionCtl.hidden = false;
    } else if (mode === 'simulation') {
      // Toggle Live Simulation (Water, Sun, Wind)
      const tLive = document.getElementById('tLive');
      if (tLive) tLive.click();
    } else if (mode === 'sheet') {
      // Toggle Sheet Presentation Overlay (Membrete)
      const planBtn = document.querySelector('[data-view="plan"]');
      if (planBtn) planBtn.click();
      if (sheet) sheet.classList.add('active');
    } else if (mode === 'export') {
      // Open Pro Export Dialog (SketchUp, GLB, CAD, Rhino)
      const btnExport = document.getElementById('btnExport');
      if (btnExport) btnExport.click();
    }
  }

  function applyArchitecturalStyle(styleId) {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    if (styleId === 'arctic') {
      const b = document.querySelector('#styleSeg button[data-style="arctic"]');
      if (b) b.click();
    } else if (styleId === 'nolli') {
      // Nolli Figure-Ground
      const b = document.querySelector('#styleSeg button[data-style="custom"]');
      if (b) b.click();
      appEl.dataset.style = 'nolli';
    } else if (styleId === 'blueprint') {
      // Blueprint Cyanotype
      const b = document.querySelector('#styleSeg button[data-style="custom"]');
      if (b) b.click();
      appEl.dataset.style = 'blueprint';
    } else if (styleId === 'analytic') {
      const b = document.querySelector('#styleSeg button[data-style="analytic"]');
      if (b) b.click();
    } else if (styleId === 'topo') {
      const b = document.querySelector('#styleSeg button[data-style="laser"]');
      if (b) b.click();
    } else if (styleId === 'signal') {
      const b = document.querySelector('#styleSeg button[data-style="signal"]');
      if (b) b.click();
    }
  }

  // Self-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUrbnzdUI);
  } else {
    initUrbnzdUI();
  }
})();
