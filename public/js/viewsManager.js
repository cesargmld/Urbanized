// Urbanized — Project Views & Studio Configurations Manager
// Permite guardar, restaurar y exportar vistas arquitectónicas, encuadres de cámara,
// estilos de capas, órdenes de superposición y análisis de factibilidad.

const STORAGE_KEY = 'urbanized_saved_views_v1';

class ViewsManager {
  constructor() {
    this.views = this.loadViews();
    this.listeners = new Set();
  }

  loadViews() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Error al leer vistas guardadas:', e);
      return [];
    }
  }

  saveToStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.views));
      this.notify();
    } catch (e) {
      console.error('Error al guardar vistas en localStorage:', e);
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) {
      try { fn(this.views); } catch (e) { console.error(e); }
    }
  }

  getViews() {
    return [...this.views];
  }

  getViewsForModel(modelId) {
    if (!modelId) return this.getViews();
    return this.views.filter((v) => !v.modelId || v.modelId === modelId);
  }

  saveCurrentView(name, state) {
    const view = {
      id: 'view_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: (name || 'Vista ' + (this.views.length + 1)).trim(),
      createdAt: new Date().toISOString(),
      modelId: state.modelId || null,
      mode: state.mode || 'result', // 'app', 'result', 'mapper', 'illustrator'
      // Cámara 3D (Three.js)
      camera3D: state.camera3D ? {
        position: state.camera3D.position,
        target: state.camera3D.target,
        zoom: state.camera3D.zoom || 1,
      } : null,
      // Axonometría / Illustrator
      illustrate: state.illustrate ? {
        angle: state.illustrate.angle,
        pitch: state.illustrate.pitch,
        zoom: state.illustrate.zoom,
        pan: state.illustrate.pan,
        style: state.illustrate.style,
        perspective: state.illustrate.perspective,
        exploded: state.illustrate.exploded,
        explodeOffset: state.illustrate.explodeOffset,
        explodedTiers: state.illustrate.explodedTiers,
      } : null,
      // Vector Map (2D)
      vectorMap: state.vectorMap ? {
        preset: state.vectorMap.preset,
        scale: state.vectorMap.scale,
        layerOrder: state.vectorMap.layerOrder,
        layerOpacities: state.vectorMap.layerOpacities,
        layers: state.vectorMap.layers,
        shadows: state.vectorMap.shadows,
        relief: state.vectorMap.relief,
        overlays: state.vectorMap.overlays,
        grain: state.vectorMap.grain,
      } : null,
      // Factibilidad / Feasibility
      feasibility: state.feasibility ? {
        cos: state.feasibility.cos,
        cus: state.feasibility.cus,
        levels: state.feasibility.levels,
        frontSetback: state.feasibility.frontSetback,
        sideSetback: state.feasibility.sideSetback,
        geometryMode: state.feasibility.geometryMode,
      } : null,
      // Acabados
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
      version: '2.0',
      exportedAt: new Date().toISOString(),
      views: this.views,
    }, null, 2);
  }

  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.views)) {
        // Mezclar sin duplicados de ID
        const existingIds = new Set(this.views.map((v) => v.id));
        for (const v of data.views) {
          if (!existingIds.has(v.id)) {
            this.views.push(v);
          }
        }
        this.saveToStorage();
        return { success: true, count: data.views.length };
      }
      throw new Error('Estructura de archivo de vistas no válida');
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

export const viewsManager = new ViewsManager();
if (typeof window !== 'undefined') {
  window.viewsManager = viewsManager;
}
