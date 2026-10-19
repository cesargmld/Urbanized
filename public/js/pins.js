// Urbanized — Pins & Marcadores Cartográficos
// Sistema unificado de pines para Mapa 2D, Estudio 3D y Axonometría.
// Soporta categorías, colores personalizados, etiquetas editables y exportación GeoJSON/SVG.

export const PIN_COLORS = [
  { id: 'orange', name: 'Naranja Hito', hex: '#f97316' }, // Color de referencia Imagen 3
  { id: 'red',    name: 'Rojo Alerta', hex: '#ef4444' },
  { id: 'cyan',   name: 'Cian Acceso', hex: '#06b6d4' },
  { id: 'white',  name: 'Blanco Puro', hex: '#ffffff' },
  { id: 'lime',   name: 'Lima Parque', hex: '#84cc16' },
  { id: 'violet', name: 'Violeta Nodo', hex: '#a855f7' },
  { id: 'yellow', name: 'Ámbar Cota', hex: '#eab308' },
  { id: 'emerald',name: 'Esmeralda',   hex: '#10b981' }
];

export const PIN_TYPES = {
  hito:     { label: 'Hito Urbano / POI', icon: 'flag', defaultColor: '#f97316' },
  acceso:   { label: 'Acceso / Vialidad',  icon: 'way',  defaultColor: '#06b6d4' },
  mirador:  { label: 'Mirador Panorámico',icon: 'eye',  defaultColor: '#eab308' },
  proyecto: { label: 'Área de Proyecto',  icon: 'rect', defaultColor: '#ef4444' },
  cota:     { label: 'Cota Topográfica',  icon: 'peak', defaultColor: '#ffffff' }
};

class PinStore {
  constructor() {
    this.pins = [];
    this.listeners = new Set();
    this.activeColor = '#f97316';
    this.activeType = 'hito';
    this.placingMode = false;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) {
      try { fn(this.pins); } catch (e) { console.error('PinStore error:', e); }
    }
  }

  getPins() {
    return [...this.pins];
  }

  addPin({ x, y, z = 0, lat, lon, color, type, label, comment, mentions }) {
    const id = 'pin_' + Math.random().toString(36).substr(2, 9);
    const chosenType = type || this.activeType;
    const chosenColor = color || this.activeColor || PIN_TYPES[chosenType]?.defaultColor || '#f97316';
    const count = this.pins.length + 1;
    const numLabel = count < 10 ? `P0${count}` : `P${count}`;
    const defaultLabel = label || numLabel;

    const newPin = {
      id,
      number: count,
      numLabel,
      x: Number(x) || 0,
      y: Number(y) || 0,
      z: Number(z) || 0,
      lat: Number(lat) || 0,
      lon: Number(lon) || 0,
      color: chosenColor,
      type: chosenType,
      label: defaultLabel,
      comment: comment || '',
      mentions: mentions || [],
      visible: true,
      createdAt: Date.now()
    };

    this.pins.push(newPin);
    this.notify();
    if (window.openPinCommentPopover) {
      window.openPinCommentPopover(newPin);
    }
    return newPin;
  }

  updatePin(id, patch) {
    const idx = this.pins.findIndex((p) => p.id === id);
    if (idx === -1) return;
    this.pins[idx] = { ...this.pins[idx], ...patch };
    this.notify();
  }

  removePin(id) {
    const idx = this.pins.findIndex((p) => p.id === id);
    if (idx === -1) return;
    this.pins.splice(idx, 1);
    this.notify();
  }

  clearPins() {
    this.pins = [];
    this.notify();
  }

  setPlacingMode(enabled, type = 'hito', color = '#f97316') {
    this.placingMode = Boolean(enabled);
    if (type) this.activeType = type;
    if (color) this.activeColor = color;
    document.body.classList.toggle('pin-placing-cursor', this.placingMode);
    this.notify();
  }

  isPlacing() {
    return this.placingMode;
  }

  toGeoJSON() {
    return {
      type: 'FeatureCollection',
      name: 'urbanized_pins',
      features: this.pins.map((p) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.lon, p.lat, p.z]
        },
        properties: {
          id: p.id,
          label: p.label,
          type: p.type,
          typeLabel: PIN_TYPES[p.type]?.label || p.type,
          color: p.color,
          localX: p.x,
          localY: p.y,
          elevationMeters: p.z
        }
      }))
    };
  }

  exportGeoJSONFile(filename = 'urbanized_pines.geojson') {
    const geo = this.toGeoJSON();
    const blob = new Blob([JSON.stringify(geo, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }
}

export const pinStore = new PinStore();
