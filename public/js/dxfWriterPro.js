// Motor de Exportación CAD Profesional (DXF AC1015 / AutoCAD 2000+)
// Genera estrictamente LWPOLYLINE cerradas (flag 70 = 1) listas para HATCH y EXTRUDE en AutoCAD.
// Escala garantizada: 1 unidad = 1 metro ($INSUNITS = 6, $MEASUREMENT = 1).

const f = (v) => (Math.round(Number(v || 0) * 1000) / 1000).toString();

export const CAD_PRO_LAYERS = {
  TARGET_LOT: { name: '01_LOTE_OBJETIVO', aci: 1 },       // Color 1 - Rojo
  CONTEXT_BLDG: { name: '02_HUELLAS_ENTORNO', aci: 8 },  // Color 8 - Gris oscuro
  ROAD_AXES: { name: '03_VIALIDADES_EJES', aci: 7 },     // Color 7 - Blanco/Negro
  CONTOURS: { name: '04_CURVAS_NIVEL', aci: 9 },         // Color 9 - Gris claro
};

/**
 * Clase compatible con la API de dxf-writer optimizada para WebGIS / AutoCAD profesional.
 */
export class DxfWriterPro {
  constructor() {
    this.layers = new Map();
    this.entities = [];
    this.activeLayer = '0';
    this.handleSeed = 100;
    this.extMin = [Infinity, Infinity, 0];
    this.extMax = [-Infinity, -Infinity, 100];

    // Registrar capas estándar por defecto
    Object.values(CAD_PRO_LAYERS).forEach((l) => {
      this.addLayer(l.name, l.aci, 'CONTINUOUS');
    });
  }

  nextHandle() {
    return (this.handleSeed++).toString(16).toUpperCase();
  }

  addLayer(name, aciColor = 7, lineType = 'CONTINUOUS') {
    this.layers.set(name, { name, aci: aciColor, ltype: lineType });
    return this;
  }

  setActiveLayer(name) {
    if (!this.layers.has(name)) {
      this.addLayer(name, 7, 'CONTINUOUS');
    }
    this.activeLayer = name;
    return this;
  }

  expandBounds(x, y, z = 0) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < this.extMin[0]) this.extMin[0] = x;
    if (y < this.extMin[1]) this.extMin[1] = y;
    if (z < this.extMin[2]) this.extMin[2] = z;
    if (x > this.extMax[0]) this.extMax[0] = x;
    if (y > this.extMax[1]) this.extMax[1] = y;
    if (z > this.extMax[2]) this.extMax[2] = z;
  }

  /**
   * Limpia vértices consecutivos duplicados y elimina el último punto si repite el primero,
   * ya que en LWPOLYLINE el cierre geométrico exacto se define mediante el código 70 = 1.
   */
  sanitizeRing(pts, closed = true) {
    const clean = [];
    const eps = 1e-4;
    for (const p of pts || []) {
      const x = Number(p[0]);
      const y = Number(p[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (clean.length > 0) {
        const prev = clean[clean.length - 1];
        if (Math.hypot(x - prev[0], y - prev[1]) < eps) continue;
      }
      clean.push([x, y, Number(p[2] || 0)]);
    }
    if (closed && clean.length > 2) {
      const first = clean[0];
      const last = clean[clean.length - 1];
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) < eps) {
        clean.pop();
      }
    }
    return clean;
  }

  /**
   * Agrega una entidad LWPOLYLINE (cerrada con flag 70=1 o abierta con flag 70=0).
   * Permite aplicar HATCH o EXTRUDE directamente en AutoCAD sin usar PEDIT/JOIN.
   */
  addLWPolyline(pts, { layer = this.activeLayer, closed = true, elevation = 0, thickness = 0 } = {}) {
    const vertices = this.sanitizeRing(pts, closed);
    const minVerts = closed ? 3 : 2;
    if (vertices.length < minVerts) return this;

    const e = [];
    const w = (code, val) => e.push(code, val);

    w(0, 'LWPOLYLINE');
    w(5, this.nextHandle());
    w(100, 'AcDbEntity');
    w(8, layer);
    w(100, 'AcDbPolyline');
    w(90, vertices.length);
    w(70, closed ? 1 : 0); // 1 = Estrictamente cerrada en AutoCAD
    w(43, '0');            // Constant width = 0

    if (Number.isFinite(elevation) && Math.abs(elevation) > 1e-4) {
      w(38, f(elevation));
    }
    if (Number.isFinite(thickness) && Math.abs(thickness) > 1e-4) {
      w(39, f(thickness));
    }

    for (const [x, y, z] of vertices) {
      this.expandBounds(x, y, elevation || z || 0);
      w(10, f(x));
      w(20, f(y));
    }

    this.entities.push(...e);
    return this;
  }

  toDxfString() {
    const o = [];
    const w = (code, val) => o.push(code, val);

    const minX = Number.isFinite(this.extMin[0]) ? this.extMin[0] : -500;
    const minY = Number.isFinite(this.extMin[1]) ? this.extMin[1] : -500;
    const minZ = Number.isFinite(this.extMin[2]) ? this.extMin[2] : 0;
    const maxX = Number.isFinite(this.extMax[0]) ? this.extMax[0] : 500;
    const maxY = Number.isFinite(this.extMax[1]) ? this.extMax[1] : 500;
    const maxZ = Number.isFinite(this.extMax[2]) ? this.extMax[2] : 100;

    // 1. HEADER SECTION (AC1015 / AutoCAD 2000+ con soporte nativo LWPOLYLINE y escala 1u = 1m)
    w(0, 'SECTION');
    w(2, 'HEADER');
    w(9, '$ACADVER'); w(1, 'AC1015');
    w(9, '$INSBASE'); w(10, '0.0'); w(20, '0.0'); w(30, '0.0');
    w(9, '$EXTMIN'); w(10, f(minX)); w(20, f(minY)); w(30, f(minZ));
    w(9, '$EXTMAX'); w(10, f(maxX)); w(20, f(maxY)); w(30, f(maxZ));
    w(9, '$MEASUREMENT'); w(70, 1); // 1 = Sistema Métrico
    w(9, '$INSUNITS'); w(70, 6);    // 6 = Metros (1 unidad = 1 metro)
    w(0, 'ENDSEC');

    // 2. TABLES SECTION
    w(0, 'SECTION');
    w(2, 'TABLES');

    // LTYPE Table
    w(0, 'TABLE');
    w(2, 'LTYPE');
    w(5, this.nextHandle());
    w(100, 'AcDbSymbolTable');
    w(70, 1);
    w(0, 'LTYPE');
    w(5, this.nextHandle());
    w(100, 'AcDbSymbolTableRecord');
    w(100, 'AcDbLinetypeTableRecord');
    w(2, 'CONTINUOUS');
    w(70, 0);
    w(3, 'Solid line');
    w(72, 65);
    w(73, 0);
    w(40, '0.0');
    w(0, 'ENDTAB');

    // LAYER Table
    w(0, 'TABLE');
    w(2, 'LAYER');
    w(5, this.nextHandle());
    w(100, 'AcDbSymbolTable');
    w(70, this.layers.size + 1);

    // Default Layer 0
    w(0, 'LAYER');
    w(5, this.nextHandle());
    w(100, 'AcDbSymbolTableRecord');
    w(100, 'AcDbLayerTableRecord');
    w(2, '0');
    w(70, 0);
    w(62, 7);
    w(6, 'CONTINUOUS');

    for (const l of this.layers.values()) {
      w(0, 'LAYER');
      w(5, this.nextHandle());
      w(100, 'AcDbSymbolTableRecord');
      w(100, 'AcDbLayerTableRecord');
      w(2, l.name);
      w(70, 0);
      w(62, l.aci);
      w(6, l.ltype);
    }
    w(0, 'ENDTAB');
    w(0, 'ENDSEC');

    // 3. ENTITIES SECTION
    w(0, 'SECTION');
    w(2, 'ENTITIES');
    for (let i = 0; i < this.entities.length; i++) {
      o.push(this.entities[i]);
    }
    w(0, 'ENDSEC');
    w(0, 'EOF');

    let out = '';
    for (let i = 0; i < o.length; i += 2) {
      out += `${String(o[i]).padStart(3, ' ')}\r\n${o[i + 1]}\r\n`;
    }
    return out;
  }
}

/**
 * Genera el archivo DXF profesional con polilíneas cerradas (LWPOLYLINE) y capas estandarizadas.
 * @param {Object} model Modelo urbano en coordenadas métricas locales (1 unidad = 1 metro)
 * @returns {Blob} Blob application/dxf
 */
export function buildProfessionalDXF(model) {
  const dxf = new DxfWriterPro();
  const half = model.frame?.half ?? ((model.size || 1000) / 2);

  // 1. CAPA '01_LOTE_OBJETIVO' (Color 1 - Rojo): Polígono cerrado de predio o área objetivo
  dxf.setActiveLayer(CAD_PRO_LAYERS.TARGET_LOT.name);
  if (Array.isArray(model.site) && model.site.length >= 3) {
    const baseZ = model.site[0]?.[2] ?? 0;
    dxf.addLWPolyline(model.site, {
      layer: CAD_PRO_LAYERS.TARGET_LOT.name,
      closed: true,
      elevation: baseZ,
    });
  } else {
    // Si no se trazó polígono manual, exporta el polígono del área seleccionada como LWPOLYLINE cerrada
    const boundaryRing = model.shape === 'circle'
      ? Array.from({ length: 64 }, (_, i) => {
          const a = (i / 64) * Math.PI * 2;
          return [Math.cos(a) * half, Math.sin(a) * half, 0];
        })
      : [
          [-half, -half, 0],
          [half, -half, 0],
          [half, half, 0],
          [-half, half, 0],
        ];
    dxf.addLWPolyline(boundaryRing, {
      layer: CAD_PRO_LAYERS.TARGET_LOT.name,
      closed: true,
      elevation: 0,
    });
  }

  // Si existe envolvente de factibilidad (desplante por remetimientos), incluirla en 01_LOTE_OBJETIVO
  if (Array.isArray(model.feasibilityFootprint) && model.feasibilityFootprint.length >= 3) {
    dxf.addLWPolyline(model.feasibilityFootprint, {
      layer: CAD_PRO_LAYERS.TARGET_LOT.name,
      closed: true,
      elevation: model.feasibilityElevation || 0,
      thickness: model.feasibilityHeight || 0,
    });
  }

  // 2. CAPA '02_HUELLAS_ENTORNO' (Color 8 - Gris oscuro): Huellas de edificios estrictamente cerradas
  dxf.setActiveLayer(CAD_PRO_LAYERS.CONTEXT_BLDG.name);
  for (const b of model.buildings || []) {
    const rings = b.rings || [];
    const baseZ = b.verts?.[0]?.[2] ?? 0;
    const height = Number(b.height) || 0;
    for (const ring of rings) {
      if (ring && ring.length >= 3) {
        dxf.addLWPolyline(ring, {
          layer: CAD_PRO_LAYERS.CONTEXT_BLDG.name,
          closed: true,
          elevation: baseZ,
          thickness: height,
        });
      }
    }
  }

  // 3. CAPA '03_VIALIDADES_EJES' (Color 7 - Blanco/Negro): Ejes viales y ferroviarios en metros
  dxf.setActiveLayer(CAD_PRO_LAYERS.ROAD_AXES.name);
  const roadLayerKeys = ['ROADS_MAJOR', 'ROADS_MINOR', 'PATHS', 'RAILWAYS'];
  for (const key of roadLayerKeys) {
    const lines = model.lines?.[key] || [];
    for (const pts of lines) {
      const coords = Array.isArray(pts) ? pts : (pts?.pts || []);
      if (coords.length >= 2) {
        dxf.addLWPolyline(coords, {
          layer: CAD_PRO_LAYERS.ROAD_AXES.name,
          closed: false,
          elevation: coords[0]?.[2] ?? 0,
        });
      }
    }
  }

  // 4. CAPA '04_CURVAS_NIVEL' (Color 9 - Gris claro): Curvas de nivel con elevación real
  if (Array.isArray(model.contours) && model.contours.length > 0) {
    dxf.setActiveLayer(CAD_PRO_LAYERS.CONTOURS.name);
    const minH = model.grid?.minH ?? 0;
    for (const c of model.contours) {
      const pts = c.pts || [];
      if (pts.length >= 2) {
        const elev = Number.isFinite(c.z) ? c.z + minH : (pts[0]?.[2] ?? 0);
        dxf.addLWPolyline(pts, {
          layer: CAD_PRO_LAYERS.CONTOURS.name,
          closed: Boolean(c.closed),
          elevation: elev,
        });
      }
    }
  }

  return new Blob([dxf.toDxfString()], { type: 'application/dxf' });
}
