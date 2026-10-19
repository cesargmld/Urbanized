// Urbanized — Project (.urbnz), Scenes & Workspace Manager
// Permite guardar, restaurar y exportar escenas estilo SketchUp/Rayon,
// así como empaquetar y cargar proyectos completos en formato nativo .urbnz.

const VIEWS_STORAGE_KEY = 'urbanized_saved_views_v1';
const RECENT_PROJECTS_KEY = 'urbanized_recent_projects_v1';

// Plantillas urbanas de referencia arquitectónica y paisaje
export const URBAN_TEMPLATES = [
  {
    id: 'tpl_mty_centro',
    title: 'Monterrey · Centro & Río Santa Catarina',
    city: 'Monterrey, MX',
    lat: 25.6690,
    lon: -100.3120,
    size: 1200,
    shape: 'square',
    tag: 'Paisaje Fluvial & Topografía',
    desc: 'Corredor hidrológico del Río Santa Catarina, Alameda y Macroplaza.',
  },
  {
    id: 'tpl_nyc_highline',
    title: 'Nueva York · High Line & Hudson River Park',
    city: 'New York, US',
    lat: 40.7480,
    lon: -74.0048,
    size: 1000,
    shape: 'square',
    tag: 'Parque Lineal & Frente Fluvial',
    desc: 'Masterclass de arquitectura de paisaje: infraestructura reconvertida frente al río.',
  },
  {
    id: 'tpl_paris_villette',
    title: 'París · Parc de la Villette & Canal de l\'Ourcq',
    city: 'París, FR',
    lat: 48.8938,
    lon: 2.3902,
    size: 1000,
    shape: 'square',
    tag: 'Deconstrucción & Paisaje',
    desc: 'Retícula de Folies de Bernard Tschumi, corredores cinemáticos y canal.',
  },
];

class ViewsManager {
  constructor() {
    this.views = this.loadViews();
    this.recentProjects = this.loadRecentProjects();
    this.listeners = new Set();
  }

  loadViews() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const data = localStorage.getItem(VIEWS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Error al leer escenas guardadas:', e);
      return [];
    }
  }

  saveToStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(this.views));
      this.notify();
    } catch (e) {
      console.error('Error al guardar escenas en localStorage:', e);
    }
  }

  loadRecentProjects() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const data = localStorage.getItem(RECENT_PROJECTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveRecentProjects() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(this.recentProjects.slice(0, 12)));
      this.notify();
    } catch (e) {
      console.warn('Error al guardar proyectos recientes:', e);
    }
  }

  registerRecentProject(model, placeLabel = '') {
    if (!model || !model.center) return;
    const entry = {
      id: model.id || `proj_${Date.now()}`,
      name: placeLabel || `Modelo ${model.center.lat.toFixed(3)}, ${model.center.lon.toFixed(3)}`,
      lat: model.center.lat,
      lon: model.center.lon,
      size: model.size || 1000,
      shape: model.shape || 'square',
      buildings: model.buildings?.length || model.stats?.buildings || 0,
      relief: Math.round(model.grid?.maxH || model.stats?.relief || 0),
      roadsKm: Number(model.stats?.roadsKm || 0).toFixed(1),
      updatedAt: new Date().toISOString(),
    };
    this.recentProjects = [
      entry,
      ...this.recentProjects.filter((p) => p.id !== entry.id && !(Math.abs(p.lat - entry.lat) < 0.0005 && Math.abs(p.lon - entry.lon) < 0.0005))
    ].slice(0, 12);
    this.saveRecentProjects();
    return entry;
  }

  addRecentProject(model, placeLabel = '') {
    return this.registerRecentProject(model, placeLabel);
  }

  removeRecentProject(id) {
    this.recentProjects = this.recentProjects.filter((p) => p.id !== id);
    this.saveRecentProjects();
  }

  getRecentProjects() {
    return [...this.recentProjects];
  }

  getTemplates() {
    const accents = ['#38bdf8', '#f97316', '#a855f7', '#10b981'];
    return URBAN_TEMPLATES.map((t, i) => ({
      ...t,
      name: t.title,
      subtitle: t.city,
      accent: accents[i % accents.length]
    }));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) {
      try { fn(this.views, this.recentProjects); } catch (e) { console.error(e); }
    }
  }

  getViews() {
    return [...this.views];
  }

  getViewsForModel(modelId) {
    if (!modelId) return this.getViews();
    return this.views.filter((v) => !v.modelId || v.modelId === modelId);
  }

  saveCurrentScene(name) {
    let thumbnail = null;
    let renderMode = 'model';
    let canvasBg = '#090A0D';
    let sectionCut = false;

    if (typeof window !== 'undefined') {
      const canvas = document.querySelector('#viewer canvas, #map-canvas, #illu-canvas');
      if (canvas) {
        try {
          thumbnail = canvas.toDataURL('image/jpeg', 0.65);
        } catch (e) {
          console.warn('Could not capture scene thumbnail:', e);
        }
      }
      if (window.isMaquetaModeActive?.()) renderMode = 'maqueta';
      if (window.getActiveCanvasBg?.()) canvasBg = window.getActiveCanvasBg();
      if (window.isSectionCutActive?.()) sectionCut = window.isSectionCutActive();
    }

    return this.saveCurrentView(name, {
      mode: (typeof window !== 'undefined' && window.currentWorkspaceMode) || 'result',
      modelId: (typeof window !== 'undefined' && window.getActiveModelData?.()?.id) || null,
      camera3D: (typeof window !== 'undefined' && window.getCamera3DState?.()) || null,
      renderMode,
      canvasBg,
      sectionCut,
      thumbnail,
      vectorMap: (typeof window !== 'undefined' && window.getVectorMapState?.()) || null,
      illustrate: (typeof window !== 'undefined' && window.getIllustrateState?.()) || null,
      feasibility: (typeof window !== 'undefined' && window.getFeasibilityState?.()) || null,
    });
  }

  saveCurrentView(name, state = {}) {
    const view = {
      id: 'scene_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: (name || 'Escena ' + (this.views.length + 1)).trim(),
      createdAt: new Date().toISOString(),
      modelId: state.modelId || null,
      mode: state.mode || 'result', // 'result', 'mapper', 'illustrator'
      camera3D: state.camera3D ? structuredClone(state.camera3D) : null,
      renderMode: state.renderMode || 'model',
      canvasBg: state.canvasBg || '#090A0D',
      sectionCut: Boolean(state.sectionCut),
      thumbnail: state.thumbnail || null,
      illustrate: state.illustrate ? structuredClone(state.illustrate) : null,
      vectorMap: state.vectorMap ? structuredClone(state.vectorMap) : null,
      feasibility: state.feasibility ? structuredClone(state.feasibility) : null,
      pins: state.pins ? structuredClone(state.pins) : null,
      finish: state.finish || null,
    };

    this.views.unshift(view);
    this.saveToStorage();
    return view;
  }

  deleteView(id) {
    this.views = this.views.filter((v) => v.id !== id);
    this.saveToStorage();
  }

  renameView(id, newName) {
    const v = this.views.find((item) => item.id === id);
    if (v && newName?.trim()) {
      v.name = newName.trim();
      this.saveToStorage();
    }
  }

  exportJSON() {
    return JSON.stringify({
      app: 'Urbanized Architectural Studio',
      format: 'urbnz-scenes',
      version: '2.5',
      exportedAt: new Date().toISOString(),
      views: this.views,
    }, null, 2);
  }

  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.views)) {
        const existingIds = new Set(this.views.map((v) => v.id));
        for (const v of data.views) {
          if (!existingIds.has(v.id)) {
            this.views.push(v);
          }
        }
        this.saveToStorage();
        return { success: true, count: data.views.length };
      }
      throw new Error('Estructura de archivo no válida');
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Empaqueta todo el proyecto activo en un archivo nativo .urbnz
   */
  serializeUrbnzProject({ model, projectName, pins, feasibility, vectorMap, illustrate, camera3D }) {
    if (!model) throw new Error('No hay un modelo activo para guardar.');

    // Serializar grid convirtiendo Float32Array a array numérico compacto
    const serializedGrid = model.grid ? {
      n: model.grid.n,
      step: model.grid.step,
      w: model.grid.w,
      half: model.grid.half,
      maxH: model.grid.maxH,
      minH: model.grid.minH || 0,
      offset: model.grid.offset || 0,
      source: model.grid.source || null,
      res: model.grid.res || null,
      heights: model.grid.heights ? Array.from(model.grid.heights) : [],
    } : null;

    // Guardar ortomosaico satelital como JPEG dataURL si existe
    let imageryDataUrl = null;
    if (model.imagery?.canvas) {
      try {
        imageryDataUrl = model.imagery.canvas.toDataURL('image/jpeg', 0.82);
      } catch (e) {
        imageryDataUrl = null;
      }
    }

    const serializedModel = {
      id: model.id,
      center: model.center,
      size: model.size,
      shape: model.shape,
      contourInterval: model.contourInterval,
      extraBuildings: model.extraBuildings,
      dataSource: model.dataSource,
      warnings: model.warnings || [],
      stats: model.stats,
      ecosystem: model.ecosystem || null,
      site: model.site || null,
      buildings: model.buildings || [],
      lines: model.lines || {},
      areas: model.areas || {},
      roadAreas: model.roadAreas || [],
      roadMeshes: model.roadMeshes || [],
      bridges: model.bridges || [],
      water: model.water || [],
      contours: model.contours || [],
      trees: model.trees || [],
      terrain: model.terrain || null,
      grid: serializedGrid,
      imageryDataUrl,
    };

    const payload = {
      app: 'Urbanized Architectural Studio · CGM Atelier',
      format: 'urbnz',
      version: '2.5',
      savedAt: new Date().toISOString(),
      projectName: projectName || `Proyecto_${model.center.lat.toFixed(4)}_${model.center.lon.toFixed(4)}`,
      model: serializedModel,
      pins: pins || [],
      feasibility: feasibility || null,
      vectorMap: vectorMap || null,
      illustrate: illustrate || null,
      camera3D: camera3D || null,
      views: this.views,
    };

    return JSON.stringify(payload);
  }

  /**
   * Rehidrata un archivo .urbnz cargado desde la computadora del usuario
   */
  async deserializeUrbnzProject(jsonString, makeFrameFn) {
    const data = JSON.parse(jsonString);
    if (!data || (!data.model && !Array.isArray(data.views))) {
      throw new Error('El archivo seleccionado no es un proyecto .urbnz válido.');
    }

    // Si también contiene vistas/escenas, importarlas
    if (Array.isArray(data.views) && data.views.length) {
      const existingIds = new Set(this.views.map((v) => v.id));
      for (const v of data.views) {
        if (!existingIds.has(v.id)) {
          this.views.push(v);
        }
      }
      this.saveToStorage();
    }

    if (!data.model) {
      return { success: true, isFullProject: false, viewsOnly: true, count: data.views?.length || 0 };
    }

    const m = data.model;
    // Reconstruir frame con funciones geométricas
    if (makeFrameFn && m.center) {
      m.frame = makeFrameFn(m.center.lat, m.center.lon, m.size || 1000, m.shape || 'square');
    }

    // Reconstruir Float32Array y función heightAt(x, y) en m.grid
    if (m.grid) {
      const h = new Float32Array(m.grid.heights || []);
      const n = m.grid.n;
      const w = m.grid.w;
      const step = m.grid.step;
      const half = m.grid.half || (m.size || 1000) / 2;
      m.grid.heights = h;
      m.grid.heightAt = (x, y) => {
        if (!h.length) return 0;
        const fx = Math.min(n, Math.max(0, (x + half) / step));
        const fy = Math.min(n, Math.max(0, (y + half) / step));
        const i = Math.min(n - 1, Math.floor(fx));
        const j = Math.min(n - 1, Math.floor(fy));
        const dx = fx - i, dy = fy - j;
        const a = h[j * w + i] || 0;
        const b = h[j * w + i + 1] || 0;
        const c = h[(j + 1) * w + i] || 0;
        const d = h[(j + 1) * w + i + 1] || 0;
        return (a * (1 - dx) + b * dx) * (1 - dy) + (c * (1 - dx) + d * dx) * dy;
      };
    }

    // Reconstruir canvas de imagen satelital si venía incluido
    if (m.imageryDataUrl) {
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const cv = document.createElement('canvas');
          cv.width = img.naturalWidth || 1024;
          cv.height = img.naturalHeight || 1024;
          cv.getContext('2d').drawImage(img, 0, 0);
          m.imagery = { canvas: cv };
          resolve();
        };
        img.onerror = () => resolve();
        img.src = m.imageryDataUrl;
      });
    }

    this.registerRecentProject(m, data.projectName);

    return {
      success: true,
      isFullProject: true,
      viewsOnly: false,
      projectName: data.projectName,
      model: m,
      pins: data.pins || [],
      feasibility: data.feasibility || null,
      vectorMap: data.vectorMap || null,
      illustrate: data.illustrate || null,
      camera3D: data.camera3D || null,
    };
  }
}

export const viewsManager = new ViewsManager();
if (typeof window !== 'undefined') {
  window.viewsManager = viewsManager;
}
