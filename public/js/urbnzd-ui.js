/**
 * URBNZD Studio — Unified Architectural UI Controller
 * Integrates 3D Terrain DEM + 2D Cartography / Nolli + Section Cut + Titleblock
 */

(function () {
  'use strict';

  function initUrbnzdUI() {
    if (document.getElementById('uzRail')) return;

    // 1. Build Left Icon Rail (64px)
    const rail = document.createElement('nav');
    rail.id = 'uzRail';
    rail.setAttribute('aria-label', 'URBNZD Navigation');
    rail.innerHTML = `
      <div class="uz-rail-top">
        <button type="button" class="uz-rail-brand" id="uzBrandBtn" title="URBNZD Studio — Reiniciar Vista" aria-label="URBNZD Studio">
          <svg viewBox="0 0 40 40" width="30" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 4L34 12V28L20 36L6 28V12L20 4Z" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round"/>
            <path d="M20 4L20 20L34 28" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
            <path d="M20 20L6 28" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
            <circle cx="20" cy="20" r="3" fill="#ffffff"/>
          </svg>
        </button>
        <div class="uz-rail-nav">
          <button type="button" class="uz-rail-btn active" id="uzNav3D" data-mode="3d" data-tip="3D Studio (DEM 20×, OSM 3D, Árboles)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>
          </button>
          <button type="button" class="uz-rail-btn" id="uzNav2D" data-mode="2d" data-tip="Plano 2D / Nolli (Figura-Fondo, Blueprint)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          </button>
          <button type="button" class="uz-rail-btn" id="uzNavSection" data-mode="section" data-tip="Corte & Sección (Perfil Altimétrico)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
          </button>
          <button type="button" class="uz-rail-btn" id="uzNavLive" data-mode="simulation" data-tip="Simulación Viva (Agua 40a, Sol, Viento)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/><circle cx="12" cy="12" r="4"/></svg>
          </button>
          <button type="button" class="uz-rail-btn" id="uzNavSheet" data-mode="sheet" data-tip="Lámina de Entrega (Membrete y Escala)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>
          </button>
          <div class="uz-rail-sep"></div>
          <button type="button" class="uz-rail-btn" id="uzNavExport" data-mode="export" data-tip="Exportar Pro (SketchUp .skp, GLB, CAD, Rhino)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        </div>
      </div>
      <div class="uz-rail-bottom">
        <button type="button" class="uz-rail-btn" id="uzRailNewSite" data-tip="Nuevo Emplazamiento">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <button type="button" class="uz-rail-btn" id="uzRailToggleDrawer" data-tip="Colapsar / Expandir Panel">
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
          <span class="uz-drawer-badge">PRO · 20×</span>
        </div>
        <div class="uz-drawer-actions">
          <button type="button" class="uz-icon-btn" id="uzDrawerClose" title="Cerrar panel">✕</button>
        </div>
      </div>

      <!-- Integrated Search -->
      <div class="uz-search-box">
        <div class="uz-search-wrapper">
          <svg class="uz-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="uz-search-input" id="uzSearchInput" placeholder="Buscar dirección o coordenadas..." autocomplete="off">
        </div>
      </div>

      <!-- Segmented Tabs (Folders / Tags style) -->
      <div class="uz-tabs-track" role="tablist">
        <button type="button" class="uz-tab-btn active" data-tab="layers">Capas 3D</button>
        <button type="button" class="uz-tab-btn" data-tab="styles">Estilos</button>
        <button type="button" class="uz-tab-btn" data-tab="analysis">Análisis</button>
      </div>

      <!-- Scrollable Content -->
      <div class="uz-drawer-content">
        <!-- Tab 1: Capas 3D & Framing -->
        <div class="uz-tab-pane active" id="uzPaneLayers">
          <!-- Site Framing (visible only in select phase) -->
          <div class="uz-card-section" id="uzFrameControls">
            <div class="uz-slider-row">
              <div class="uz-slider-label"><span>Ancho del Lote</span><b id="uzValW">1,000 m</b></div>
              <input type="range" class="uz-range" id="uzRangeW" min="100" max="5000" step="50" value="1000">
            </div>
            <div class="uz-slider-row">
              <div class="uz-slider-label"><span>Largo del Lote</span><b id="uzValH">1,000 m</b></div>
              <input type="range" class="uz-range" id="uzRangeH" min="100" max="5000" step="50" value="1000">
            </div>
            <button type="button" class="uz-btn-build" id="uzBtnBuildProxy">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/></svg>
              <span>Construir Modelo 3D</span>
            </button>
          </div>

          <!-- Tree View Layers (Knowledge Base style) -->
          <div class="uz-tree-group" id="uzTreeLayers">
            <!-- Group 1: Terreno -->
            <div class="uz-tree-header">
              <div class="uz-tree-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M2 20h20L12 4z"/></svg>
                <span>Terreno & Relieve</span>
              </div>
              <span class="uz-count-badge">DEM 20×</span>
            </div>
            <div class="uz-tree-sub">
              <div class="uz-tree-item active" data-layer="dem">
                <div class="uz-tree-item-left">
                  <button type="button" class="uz-eye-toggle on">👁</button>
                  <span>Malla Copernicus 0.5m</span>
                </div>
                <span class="uz-count-badge">Activo</span>
              </div>
              <div class="uz-tree-item" data-layer="contours">
                <div class="uz-tree-item-left">
                  <button type="button" class="uz-eye-toggle on">👁</button>
                  <span>Curvas de Nivel CAD</span>
                </div>
                <span class="uz-count-badge">Cotas</span>
              </div>
            </div>

            <!-- Group 2: Arquitectura & OSM -->
            <div class="uz-tree-header" style="margin-top: 6px;">
              <div class="uz-tree-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/></svg>
                <span>Entorno Construido</span>
              </div>
              <span class="uz-count-badge" id="uzBuildingCount">1,248</span>
            </div>
            <div class="uz-tree-sub">
              <div class="uz-tree-item active" data-layer="buildings">
                <div class="uz-tree-item-left">
                  <button type="button" class="uz-eye-toggle on">👁</button>
                  <span>Edificios y Alturas</span>
                </div>
                <span class="uz-count-badge">3D</span>
              </div>
              <div class="uz-tree-item active" data-layer="roads">
                <div class="uz-tree-item-left">
                  <button type="button" class="uz-eye-toggle on">👁</button>
                  <span>Calles y Vialidades</span>
                </div>
                <span class="uz-count-badge">Vector</span>
              </div>
            </div>

            <!-- Group 3: Vegetación -->
            <div class="uz-tree-header" style="margin-top: 6px;">
              <div class="uz-tree-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 10v10M12 10a5 5 0 0 1-5-5 5 5 0 0 1 10 0 5 5 0 0 1-5 5z"/></svg>
                <span>Vegetación & Árboles</span>
              </div>
              <span class="uz-count-badge" id="uzTreeCount">3,850</span>
            </div>
            <div class="uz-tree-sub">
              <div class="uz-tree-item active" data-layer="trees">
                <div class="uz-tree-item-left">
                  <button type="button" class="uz-eye-toggle on">👁</button>
                  <span>Árboles Georreferenciados</span>
                </div>
                <span class="uz-count-badge">Mesh</span>
              </div>
            </div>

            <!-- Group 4: Hidrología -->
            <div class="uz-tree-header" style="margin-top: 6px;">
              <div class="uz-tree-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>
                <span>Red Hídrica</span>
              </div>
              <span class="uz-count-badge">JRC 40a</span>
            </div>
            <div class="uz-tree-sub">
              <div class="uz-tree-item active" data-layer="water">
                <div class="uz-tree-item-left">
                  <button type="button" class="uz-eye-toggle on">👁</button>
                  <span>Ríos, Lagos y Humedales</span>
                </div>
                <span class="uz-count-badge">Live</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: Estilos Arquitectónicos -->
        <div class="uz-tab-pane" id="uzPaneStyles" style="display:none;">
          <div class="uz-styles-grid">
            <div class="uz-style-card active" data-style-id="arctic">
              <span class="uz-style-icon">❄️</span>
              <span class="uz-style-name">Arctic Studio</span>
              <span class="uz-style-desc">Maqueta blanca nórdica mate y sombreado fino.</span>
            </div>
            <div class="uz-style-card" data-style-id="nolli">
              <span class="uz-style-icon">⬛</span>
              <span class="uz-style-name">Figura-Fondo Nolli</span>
              <span class="uz-style-desc">Cartografía histórica de llenos y vacíos urbanos.</span>
            </div>
            <div class="uz-style-card" data-style-id="blueprint">
              <span class="uz-style-icon">🔷</span>
              <span class="uz-style-name">Blueprint Cianotipo</span>
              <span class="uz-style-desc">Cianotipo arquitectónico con líneas blancas.</span>
            </div>
            <div class="uz-style-card" data-style-id="analytic">
              <span class="uz-style-icon">📊</span>
              <span class="uz-style-name">Analytic GIS</span>
              <span class="uz-style-desc">Zonificación de usos de suelo y alturas.</span>
            </div>
            <div class="uz-style-card" data-style-id="topo">
              <span class="uz-style-icon">📐</span>
              <span class="uz-style-name">Topográfico CAD</span>
              <span class="uz-style-desc">Curvas de nivel maestras y cotas de nivel.</span>
            </div>
            <div class="uz-style-card" data-style-id="signal">
              <span class="uz-style-icon">⚡</span>
              <span class="uz-style-name">Signal Dark</span>
              <span class="uz-style-desc">Obsidiana con resplandor en agua y vías.</span>
            </div>
          </div>
        </div>

        <!-- Tab 3: Análisis y Métricas -->
        <div class="uz-tab-pane" id="uzPaneAnalysis" style="display:none;">
          <div class="uz-card-section">
            <div class="uz-slider-row">
              <div class="uz-slider-label"><span>Superficie del Sitio</span><b id="uzMetricArea">100 ha</b></div>
            </div>
            <div class="uz-slider-row">
              <div class="uz-slider-label"><span>Desnivel Topográfico</span><b id="uzMetricRelief">27 m</b></div>
            </div>
            <div class="uz-slider-row">
              <div class="uz-slider-label"><span>Resolución Copernicus</span><b>0.5 m / 20×</b></div>
            </div>
            <div class="uz-slider-row">
              <div class="uz-slider-label"><span>Histórico de Agua</span><b>JRC 1984–2024</b></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // 3. Build Architectural Sheet Overlay (Membrete Lámina 2D)
    const sheetOverlay = document.createElement('div');
    sheetOverlay.id = 'uzSheetOverlay';
    sheetOverlay.innerHTML = `
      <div class="uz-titleblock">
        <div class="uz-tb-project" contenteditable="true" spellcheck="false">PROYECTO URBANO</div>
        <div class="uz-tb-site" id="uzTbCoords">48.1105° N, 11.5574° E · WGS84</div>
        <div class="uz-tb-grid">
          <div><span>ESTUDIO:</span> <b contenteditable="true">URBNZD / CGM</b></div>
          <div><span>ESCALA:</span> <b id="uzTbScale">1:1,000</b></div>
          <div><span>FECHA:</span> <b>${new Date().toLocaleDateString('es-ES')}</b></div>
          <div><span>DATUM:</span> <b>COPERNICUS DEM</b></div>
        </div>
      </div>
    `;

    // Append to document body
    document.body.appendChild(rail);
    document.body.appendChild(drawer);
    document.body.appendChild(sheetOverlay);

    // 4. Wire Events & Proxies
    setupEventListeners();
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
        uzBuildBtn.innerHTML = `<span>Construyendo Modelo DEM 20×...</span>`;
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

    // Observer to update metrics and UI state when phase changes
    let lastArea = '', lastCoords = '', lastPhase = '';
    const observer = new MutationObserver(() => {
      const appEl = document.getElementById('app');
      const curPhase = appEl ? appEl.getAttribute('data-phase') : '';
      if (curPhase && curPhase !== lastPhase) {
        lastPhase = curPhase;
        const frameCtrl = document.getElementById('uzFrameControls');
        if (frameCtrl) {
          if (curPhase === 'model') {
            frameCtrl.style.display = 'none';
          } else {
            frameCtrl.style.display = 'flex';
          }
        }
      }

      const nativeArea = document.getElementById('valArea');
      const uzArea = document.getElementById('uzMetricArea');
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
      // Orthographic 2D Cartography / Plan view
      const planBtn = document.querySelector('[data-view="plan"]');
      if (planBtn) planBtn.click();
    } else if (mode === 'section') {
      // Architectural Section Cut
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
      // Blueprint Cianotipo
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
