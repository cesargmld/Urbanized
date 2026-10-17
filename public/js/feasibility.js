// Módulo Paramétrico de Factibilidad Urbana (Estilo Finch 3D / Autodesk Forma)
// Utiliza Turf.js para buffers negativos de remetimientos, cálculo de COS, CUS y envolvente 3D.
import * as turf from 'https://cdn.jsdelivr.net/npm/@turf/turf@7.1.0/+esm';

export const LEVEL_HEIGHT_M = 3.5; // Altura estándar de entrepiso (m)

class FeasibilityStore {
  constructor() {
    this.params = {
      enabled: false,
      cos: 70,              // % de ocupación de suelo permitido (ej. 70%)
      cus: 2.4,             // Coeficiente de utilización de suelo (ej. 2.4)
      max_levels: 4,        // Niveles máximos permitidos (ej. 4 niveles)
      front_setback_m: 3.0, // Remetimiento frontal (metros)
      side_setback_m: 1.5,  // Remetimiento perimetral/lateral (metros)
    };
    this.siteOrigin = { x: 0, y: 0, z: 0 };
    this.siteRotation = 0;       // 0 to 360 deg
    this.lotWidth = 35;          // metros
    this.lotLength = 45;         // metros
    this.isPlacingLot = false;
    this.geometryMode = 'envelope'; // 'envelope' | 'massing' | 'project'
    this.customSnappedRing = null;
    this.projectModel = null;
    this.projectScale = 1.0;
    this.projectRotY = 0;
    this.projectOffsetZ = 0;
    this.metrics = {
      lotAreaM2: 0,
      footprintAreaM2: 0,
      maxBuildableM2: 0,
      effectiveLevels: 4,
      maxHeightM: 14,
      lotRingLocal: [],
      footprintRingLocal: [],
    };
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) {
      try { fn(this.params, this.metrics); } catch (e) { console.error(e); }
    }
  }

  setParams(partial) {
    if (!partial) return;
    if (partial.enabled !== undefined) this.params.enabled = Boolean(partial.enabled);
    if (Number.isFinite(Number(partial.cos))) this.params.cos = Math.max(5, Math.min(100, Number(partial.cos)));
    if (Number.isFinite(Number(partial.cus))) this.params.cus = Math.max(0.1, Math.min(30, Number(partial.cus)));
    if (Number.isFinite(Number(partial.max_levels))) this.params.max_levels = Math.max(1, Math.min(80, Math.round(Number(partial.max_levels))));
    if (Number.isFinite(Number(partial.front_setback_m))) this.params.front_setback_m = Math.max(0, Math.min(50, Number(partial.front_setback_m)));
    if (Number.isFinite(Number(partial.side_setback_m))) this.params.side_setback_m = Math.max(0, Math.min(50, Number(partial.side_setback_m)));
    this.notify();
  }

  setSiteOrigin(x, y, z) {
    this.siteOrigin = { x: Number(x) || 0, y: Number(y) || 0, z: Number(z) || 0 };
    this.customSnappedRing = null;
    this.notify();
  }

  setSiteRotation(deg) {
    this.siteRotation = Number(deg) || 0;
    this.notify();
  }

  setLotDimensions(w, l) {
    if (w) this.lotWidth = Math.max(5, Math.min(500, Number(w)));
    if (l) this.lotLength = Math.max(5, Math.min(500, Number(l)));
    this.customSnappedRing = null;
    this.notify();
  }

  setGeometryMode(mode) {
    if (['envelope', 'massing', 'project'].includes(mode)) {
      this.geometryMode = mode;
      this.notify();
    }
  }

  setPlacingMode(bool) {
    this.isPlacingLot = Boolean(bool);
    this.notify();
  }

  setProjectAdjustments({ scale, rotY, offsetZ } = {}) {
    if (scale !== undefined) this.projectScale = Number(scale);
    if (rotY !== undefined) this.projectRotY = Number(rotY);
    if (offsetZ !== undefined) this.projectOffsetZ = Number(offsetZ);
    this.notify();
  }

  setProjectModel(obj, filename) {
    this.projectModel = { object: obj, filename };
    this.geometryMode = 'project';
    this.notify();
  }

  snapToNearestBuilding(model, targetX = this.siteOrigin.x, targetY = this.siteOrigin.y) {
    if (!model?.buildings || model.buildings.length === 0) return null;
    let closestB = null;
    let minDistSq = Infinity;
    for (const b of model.buildings) {
      const ring = b.rings?.[0];
      if (!ring || ring.length < 3) continue;
      let cx = 0, cy = 0;
      for (const [bx, by] of ring) { cx += bx; cy += by; }
      cx /= ring.length;
      cy /= ring.length;
      const distSq = (cx - targetX) ** 2 + (cy - targetY) ** 2;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closestB = b;
      }
    }
    if (closestB && closestB.rings?.[0]) {
      const ring = closestB.rings[0];
      let cx = 0, cy = 0;
      for (const [bx, by] of ring) { cx += bx; cy += by; }
      cx /= ring.length;
      cy /= ring.length;
      this.siteOrigin = { x: cx, y: cy, z: model?.grid?.heightAt ? model.grid.heightAt(cx, cy) : 0 };
      this.customSnappedRing = ring.map(([bx, by]) => [bx, by, model?.grid?.heightAt ? model.grid.heightAt(bx, by) : 0]);
      this.notify();
      return closestB;
    }
    return null;
  }

  /**
   * Convierte coordenadas locales en metros [x, y] a [lon, lat] WGS84 para Turf.js
   */
  localToLngLat(x, y, centerLat = 19.4326, centerLon = -99.1332) {
    const phi = (centerLat * Math.PI) / 180;
    const mLat = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
    const mLon = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
    return [centerLon + x / mLon, centerLat + y / mLat];
  }

  /**
   * Convierte [lon, lat] WGS84 de vuelta a coordenadas métricas locales [x, y]
   */
  lngLatToLocal(lon, lat, centerLat = 19.4326, centerLon = -99.1332) {
    const phi = (centerLat * Math.PI) / 180;
    const mLat = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
    const mLon = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
    return [(lon - centerLon) * mLon, (lat - centerLat) * mLat];
  }

  /**
   * Obtiene el polígono del lote en metros locales [x, y, z].
   */
  resolveTargetLotRing(model) {
    if (this.customSnappedRing && this.customSnappedRing.length >= 3) {
      return this.customSnappedRing.map(([x, y]) => {
        const z = model?.grid?.heightAt ? model.grid.heightAt(x, y) : 0;
        return [x, y, z];
      });
    }
    if (model?.site && model.site.length >= 3) {
      return model.site.map((p) => [Number(p[0]), Number(p[1]), Number(p[2] || 0)]);
    }

    const { x: ox, y: oy } = this.siteOrigin;
    const rad = (this.siteRotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const hw = this.lotWidth / 2;
    const hl = this.lotLength / 2;

    const corners = [
      [-hw, -hl],
      [hw, -hl],
      [hw, hl],
      [-hw, hl],
    ];

    return corners.map(([lx, ly]) => {
      const rx = ox + lx * cos - ly * sin;
      const ry = oy + lx * sin + ly * cos;
      const rz = model?.grid?.heightAt ? model.grid.heightAt(rx, ry) : 0;
      return [rx, ry, rz];
    });
  }

  /**
   * Aplica remetimiento frontal adicional sobre la arista principal (frente a calle: segmento 0->1)
   */
  applyFrontSetbackLocal(ringLocal, extraFrontM) {
    if (!ringLocal || ringLocal.length < 3 || extraFrontM <= 0.01) return ringLocal;
    const p0 = ringLocal[0];
    const p1 = ringLocal[1];
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) return ringLocal;

    // Vector normal interior desde el frente (arista 0-1) hacia el centroide del lote
    let cx = 0, cy = 0;
    for (const p of ringLocal) { cx += p[0]; cy += p[1]; }
    cx /= ringLocal.length;
    cy /= ringLocal.length;

    let nx = -dy / len;
    let ny = dx / len;
    const midX = (p0[0] + p1[0]) / 2;
    const midY = (p0[1] + p1[1]) / 2;
    if ((cx - midX) * nx + (cy - midY) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }

    // Desplazar los dos vértices frontales a lo largo de la normal interior
    return ringLocal.map((pt, idx) => {
      if (idx === 0 || idx === 1) {
        return [pt[0] + nx * extraFrontM, pt[1] + ny * extraFrontM, pt[2] || 0];
      }
      return pt;
    });
  }

  /**
   * Calcula en tiempo real con Turf.js:
   * - Buffer negativo de remetimientos perimetral y frontal
   * - Área de desplante permitida (m²) limitada por COS y remetimientos
   * - Metros cuadrados totales construibles (m²) según CUS y niveles máximos
   */
  compute(model) {
    const centerLat = model?.center?.lat ?? 19.4326;
    const centerLon = model?.center?.lon ?? -99.1332;
    const lotRingLocal = this.resolveTargetLotRing(model);

    const closedLngLat = lotRingLocal.map(([x, y]) => this.localToLngLat(x, y, centerLat, centerLon));
    if (
      closedLngLat.length > 0 &&
      (closedLngLat[0][0] !== closedLngLat[closedLngLat.length - 1][0] ||
        closedLngLat[0][1] !== closedLngLat[closedLngLat.length - 1][1])
    ) {
      closedLngLat.push([...closedLngLat[0]]);
    }

    const lotPoly = turf.polygon([closedLngLat]);
    const lotAreaM2 = Math.max(1, turf.area(lotPoly));

    // 1. Aplicar buffer negativo con Turf.js para el remetimiento perimetral (side_setback_m)
    const sideSetback = Math.max(0, Number(this.params.side_setback_m) || 0);
    const frontSetback = Math.max(0, Number(this.params.front_setback_m) || 0);

    let setbackPoly = lotPoly;
    if (sideSetback > 0.05) {
      try {
        const buffered = turf.buffer(lotPoly, -sideSetback, { units: 'meters' });
        if (buffered && buffered.geometry && buffered.geometry.coordinates?.length) {
          setbackPoly = buffered.geometry.type === 'MultiPolygon'
            ? turf.polygon(buffered.geometry.coordinates[0])
            : buffered;
        }
      } catch {
        setbackPoly = lotPoly;
      }
    }

    // Convertir anillo con buffer perimetral a coordenadas locales y aplicar diferencial frontal
    const rawCoords = setbackPoly.geometry.coordinates[0].slice(0, -1);
    let footprintLocal = rawCoords.map(([lon, lat]) => {
      const [x, y] = this.lngLatToLocal(lon, lat, centerLat, centerLon);
      const z = model?.grid?.heightAt ? model.grid.heightAt(x, y) : (lotRingLocal[0]?.[2] || 0);
      return [x, y, z];
    });

    const extraFront = Math.max(0, frontSetback - sideSetback);
    if (extraFront > 0.05 && footprintLocal.length >= 3) {
      footprintLocal = this.applyFrontSetbackLocal(footprintLocal, extraFront);
    }

    // Reconstruir polígono Turf tras remetimiento frontal para medir área exacta
    const fpLngLat = footprintLocal.map(([x, y]) => this.localToLngLat(x, y, centerLat, centerLon));
    if (fpLngLat.length >= 3) {
      fpLngLat.push([...fpLngLat[0]]);
    }
    let fpPoly = fpLngLat.length >= 4 ? turf.polygon([fpLngLat]) : setbackPoly;
    const setbackAreaM2 = Math.max(0, turf.area(fpPoly));

    // 2. Restricción por COS (% de ocupación del suelo permitido)
    const maxCosAreaM2 = lotAreaM2 * (this.params.cos / 100);
    const footprintAreaM2 = Math.min(setbackAreaM2, maxCosAreaM2);

    // Si el área tras remetimientos supera el COS máximo, escalar concéntricamente la huella con Turf.js
    if (setbackAreaM2 > maxCosAreaM2 && setbackAreaM2 > 1) {
      const scaleFactor = Math.sqrt(maxCosAreaM2 / setbackAreaM2);
      try {
        const scaled = turf.transformScale(fpPoly, scaleFactor, { origin: 'centroid' });
        const scaledCoords = scaled.geometry.coordinates[0].slice(0, -1);
        footprintLocal = scaledCoords.map(([lon, lat]) => {
          const [x, y] = this.lngLatToLocal(lon, lat, centerLat, centerLon);
          const z = model?.grid?.heightAt ? model.grid.heightAt(x, y) : (lotRingLocal[0]?.[2] || 0);
          return [x, y, z];
        });
      } catch {
        // Mantiene footprintLocal
      }
    }

    // 3. Cálculo de CUS (m² totales construibles) y niveles efectivos
    const maxCusAreaM2 = lotAreaM2 * this.params.cus;
    const maxEnvelopeGfaM2 = footprintAreaM2 * this.params.max_levels;
    const maxBuildableM2 = Math.min(maxCusAreaM2, maxEnvelopeGfaM2);
    const effectiveLevels = footprintAreaM2 > 0
      ? Math.min(this.params.max_levels, Math.max(1, maxBuildableM2 / footprintAreaM2))
      : this.params.max_levels;
    const maxHeightM = effectiveLevels * LEVEL_HEIGHT_M;

    this.metrics = {
      lotAreaM2: Math.round(lotAreaM2),
      footprintAreaM2: Math.round(footprintAreaM2),
      maxBuildableM2: Math.round(maxBuildableM2),
      effectiveLevels: Number(effectiveLevels.toFixed(1)),
      maxHeightM: Number(maxHeightM.toFixed(1)),
      lotRingLocal,
      footprintRingLocal: footprintLocal,
    };

    if (model) {
      model.feasibilityFootprint = footprintLocal;
      model.feasibilityElevation = footprintLocal[0]?.[2] || 0;
      model.feasibilityHeight = maxHeightM;
    }

    return this.metrics;
  }

  /**
   * Envía un extracto de texto normativo al endpoint Gemini Flash-Lite y actualiza los sliders reactivamente.
   */
  async parseZoningExtract(rawText) {
    if (!rawText || !rawText.trim()) {
      throw new Error('Ingresa un extracto de normativa urbana.');
    }
    const res = await fetch('/api/parse-normativa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rawText.trim() }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Error ${res.status} al analizar normativa`);
    }
    const parsed = await res.json();
    this.setParams({
      cos: parsed.cos,
      cus: parsed.cus,
      max_levels: parsed.max_levels,
      front_setback_m: parsed.front_setback_m,
      side_setback_m: parsed.side_setback_m,
    });
    return parsed;
  }
}

export const feasibilityStore = new FeasibilityStore();
