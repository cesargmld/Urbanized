import earcut from 'https://cdn.jsdelivr.net/npm/earcut@3.0.1/+esm';
import { pinStore } from './pins.js?v=1.0';

// Urbanized — Axonometría & Maqueta Arquitectónica
// Proyección axonométrica/isométrica/perspectiva con sombreado solar dinámico,
// Hatch Punteado (stipple/dots) real en Canvas y SVG, Axonometría Explotada (Cascada QGIS) con placas traslúcidas,
// base de maqueta (yeso, balsa, estrato geológico), multimapas temáticos, norte técnico CAD y escala gráfica.

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
    hatchMode: 'none',
  },
  // Línea fina técnica de arquitectura con curvas de nivel
  line: {
    bg: '#ffffff', stroke: '#2b2b2d', width: 0.4, contours: true,
    terrain: '#f6f3ea', building: '#f6ece2', water: '#c3ddf0', green: '#dbe9c9', tree: '#a3c98c',
    road: '#ffffff', roadMajor: '#f4f0e5', bridge: '#d9d3c4', contour: '#c6bfad', site: '#b4341f', shade: 0.24,
    hatchMode: 'none',
  },
  // Maqueta monocromática blanca/yeso con sombras volumétricas
  mono: {
    bg: '#ffffff', stroke: '#333333', width: 0.25, contours: false,
    terrain: '#e5e5e5', building: '#ffffff', water: '#cccccc', green: '#e0e0e0', tree: '#bfbfbf',
    road: '#f5f5f5', roadMajor: '#eaeaea', bridge: '#cccccc', contour: '#d4d4d4', site: '#000000', shade: 0.55,
    hatchMode: 'none',
  },
  // Hatch Punteado / Risograph arquitectónico (Stipple real con densidad por sombreado)
  stipple: {
    bg: '#ffffff', stroke: '#1e3a8a', width: 0.4, contours: true,
    terrain: '#f8fafc', building: '#ffffff', water: '#dbeafe', green: '#f0fdf4', tree: '#1e3a8a',
    road: '#ffffff', roadMajor: '#f1f5f9', bridge: '#dbeafe', contour: '#93c5fd', site: '#1e3a8a', shade: 0.45,
    isStipple: true,
    hatchMode: 'dots',
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

// Rampa de alturas (Niveles / Metros)
export const HEIGHT_TIERS = [
  { max: 9, color: '#fde68a', label: '1–2 Niv (<9m)' },
  { max: 18, color: '#fbbf24', label: '3–5 Niv (9–18m)' },
  { max: 36, color: '#f97316', label: '6–10 Niv (18–36m)' },
  { max: 70, color: '#dc2626', label: '11–20 Niv (36–70m)' },
  { max: Infinity, color: '#7f1d1d', label: '+20 Niv (>70m)' },
];

export function heightTierColor(h = 8) {
  for (const t of HEIGHT_TIERS) {
    if (h <= t.max) return t.color;
  }
  return '#7f1d1d';
}

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

const isDarkHex = (hex) => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return false;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.42;
};

// Generador con caché de patrones Canvas para Hatch Punteado (dots), Diagonal (diag) y Cruzado (cross)
const patternCache = new Map();
function getHatchPattern(ctx, mode, inkColor = '#1e3a8a', density = 'medium') {
  if (!mode || mode === 'none') return null;
  const key = `${mode}:${inkColor}:${density}`;
  if (patternCache.has(key)) return patternCache.get(key);

  const off = document.createElement('canvas');
  const octx = off.getContext('2d');

  if (mode === 'dots') {
    const size = density === 'dense' ? 5 : density === 'medium' ? 7 : 9;
    const r = density === 'dense' ? 1.35 : density === 'medium' ? 1.05 : 0.8;
    off.width = size;
    off.height = size;
    octx.fillStyle = inkColor;
    octx.globalAlpha = density === 'dense' ? 0.52 : density === 'medium' ? 0.34 : 0.18;
    octx.beginPath();
    octx.arc(size * 0.25, size * 0.25, r, 0, Math.PI * 2);
    octx.arc(size * 0.75, size * 0.75, r * 0.9, 0, Math.PI * 2);
    octx.fill();
  } else if (mode === 'diag') {
    const size = density === 'dense' ? 6 : 8;
    off.width = size;
    off.height = size;
    octx.strokeStyle = inkColor;
    octx.globalAlpha = density === 'dense' ? 0.45 : 0.28;
    octx.lineWidth = density === 'dense' ? 1.0 : 0.75;
    octx.beginPath();
    octx.moveTo(0, size);
    octx.lineTo(size, 0);
    octx.moveTo(-size * 0.5, size * 0.5);
    octx.lineTo(size * 0.5, -size * 0.5);
    octx.moveTo(size * 0.5, size * 1.5);
    octx.lineTo(size * 1.5, size * 0.5);
    octx.stroke();
  } else if (mode === 'cross') {
    const size = 8;
    off.width = size;
    off.height = size;
    octx.strokeStyle = inkColor;
    octx.globalAlpha = density === 'dense' ? 0.42 : 0.25;
    octx.lineWidth = 0.7;
    octx.beginPath();
    octx.moveTo(0, size);
    octx.lineTo(size, 0);
    octx.moveTo(0, 0);
    octx.lineTo(size, size);
    octx.stroke();
  } else {
    return null;
  }

  const pat = ctx.createPattern(off, 'repeat');
  patternCache.set(key, pat);
  return pat;
}

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
    hatchMode: 'none', // 'none' | 'dots' | 'diag' | 'cross'
    perspective: false,
    az: VIEWS['iso-sw'].az,
    el: VIEWS['iso-sw'].el,
    zoom: 1,
    pan: [0, 0],
    labels: [],
    quick: false,
    labelColor: '#111114',
    byType: false,
    byHeight: false,
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
      northStyle: 'arch_bar_n', // 'arch_cross' | 'arch_bar' | 'arch_bar_n' | 'arch_notch' | 'arch_disc' | 'minimal' | 'swiss' | 'circle'
      scalebar: true,
      scalebarStyle: 'minimal', // 'minimal' | 'classic' | 'subdivided'
      grid: false,
      gridStyle: 'cross', // 'cross' | 'line'
      labels: true,
    },
    stippleInk: '#1e3a8a', // Tinta monocromática para Hatch Punteado (Risograph / Puntos)
    treeStyle: 'branching', // 'minimal' | 'crown_hatch' | 'stipple' | 'branching' | 'detailed'
    heroBuilding: {
      enabled: false,
      id: null,
      color: '#1e3a8a',
      texture: 'solid', // 'solid' | 'travertine' | 'concrete' | 'wood' | 'hatched'
    },
    showLabels: true,
    thematic: {
      isochrones: false,
      flora: false,
      fauna: false,
    },
    colors: {},
    classColors: {},
    layers: { terrain: true, buildings: true, trees: true, roads: true, nature: true, contours: false },
    exploded: false, // Superposición en Cascada / Axonometría Despiezada QGIS
    explodeOffset: 180, // Desplazamiento vertical base entre niveles
    explodedTiers: {
      contours: true,
      hydrography: true,
      water: true,
      network: true,
      roads: true,
      buildings: true,
      green: true
    },
    tierColors: {
      hydrography: '#06b6d4',
      network: '#f8fafc',
      green: '#22c55e',
      buildings: '#ffffff'
    },
    explodedCornerLabels: true,
    explodedGuides: true,
    contourLabels: true,
  };

  let list = null, listKey = '';

  const palette = () => {
    const base = STYLES[state.style] || STYLES.flat;
    const res = {
      ...base,
      ...state.colors,
      width: state.lineWidth ?? base.width,
    };
    if ((state.style === 'stipple' || state.hatchMode === 'dots') && state.stippleInk) {
      res.stroke = state.stippleInk;
      res.tree = state.stippleInk;
      res.site = state.stippleInk;
      res.contour = shadeColor(state.stippleInk, 0.65);
    }
    return res;
  };

  const activeHatchMode = () => {
    if (state.hatchMode && state.hatchMode !== 'none') return state.hatchMode;
    if (state.style === 'stipple') return 'dots';
    return 'none';
  };

  const classPalette = () => {
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

  /* --- Cálculo de vector de luz solar dinámico (Físicamente alineado al Norte) --- */
  function getLightVector() {
    const azRad = (state.sunAz * Math.PI) / 180;
    const altRad = (Math.max(8, state.sunAlt) * Math.PI) / 180;
    const v = [Math.sin(azRad) * Math.cos(altRad), Math.cos(azRad) * Math.cos(altRad), Math.sin(altRad)];
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
  }

  // Normaliza nombres de niveles en cascada (water <-> hydrography, roads <-> network)
  function isTierVisible(tierKey) {
    if (!state.exploded) return true;
    const t = state.explodedTiers || {};
    if (tierKey === 'hydrography' || tierKey === 'water') {
      return t.hydrography !== false && t.water !== false;
    }
    if (tierKey === 'network' || tierKey === 'roads') {
      return t.network !== false && t.roads !== false;
    }
    return t[tierKey] !== false;
  }

  function getExplodeDeltaZ() {
    const size = model.size || 1000;
    const userOffset = Number(state.explodeOffset) || 180;
    // Escala proporcional al tamaño del modelo para evitar empalmes visuales entre losas de 1000x1000m
    return Math.max(110, (size * 0.22) * (userOffset / 160));
  }

  /* --- Geometría en coordenadas del mundo --- */
  function buildList() {
    const key = JSON.stringify([
      state.layers,
      state.style,
      state.hatchMode,
      state.byType,
      state.byHeight,
      state.baseMaterial,
      state.baseDepth,
      state.thematic,
      state.exploded,
      state.explodeOffset,
      state.explodedTiers,
      state.tierColors,
      state.contourLabels,
      state.heroBuilding,
      pinStore.getPins().length,
      model.site?.length ?? 0
    ]);
    if (list && listKey === key) return list;

    const items = [];
    const add = (kind, pts, opts) => items.push({ kind, pts, ...opts });
    const size = model.size || 1000;
    const half = size / 2;

    const isExp = Boolean(state.exploded);
    const dZ = isExp ? getExplodeDeltaZ() : 0;
    const tierOffsets = {
      contours: 0,
      hydrography: isExp ? dZ * 1 : 0,
      network: isExp ? dZ * 2 : 0,
      buildings: isExp ? dZ * 3 : 0,
      green: isExp ? dZ * 4 : 0
    };
    const showTier = (tier) => isTierVisible(tier);

    const st = palette();
    const darkTheme = isDarkHex(st.bg);

    // 0. Placas Arquitectónicas Traslúcidas para Axonometría Explotada (Cascada QGIS)
    const activeTiers = [
      { key: 'contours', z: tierOffsets.contours, label: '01 / TOPOGRAFÍA & CURVAS', accent: '#64748b' },
      { key: 'hydrography', z: tierOffsets.hydrography, label: '02 / HIDROGRAFÍA', accent: '#06b6d4' },
      { key: 'network', z: tierOffsets.network, label: '03 / RED VIAL & INFRAESTRUCTURA', accent: '#f59e0b' },
      { key: 'buildings', z: tierOffsets.buildings, label: '04 / MORFOLOGÍA URBANA', accent: '#3b82f6' },
      { key: 'green', z: tierOffsets.green, label: '05 / CORREDORES VERDES & ARBOLADO', accent: '#22c55e' }
    ].filter((t) => showTier(t.key));

    if (isExp && activeTiers.length > 0) {
      const plateFill = darkTheme ? 'rgba(30, 41, 59, 0.34)' : 'rgba(255, 255, 255, 0.58)';
      const frameColor = darkTheme ? 'rgba(226, 232, 240, 0.72)' : 'rgba(30, 41, 59, 0.62)';
      for (const t of activeTiers) {
        if (t.key === 'contours' && state.layers.terrain) continue; // Tier 0 ya tiene malla de terreno
        const platePts = [
          [-half, -half, t.z - 0.5],
          [half, -half, t.z - 0.5],
          [half, half, t.z - 0.5],
          [-half, half, t.z - 0.5],
        ];
        add('poly', platePts, {
          fillDirect: plateFill,
          flat: true,
          noStroke: true,
          isTierPlate: true,
          order: 0.2,
          bias: -2,
        });
        const framePts = [
          [-half, -half, t.z],
          [half, -half, t.z],
          [half, half, t.z],
          [-half, half, t.z],
          [-half, -half, t.z]
        ];
        add('line', framePts, {
          colorDirect: frameColor,
          weight: 1.35,
          isTierFrame: true,
          tierLabel: t.label,
          tierZ: t.z
        });
      }
      // Marco para Tier 0 (Contours)
      if (showTier('contours')) {
        const z0 = tierOffsets.contours;
        add('line', [
          [-half, -half, z0],
          [half, -half, z0],
          [half, half, z0],
          [-half, half, z0],
          [-half, -half, z0]
        ], {
          colorDirect: frameColor,
          weight: 1.5,
          isTierFrame: true,
          tierLabel: '01 / TOPOGRAFÍA & CURVAS',
          tierZ: z0
        });
      }
    }

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

    // 2. Base de Maqueta / Zócalo / Estrato Geológico (Solo cuando NO está explotado o como base fina en Tier 0)
    if (!isExp && showTier('contours') && state.layers.terrain && model.terrain?.boundary) {
      const t = model.terrain;
      const baseDepthMult = Math.max(0.015, Math.min(0.06, state.baseDepth || 0.02));
      const base = -Math.max(8, size * baseDepthMult);
      const loop = t.boundary;
      const mat = BASE_MATERIALS[state.baseMaterial] || BASE_MATERIALS.plaster;
      const off = tierOffsets.contours;

      if (state.baseMaterial === 'soil') {
        const sub1 = base * 0.25;
        const sub2 = base * 0.65;
        for (let i = 0; i < loop.length; i++) {
          const a = t.verts[loop[i]], b = t.verts[loop[(i + 1) % loop.length]];
          const a1 = [a[0], a[1], sub1 + off], b1 = [b[0], b[1], sub1 + off];
          const a2 = [a[0], a[1], sub2 + off], b2 = [b[0], b[1], sub2 + off];
          const aBase = [a[0], a[1], base + off], bBase = [b[0], b[1], base + off];
          const aTop = [a[0], a[1], a[2] + off], bTop = [b[0], b[1], b[2] + off];

          add('poly', [a1, b1, bTop, aTop], { fillDirect: '#453326', side: true, order: 0 });
          add('poly', [a2, b2, b1, a1], { fillDirect: '#634c38', side: true, order: 0 });
          add('poly', [aBase, bBase, b2, a2], { fillDirect: '#827365', side: true, order: 0 });
        }
        add('line', [...loop.map((i) => [t.verts[i][0], t.verts[i][1], sub1 + off]), [t.verts[loop[0]][0], t.verts[loop[0]][1], sub1 + off]], { colorDirect: '#332419', weight: 0.8, edge: true });
        add('line', [...loop.map((i) => [t.verts[i][0], t.verts[i][1], sub2 + off]), [t.verts[loop[0]][0], t.verts[loop[0]][1], sub2 + off]], { colorDirect: '#423326', weight: 0.8, edge: true });
        add('line', [...loop.map((i) => [t.verts[i][0], t.verts[i][1], base + off]), [t.verts[loop[0]][0], t.verts[loop[0]][1], base + off]], { colorDirect: '#211812', weight: 1.2, edge: true });
        add('line', [...loop.map((i) => [t.verts[i][0], t.verts[i][1], t.verts[i][2] + off]), [t.verts[loop[0]][0], t.verts[loop[0]][1], t.verts[loop[0]][2] + off]], { colorDirect: '#211812', weight: 1.2, edge: true });
      } else {
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

      const flatBottom = [];
      for (const i of loop) flatBottom.push(t.verts[i][0], t.verts[i][1]);
      const bTris = earcut(flatBottom, [], 2);
      for (let ti = 0; ti < bTris.length; ti += 3) {
        add('poly', [
          [t.verts[loop[bTris[ti]]][0], t.verts[loop[bTris[ti]]][1], base + off],
          [t.verts[loop[bTris[ti + 1]]][0], t.verts[loop[bTris[ti + 1]]][1], base + off],
          [t.verts[loop[bTris[ti + 2]]][0], t.verts[loop[bTris[ti + 2]]][1], base + off]
        ], { fillDirect: mat.color, flat: true, noStroke: true, order: -1 });
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
          add('poly', v.map((i) => { const p = w.verts[i]; return [p[0], p[1], (isExp ? 0 : p[2]) + off + 0.4]; }), { color: waterColor, fillDirect: isExp ? waterColor : null, flat: true, noStroke: true, bias: 0.6, order: 1 });
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
          add('area', [ring[tri[i]], ring[tri[i + 1]], ring[tri[i + 2]]].map((p) => [p[0], p[1], (isExp ? 0 : p[2]) + off + 0.2]), {
            color: greenColor,
            fillDirect: isExp ? greenColor : null,
            flat: true,
            noStroke: true,
            isGreen: true,
            bias: 0.5,
            order: 1
          });
        if (state.thematic.flora || isExp) {
          add('line', ring.map(([x, y, z]) => [x, y, (isExp ? 0 : (z || 0)) + off + 0.3]), { colorDirect: '#15803d', weight: 1.5, floraOutline: true });
        }
      }
    }

    // 5. Red Vial (Tier 2: Network en Cascada)
    if (showTier('network') && state.layers.roads) {
      const off = tierOffsets.network;
      const netColor = isExp ? (state.tierColors.network || '#f59e0b') : null;
      const wide = Boolean(model.roadMeshes?.length);
      for (const rm of model.roadMeshes ?? []) {
        const color = isExp ? netColor : (rm.layer === 'ROADS_AREA' ? 'roadMajor' : 'road');
        for (const { v, vis } of rm.faces)
          add('area', v.map((i) => { const p = rm.verts[i]; return [p[0], p[1], (isExp ? 0 : p[2]) + off + 0.1]; }), { color, fillDirect: isExp ? netColor : null, flat: true, edges: vis, bias: 0.55, order: 1 });
      }
      for (const [layer, lines] of Object.entries(model.lines ?? {})) {
        if (layer === 'WATER') continue;
        if (wide && (layer === 'ROADS_MAJOR' || layer === 'ROADS_MINOR' || layer === 'PATHS')) continue;
        const color = isExp ? netColor : (layer === 'ROADS_MAJOR' ? 'roadMajor' : layer === 'BRIDGES' ? 'bridge' : 'road');
        const w = layer === 'ROADS_MAJOR' || layer === 'BRIDGES' ? 2.2 : layer === 'ROADS_MINOR' ? 1.4 : 0.9;
        for (const lineObj of lines) {
          const pts = Array.isArray(lineObj) ? lineObj : (lineObj?.pts || []);
          if (pts.length > 1) {
            add('line', pts.map(([x, y, z]) => [x, y, (isExp ? 0 : (z || 0)) + off]), { color, colorDirect: isExp ? netColor : null, weight: w });
          }
        }
      }
    }

    // 6. Curvas de nivel topográficas (Tier 0: Contours) & Altitude Labels
    if (showTier('contours') && (state.layers.contours || STYLES[state.style]?.contours || isExp)) {
      const off = tierOffsets.contours;
      const ci = model.contourInterval || 5;
      const stepInterval = ci <= 5 ? 20 : (ci * 2);
      for (const c of model.contours ?? []) {
        const pts = c.pts.map(([x, y, z]) => [x, y, z + off + 0.2]);
        add('line', pts, { color: 'contour', weight: 0.75 });
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

    // 7B. Sombras de suelo proyectadas (Directional Ground Cast Shadows)
    if (showTier('buildings') && state.layers.buildings) {
      const light = getLightVector();
      const lx = light[0], ly = light[1], lz = Math.max(0.18, light[2]);
      const off = tierOffsets.buildings;
      const hMode = activeHatchMode();
      const shadowColor = (state.style === 'stipple' || hMode === 'dots')
        ? 'rgba(30, 58, 138, 0.14)'
        : (state.style === 'mono' ? 'rgba(0, 0, 0, 0.16)' : 'rgba(28, 32, 42, 0.15)');

      for (const b of (model.buildings ?? [])) {
        if (!b.verts || b.verts.length < 6) continue;
        const nHalf = Math.floor(b.verts.length / 2);
        const z0 = b.verts[0][2], zTopB = b.verts[nHalf]?.[2] || (z0 + 10);
        const h = Math.min(75, Math.max(3, zTopB - z0));
        const shiftX = -(lx / lz) * h * 0.75;
        const shiftY = -(ly / lz) * h * 0.75;
        const groundZ = (isExp ? 0 : z0) + off + 0.08;

        const baseRing = b.verts.slice(0, nHalf);
        const shadowPts = baseRing.map((v) => [
          Math.max(-half, Math.min(half, v[0] + shiftX)),
          Math.max(-half, Math.min(half, v[1] + shiftY)),
          groundZ
        ]);
        if (shadowPts.length >= 3) {
          const flat = [];
          for (const [sx, sy] of shadowPts) flat.push(sx, sy);
          const tri = earcut(flat, [], 2);
          for (let i = 0; i < tri.length; i += 3) {
            add('poly', [shadowPts[tri[i]], shadowPts[tri[i + 1]], shadowPts[tri[i + 2]]], {
              fillDirect: shadowColor,
              flat: true,
              noStroke: true,
              isShadow: true,
              bias: 0.12,
              order: 1.15
            });
          }
        }
      }
    }

    // 8. Edificios 3D con tipologías, alturas y Edificio Héroe / Proyecto (Tier 3: Urban Areas en Cascada)
    if (showTier('buildings') && state.layers.buildings) {
      const off = tierOffsets.buildings;
      const bColor = isExp ? (state.tierColors.buildings || '#ffffff') : null;
      for (let bi = 0; bi < (model.buildings ?? []).length; bi++) {
        const b = model.buildings[bi];
        const nHalf = Math.floor((b.verts?.length || 0) / 2);
        const zBase = b.verts?.[0]?.[2] ?? 0;
        const zRoof = b.verts?.[nHalf]?.[2] ?? (zBase + 10);
        const bHeight = Math.max(3, zRoof - zBase);

        let cx = 0, cy = 0, cz = 0;
        for (const v of b.verts) {
          cx += v[0];
          cy += v[1];
          cz += (isExp ? (v[2] - zBase) : v[2]);
        }
        const g = [cx / b.verts.length, cy / b.verts.length, cz / b.verts.length + off];

        const isHero = Boolean(state.heroBuilding?.enabled && (
          (state.heroBuilding.id && b.id === state.heroBuilding.id) ||
          (!state.heroBuilding.id && bi === 0) ||
          b.isHero
        ));

        const heroOpts = isHero ? {
          isHero: true,
          heroColor: state.heroBuilding.color || '#1e3a8a',
          heroTexture: state.heroBuilding.texture || 'solid',
        } : {};

        let heightFill = null;
        if (state.byHeight) {
          heightFill = heightTierColor(bHeight);
        }

        for (const f of b.faces) {
          const poly = f.v.map((i) => {
            const p = b.verts[i];
            const zVal = isExp ? (p[2] - zBase) : p[2];
            return [p[0], p[1], zVal + off];
          });
          add('poly', poly, {
            color: 'building',
            fillDirect: isHero
              ? (state.heroBuilding.color || '#1e3a8a')
              : (heightFill || (isExp ? bColor : null)),
            cls: b.cls,
            edges: f.vis,
            isBuilding: true,
            g,
            ...heroOpts
          });
        }
      }
    }

    // 9. Puentes y viaductos (Tier 2: Network)
    if (showTier('network') && state.layers.roads) {
      const off = tierOffsets.network;
      for (const br of model.bridges ?? []) {
        const z0 = br.verts?.[0]?.[2] ?? 0;
        for (const f of br.faces) {
          const poly = f.v.map((i) => {
            const p = br.verts[i];
            return [p[0], p[1], (isExp ? (p[2] - z0) : p[2]) + off];
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
        const zBase = isExp ? 0 : tr.z;
        add('tree', [[tr.x, tr.y, zBase + off], [tr.x, tr.y, zBase + tr.h + off]], { color: treeFill, fillDirect: state.thematic.flora ? treeFill : null, r: tr.r });
      }
    }

    // 11. Guías Verticales en Esquinas para Cascada Explotada
    if (isExp && state.explodedGuides && activeTiers.length > 1) {
      const zMin = activeTiers[0].z;
      const zMax = activeTiers[activeTiers.length - 1].z + 18;
      const guideColor = darkTheme ? 'rgba(226, 232, 240, 0.45)' : 'rgba(15, 23, 42, 0.42)';
      const corners = [[-half, -half], [half, -half], [half, half], [-half, half]];
      for (const [cx, cy] of corners) {
        add('line', [[cx, cy, zMin], [cx, cy, zMax]], {
          colorDirect: guideColor,
          weight: 1.15,
          dash: [6, 5]
        });
      }
    }

    // 12. Hitos / Pines Responsivos
    const pins = pinStore.getPins().filter((p) => p.visible);
    if (isExp && activeTiers.length > 0) {
      const zMin = activeTiers[0].z;
      const zMax = activeTiers[activeTiers.length - 1].z + 28;
      for (const p of pins) {
        add('line', [[p.x, p.y, zMin], [p.x, p.y, zMax + 20]], { colorDirect: p.color, weight: 1.5, dash: [5, 4] });
        for (const t of activeTiers) {
          add('pinDot', [[p.x, p.y, t.z + 1.2]], { colorDirect: p.color });
        }
        add('pinBadge', [[p.x, p.y, zMax + 25]], { label: p.label, color: p.color, type: p.type, style: p.style || 'glass', needleHeight: p.needleHeight || 45 });
      }
    } else if (!isExp) {
      for (const p of pins) {
        add('pinBadge', [[p.x, p.y, p.z || 0]], { label: p.label, color: p.color, type: p.type, normal: true, style: p.style || 'glass', needleHeight: p.needleHeight || 45 });
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
    const isExp = Boolean(state.exploded);
    const dZ = isExp ? getExplodeDeltaZ() : 0;
    const targetZ = isExp ? (dZ * 2.0) : ((model.grid?.maxH ?? 10) * 0.3);
    const target = [0, 0, targetZ];
    const span = model.size || 1000;
    const dist = span * 2.4;
    const eye = [target[0] + dir[0] * dist, target[1] + dir[1] * dist, target[2] + dir[2] * dist];
    const f = dir.map((v) => -v);
    const rx = f[1] * 1 - f[2] * 0, ry = f[2] * 0 - f[0] * 1, rz = 0;
    const rl = Math.hypot(rx, ry, rz) || 1;
    const right = [rx / rl, ry / rl, rz / rl];
    const up = [right[1] * f[2] - right[2] * f[1], right[2] * f[0] - right[0] * f[2], right[0] * f[1] - right[1] * f[0]];
    const h0 = isExp ? -10 : -Math.max(8, span * (state.baseDepth || 0.02));
    const h1 = isExp ? (dZ * 4.35 + 40) : zTop;
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
    const padX = isExp ? 1.28 : 1.12;
    const padY = isExp ? 1.22 : 1.14;
    const fit = Math.min(width / ((x1 - x0) * padX || 1), height / ((y1 - y0) * padY || 1));
    const scale = fit * state.zoom;
    const focal = dist * scale;
    const cx = width / 2 + state.pan[0] - ((x0 + x1) / 2) * scale + (isExp ? width * 0.04 : 0);
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
        if (pt[2] > 0) out.push({ kind: 'pinBadge', pt, label: it.label, color: it.color, type: it.type, normal: it.normal, style: it.style, needleHeight: it.needleHeight, depth: -1e8, order: 4 });
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

        if (quick || it.dash) {
          let depth = 0;
          for (const p of pts) depth = Math.max(depth, p[2]);
          out.push({ kind: 'line', pts, gdepth: depth - 0.5, depth: depth - 0.5, order: 1, stroke, weight, dash: it.dash });
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
      if (it.kind === 'poly' && !it.isTierPlate && facing < 0) continue;

      let area = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        area += p[0] * q[1] - q[0] * p[1];
      }
      if (!it.sub && !it.isTierPlate && Math.abs(area) / 2 < minArea) continue;

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

      // Determinar densidad de Hatch Punteado según orientación solar (techo vs muro iluminado vs muro en sombra)
      let hatchDensity = null;
      const hMode = activeHatchMode();
      if (hMode !== 'none') {
        if (it.isShadow) hatchDensity = 'dense';
        else if (it.isGreen) hatchDensity = 'light';
        else if (it.isBuilding) {
          if (nz > 0.85) hatchDensity = 'light'; // Techo
          else if (lam < 0.35) hatchDensity = 'dense'; // Fachada en sombra
          else hatchDensity = 'medium'; // Fachada lateral
        }
      }

      out.push({
        kind: 'poly',
        pts,
        gdepth,
        depth,
        order: it.order ?? 2,
        fill: (it.flat || it.isTierPlate || it.isShadow) ? baseFill : shadeColor(baseFill, it.side ? 0.88 : k),
        isHero: it.isHero,
        heroColor: it.heroColor,
        heroTexture: it.heroTexture,
        isShadow: it.isShadow,
        isGreen: it.isGreen,
        isBuilding: it.isBuilding,
        hatchDensity,
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

  /* --- Opciones Arquitectónicas: Norte CAD, Escala de Precisión, Retícula y Callouts de Cascada --- */
  function drawOverlays(ctx, width, height, cam) {
    const st = palette();
    const darkBg = isDarkHex(st.bg);
    const txtColor = darkBg ? '#f8fafc' : '#18181b';
    const cardBg = darkBg ? 'rgba(15, 23, 42, 0.86)' : 'rgba(255, 255, 255, 0.90)';
    const cardBorder = darkBg ? 'rgba(255, 255, 255, 0.22)' : 'rgba(15, 23, 42, 0.18)';

    // 1. Retícula Técnica (Grid)
    if (state.overlays.grid) {
      ctx.save();
      const step = 100;
      const span = model.size || 1000;
      const half = span / 2;
      const gridStroke = darkBg ? 'rgba(255, 255, 255, 0.28)' : 'rgba(15, 23, 42, 0.24)';
      const gridFill = darkBg ? 'rgba(255, 255, 255, 0.48)' : 'rgba(15, 23, 42, 0.42)';
      ctx.strokeStyle = gridStroke;
      ctx.fillStyle = gridFill;
      ctx.lineWidth = 0.9;

      const style = state.overlays.gridStyle || 'cross';

      if (style === 'line') {
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
                ctx.moveTo(pt[0] - 4.5, pt[1]); ctx.lineTo(pt[0] + 4.5, pt[1]);
                ctx.moveTo(pt[0], pt[1] - 4.5); ctx.lineTo(pt[0], pt[1] + 4.5);
                ctx.stroke();
              } else {
                ctx.beginPath();
                ctx.arc(pt[0], pt[1], 1.6, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
      }
      ctx.restore();
    }

    // 2. Rosa de los Vientos / Norte Arquitectónico CAD de Alta Precisión
    if (state.overlays.north) {
      ctx.save();
      const p0 = cam.project([0, 0, 0]);
      const pN = cam.project([0, 100, 0]);
      const dx = pN[0] - p0[0];
      const dy = pN[1] - p0[1];
      const northAngle = Math.atan2(dy, dx) + Math.PI / 2;

      const nx = width - 54, ny = 58;

      // Disco base protector de lectura
      ctx.beginPath();
      ctx.arc(nx, ny, 28, 0, Math.PI * 2);
      ctx.fillStyle = cardBg;
      ctx.fill();
      ctx.strokeStyle = cardBorder;
      ctx.lineWidth = 1.0;
      ctx.stroke();

      ctx.translate(nx, ny);
      ctx.rotate(northAngle);

      const style = state.overlays.northStyle || 'arch_bar_n';
      const r = 17;

      // Marcas de graduación CAD cada 30°
      ctx.strokeStyle = txtColor;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 0.75;
      for (let deg = 0; deg < 360; deg += 30) {
        const rad = (deg * Math.PI) / 180;
        const rIn = deg % 90 === 0 ? r - 3.5 : r - 1.8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(rad) * rIn, Math.sin(rad) * rIn);
        ctx.lineTo(Math.cos(rad) * r, Math.sin(rad) * r);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      if (style === 'arch_cross') {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = txtColor; ctx.lineWidth = 1.1; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
        ctx.moveTo(0, 0); ctx.lineTo(0, r);
        ctx.strokeStyle = txtColor; ctx.lineWidth = 0.85; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -r);
        ctx.strokeStyle = txtColor; ctx.lineWidth = 3.0; ctx.lineCap = 'round'; ctx.stroke();
      } else if (style === 'arch_bar') {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = txtColor; ctx.lineWidth = 1.1; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -r);
        ctx.strokeStyle = txtColor; ctx.lineWidth = 3.0; ctx.lineCap = 'round'; ctx.stroke();
      } else if (style === 'arch_bar_n') {
        ctx.beginPath();
        ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
        ctx.strokeStyle = txtColor; ctx.lineWidth = 1.1; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 2); ctx.lineTo(0, -(r - 2));
        ctx.strokeStyle = txtColor; ctx.lineWidth = 2.8; ctx.lineCap = 'round'; ctx.stroke();
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.fillStyle = txtColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', 0, -(r + 5.5));
      } else if (style === 'arch_notch') {
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2 + 0.16, Math.PI * 1.5 - 0.16);
        ctx.lineTo(2.4, -4);
        ctx.lineTo(-2.4, -4);
        ctx.closePath();
        ctx.strokeStyle = txtColor; ctx.lineWidth = 1.15; ctx.stroke();
      } else if (style === 'arch_disc') {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = txtColor; ctx.fill();
        ctx.fillStyle = darkBg ? '#0f172a' : '#ffffff';
        ctx.fillRect(-2.2, -r - 0.5, 4.4, r * 0.78);
      } else if (style === 'swiss') {
        ctx.beginPath();
        ctx.moveTo(0, -r - 2); ctx.lineTo(5.5, 9); ctx.lineTo(0, 4.5); ctx.closePath();
        ctx.fillStyle = txtColor; ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -r - 2); ctx.lineTo(-5.5, 9); ctx.lineTo(0, 4.5); ctx.closePath();
        ctx.fillStyle = darkBg ? '#0f172a' : '#ffffff'; ctx.fill();
        ctx.strokeStyle = txtColor; ctx.lineWidth = 1.0; ctx.stroke();
      } else if (style === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = txtColor; ctx.lineWidth = 1.0; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -r); ctx.lineTo(4.5, -6); ctx.lineTo(-4.5, -6); ctx.closePath();
        ctx.fillStyle = txtColor; ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -r - 2); ctx.lineTo(0, r - 3);
        ctx.strokeStyle = txtColor; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-4.5, -r + 5); ctx.lineTo(0, -r - 2); ctx.lineTo(4.5, -r + 5);
        ctx.strokeStyle = txtColor; ctx.lineWidth = 1.4; ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Escala Gráfica Arquitectónica CAD (con Píldora Protectora y Ratio 1:xxxx)
    if (state.overlays.scalebar) {
      ctx.save();
      const targetBarPx = 130;
      const rawMeters = targetBarPx / Math.max(0.01, cam.scale);
      const niceSteps = [20, 50, 100, 200, 250, 500, 1000];
      let niceMeters = 100;
      for (const s of niceSteps) {
        if (rawMeters <= s * 1.35) { niceMeters = s; break; }
      }
      const actualPixels = Math.max(64, Math.min(220, niceMeters * cam.scale));
      const scaleStyle = state.overlays.scalebarStyle || 'minimal';
      const approxRatio = Math.max(100, Math.round((niceMeters / (actualPixels * 0.000264583)) / 50) * 50);

      const boxX = 18;
      const boxY = height - 56;
      const boxW = actualPixels + 34;
      const boxH = 40;

      roundRect(ctx, boxX, boxY, boxW, boxH, 8);
      ctx.fillStyle = cardBg;
      ctx.fill();
      ctx.strokeStyle = cardBorder;
      ctx.lineWidth = 1.0;
      ctx.stroke();

      const sx = boxX + 16;
      const sy = boxY + 29;

      // Encabezado ESCALA
      ctx.fillStyle = txtColor;
      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 0.72;
      ctx.fillText(`ESC 1:${approxRatio}`, sx, boxY + 13);
      ctx.globalAlpha = 1.0;

      ctx.fillStyle = txtColor;
      ctx.strokeStyle = txtColor;

      if (scaleStyle === 'classic') {
        const seg = actualPixels / 4;
        const bh = 4.5;
        ctx.lineWidth = 1.0;
        for (let i = 0; i < 4; i++) {
          if (i % 2 === 0) {
            ctx.fillStyle = txtColor;
            ctx.fillRect(sx + i * seg, sy - bh, seg, bh);
          } else {
            ctx.fillStyle = darkBg ? '#0f172a' : '#ffffff';
            ctx.fillRect(sx + i * seg, sy - bh, seg, bh);
            ctx.strokeRect(sx + i * seg, sy - bh, seg, bh);
          }
        }
      } else if (scaleStyle === 'subdivided') {
        const seg = actualPixels / 4;
        const subSeg = seg / 4;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(sx, sy); ctx.lineTo(sx + actualPixels, sy);
        for (let i = 0; i <= 4; i++) {
          const hTick = i % 2 === 0 ? 4.5 : 2.5;
          ctx.moveTo(sx + i * subSeg, sy - hTick); ctx.lineTo(sx + i * subSeg, sy + hTick);
        }
        for (let i = 1; i <= 4; i++) {
          ctx.moveTo(sx + i * seg, sy - 4.5); ctx.lineTo(sx + i * seg, sy + 4.5);
        }
        ctx.stroke();
      } else {
        // Minimalist Swiss CAD
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(sx, sy); ctx.lineTo(sx + actualPixels, sy);
        ctx.moveTo(sx, sy - 4.5); ctx.lineTo(sx, sy + 2);
        ctx.moveTo(sx + actualPixels / 2, sy - 3); ctx.lineTo(sx + actualPixels / 2, sy + 1.5);
        ctx.moveTo(sx + actualPixels, sy - 4.5); ctx.lineTo(sx + actualPixels, sy + 2);
        ctx.stroke();
      }

      ctx.fillStyle = txtColor;
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('0', sx, sy - 7);
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(niceMeters / 2)}`, sx + actualPixels / 2, sy - 7);
      ctx.textAlign = 'right';
      ctx.fillText(`${niceMeters}m`, sx + actualPixels, sy - 7);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    // 4. Callouts Técnicos de Capas en Cascada (Exploded Axonometry) con Contraste Adaptativo
    if (state.exploded && state.explodedCornerLabels) {
      ctx.save();
      const half = (model.size || 1000) / 2;
      const dZ = getExplodeDeltaZ();
      const activeTiers = [
        { key: 'contours', z: 0, label: '01 / TOPOGRAFÍA & CURVAS', color: '#64748b' },
        { key: 'hydrography', z: dZ * 1, label: '02 / HIDROGRAFÍA', color: '#06b6d4' },
        { key: 'network', z: dZ * 2, label: '03 / RED VIAL', color: '#f59e0b' },
        { key: 'buildings', z: dZ * 3, label: '04 / MORFOLOGÍA URBANA', color: '#3b82f6' },
        { key: 'green', z: dZ * 4, label: '05 / ÁREAS VERDES & ARBOLADO', color: '#22c55e' }
      ].filter((t) => isTierVisible(t.key));

      if (activeTiers.length > 0) {
        ctx.font = '700 10px "JetBrains Mono", monospace';
        const tierData = activeTiers.map((t) => {
          const corner = cam.project([-half, -half, t.z]);
          const txt = t.label;
          const bw = ctx.measureText(txt).width + 26;
          return { t, corner, txt, bw, y: corner[1] };
        }).filter(d => d.corner[2] > 0);

        tierData.sort((a, b) => a.y - b.y);

        const minGap = 32;
        for (let i = 1; i < tierData.length; i++) {
          if (tierData[i].y < tierData[i - 1].y + minGap) {
            tierData[i].y = tierData[i - 1].y + minGap;
          }
        }
        const maxBottom = height - 68;
        if (tierData.length > 0 && tierData[tierData.length - 1].y > maxBottom) {
          const overflow = tierData[tierData.length - 1].y - maxBottom;
          for (let i = 0; i < tierData.length; i++) tierData[i].y -= overflow;
        }

        const minCornerX = Math.min(...tierData.map(d => d.corner[0]));
        const labelRightX = Math.max(195, Math.min(minCornerX - 28, width * 0.30));
        const leaderStroke = darkBg ? 'rgba(226, 232, 240, 0.72)' : 'rgba(15, 23, 42, 0.65)';

        for (const d of tierData) {
          const { corner, txt, bw, y: badgeY } = d;

          ctx.beginPath();
          ctx.arc(corner[0], corner[1], 3, 0, Math.PI * 2);
          ctx.fillStyle = d.t.color;
          ctx.fill();

          ctx.beginPath();
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = leaderStroke;
          ctx.lineWidth = 1.1;
          ctx.moveTo(corner[0], corner[1]);
          const elbowX = (corner[0] + labelRightX) / 2;
          ctx.lineTo(elbowX, corner[1]);
          ctx.lineTo(elbowX, badgeY);
          ctx.lineTo(labelRightX, badgeY);
          ctx.stroke();
          ctx.setLineDash([]);

          const bx = Math.max(12, labelRightX - bw);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          roundRect(ctx, bx, badgeY - 12, bw, 24, 6);
          ctx.fill();
          ctx.strokeStyle = d.t.color;
          ctx.lineWidth = 1.1;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(bx + 11, badgeY, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = d.t.color;
          ctx.fill();

          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(txt, bx + 20, badgeY);
        }
      }
      ctx.restore();
    }

    // 5. Sello sutil de autoría en lámina (CGM ATELIER)
    ctx.save();
    ctx.font = '500 8.5px "JetBrains Mono", monospace';
    ctx.fillStyle = txtColor;
    ctx.globalAlpha = 0.36;
    ctx.textAlign = 'right';
    ctx.fillText('URBANIZED STUDIO · CGM ATELIER', width - 18, height - 12);
    ctx.restore();
  }

  /* --- Renderizado en Canvas --- */
  function draw(ctx, width, height, dpr = 1) {
    const { items, cam, st } = scene(width, height);
    const hMode = activeHatchMode();
    const hatchInk = state.stippleInk || st.stroke || '#1e3a8a';

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

        // Aplicación de Hatch Punteado (dots), Diagonal (diag) o Cruzado (cross) sobre Edificios, Sombras y Parques
        if (hMode !== 'none' && it.hatchDensity && !it.isHero) {
          const patColor = it.isGreen ? '#15803d' : hatchInk;
          const pat = getHatchPattern(ctx, hMode, patColor, it.hatchDensity);
          if (pat) {
            ctx.fillStyle = pat;
            ctx.fill();
          }
        }

        // Si es Hero Building con textura arquitectónica especial
        if (it.isHero && it.heroTexture && it.heroTexture !== 'solid') {
          ctx.save();
          ctx.beginPath();
          it.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
          ctx.closePath();
          ctx.clip();

          if (it.heroTexture === 'hatched') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.lineWidth = 1.0;
            const xs = it.pts.map((p) => p[0]);
            const ys = it.pts.map((p) => p[1]);
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            const minY = Math.min(...ys), maxY = Math.max(...ys);
            const span = (maxX - minX) + (maxY - minY);
            for (let d = -span; d <= span; d += 7) {
              ctx.beginPath();
              ctx.moveTo(minX + d, minY);
              ctx.lineTo(minX + d + span, minY + span);
              ctx.stroke();
            }
          } else if (it.heroTexture === 'travertine') {
            ctx.fillStyle = 'rgba(255, 248, 235, 0.28)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(160, 120, 85, 0.3)';
            ctx.lineWidth = 0.9;
            const cy = it.pts[0][1];
            for (let i = 0; i < 4; i++) {
              ctx.beginPath();
              ctx.moveTo(it.pts[0][0] - 60, cy + i * 9);
              ctx.bezierCurveTo(it.pts[0][0] - 10, cy + i * 9 + 3, it.pts[0][0] + 20, cy + i * 9 - 3, it.pts[0][0] + 60, cy + i * 9 + 2);
              ctx.stroke();
            }
          } else if (it.heroTexture === 'concrete') {
            ctx.fillStyle = 'rgba(226, 232, 240, 0.22)';
            ctx.fill();
            ctx.fillStyle = 'rgba(51, 65, 85, 0.2)';
            for (let i = 0; i < 12; i++) {
              const rx = it.pts[0][0] + ((i * 19) % 36) - 18;
              const ry = it.pts[0][1] + ((i * 29) % 36) - 18;
              ctx.fillRect(rx, ry, 1.5, 1.5);
            }
          } else if (it.heroTexture === 'wood') {
            ctx.strokeStyle = 'rgba(120, 80, 45, 0.35)';
            ctx.lineWidth = 1.1;
            const ys = it.pts.map((p) => p[1]);
            const minY = Math.min(...ys), maxY = Math.max(...ys);
            const xs = it.pts.map((p) => p[0]);
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            for (let y = minY; y <= maxY; y += 6) {
              ctx.beginPath();
              ctx.moveTo(minX, y);
              ctx.lineTo(maxX, y);
              ctx.stroke();
            }
          }
          ctx.restore();
        }

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
        ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(it.text).width + 12;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        roundRect(ctx, it.pt[0] - tw / 2, it.pt[1] - 8, tw, 16, 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
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
        const needleH = Math.max(10, it.needleHeight || 45);
        const stemLen = (needleH / 45) * 28;
        if (it.normal) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, py - stemLen);
          ctx.strokeStyle = it.color || '#f97316';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = it.color || '#f97316';
          ctx.fill();
        }
        const by = it.normal ? py - stemLen - 12 : py;
        ctx.font = 'bold 11px Inter, sans-serif';
        const txt = it.label || 'Marcador';
        const bw = ctx.measureText(txt).width + 26;
        const pStyle = it.style || 'glass';

        if (pStyle === 'white') {
          ctx.fillStyle = '#ffffff';
          roundRect(ctx, px - bw / 2, by - 11, bw, 22, 6);
          ctx.fill();
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else if (pStyle === 'accent') {
          ctx.fillStyle = it.color || '#0284c7';
          roundRect(ctx, px - bw / 2, by - 11, bw, 22, 6);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else if (pStyle === 'wire') {
          ctx.fillStyle = 'rgba(10, 11, 14, 0.75)';
          roundRect(ctx, px - bw / 2, by - 11, bw, 22, 6);
          ctx.fill();
          ctx.strokeStyle = it.color || '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(12, 13, 17, 0.92)';
          roundRect(ctx, px - bw / 2, by - 11, bw, 22, 6);
          ctx.fill();
          ctx.strokeStyle = it.color || '#f97316';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(px - bw / 2 + 10, by, 4, 0, Math.PI * 2);
        ctx.fillStyle = pStyle === 'accent' ? '#ffffff' : (it.color || '#f97316');
        ctx.fill();

        ctx.fillStyle = pStyle === 'white' ? '#0f172a' : '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, px - bw / 2 + 18, by);
        ctx.restore();
      } else {
        const tStyle = state.treeStyle || 'branching';
        const txtC = st.stroke || st.text || '#18181b';

        if (tStyle === 'branching') {
          ctx.beginPath();
          ctx.moveTo(it.trunk[0][0], it.trunk[0][1]);
          ctx.lineTo(it.trunk[1][0], it.trunk[1][1]);
          ctx.strokeStyle = txtC;
          ctx.lineWidth = Math.max(0.8, it.r * 0.16);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
          ctx.fillStyle = it.fill;
          ctx.globalAlpha = 0.45;
          ctx.fill();
          ctx.globalAlpha = 1.0;

          const midY = (it.trunk[0][1] + it.trunk[1][1]) / 2;
          ctx.beginPath();
          ctx.moveTo(it.trunk[1][0], midY);
          ctx.lineTo(it.trunk[1][0] - it.r * 0.52, midY - it.r * 0.42);
          ctx.moveTo(it.trunk[1][0], midY + it.r * 0.2);
          ctx.lineTo(it.trunk[1][0] + it.r * 0.52, midY - it.r * 0.32);
          ctx.strokeStyle = txtC;
          ctx.lineWidth = Math.max(0.6, it.r * 0.12);
          ctx.stroke();
        } else if (tStyle === 'crown_hatch') {
          ctx.beginPath();
          ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
          ctx.fillStyle = it.fill;
          ctx.globalAlpha = 0.35;
          ctx.fill();
          ctx.globalAlpha = 1.0;
          ctx.strokeStyle = txtC;
          ctx.lineWidth = 0.8;
          ctx.stroke();
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
            ctx.beginPath();
            ctx.moveTo(it.x + Math.cos(a) * it.r * 0.25, it.y + Math.sin(a) * it.r * 0.25);
            ctx.lineTo(it.x + Math.cos(a) * it.r * 0.95, it.y + Math.sin(a) * it.r * 0.95);
            ctx.stroke();
          }
        } else if (tStyle === 'stipple') {
          ctx.beginPath();
          ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
          ctx.fillStyle = it.fill;
          ctx.globalAlpha = 0.25;
          ctx.fill();
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = txtC;
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
            const dotR = it.r * 0.6;
            ctx.beginPath();
            ctx.arc(it.x + Math.cos(angle) * dotR, it.y + Math.sin(angle) * dotR, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(it.x, it.y, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (tStyle === 'detailed') {
          ctx.beginPath();
          ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
          ctx.fillStyle = it.fill;
          ctx.globalAlpha = 0.3;
          ctx.fill();
          ctx.globalAlpha = 1.0;
          ctx.strokeStyle = txtC;
          ctx.lineWidth = 0.9;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(it.x, it.y, it.r * 0.55, 0, Math.PI * 2);
          ctx.lineWidth = 0.6;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(it.x, it.y, 1.6, 0, Math.PI * 2);
          ctx.fillStyle = txtC;
          ctx.fill();
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
    if (state.byHeight) {
      return HEIGHT_TIERS.map((t) => ({ color: t.color, text: t.label }));
    }
    const counts = model.stats?.classes ?? {};
    const tint = classPalette();
    return Object.keys(tint)
      .filter((c) => counts[c])
      .map((c) => ({ color: tint[c], text: `${LEGEND_NAMES[state.lang]?.[c] ?? c} · ${counts[c]}` }));
  }

  function drawLegend(ctx, width, height) {
    if (!state.legend || (!state.byType && !state.byHeight)) return;
    const items = legendItems();
    if (!items.length) return;
    ctx.font = '500 10.5px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    const w = Math.max(...items.map((i) => ctx.measureText(i.text).width)) + 42;
    const h = items.length * 20 + 18;
    const x = 18, y = height - h - 66;
    const st = palette();
    ctx.fillStyle = st.bg;
    ctx.globalAlpha = 0.94;
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    items.forEach((it, i) => {
      const yy = y + 17 + i * 20;
      ctx.fillStyle = it.color;
      roundRect(ctx, x + 12, yy - 5, 11, 11, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.stroke();
      ctx.fillStyle = isDarkHex(st.bg) ? '#f8fafc' : '#1d1d1f';
      ctx.fillText(it.text, x + 30, yy);
    });
  }

  function drawLabels(ctx, cam) {
    if (state.overlays?.labels === false || state.showLabels === false) return;
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

  /* --- Exportación SVG vectorial con soporte para Hatch Punteado (<pattern>) --- */
  const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);
  const n1 = (v) => Math.round(v * 10) / 10;

  function toSVG({ width = 2400 } = {}) {
    const ratio = canvas.clientHeight / (canvas.clientWidth || 1);
    const height = Math.round(width * ratio);
    const k = width / (canvas.clientWidth || 1);
    const { items, cam, st } = scene(canvas.clientWidth, canvas.clientHeight);
    const hMode = activeHatchMode();
    const hatchInk = state.stippleInk || st.stroke || '#1e3a8a';

    const defs = `<defs>
      <pattern id="ax-dots-light" width="${n1(9 * k)}" height="${n1(9 * k)}" patternUnits="userSpaceOnUse">
        <circle cx="${n1(2.2 * k)}" cy="${n1(2.2 * k)}" r="${n1(0.8 * k)}" fill="${hatchInk}" fill-opacity="0.22"/>
        <circle cx="${n1(6.7 * k)}" cy="${n1(6.7 * k)}" r="${n1(0.75 * k)}" fill="${hatchInk}" fill-opacity="0.18"/>
      </pattern>
      <pattern id="ax-dots-medium" width="${n1(7 * k)}" height="${n1(7 * k)}" patternUnits="userSpaceOnUse">
        <circle cx="${n1(1.8 * k)}" cy="${n1(1.8 * k)}" r="${n1(1.05 * k)}" fill="${hatchInk}" fill-opacity="0.36"/>
        <circle cx="${n1(5.2 * k)}" cy="${n1(5.2 * k)}" r="${n1(0.95 * k)}" fill="${hatchInk}" fill-opacity="0.32"/>
      </pattern>
      <pattern id="ax-dots-dense" width="${n1(5 * k)}" height="${n1(5 * k)}" patternUnits="userSpaceOnUse">
        <circle cx="${n1(1.3 * k)}" cy="${n1(1.3 * k)}" r="${n1(1.3 * k)}" fill="${hatchInk}" fill-opacity="0.52"/>
        <circle cx="${n1(3.8 * k)}" cy="${n1(3.8 * k)}" r="${n1(1.2 * k)}" fill="${hatchInk}" fill-opacity="0.48"/>
      </pattern>
      <pattern id="ax-diag" width="${n1(7 * k)}" height="${n1(7 * k)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="${n1(7 * k)}" stroke="${hatchInk}" stroke-width="${n1(0.9 * k)}" stroke-opacity="0.36"/>
      </pattern>
      <pattern id="ax-cross" width="${n1(8 * k)}" height="${n1(8 * k)}" patternUnits="userSpaceOnUse">
        <path d="M 0,0 L ${n1(8 * k)},${n1(8 * k)} M ${n1(8 * k)},0 L 0,${n1(8 * k)}" stroke="${hatchInk}" stroke-width="${n1(0.75 * k)}" stroke-opacity="0.32"/>
      </pattern>
    </defs>`;

    const parts = [defs, `<rect width="${width}" height="${height}" fill="${st.bg}"/>`];
    const P = (p) => `${n1(p[0] * k)},${n1(p[1] * k)}`;

    for (const it of items) {
      if (it.kind === 'poly') {
        const ptsAttr = it.pts.map(P).join(' ');
        parts.push(`<polygon points="${ptsAttr}" fill="${it.fill}"${it.stroke ? ` stroke="${it.stroke}" stroke-width="${n1(it.width * k)}"` : ''}/>`);
        if (hMode !== 'none' && it.hatchDensity && !it.isHero) {
          const patId = hMode === 'dots' ? `ax-dots-${it.hatchDensity}` : hMode === 'diag' ? 'ax-diag' : 'ax-cross';
          parts.push(`<polygon points="${ptsAttr}" fill="url(#${patId})"/>`);
        }
      } else if (it.kind === 'line') {
        parts.push(`<polyline points="${it.pts.map(P).join(' ')}" fill="none" stroke="${it.stroke}" stroke-width="${n1(it.weight * k)}" stroke-linejoin="round" stroke-linecap="round"${it.dash ? ` stroke-dasharray="${it.dash.map((v) => n1(v * k)).join(' ')}"` : ''}/>`);
      } else if (it.kind === 'tree') {
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

    // Norte CAD en SVG
    let northSvg = '';
    if (state.overlays.north) {
      const p0 = cam.project([0, 0, 0]);
      const pN = cam.project([0, 100, 0]);
      const dx = pN[0] - p0[0];
      const dy = pN[1] - p0[1];
      const northAngleDeg = ((Math.atan2(dy, dx) + Math.PI / 2) * 180) / Math.PI;
      const nx = (canvas.clientWidth - 54) * k, ny = 58 * k;
      const r = 17 * k;
      const inner = `<circle cx="0" cy="0" r="${n1(r)}" fill="none" stroke="#18181b" stroke-width="${n1(1.1 * k)}"/>`
        + `<line x1="0" y1="0" x2="0" y2="${n1(-r)}" stroke="#18181b" stroke-width="${n1(2.8 * k)}" stroke-linecap="round"/>`
        + `<text y="${n1(-(r + 5 * k))}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="${n1(10 * k)}" font-weight="700" fill="#18181b">N</text>`;
      northSvg = `<g id="NORTH" transform="translate(${n1(nx)}, ${n1(ny)})">`
        + `<g transform="rotate(${n1(northAngleDeg)})">${inner}</g></g>`;
    }

    const showLabels = (state.overlays?.labels !== false && state.showLabels !== false);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Urbanized · Axonometría Arquitectónica · ${model.size}x${model.size}m -->
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<g id="SCENE">${parts.join('')}</g>
${northSvg}
${(showLabels && labels.length) ? `<g id="LABELS">${labels.join('')}</g>` : ''}
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
    setByType(on) { state.byType = Boolean(on); if (on) state.byHeight = false; list = null; render(); },
    setByHeight(on) { state.byHeight = Boolean(on); if (on) state.byType = false; list = null; render(); },
    setHatchMode(mode) { state.hatchMode = mode || 'none'; list = null; render(); },
    setLegend(on) { state.legend = on; render(); },
    setLang(lang) { state.lang = lang; render(); },
    setSite(ring) { model.site = ring; list = null; render(); },
    setStyle(name) {
      if (STYLES[name]) {
        state.style = name;
        state.hatchMode = STYLES[name].hatchMode || 'none';
      }
      state.colors = {};
      state.classColors = {};
      list = null;
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
      state.overlays[name] = val;
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
    setExplodedTier(tier, on) {
      const val = Boolean(on);
      state.explodedTiers[tier] = val;
      if (tier === 'water' || tier === 'hydrography') {
        state.explodedTiers.water = val;
        state.explodedTiers.hydrography = val;
      }
      if (tier === 'roads' || tier === 'network') {
        state.explodedTiers.roads = val;
        state.explodedTiers.network = val;
      }
      list = null;
      render();
    },
    setTierColor(tier, color) { state.tierColors[tier] = color; list = null; render(); },
    setContourLabels(on) { state.contourLabels = Boolean(on); list = null; render(); },
    setScaleStyle(st) {
      if (!state.overlays) state.overlays = {};
      state.overlays.scalebarStyle = st;
      render();
    },
    setTreeStyle(ts) { state.treeStyle = ts; list = null; render(); },
    setStippleInk(hex) { state.stippleInk = hex; list = null; render(); },
    setHeroBuilding(opts) {
      state.heroBuilding = { ...(state.heroBuilding || {}), ...(opts || {}) };
      list = null;
      render();
    },
    setShowLabels(show) {
      state.showLabels = Boolean(show);
      if (state.overlays) state.overlays.labels = Boolean(show);
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
  window.setIllustrateTreeStyle = (ts) => inst.setTreeStyle(ts);
  window.setIllustrateStippleInk = (hex) => inst.setStippleInk(hex);
  window.setIllustrateHeroBuilding = (opts) => inst.setHeroBuilding(opts);
  window.setIllustrateShowLabels = (show) => inst.setShowLabels(show);
  window.setIllustrateHatchMode = (mode) => inst.setHatchMode(mode);

  pinStore.subscribe(() => {
    list = null;
    render();
  });

  return inst;
}
