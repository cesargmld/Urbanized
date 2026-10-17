import earcut from 'https://cdn.jsdelivr.net/npm/earcut@3.0.1/+esm';
import { pinStore } from './pins.js?v=1.0';

// Urbanized — Axonometría & Maqueta Arquitectónica
// Proyección axonométrica/isométrica/perspectiva con sombreado solar dinámico,
// base de maqueta (yeso, balsa, estrato geológico), multimapas temáticos (tipología, isócronas, flora, fauna),
// norte giratorio con la cámara, escala gráfica, retícula técnica y etiquetas libres arrastrables.

export const VIEWS = {
  'iso-sw': { az: 225, el: 35.264 },
  'iso-se': { az: 315, el: 35.264 },
  'iso-ne': { az: 45, el: 35.264 },
  'iso-nw': { az: 135, el: 35.264 },
  top: { az: 270, el: 89.9 },
  eye: { az: 225, el: 12 },
};

export const STYLES = {
  // Color arquitectónico plano sin contorno
  flat: {
    bg: '#f3f0e8', stroke: null, width: 0, contours: false,
    terrain: '#e3ded0', building: '#f0e3d6', water: '#9cc6e0', green: '#c3d9a8', tree: '#82ac67',
    road: '#d6d1c4', roadMajor: '#c3bcab', bridge: '#a9a396', contour: '#d5cfbd', site: '#b4341f', shade: 0.5,
  },
  // Línea fina técnica de arquitectura con curvas de nivel
  line: {
    bg: '#ffffff', stroke: '#2b2b2d', width: 0.4, contours: true,
    terrain: '#f6f3ea', building: '#f6ece2', water: '#c3ddf0', green: '#dbe9c9', tree: '#a3c98c',
    road: '#ffffff', roadMajor: '#f4f0e5', bridge: '#d9d3c4', contour: '#c6bfad', site: '#b4341f', shade: 0.24,
  },
  // Maqueta monocromática blanca/yeso con sombras volumétricas
  mono: {
    bg: '#ffffff', stroke: '#333333', width: 0.25, contours: false,
    terrain: '#e5e5e5', building: '#ffffff', water: '#cccccc', green: '#e0e0e0', tree: '#bfbfbf',
    road: '#f5f5f5', roadMajor: '#eaeaea', bridge: '#cccccc', contour: '#d4d4d4', site: '#000000', shade: 0.55,
  },
};

// Paleta suave de tipologías GIS
export const CLASS_TINT = {
  residential: '#e4b79a',
  public: '#a8c0cc',
  commercial: '#e8cf9e',
  industrial: '#bfb5ab',
  utility: '#d6d2c8',
  other: '#e2dbd0',
};

// En maqueta B/N por defecto
export const CLASS_GRAY = {
  residential: '#fafafa',
  public: '#dcdcdc',
  commercial: '#efefef',
  industrial: '#cfcfcf',
  utility: '#e5e5e5',
  other: '#f4f4f4',
};

// Materiales para la base de la maqueta
export const BASE_MATERIALS = {
  plaster: { name: 'Yeso Blanco', color: '#dedbd3', topColor: '#ebe8df', stroke: '#2b2b2d' },
  balsa: { name: 'Madera Balsa', color: '#dfcbb5', topColor: '#eddcc9', stroke: '#8c7355' },
  soil: { name: 'Estrato Geológico', color: '#6d533d', topColor: '#4a3728', stroke: '#382b1f' },
  graphite: { name: 'Grafito / Pizarra', color: '#272930', topColor: '#1d1f24', stroke: '#111215' },
};

const shadeColor = (hex, k) => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex || '#ffffff';
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `#${((1 << 24) + (m(r) << 16) + (m(g) << 8) + m(b)).toString(16).slice(1)}`;
};

// subdivisión de polígono para orden de dibujo
function subdivide(P, vis, step) {
  if (P.length !== 4) return [[P, vis]];
  const [a, b, c, d] = P;
  const len = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
  const nu = Math.max(1, Math.ceil(Math.max(len(a, b), len(d, c)) / step));
  const nv = Math.max(1, Math.ceil(Math.max(len(a, d), len(b, c)) / step));
  if (nu * nv === 1) return [[P, vis]];
  const mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  const at = (u, v) => mix(mix(a, b, u), mix(d, c, u), v);
  const out = [];
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const u0 = i / nu, u1 = (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv;
      const e = vis ? [j === 0 && vis[0], i === nu - 1 && vis[1], j === nv - 1 && vis[2], i === 0 && vis[3]].map(Number) : null;
      out.push([[at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)], e]);
    }
  return out;
}

export function createIllustrator(canvas, model) {
  const state = {
    view: 'iso-sw',
    style: 'flat',
    perspective: false,
    az: VIEWS['iso-sw'].az,
    el: VIEWS['iso-sw'].el,
    zoom: 1,
    pan: [0, 0],
    labels: [],
    quick: false,
    labelColor: '#111114',
    byType: false,
    legend: true,
    lang: 'es',
    sunAz: 315,
    sunAlt: 42,
    lineWidth: 0.4,
    baseMaterial: 'plaster',
    baseDepth: 0.02,
    soilName: model.ecosystem?.soil || 'Suelo Aluvial & Sedimentos Lacustres',
    overlays: {
      north: true,
      northStyle: 'swiss', // 'swiss' | 'minimal' | 'circle'
      scalebar: true,
      scalebarStyle: 'minimal', // 'minimal' | 'classic' | 'subdivided'
      grid: false,
      gridStyle: 'cross', // 'cross' | 'line'
    },
    thematic: {
      isochrones: false,
      flora: false,
      fauna: false,
    },
    colors: {},
    classColors: {},
    layers: { terrain: true, buildings: true, trees: true, roads: true, nature: true, contours: false },
    exploded: false, // Superposición en Cascada / Axonometría Despiezada QGIS (Imagen 4)
    explodeOffset: 120, // Desplazamiento vertical entre capas en metros (40m - 350m)
    explodedTiers: {
      contours: true,
      hydrography: true,
      network: true,
      buildings: true,
      green: true
    },
    tierColors: {
      hydrography: '#06b6d4',
      network: '#ffffff',
      green: '#22c55e',
      buildings: '#fafafa'
    },
    explodedCornerLabels: true,
    explodedGuides: true,
    contourLabels: true,
  };

  let list = null, listKey = '';

  const palette = () => ({
    ...STYLES[state.style],
    ...state.colors,
    width: state.lineWidth ?? STYLES[state.style].width,
  });

  const classPalette = () => {
    // Si byType está activo, usar siempre los tonos vivos diferenciados (incluso en monocromo)
    if (state.byType) {
      return { ...CLASS_TINT, ...state.classColors };
    }
    return { ...(state.style === 'mono' ? CLASS_GRAY : CLASS_TINT), ...state.classColors };
  };

  const zTop = (() => {
    let z = model.grid?.maxH ?? 10;
    for (const b of model.buildings ?? []) {
      if (b.verts) {
        for (const v of b.verts) z = Math.max(z, v[2]);
      } else if (b.height) {
        z = Math.max(z, (b.baseZ || 0) + b.height);
      }
    }
    for (const t of model.trees ?? []) z = Math.max(z, (t.z || 0) + (t.h || 0));
    return z;
  })();

  /* --- Cálculo de vector de luz solar dinámico --- */
  function getLightVector() {
    const azRad = (state.sunAz * Math.PI) / 180;
    const altRad = (Math.max(8, state.sunAlt) * Math.PI) / 180;
    const v = [-Math.cos(altRad) * Math.cos(azRad), -Math.cos(altRad) * Math.sin(azRad), Math.sin(altRad)];
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
  }

  /* --- Geometría en coordenadas del mundo --- */
  function buildList() {
    const key = JSON.stringify([
      state.layers,
      state.style,
      state.baseMaterial,
      state.baseDepth,
      state.thematic,
      state.exploded,
      state.explodeOffset,
      state.explodedTiers,
      state.tierColors,
      state.contourLabels,
      pinStore.getPins().length,
      model.site?.length ?? 0
    ]);
    if (list && listKey === key) return list;

    const items = [];
    const add = (kind, pts, opts) => items.push({ kind, pts, ...opts });
    const size = model.size || 1000;
    const half = size / 2;

    const isExp = Boolean(state.exploded);
    const dZ = isExp ? (state.explodeOffset || 120) : 0;
    const tierOffsets = {
      contours: 0,
      hydrography: isExp ? dZ * 1 : 0,
      network: isExp ? dZ * 2 : 0,
      buildings: isExp ? dZ * 3 : 0,
      green: isExp ? dZ * 4 : 0
    };
    const showTier = (tier) => !isExp || Boolean(state.explodedTiers?.[tier]);

    // 1. Relieve de terreno (Tier 0: Contours)
    if (showTier('contours') && state.layers.terrain && model.terrain) {
      const t = model.terrain;
      const off = tierOffsets.contours;
      for (const { v } of t.faces) {
        const poly = v.map((i) => {
          const p = t.verts[i];
          return [p[0], p[1], p[2] + off];
        });
        add('poly', poly, { color: 'terrain', noStroke: true, order: 0 });
      }
    }

    // 2. Base de Maqueta / Zócalo / Estrato Geológico (Tier 0)
    if (showTier('contours') && state.layers.terrain && model.terrain?.boundary) {
      const t = model.terrain;
      const baseDepthMult = Math.max(0.015, Math.min(0.06, state.baseDepth || 0.02));
      const base = -Math.max(8, size * baseDepthMult);
      const loop = t.boundary;
      const mat = BASE_MATERIALS[state.baseMaterial] || BASE_MATERIALS.plaster;
      const off = tierOffsets.contours;

      if (state.baseMaterial === 'soil') {
        // Estrato geológico en 3 capas
        const sub1 = base * 0.25;
        const sub2 = base * 0.65;
        for (let i = 0; i < loop.length; i++) {
          const a = t.verts[loop[i]], b = t.verts[loop[(i + 1) % loop.length]];
          const a1 = [a[0], a[1], sub1 + off], b1 = [b[0], b[1], sub1 + off];
          const a2 = [a[0], a[1], sub2 + off], b2 = [b[0], b[1], sub2 + off];
          const aBase = [a[0], a[1], base + off], bBase = [b[0], b[1], base + off];
          const aTop = [a[0], a[1], a[2] + off], bTop = [b[0], b[1], b[2] + off];

          // Capa fértil / topsoil
          add('poly', [a1, b1, bTop, aTop], { fillDirect: '#453326', side: true, order: 0 });
          // Subsuelo arcilloso
          add('poly', [a2, b2, b1, a1], { fillDirect: '#634c38', side: true, order: 0 });
          // Roca madre / sustrato
          add('poly', [aBase, bBase, b2, a2], { fillDirect: '#827365', side: true, order: 0 });
        }
        add('line', [...loop.map((i) => [t.verts[i][0], t.verts[i][1], sub1 + off]), [t.verts[loop[0]][0], t.verts[loop[0]][1], sub1 + off]], { colorDirect: '#332419', weight: 0.8, edge: true });
        add('line', [...loop.map((i) => [t.verts[i][0], t.verts[i][1], sub2 + off]), [t.verts[loop[0]][0], t.verts[loop[0]][1], sub2 + off]], { colorDirect: '#423326', weight: 0.8, edge: true });
        add('line', [...loop.map((i) => [t.verts[i][0], t.verts[i][1], base + off]), [t.verts[loop[0]][0], t.verts[loop[0]][1], base + off]], { colorDirect: '#211812', weight: 1.2, edge: true });
        add('line', [...loop.map((i) => [t.verts[i][0], t.verts[i][1], t.verts[i][2] + off]), [t.verts[loop[0]][0], t.verts[loop[0]][1], t.verts[loop[0]][2] + off]], { colorDirect: '#211812', weight: 1.2, edge: true });
      } else {
        // Yeso, Balsa o Grafito sólido
        for (let i = 0; i < loop.length; i++) {
          const a = t.verts[loop[i]], b = t.verts[loop[(i + 1) % loop.length]];
          add('poly', [[a[0], a[1], base + off], [b[0], b[1], base + off], [b[0], b[1], b[2] + off], [a[0], a[1], a[2] + off]], { fillDirect: mat.color, side: true, order: 0 });
        }
        if (state.baseMaterial === 'balsa') {
          const sub1 = base * 0.45;
          add('line', [...loop.map((i) => [t.verts[i][0], t.verts[i][1], sub1 + off]), [t.verts[loop[0]][0], t.verts[loop[0]][1], sub1 + off]], { colorDirect: '#a38d74', weight: 0.6, edge: true });
        }
        add('line', [...loop.map((i) => [t.verts[i][0], t.verts[i][1], base + off]), [t.verts[loop[0]][0], t.verts[loop[0]][1], base + off]], { colorDirect: mat.stroke, weight: 1.2, edge: true });
        add('line', [...loop.map((i) => [t.verts[i][0], t.verts[i][1], t.verts[i][2] + off]), [t.verts[loop[0]][0], t.verts[loop[0]][1], t.verts[loop[0]][2] + off]], { colorDirect: mat.stroke, weight: 1.2, edge: true });
      }
    }

    // 3. Multimapa Temático: Isócronas Peatonales (5, 10, 15 min)
    if (state.thematic.isochrones) {
      const rings = [
        { r: 400, color: '#0284c7', label: '5 min · 400 m' },
        { r: 800, color: '#4f46e5', label: '10 min · 800 m' },
        { r: 1200, color: '#7c3aed', label: '15 min · 1.2 km' },
      ];
      for (const ring of rings) {
        if (ring.r > size * 0.9) continue;
        const pts = [];
        const nSteps = 72;
        for (let i = 0; i <= nSteps; i++) {
          const theta = (i / nSteps) * Math.PI * 2;
          const px = ring.r * Math.cos(theta);
          const py = ring.r * Math.sin(theta);
          pts.push([px, py, 0.4 + tierOffsets.contours]);
        }
        add('line', pts, { colorDirect: ring.color, weight: 2.2, dash: [8, 5], isochrone: true, label: ring.label });
      }
    }

    // 4. Naturaleza, Agua y Zonas Verdes
    // 4A. Agua (Tier 1: Hydrography en Cascada)
    if (showTier('hydrography') && state.layers.nature) {
      const off = tierOffsets.hydrography;
      const waterColor = isExp ? (state.tierColors.hydrography || '#06b6d4') : 'water';
      for (const w of model.water ?? []) {
        for (const { v } of w.faces)
          add('poly', v.map((i) => { const p = w.verts[i]; return [p[0], p[1], p[2] + off + 0.4]; }), { color: waterColor, fillDirect: isExp ? waterColor : null, flat: true, noStroke: true, bias: 0.6, order: 1 });
      }
    }

    // 4B. Zonas Verdes y Parques (Tier 4: Green Areas en Cascada)
    if (showTier('green') && state.layers.nature) {
      const off = tierOffsets.green;
      for (const ring of model.areas?.GREEN ?? []) {
        if (ring.length < 3) continue;
        const flat = [];
        for (const [x, y] of ring) flat.push(x, y);
        const tri = earcut(flat, [], 2);
        const greenColor = isExp ? (state.tierColors.green || '#22c55e') : (state.thematic.flora ? '#4ade80' : 'green');
        for (let i = 0; i < tri.length; i += 3)
          add('area', [ring[tri[i]], ring[tri[i + 1]], ring[tri[i + 2]]].map((p) => [p[0], p[1], p[2] + off + 0.2]), { color: greenColor, fillDirect: isExp ? greenColor : null, flat: true, noStroke: true, bias: 0.5, order: 1 });
        if (state.thematic.flora || isExp) {
          add('line', ring.map(([x, y, z]) => [x, y, (z || 0) + off + 0.3]), { colorDirect: '#15803d', weight: 1.8, floraOutline: true });
        }
      }
    }

    // 5. Red Vial (Tier 2: Network en Cascada)
    if (showTier('network') && state.layers.roads) {
      const off = tierOffsets.network;
      const netColor = isExp ? (state.tierColors.network || '#ffffff') : null;
      const wide = Boolean(model.roadMeshes?.length);
      for (const rm of model.roadMeshes ?? []) {
        const color = isExp ? netColor : (rm.layer === 'ROADS_AREA' ? 'roadMajor' : 'road');
        for (const { v, vis } of rm.faces)
          add('area', v.map((i) => { const p = rm.verts[i]; return [p[0], p[1], p[2] + off + 0.1]; }), { color, fillDirect: isExp ? netColor : null, flat: true, edges: vis, bias: 0.55, order: 1 });
      }
      for (const [layer, lines] of Object.entries(model.lines ?? {})) {
        if (layer === 'WATER') continue;
        if (wide && (layer === 'ROADS_MAJOR' || layer === 'ROADS_MINOR' || layer === 'PATHS')) continue;
        const color = isExp ? netColor : (layer === 'ROADS_MAJOR' ? 'roadMajor' : layer === 'BRIDGES' ? 'bridge' : 'road');
        const w = layer === 'ROADS_MAJOR' || layer === 'BRIDGES' ? 2.2 : layer === 'ROADS_MINOR' ? 1.4 : 0.9;
        for (const lineObj of lines) {
          const pts = Array.isArray(lineObj) ? lineObj : (lineObj?.pts || []);
          if (pts.length > 1) {
            add('line', pts.map(([x, y, z]) => [x, y, (z || 0) + off]), { color, colorDirect: isExp ? netColor : null, weight: w });
          }
        }
      }
    }

    // 6. Curvas de nivel topográficas (Tier 0: Contours) & Altitude Labels (Moodboard Image 1)
    if (showTier('contours') && (state.layers.contours || STYLES[state.style].contours || isExp)) {
      const off = tierOffsets.contours;
      const ci = model.contourInterval || 5;
      const stepInterval = ci <= 5 ? 20 : (ci * 2);
      for (const c of model.contours ?? []) {
        const pts = c.pts.map(([x, y, z]) => [x, y, z + off + 0.2]);
        add('line', pts, { color: 'contour', weight: 0.7 });
        if (state.contourLabels && Math.round(c.z) % stepInterval === 0 && c.pts.length > 8) {
          const midIdx = Math.floor(c.pts.length * 0.45);
          const pt = c.pts[midIdx];
          const minH = model.grid?.minH ?? 0;
          const elevationMeters = Math.round(c.z + minH);
          add('contourLabel', [[pt[0], pt[1], pt[2] + off + 1.2]], { text: `${elevationMeters} m` });
        }
      }
    }

    // 7. Polígono de predio
    if (model.site?.length) {
      add('line', [...model.site, model.site[0]].map(([x, y, z]) => [x, y, (z || 0) + tierOffsets.contours + 0.5]), { color: 'site', weight: 2.4, site: true });
    }

    // 8. Edificios 3D con tipologías (Tier 3: Urban Areas en Cascada)
    if (showTier('buildings') && state.layers.buildings) {
      const off = tierOffsets.buildings;
      const bColor = isExp ? (state.tierColors.buildings || '#fafafa') : null;
      for (const b of model.buildings ?? []) {
        let cx = 0, cy = 0, cz = 0;
        for (const v of b.verts) { cx += v[0]; cy += v[1]; cz += v[2]; }
        const g = [cx / b.verts.length, cy / b.verts.length, cz / b.verts.length + off];
        for (const f of b.faces) {
          const poly = f.v.map((i) => {
            const p = b.verts[i];
            return [p[0], p[1], p[2] + off];
          });
          add('poly', poly, { color: 'building', fillDirect: isExp ? bColor : null, cls: b.cls, edges: f.vis, g });
        }
      }
    }

    // 9. Puentes y viaductos (Tier 2: Network)
    if (showTier('network') && state.layers.roads) {
      const off = tierOffsets.network;
      for (const br of model.bridges ?? []) {
        for (const f of br.faces) {
          const poly = f.v.map((i) => {
            const p = br.verts[i];
            return [p[0], p[1], p[2] + off];
          });
          for (const [q, vis] of subdivide(poly, f.vis, 3)) add('poly', q, { color: 'bridge', edges: vis, sub: true });
        }
      }
    }

    // 10. Árboles (Tier 4: Green Areas)
    if (showTier('green') && state.layers.trees) {
      const off = tierOffsets.green;
      for (const tr of model.trees ?? []) {
        let treeFill = 'tree';
        if (state.thematic.flora) {
          const speciesTints = ['#22c55e', '#16a34a', '#84cc16', '#a855f7', '#059669'];
          treeFill = speciesTints[Math.floor(Math.abs(tr.x * 13 + tr.y * 7)) % speciesTints.length];
        }
        add('tree', [[tr.x, tr.y, tr.z + off], [tr.x, tr.y, tr.z + tr.h + off]], { color: treeFill, fillDirect: state.thematic.flora ? treeFill : null, r: tr.r });
      }
    }

    // 11. Marcos de Capas en Cascada, Guías Verticales y Pines (Imagen 4 e Imagen 3)
    const activeTiers = [
      { key: 'contours', z: tierOffsets.contours, label: '01 / CONTOURS' },
      { key: 'hydrography', z: tierOffsets.hydrography, label: '02 / HYDROGRAPHY' },
      { key: 'network', z: tierOffsets.network, label: '03 / NETWORK' },
      { key: 'buildings', z: tierOffsets.buildings, label: '04 / URBAN AREAS (BUILDINGS)' },
      { key: 'green', z: tierOffsets.green, label: '05 / GREEN AREAS' }
    ].filter((t) => showTier(t.key));

    if (isExp && activeTiers.length > 0) {
      // Wireframe bounding rectangle for each floating tier
      for (const t of activeTiers) {
        const framePts = [
          [-half, -half, t.z],
          [half, -half, t.z],
          [half, half, t.z],
          [-half, half, t.z],
          [-half, -half, t.z]
        ];
        add('line', framePts, { colorDirect: 'rgba(255, 255, 255, 0.45)', weight: 1.4, isTierFrame: true, tierLabel: t.label, tierZ: t.z });
      }

      // Vertical dashed corner guide lines connecting all tiers
      if (state.explodedGuides && activeTiers.length > 1) {
        const zMin = activeTiers[0].z;
        const zMax = activeTiers[activeTiers.length - 1].z + 25;
        const corners = [[-half, -half], [half, -half], [half, half], [-half, half]];
        for (const [cx, cy] of corners) {
          add('line', [[cx, cy, zMin], [cx, cy, zMax]], {
            colorDirect: 'rgba(255, 255, 255, 0.35)',
            weight: 1.2,
            dash: [7, 5]
          });
        }
      }
    }

    // Custom Pins (Imagen 3 & Imagen 4)
    const pins = pinStore.getPins().filter((p) => p.visible);
    if (isExp && activeTiers.length > 0) {
      const zMin = activeTiers[0].z;
      const zMax = activeTiers[activeTiers.length - 1].z + 28;
      for (const p of pins) {
        // Vertical dashed projection line piercing through all 5 tiers
        add('line', [[p.x, p.y, zMin], [p.x, p.y, zMax + 20]], { colorDirect: p.color, weight: 1.5, dash: [5, 4] });
        for (const t of activeTiers) {
          add('pinDot', [[p.x, p.y, t.z + 1.2]], { colorDirect: p.color });
        }
        add('pinBadge', [[p.x, p.y, zMax + 25]], { label: p.label, color: p.color, type: p.type });
      }
    } else if (!isExp) {
      for (const p of pins) {
        add('pinBadge', [[p.x, p.y, p.z || 0]], { label: p.label, color: p.color, type: p.type, normal: true });
      }
    }

    list = items;
    listKey = key;
    return items;
  }

  /* --- Cámara y Proyección --- */
  function camera(width, height) {
    const rad = Math.PI / 180;
    const az = state.az * rad, el = state.el * rad;
    const dir = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
    const target = [0, 0, (model.grid?.maxH ?? 10) * 0.3];
    const span = model.size || 1000;
    const dist = span * 2.2;
    const eye = [target[0] + dir[0] * dist, target[1] + dir[1] * dist, target[2] + dir[2] * dist];
    const f = dir.map((v) => -v);
    const rx = f[1] * 1 - f[2] * 0, ry = f[2] * 0 - f[0] * 1, rz = f[0] * 0 - f[1] * 0;
    const rl = Math.hypot(rx, ry, rz) || 1;
    const right = [rx / rl, ry / rl, rz / rl];
    const up = [right[1] * f[2] - right[2] * f[1], right[2] * f[0] - right[0] * f[2], right[0] * f[1] - right[1] * f[0]];
    const isExp = Boolean(state.exploded);
    const dZ = isExp ? (state.explodeOffset || 120) : 0;
    const h0 = -Math.max(8, span * (state.baseDepth || 0.02)), h1 = isExp ? (zTop + dZ * 4.6) : zTop;
    const corners = [];
    for (const z of [h0, h1])
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) corners.push([(sx * span) / 2, (sy * span) / 2, z]);

    const view = (p) => {
      const dx = p[0] - eye[0], dy = p[1] - eye[1], dz = p[2] - eye[2];
      return [dx * right[0] + dy * right[1] + dz * right[2], dx * up[0] + dy * up[1] + dz * up[2]];
    };

    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of corners) {
      const [vx, vy] = view(c);
      x0 = Math.min(x0, vx); x1 = Math.max(x1, vx); y0 = Math.min(y0, vy); y1 = Math.max(y1, vy);
    }
    const fit = Math.min(width / ((x1 - x0) * 1.1 || 1), height / ((y1 - y0) * 1.14 || 1));
    const scale = fit * state.zoom;
    const focal = dist * scale;
    const cx = width / 2 + state.pan[0] - ((x0 + x1) / 2) * scale;
    const cy = height / 2 + state.pan[1] + ((y0 + y1) / 2) * scale;

    const project = (p) => {
      const dx = p[0] - eye[0], dy = p[1] - eye[1], dz = p[2] - eye[2];
      const vx = dx * right[0] + dy * right[1] + dz * right[2];
      const vy = dx * up[0] + dy * up[1] + dz * up[2];
      const vz = dx * f[0] + dy * f[1] + dz * f[2];
      if (state.perspective) {
        const s = focal / Math.max(vz, 1e-3);
        return [cx + vx * s, cy - vy * s, vz];
      }
      return [cx + vx * scale, cy - vy * scale, vz];
    };
    return { project, eye, scale, focal, dir, cx, cy };
  }

  /* --- Primitivas 2D ordenadas por profundidad --- */
  function scene(width, height) {
    const cam = camera(width, height);
    const st = palette();
    const light = getLightVector();
    const out = [];
    const quick = state.quick;
    const minArea = quick ? 4 : 0.35;
    const treeStep = quick && (model.trees?.length ?? 0) > 6000 ? 3 : 1;
    let treeIndex = 0;

    for (const it of buildList()) {
      if (it.kind === 'contourLabel') {
        const pt = cam.project(it.pts[0]);
        if (pt[2] > 0) out.push({ kind: 'contourLabel', pt, text: it.text, depth: pt[2] - 0.2, order: 3 });
        continue;
      }
      if (it.kind === 'pinDot') {
        const pt = cam.project(it.pts[0]);
        if (pt[2] > 0) out.push({ kind: 'pinDot', pt, color: it.colorDirect, depth: pt[2] - 0.3, order: 3 });
        continue;
      }
      if (it.kind === 'pinBadge') {
        const pt = cam.project(it.pts[0]);
        if (pt[2] > 0) out.push({ kind: 'pinBadge', pt, label: it.label, color: it.color, type: it.type, normal: it.normal, depth: -1e8, order: 4 });
        continue;
      }
      if (it.kind === 'tree') {
        if (treeStep > 1 && treeIndex++ % treeStep) continue;
        const [b, top] = it.pts.map(cam.project);
        if (b[2] <= 0) continue;
        const unit = state.perspective ? cam.focal / Math.max(b[2], 1e-3) : cam.scale;
        const r = Math.max(1.2, it.r * unit);
        const fill = it.fillDirect || st[it.color] || st.tree;
        out.push({ kind: 'tree', x: (b[0] + top[0]) / 2, y: (b[1] + top[1]) / 2 - r * 0.15, r, gdepth: b[2], depth: b[2], order: 2, fill, trunk: [b, top] });
        continue;
      }
      if (it.kind === 'line') {
        if (it.edge && !st.stroke && !it.colorDirect) continue;
        const pts = it.pts.map(cam.project);
        if (pts.some((p) => p[2] <= 0)) continue;
        if (it.site) {
          out.push({ kind: 'line', pts, gdepth: -1e9, depth: -1e9, order: 3, stroke: st.site, weight: it.weight, dash: [9, 6] });
          continue;
        }
        if (it.isochrone) {
          out.push({ kind: 'line', pts, gdepth: -1e8, depth: -1e8, order: 2, stroke: it.colorDirect, weight: it.weight, dash: it.dash, label: it.label });
          continue;
        }
        const stroke = it.colorDirect || (it.edge ? st.stroke : st[it.color]);
        const weight = it.weight ? it.weight : (it.edge ? Math.max(0.6, st.width * 1.4) : st.width);

        if (quick) {
          let depth = 0;
          for (const p of pts) depth = Math.max(depth, p[2]);
          out.push({ kind: 'line', pts, gdepth: depth - 0.5, depth: depth - 0.5, order: 1, stroke, weight });
          continue;
        }
        for (let i = 0; i < pts.length - 1; i++) {
          const a2 = pts[i], b2 = pts[i + 1];
          if (Math.abs(a2[0] - b2[0]) < 0.25 && Math.abs(a2[1] - b2[1]) < 0.25) continue;
          const d2 = (a2[2] + b2[2]) / 2 - 0.4;
          out.push({ kind: 'line', pts: [a2, b2], gdepth: d2, depth: d2, order: 1, stroke, weight });
        }
        continue;
      }

      const world = it.pts;
      const pts = world.map(cam.project);
      if (pts.some((p) => p[2] <= 0)) continue;

      const [a, b, c] = world;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;

      const facing = nx * cam.dir[0] + ny * cam.dir[1] + nz * cam.dir[2];
      if (it.kind === 'poly' && facing < 0) continue;

      let area = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        area += p[0] * q[1] - q[0] * p[1];
      }
      if (!it.sub && Math.abs(area) / 2 < minArea) continue;

      const lam = Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]);
      const k = 1 - st.shade + st.shade * lam;

      let depth = 0;
      for (const p of pts) depth += p[2];
      depth = depth / pts.length - (it.bias ?? 0);
      const gdepth = it.g ? cam.project(it.g)[2] : depth;

      let baseFill = it.fillDirect;
      if (!baseFill) {
        const tint = classPalette();
        baseFill = (it.cls && state.byType) ? (tint[it.cls] ?? st[it.color]) : st[it.color];
      }

      out.push({
        kind: 'poly',
        pts,
        gdepth,
        depth,
        order: it.order ?? 2,
        fill: shadeColor(baseFill, it.flat ? 1 : it.side ? 0.88 : k)
      });

      if (st.stroke && !it.noStroke && !it.side && it.edges) {
        for (let i = 0; i < pts.length; i++) {
          if (!it.edges[i]) continue;
          const a2 = pts[i], b2 = pts[(i + 1) % pts.length];
          out.push({ kind: 'line', pts: [a2, b2], gdepth, depth: depth - 0.15, order: it.order ?? 2, stroke: st.stroke, weight: st.width });
        }
      }
    }

    out.sort((p, q) => ((p.order ?? 2) - (q.order ?? 2)) || ((q.gdepth ?? q.depth) - (p.gdepth ?? p.depth)) || (q.depth - p.depth));
    return { items: out, cam, st };
  }

  /* --- Opciones Arquitectónicas: Norte, Escala, Retícula --- */
  function drawOverlays(ctx, width, height, cam) {
    const st = palette();
    const txtColor = st.bg === '#ffffff' ? '#18181b' : '#27272a';

    // 1. Retícula (Grid)
    if (state.overlays.grid) {
      ctx.save();
      const step = 100;
      const span = model.size || 1000;
      const half = span / 2;
      const isDark = st.bg === '#000000' || st.bg === '#15171c';
      const gridStroke = isDark ? 'rgba(255, 255, 255, 0.32)' : 'rgba(0, 0, 0, 0.28)';
      const gridFill = isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.45)';
      ctx.strokeStyle = gridStroke;
      ctx.fillStyle = gridFill;
      ctx.lineWidth = 1.0;

      const style = state.overlays.gridStyle || 'cross';

      if (style === 'line') {
        // Líneas continuas en el plano de suelo axonométrico
        for (let gx = -half; gx <= half; gx += step) {
          const pStart = cam.project([gx, -half, 0]);
          const pEnd = cam.project([gx, half, 0]);
          if (pStart[2] > 0 && pEnd[2] > 0) {
            ctx.beginPath();
            ctx.moveTo(pStart[0], pStart[1]);
            ctx.lineTo(pEnd[0], pEnd[1]);
            ctx.stroke();
          }
        }
        for (let gy = -half; gy <= half; gy += step) {
          const pStart = cam.project([-half, gy, 0]);
          const pEnd = cam.project([half, gy, 0]);
          if (pStart[2] > 0 && pEnd[2] > 0) {
            ctx.beginPath();
            ctx.moveTo(pStart[0], pStart[1]);
            ctx.lineTo(pEnd[0], pEnd[1]);
            ctx.stroke();
          }
        }
      } else {
        for (let gx = -half; gx <= half; gx += step) {
          for (let gy = -half; gy <= half; gy += step) {
            const pt = cam.project([gx, gy, 0]);
            if (pt[2] > 0) {
              if (style === 'cross') {
                ctx.beginPath();
                ctx.moveTo(pt[0] - 5, pt[1]); ctx.lineTo(pt[0] + 5, pt[1]);
                ctx.moveTo(pt[0], pt[1] - 5); ctx.lineTo(pt[0], pt[1] + 5);
                ctx.stroke();
              } else {
                ctx.beginPath();
                ctx.arc(pt[0], pt[1], 1.8, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
      }
      ctx.restore();
    }

    // 2. Norte Arquitectónico Minimalista
    if (state.overlays.north) {
      ctx.save();
      const p0 = cam.project([0, 0, 0]);
      const pN = cam.project([0, 100, 0]);
      const dx = pN[0] - p0[0];
      const dy = pN[1] - p0[1];
      const northAngle = Math.atan2(dy, dx) + Math.PI / 2;

      const nx = width - 44, ny = 48;
      ctx.translate(nx, ny);
      ctx.rotate(northAngle);

      const style = state.overlays.northStyle || 'minimal';
      if (style === 'swiss') {
        // Aguja Suiza Arquitectónica (Dual tone estilizado)
        ctx.beginPath();
        ctx.moveTo(0, -22); ctx.lineTo(5, 8); ctx.lineTo(0, 4); ctx.closePath();
        ctx.fillStyle = txtColor; ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, -22); ctx.lineTo(-5, 8); ctx.lineTo(0, 4); ctx.closePath();
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.strokeStyle = txtColor; ctx.lineWidth = 1; ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-6, 4); ctx.lineTo(6, 4);
        ctx.strokeStyle = txtColor; ctx.lineWidth = 1; ctx.stroke();
      } else if (style === 'circle') {
        // Círculo técnico Bauhaus
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.strokeStyle = txtColor; ctx.lineWidth = 0.9; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -14);
        ctx.strokeStyle = txtColor; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -18); ctx.lineTo(4, -8); ctx.lineTo(-4, -8); ctx.closePath();
        ctx.fillStyle = txtColor; ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fillStyle = txtColor; ctx.fill();
      } else {
        // Minimalista puro de precisión (Hairline needle)
        ctx.beginPath();
        ctx.moveTo(0, -24); ctx.lineTo(0, 14);
        ctx.strokeStyle = txtColor; ctx.lineWidth = 1.4; ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-4, -16); ctx.lineTo(0, -24); ctx.lineTo(4, -16);
        ctx.strokeStyle = txtColor; ctx.lineWidth = 1.4; ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 14, 2, 0, Math.PI * 2);
        ctx.fillStyle = txtColor; ctx.fill();
      }

      ctx.rotate(-northAngle);
      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillStyle = txtColor;
      ctx.textAlign = 'center';
      ctx.fillText('N', 0, 24);
      ctx.restore();
    }

    // 3. Escala Gráfica Arquitectónica
    if (state.overlays.scalebar) {
      ctx.save();
      const sx = 20, sy = height - 24;
      const barLen = 120;
      const realMeters = Math.round((barLen / cam.scale) * 10) / 10;
      const niceMeters = realMeters >= 500 ? Math.round(realMeters / 100) * 100 : Math.round(realMeters / 50) * 50 || 100;
      const actualPixels = niceMeters * cam.scale;
      const scaleStyle = state.overlays.scalebarStyle || 'minimal';

      ctx.fillStyle = txtColor;
      ctx.strokeStyle = txtColor;

      if (scaleStyle === 'classic') {
        const seg = actualPixels / 4;
        const bh = 5;
        for (let i = 0; i < 4; i++) {
          if (i % 2 === 0) {
            ctx.fillStyle = txtColor;
            ctx.fillRect(sx + i * seg, sy - bh, seg, bh);
          } else {
            ctx.strokeRect(sx + i * seg, sy - bh, seg, bh);
          }
        }
        ctx.fillStyle = txtColor;
        ctx.font = '500 10.5px Inter, sans-serif';
        ctx.fillText('0', sx, sy - 8);
        ctx.textAlign = 'right';
        ctx.fillText(`${niceMeters} m`, sx + actualPixels, sy - 8);
        ctx.textAlign = 'left';
      } else if (scaleStyle === 'subdivided') {
        const seg = actualPixels / 4;
        const subSeg = seg / 4;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(sx, sy); ctx.lineTo(sx + actualPixels, sy);
        for (let i = 0; i <= 4; i++) {
          const hTick = i % 2 === 0 ? 5 : 3;
          ctx.moveTo(sx + i * subSeg, sy - hTick); ctx.lineTo(sx + i * subSeg, sy + hTick);
        }
        for (let i = 1; i <= 4; i++) {
          ctx.moveTo(sx + i * seg, sy - 5); ctx.lineTo(sx + i * seg, sy + 5);
        }
        ctx.stroke();
        ctx.font = '500 10.5px Inter, sans-serif';
        ctx.fillText('0', sx, sy - 8);
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(niceMeters / 4)}`, sx + seg, sy - 8);
        ctx.textAlign = 'right';
        ctx.fillText(`${niceMeters} m`, sx + actualPixels, sy - 8);
        ctx.textAlign = 'left';
      } else {
        // Minimalist Swiss hairline
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(sx, sy); ctx.lineTo(sx + actualPixels, sy);
        ctx.moveTo(sx, sy - 4); ctx.lineTo(sx, sy + 4);
        ctx.moveTo(sx + actualPixels, sy - 4); ctx.lineTo(sx + actualPixels, sy + 4);
        ctx.moveTo(sx + actualPixels / 2, sy - 2.5); ctx.lineTo(sx + actualPixels / 2, sy + 2.5);
        ctx.stroke();

        ctx.font = '500 10.5px Inter, sans-serif';
        ctx.fillText('0', sx, sy - 7);
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(niceMeters / 2)}`, sx + actualPixels / 2, sy - 7);
        ctx.textAlign = 'right';
        ctx.fillText(`${niceMeters} m`, sx + actualPixels, sy - 7);
        ctx.textAlign = 'left';
      }
      ctx.restore();
    }

    // 4. Bounding Box Corner Titles for Exploded Tiers (Imagen 4)
    if (state.exploded && state.explodedCornerLabels) {
      ctx.save();
      const half = (model.size || 1000) / 2;
      const dZ = state.explodeOffset || 120;
      const activeTiers = [
        { key: 'contours', z: 0, label: '01 / CONTOURS' },
        { key: 'hydrography', z: dZ * 1, label: '02 / HYDROGRAPHY' },
        { key: 'network', z: dZ * 2, label: '03 / NETWORK' },
        { key: 'buildings', z: dZ * 3, label: '04 / URBAN AREAS (BUILDINGS)' },
        { key: 'green', z: dZ * 4, label: '05 / GREEN AREAS' }
      ].filter((t) => state.explodedTiers[t.key]);

      for (const t of activeTiers) {
        const pt = cam.project([-half, -half, t.z]);
        if (pt[2] > 0) {
          ctx.font = 'bold 11px "JetBrains Mono", monospace';
          const txt = t.label;
          const bw = ctx.measureText(txt).width + 18;
          ctx.fillStyle = 'rgba(10, 11, 16, 0.92)';
          roundRect(ctx, pt[0] - bw - 12, pt[1] - 11, bw, 22, 5);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.50)';
          ctx.lineWidth = 1.1;
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(txt, pt[0] - bw / 2 - 12, pt[1]);
        }
      }
      ctx.restore();
    }
  }

  /* --- Otridovka na Canvas --- */
  function draw(ctx, width, height, dpr = 1) {
    const { items, cam, st } = scene(width, height);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = st.bg;
    ctx.fillRect(0, 0, width, height);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (const it of items) {
      if (it.kind === 'poly') {
        ctx.beginPath();
        it.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath();
        ctx.fillStyle = it.fill;
        ctx.fill();
        if (it.stroke) { ctx.strokeStyle = it.stroke; ctx.lineWidth = it.width; ctx.stroke(); }
      } else if (it.kind === 'line') {
        ctx.beginPath();
        it.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.strokeStyle = it.stroke;
        ctx.lineWidth = it.weight;
        if (it.dash) ctx.setLineDash(it.dash);
        ctx.stroke();
        if (it.dash) ctx.setLineDash([]);
      } else if (it.kind === 'contourLabel') {
        ctx.save();
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(it.text).width + 12;
        ctx.fillStyle = 'rgba(15, 17, 23, 0.88)';
        roundRect(ctx, it.pt[0] - tw / 2, it.pt[1] - 8, tw, 16, 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(it.text, it.pt[0], it.pt[1]);
        ctx.restore();
      } else if (it.kind === 'pinDot') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(it.pt[0], it.pt[1], 4, 0, Math.PI * 2);
        ctx.fillStyle = it.color || '#f97316';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      } else if (it.kind === 'pinBadge') {
        ctx.save();
        const px = it.pt[0], py = it.pt[1];
        if (it.normal) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, py - 26);
          ctx.strokeStyle = it.color || '#f97316';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = it.color;
          ctx.fill();
        }
        const by = it.normal ? py - 38 : py;
        ctx.font = 'bold 11px Inter, sans-serif';
        const txt = it.label || 'Marcador';
        const bw = ctx.measureText(txt).width + 26;
        ctx.fillStyle = 'rgba(12, 13, 17, 0.94)';
        roundRect(ctx, px - bw / 2, by - 11, bw, 22, 6);
        ctx.fill();
        ctx.strokeStyle = it.color || '#f97316';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px - bw / 2 + 10, by, 4, 0, Math.PI * 2);
        ctx.fillStyle = it.color || '#f97316';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, px - bw / 2 + 18, by);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.moveTo(it.trunk[0][0], it.trunk[0][1]);
        ctx.lineTo(it.trunk[1][0], it.trunk[1][1]);
        ctx.strokeStyle = shadeColor(it.fill, 0.75);
        ctx.lineWidth = Math.max(0.6, it.r * 0.18);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
        ctx.fillStyle = it.fill;
        ctx.fill();
        if (st.stroke) { ctx.strokeStyle = st.stroke; ctx.lineWidth = st.width; ctx.stroke(); }
      }
    }

    drawLabels(ctx, cam);
    drawLegend(ctx, width, height);
    drawOverlays(ctx, width, height, cam);
    ctx.restore();
    return cam;
  }

  function labelScreen(cam, l) {
    const p = cam.project(l.world);
    return { anchor: p, text: [p[0] + (l.dx || 48), p[1] + (l.dy || -52)] };
  }

  const LABEL_FONT = '500 12px Inter, sans-serif';
  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const textOn = (hex) => {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return '#ffffff';
    const n = parseInt(hex.slice(1), 16);
    const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.6 ? '#111114' : '#ffffff';
  };

  function labelBox(ctx, l) {
    ctx.font = LABEL_FONT;
    const w = Math.max(20, ctx.measureText(l.text || ' ').width) + 20;
    return { w, h: 26, r: 6 };
  }

  const LEGEND_NAMES = {
    es: { residential: 'Residencial', public: 'Institucional', commercial: 'Comercial', industrial: 'Industrial', utility: 'Infraestructura', other: 'Otros' },
    en: { residential: 'Residential', public: 'Public', commercial: 'Commercial', industrial: 'Industrial', utility: 'Utility', other: 'Other' },
  };

  function legendItems() {
    const counts = model.stats?.classes ?? {};
    const tint = classPalette();
    return Object.keys(tint)
      .filter((c) => counts[c])
      .map((c) => ({ color: tint[c], text: `${LEGEND_NAMES[state.lang]?.[c] ?? c} · ${counts[c]}` }));
  }

  function drawLegend(ctx, width, height) {
    if (!state.legend || !state.byType) return;
    const items = legendItems();
    if (!items.length) return;
    ctx.font = '400 11px Inter, sans-serif';
    ctx.textBaseline = 'middle';
    const w = Math.max(...items.map((i) => ctx.measureText(i.text).width)) + 38;
    const h = items.length * 20 + 16;
    const x = 16, y = height - h - 42;
    const st = palette();
    ctx.fillStyle = st.bg;
    ctx.globalAlpha = 0.94;
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    items.forEach((it, i) => {
      const yy = y + 16 + i * 20;
      ctx.fillStyle = it.color;
      roundRect(ctx, x + 12, yy - 5, 10, 10, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.stroke();
      ctx.fillStyle = '#1d1d1f';
      ctx.fillText(it.text, x + 30, yy);
    });
  }

  function drawLabels(ctx, cam) {
    ctx.font = LABEL_FONT;
    ctx.textBaseline = 'middle';
    for (const l of state.labels) {
      const s = labelScreen(cam, l);
      const color = l.color ?? state.labelColor;
      const { w, h, r } = labelBox(ctx, l);
      const bx = s.text[0] - (l.dx < 0 ? w : 0), by = s.text[1] - h / 2;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(l.dx < 0 ? bx + w : bx, s.text[1]);
      ctx.lineTo(s.anchor[0], s.anchor[1]);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s.anchor[0], s.anchor[1], 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      roundRect(ctx, bx, by, w, h, r);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = textOn(color);
      ctx.textAlign = 'center';
      ctx.fillText(l.text, bx + w / 2, s.text[1]);
      ctx.textAlign = 'left';
    }
  }

  function render() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w <= 0 || h <= 0) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    draw(ctx, w, h, dpr);
  }

  /* --- Detección de Label para arrastre interactivo libre --- */
  function hitLabel(screenX, screenY) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const cam = camera(w, h);
    const ctx = canvas.getContext('2d');
    for (let i = state.labels.length - 1; i >= 0; i--) {
      const l = state.labels[i];
      const s = labelScreen(cam, l);
      const { w: bw, h: bh } = labelBox(ctx, l);
      const bx = s.text[0] - (l.dx < 0 ? bw : 0), by = s.text[1] - bh / 2;
      if (screenX >= bx && screenX <= bx + bw && screenY >= by && screenY <= by + bh) {
        return { label: l, anchor: s.anchor };
      }
    }
    return null;
  }

  /* --- Exportación SVG vectorial para Illustrator --- */
  const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);
  const n1 = (v) => Math.round(v * 10) / 10;

  function toSVG({ width = 2400 } = {}) {
    const ratio = canvas.clientHeight / (canvas.clientWidth || 1);
    const height = Math.round(width * ratio);
    const k = width / (canvas.clientWidth || 1);
    const { items, cam, st } = scene(canvas.clientWidth, canvas.clientHeight);
    const parts = [`<rect width="${width}" height="${height}" fill="${st.bg}"/>`];
    const P = (p) => `${n1(p[0] * k)},${n1(p[1] * k)}`;

    for (const it of items) {
      if (it.kind === 'poly')
        parts.push(`<polygon points="${it.pts.map(P).join(' ')}" fill="${it.fill}"${it.stroke ? ` stroke="${it.stroke}" stroke-width="${n1(it.width * k)}"` : ''}/>`);
      else if (it.kind === 'line')
        parts.push(`<polyline points="${it.pts.map(P).join(' ')}" fill="none" stroke="${it.stroke}" stroke-width="${n1(it.weight * k)}" stroke-linejoin="round" stroke-linecap="round"${it.dash ? ` stroke-dasharray="${it.dash.map((v) => n1(v * k)).join(' ')}"` : ''}/>`);
      else {
        parts.push(`<line x1="${n1(it.trunk[0][0] * k)}" y1="${n1(it.trunk[0][1] * k)}" x2="${n1(it.trunk[1][0] * k)}" y2="${n1(it.trunk[1][1] * k)}" stroke="${shadeColor(it.fill, 0.75)}" stroke-width="${n1(Math.max(0.6, it.r * 0.18) * k)}"/>`);
        parts.push(`<circle cx="${n1(it.x * k)}" cy="${n1(it.y * k)}" r="${n1(it.r * k)}" fill="${it.fill}"${st.stroke ? ` stroke="${st.stroke}" stroke-width="${n1(st.width * k)}"` : ''}/>`);
      }
    }

    const meter = document.createElement('canvas').getContext('2d');
    const labels = state.labels.map((l) => {
      const sc = labelScreen(cam, l);
      const color = l.color ?? state.labelColor;
      meter.font = LABEL_FONT;
      const w = (Math.max(20, meter.measureText(l.text || ' ').width) + 20) * k;
      const h = 26 * k, r = 6 * k;
      const bx = (sc.text[0] - (l.dx < 0 ? w / k : 0)) * k, by = sc.text[1] * k - h / 2;
      const side = l.dx < 0 ? bx + w : bx;
      return `<g><line x1="${n1(side)}" y1="${n1(sc.text[1] * k)}" x2="${n1(sc.anchor[0] * k)}" y2="${n1(sc.anchor[1] * k)}" stroke="${color}" stroke-width="${n1(1.1 * k)}"/>`
        + `<circle cx="${n1(sc.anchor[0] * k)}" cy="${n1(sc.anchor[1] * k)}" r="${n1(3 * k)}" fill="${color}"/>`
        + `<rect x="${n1(bx)}" y="${n1(by)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(r)}" fill="${color}"/>`
        + `<text x="${n1(bx + w / 2)}" y="${n1(sc.text[1] * k)}" font-family="Inter, sans-serif" font-size="${n1(12 * k)}" font-weight="500" text-anchor="middle" dominant-baseline="central" fill="${textOn(color)}">${esc(l.text)}</text></g>`;
    });

    // Norte en SVG
    let northSvg = '';
    if (state.overlays.north) {
      const p0 = cam.project([0, 0, 0]);
      const pN = cam.project([0, 100, 0]);
      const dx = pN[0] - p0[0];
      const dy = pN[1] - p0[1];
      const northAngleDeg = ((Math.atan2(dy, dx) + Math.PI / 2) * 180) / Math.PI;
      const nx = (canvas.clientWidth - 44) * k, ny = 48 * k;
      northSvg = `<g id="NORTH" transform="translate(${n1(nx)}, ${n1(ny)})">`
        + `<g transform="rotate(${n1(northAngleDeg)})">`
        + `<polygon points="0,${n1(-22 * k)} ${n1(7 * k)},${n1(10 * k)} 0,${n1(5 * k)}" fill="#18181b"/>`
        + `<polygon points="0,${n1(-22 * k)} ${n1(-7 * k)},${n1(10 * k)} 0,${n1(5 * k)}" fill="#ffffff" stroke="#18181b" stroke-width="${n1(1 * k)}"/>`
        + `</g><text y="${n1(24 * k)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="${n1(11 * k)}" font-weight="700" fill="#18181b">N</text></g>`;
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Urbanized · Axonometría Arquitectónica · ${model.size}x${model.size}m -->
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<g id="SCENE">${parts.join('')}</g>
${northSvg}
${labels.length ? `<g id="LABELS">${labels.join('')}</g>` : ''}
</svg>`;
    return new Blob([svg], { type: 'image/svg+xml' });
  }

  function toPNG({ width = 3600 } = {}) {
    const ratio = canvas.clientHeight / (canvas.clientWidth || 1);
    const height = Math.round(width * ratio);
    const k = width / (canvas.clientWidth || 1);
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const ctx = off.getContext('2d');
    ctx.scale(k, k);
    draw(ctx, canvas.clientWidth, canvas.clientHeight, 1);
    return new Promise((res) => off.toBlob(res, 'image/png'));
  }

  function pick(x, y) {
    const { items } = scene(canvas.clientWidth, canvas.clientHeight);
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.kind === 'tree') {
        if (Math.hypot(x - it.x, y - it.y) <= it.r) return { depth: it.depth, screen: [it.x, it.y] };
        continue;
      }
      if (it.kind !== 'poly') continue;
      let inside = false;
      const p = it.pts;
      for (let a = 0, b = p.length - 1; a < p.length; b = a++) {
        if (p[a][1] > y !== p[b][1] > y && x < ((p[b][0] - p[a][0]) * (y - p[a][1])) / (p[b][1] - p[a][1]) + p[a][0]) inside = !inside;
      }
      if (inside) return { depth: it.depth, screen: [x, y] };
    }
    return null;
  }

  function unproject(x, y, depth) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const cam = camera(w, h);
    const rad = Math.PI / 180;
    const az = state.az * rad, el = state.el * rad;
    const dir = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
    const f = dir.map((v) => -v);
    const rl = Math.hypot(f[1], -f[0]) || 1;
    const right = [f[1] / rl, -f[0] / rl, 0];
    const up = [right[1] * f[2] - right[2] * f[1], right[2] * f[0] - right[0] * f[2], right[0] * f[1] - right[1] * f[0]];
    const { cx, cy } = cam;
    const scale = cam.scale;
    let vx, vy;
    if (state.perspective) {
      const focal = cam.focal;
      vx = ((x - cx) * depth) / focal;
      vy = ((cy - y) * depth) / focal;
    } else {
      vx = (x - cx) / scale;
      vy = (cy - y) / scale;
    }
    return [0, 1, 2].map((i) => cam.eye[i] + right[i] * vx + up[i] * vy + f[i] * depth);
  }

  const inst = {
    state,
    render,
    setView(name) {
      if (VIEWS[name]) { state.view = name; state.az = VIEWS[name].az; state.el = VIEWS[name].el; }
      render();
    },
    orbit(dx, dy) {
      state.view = 'free';
      state.az = (state.az - dx * 0.4 + 360) % 360;
      state.el = Math.max(2, Math.min(89.9, state.el + dy * 0.3));
      render();
    },
    pan(dx, dy) { state.pan[0] += dx; state.pan[1] += dy; render(); },
    zoomBy(k) { state.zoom = Math.max(0.2, Math.min(12, state.zoom * k)); render(); },
    setPerspective(on) { state.perspective = on; render(); },
    setQuick(on) { state.quick = on; if (!on) render(); },
    setLabelColor(color) { state.labelColor = color; for (const l of state.labels) l.color = color; render(); },
    setByType(on) { state.byType = on; render(); },
    setLegend(on) { state.legend = on; render(); },
    setLang(lang) { state.lang = lang; render(); },
    setSite(ring) { model.site = ring; list = null; render(); },
    setStyle(name) {
      if (STYLES[name]) state.style = name;
      state.colors = {};
      state.classColors = {};
      render();
    },
    setColor(key, value) { state.colors[key] = value; render(); },
    setClassColor(cls, value) { state.classColors[cls] = value; render(); },
    resetColors() { state.colors = {}; state.classColors = {}; render(); },
    colors: () => ({ base: palette(), classes: classPalette() }),
    setLayer(name, on) { state.layers[name] = on; list = null; render(); },
    setSun(az, alt) { state.sunAz = az; state.sunAlt = alt; render(); },
    setLineWidth(w) { state.lineWidth = w; render(); },
    setBaseMaterial(mat) { state.baseMaterial = mat; list = null; render(); },
    setBaseDepth(d) { state.baseDepth = d; list = null; render(); },
    setThematic(layer, on) { state.thematic[layer] = on; list = null; render(); },
    setOverlay(name, val) {
      if (typeof val === 'boolean') state.overlays[name] = val;
      else state.overlays[name] = val;
      render();
    },
    reset() { state.zoom = 1; state.pan = [0, 0]; render(); },
    addLabel(x, y, text) {
      const hit = pick(x, y);
      if (!hit) return null;
      const world = unproject(hit.screen[0], hit.screen[1], hit.depth);
      const l = { world, text, dx: 48, dy: -52, color: state.labelColor };
      state.labels.push(l);
      render();
      return l;
    },
    hitLabel,
    dragLabel(l, dx, dy) {
      l.dx = (l.dx || 0) + dx;
      l.dy = (l.dy || 0) + dy;
      render();
    },
    removeLabel(l) {
      state.labels = state.labels.filter((x) => x !== l);
      render();
    },
    labels: () => state.labels,
    setExploded(on) { state.exploded = Boolean(on); list = null; render(); },
    setExplodeOffset(offset) { state.explodeOffset = Number(offset); list = null; render(); },
    setExplodedTier(tier, on) { state.explodedTiers[tier] = Boolean(on); list = null; render(); },
    setTierColor(tier, color) { state.tierColors[tier] = color; list = null; render(); },
    setContourLabels(on) { state.contourLabels = Boolean(on); list = null; render(); },
    setScaleStyle(st) {
      if (!state.overlays) state.overlays = {};
      state.overlays.scalebarStyle = st;
      render();
    },
    getState() { return structuredClone(state); },
    applyState(cfg) {
      if (cfg) {
        Object.assign(state, cfg);
        list = null;
        render();
      }
    },
    toSVG,
    toPNG,
    invalidate() { list = null; render(); },
  };

  window.getIllustrateState = () => inst.getState();
  window.applyIllustrateConfig = (cfg) => inst.applyState(cfg);
  window.setIllustrateScaleStyle = (st) => inst.setScaleStyle(st);

  pinStore.subscribe(() => {
    list = null;
    render();
  });

  return inst;
}

