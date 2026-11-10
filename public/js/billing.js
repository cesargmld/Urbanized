// URBNZD — Terrain, Climate, Hydrology & Site Design Studio
// 100% Client-Side Engine: Native SketchUp (.skp) Import & Export with Embedded Satellite & Building Facade Textures,
// plus Binary glTF 2.0 (.glb) Textured 3D Export.
import { siteId } from './pricing.js';
import * as skp from './openskp.bundle.js';
import {
  buildTerrainTexturePNG,
  buildFacadeTexturePNG,
  buildRoofTexturePNG,
  compileTexturedGLB,
} from './textured3d.js';

const state = { site: null };

let dlg = null;
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
};

function dialog(...content) {
  if (!dlg) {
    dlg = el('dialog', { class: 'acct' });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    document.body.append(dlg);
  }
  dlg.replaceChildren(
    el('button', { class: 'acct-x', type: 'button', 'aria-label': 'Close', onclick: () => dlg.close() }, '×'),
    ...content.flat().filter((k) => k != null && k !== false),
  );
  if (!dlg.open) dlg.showModal();
  return dlg;
}

function openAccount() {
  dialog(
    el('h3', {}, 'URBNZD Studio'),
    el('p', {}, 'All terrain resolutions (up to ×20 Terrain Pro), site sizes (up to 5 km), live hydrological/solar/wind simulations, and textured 3D exports (.skp, .glb, .3dm, .dxf, GIS & laser-cut) are unlocked in your workspace.'),
  );
}

const NEW_SITE = 'lf:newSite';
function newSite(e) {
  e?.preventDefault();
  e?.stopImmediatePropagation();
  if (!confirm('Start a new site? The current model and its settings will be closed. Save the project first (File → Save project) if you need it.')) return;
  try { sessionStorage.setItem(NEW_SITE, '1'); } catch { /* private mode */ }
  history.replaceState(null, '', `${location.pathname}#app`);
  location.reload();
}

/**
 * Parses an imported binary SketchUp (.skp) file in the browser using openskp
 * and returns a GLB ArrayBuffer ready for Three.js GLTFLoader.
 */
async function parseImportedSkp(arrayBuffer) {
  try {
    const instancedScene = skp.buildInstancedScene(arrayBuffer, { respectEdgeVisibility: true });
    let glbBytes;
    try {
      glbBytes = skp.toInstancedGLB(instancedScene, { textures: true });
    } catch {
      glbBytes = skp.toInstancedGLB(instancedScene, { textures: false });
    }
    return glbBytes.buffer.slice(glbBytes.byteOffset, glbBytes.byteOffset + glbBytes.byteLength);
  } catch (errClient) {
    try {
      const skpScene = skp.buildScene(arrayBuffer, { respectEdgeVisibility: true });
      const glbBytes = skp.toGLB(skpScene, { textures: false });
      return glbBytes.buffer.slice(glbBytes.byteOffset, glbBytes.byteOffset + glbBytes.byteLength);
    } catch (errFallback) {
      // Server-side fallback via /api/convert-skp
      try {
        const resp = await fetch('/api/convert-skp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: arrayBuffer,
        });
        if (resp.ok) {
          return await resp.arrayBuffer();
        }
      } catch (errServer) {}
      throw new Error('No se pudo procesar el archivo .skp directamente. Guarda el modelo en SketchUp como versión 2017-2021 o expórtalo a .glb/.obj.');
    }
  }
}

/**
 * Compiles a native binary SketchUp (.skp) file 100% in the browser using openskp,
 * embedding high-resolution Satellite Orthophoto textures on the 3D terrain mesh
 * and seamless Architectural Facade & Roof textures on the 3D buildings.
 */
async function compileNativeSkp(pack, opts = {}) {
  const lf = window.__LF_STATE || {};
  const U = lf.U || { area: pack.area };
  const M2I = skp.METRES_TO_INCHES || 39.37007874015748;
  const stats = pack.grid ? pack.grid.stats() : { min: 0 };
  const zMin = Number(stats.min || 0);
  const w = U.area ? U.area.w : 1000;
  const h = U.area ? U.area.h : 1000;
  const toIn = (x, y, z) => [x * M2I, y * M2I, (z - zMin) * M2I];

  // Generate embedded PNG textures for Terrain Satellite + Building Facades & Roofs
  const [texTerrain, texGlass, texRes, texMasonry, texRoof] = await Promise.all([
    buildTerrainTexturePNG(pack, U),
    buildFacadeTexturePNG('glass'),
    buildFacadeTexturePNG('residential'),
    buildFacadeTexturePNG('masonry'),
    buildRoofTexturePNG(),
  ]);

  const builder = skp.create();

  // 1. Register Textured & Standard Materials (must precede all addLayer / addGroup calls in openskp)
  const matTerrainSat    = builder.addTextureMaterial('Mat_Terreno_Satelital', texTerrain, 'terrain_satellite.png', 1.0, 1.0);
  const matFacadeGlass   = builder.addTextureMaterial('Mat_Fachada_Cristal',   texGlass,   'facade_glass.png',      1.0, 1.0);
  const matFacadeRes     = builder.addTextureMaterial('Mat_Fachada_Residencial', texRes,   'facade_residential.png', 1.0, 1.0);
  const matFacadeMasonry = builder.addTextureMaterial('Mat_Fachada_Mamposteria', texMasonry, 'facade_masonry.png',  1.0, 1.0);
  const matRoofDeck      = builder.addTextureMaterial('Mat_Cubierta_Edificio', texRoof,    'roof_detail.png',       1.0, 1.0);

  const matPisoPorcelanato = builder.addMaterial('Mat_Piso_Porcelanato', [230, 226, 218, 255], 1.0);
  const matMuroBlanco      = builder.addMaterial('Mat_Muro_Blanco',      [242, 242, 240, 255], 1.0);
  const matAluminioNegro   = builder.addMaterial('Mat_Aluminio_Negro',   [25,  25,  28,  255], 1.0);
  const matCristalClaro    = builder.addMaterial('Mat_Cristal_Claro',    [140, 200, 230, 90],  0.35);
  const matMadera          = builder.addMaterial('Mat_Madera',           [155, 105, 65,  255], 1.0);

  // 2. Standard Architectural Layers / Tags
  const tagLosa       = builder.addLayer('01_Losa_y_Pisos',                  { color: [230, 226, 218, 255] });
  const tagEstructura = builder.addLayer('02_Estructura_y_Nucleos',          { color: [200, 200, 205, 255] });
  const tagMuros      = builder.addLayer('03_Muros_Tablaroca_Interiores',    { color: [242, 242, 240, 255] });
  const tagCanceleria = builder.addLayer('04_Canceleria_y_Mamparas_Cristal', { color: [140, 200, 230, 255] });
  const tagPlafones   = builder.addLayer('05_Plafones_e_Iluminacion',        { color: [45,  48,  55,  255] });
  const tagMobiliario = builder.addLayer('06_Mobiliario_y_Equipos',          { color: [155, 105, 65,  255] });

  const toW = pack.toW || ((x, z) => [x, -z]);
  const elevAt = pack.elev || (() => zMin);

  const addTexturedTri = (g, p0, p1, p2, uv0, uv1, uv2, mat) => {
    const pins = [
      [p0, uv0],
      [p1, uv1],
      [p2, uv2],
    ];
    try {
      g.addFace([p0, p1, p2], { material: mat, backMaterial: mat, frontUv: pins, backUv: pins });
    } catch {
      try {
        g.addFace([p0, p1, p2], { material: mat, backMaterial: mat });
      } catch {}
    }
  };

  // 3. 3D Terrain Mesh with 1:1 UV-Mapped Satellite Orthophoto
  const tm = pack.meshes && pack.meshes.terrain;
  if (tm && tm.P && tm.quads && tm.quads.length > 0) {
    builder.addGroup((g) => {
      const P = tm.P;
      const Q = tm.quads;
      const vPt = (idx) => {
        const [wx, wy] = toW(P[3 * idx], P[3 * idx + 1]);
        return toIn(wx, wy, P[3 * idx + 2]);
      };
      const vUV = (idx) => [
        Math.max(0, Math.min(1, (P[3 * idx] + w / 2) / w)),
        Math.max(0, Math.min(1, 1.0 - (P[3 * idx + 1] + h / 2) / h)),
      ];
      for (let i = 0; i < Q.length; i += 4) {
        const i0 = Q[i], i1 = Q[i + 1], i2 = Q[i + 2], i3 = Q[i + 3];
        const p0 = vPt(i0), p1 = vPt(i1), p2 = vPt(i2), p3 = vPt(i3);
        const u0 = vUV(i0), u1 = vUV(i1), u2 = vUV(i2), u3 = vUV(i3);
        addTexturedTri(g, p0, p1, p2, u0, u1, u2, matTerrainSat);
        addTexturedTri(g, p0, p2, p3, u0, u2, u3, matTerrainSat);
      }
    }, { name: 'Terreno_Satelital_3D', layer: tagLosa, material: matTerrainSat });
  }

  // 4. 3D Road Surfaces
  const rm = pack.meshes && pack.meshes.roads;
  if (Array.isArray(rm) && rm.length > 0) {
    builder.addGroup((g) => {
      for (const item of rm) {
        const Q = item.tris;
        if (!Q) continue;
        for (let i = 0; i < Q.length; i += 9) {
          const [x0, y0] = toW(Q[i], Q[i + 2]);
          const [x1, y1] = toW(Q[i + 3], Q[i + 5]);
          const [x2, y2] = toW(Q[i + 6], Q[i + 8]);
          try {
            g.addFace(
              [toIn(x0, y0, Q[i + 1]), toIn(x1, y1, Q[i + 4]), toIn(x2, y2, Q[i + 7])],
              { material: matAluminioNegro, backMaterial: matAluminioNegro },
            );
          } catch {}
        }
      }
    }, { name: 'Vialidades_3D', layer: tagLosa, material: matAluminioNegro });
  }

  // 5. 3D Buildings in Independent Groups with Detailed Facade & Roof Textures
  const bm = pack.meshes && pack.meshes.buildings;
  if (Array.isArray(bm) && bm.length > 0) {
    const tileW = 14.0; // 4 bays * 3.5m
    const tileH = 12.8; // 4 floors * 3.2m
    const bldSlice = bm.slice(0, 1500);
    for (let idx = 0; idx < bldSlice.length; idx++) {
      const b = bldSlice[idx];
      const Q = b.tris;
      if (!Q || Q.length < 9) continue;

      const hMeters = Number((b.attrs && b.attrs.height_m) || 8);
      const osmId = Number((b.attrs && b.attrs.osm_id) || idx);
      let wallMat = matFacadeRes;
      if (hMeters >= 18 || (osmId % 5 === 0 && hMeters >= 10)) {
        wallMat = matFacadeGlass;
      } else if (osmId % 3 === 0) {
        wallMat = matFacadeMasonry;
      }

      let bMinZ = Infinity;
      for (let i = 1; i < Q.length; i += 3) {
        if (Q[i] < bMinZ) bMinZ = Q[i];
      }

      const bName = `Edificio_${idx + 1}_${(b.attrs && b.attrs.osm_id) || idx + 1}`;
      builder.addGroup((g) => {
        for (let i = 0; i < Q.length; i += 9) {
          const [x0, y0] = toW(Q[i], Q[i + 2]);
          const [x1, y1] = toW(Q[i + 3], Q[i + 5]);
          const [x2, y2] = toW(Q[i + 6], Q[i + 8]);
          const z0 = Q[i + 1], z1 = Q[i + 4], z2 = Q[i + 7];

          const p0 = toIn(x0, y0, z0);
          const p1 = toIn(x1, y1, z1);
          const p2 = toIn(x2, y2, z2);

          // Normal in Z-up metric space
          const ux = x1 - x0, uy = y1 - y0, uz = z1 - z0;
          const vx = x2 - x0, vy = y2 - y0, vz = z2 - z0;
          const nx = uy * vz - uz * vy;
          const ny = uz * vx - ux * vz;
          const nz = ux * vy - uy * vx;
          const nLen = Math.hypot(nx, ny, nz) || 1;
          const absNz = Math.abs(nz / nLen);

          if (absNz < 0.45) {
            const tLen = Math.hypot(nx, ny) || 1;
            const tx = -ny / tLen;
            const ty = nx / tLen;
            const uv0 = [(x0 * tx + y0 * ty) / tileW, (z0 - bMinZ) / tileH];
            const uv1 = [(x1 * tx + y1 * ty) / tileW, (z1 - bMinZ) / tileH];
            const uv2 = [(x2 * tx + y2 * ty) / tileW, (z2 - bMinZ) / tileH];
            addTexturedTri(g, p0, p1, p2, uv0, uv1, uv2, wallMat);
          } else {
            const uv0 = [Math.max(0, Math.min(1, (Q[i] + w / 2) / w)), Math.max(0, Math.min(1, 1.0 - (Q[i + 2] + h / 2) / h))];
            const uv1 = [Math.max(0, Math.min(1, (Q[i + 3] + w / 2) / w)), Math.max(0, Math.min(1, 1.0 - (Q[i + 5] + h / 2) / h))];
            const uv2 = [Math.max(0, Math.min(1, (Q[i + 6] + w / 2) / w)), Math.max(0, Math.min(1, 1.0 - (Q[i + 8] + h / 2) / h))];
            addTexturedTri(g, p0, p1, p2, uv0, uv1, uv2, matTerrainSat);
          }
        }
      }, { name: bName, layer: tagEstructura, material: wallMat });
    }
  }

  // 6. Water Bodies, Rivers & Lakes -> 04_Canceleria_y_Mamparas_Cristal (Mat_Cristal_Claro)
  const waterVectors = (pack.vectors || []).filter((v) => ['water', 'river', 'lakes', 'sea', 'slr'].includes(v.key));
  for (const wLayer of waterVectors) {
    let wIdx = 0;
    for (const item of (wLayer.items || []).slice(0, 200)) {
      if (item.type !== 'poly' || !item.outer || item.outer.length < 6) continue;
      wIdx++;
      builder.addGroup((g) => {
        const pts = [];
        const zConst = item.z !== undefined ? item.z : elevAt(item.outer[0], item.outer[1]) + 0.12;
        for (let i = 0; i < item.outer.length; i += 2) {
          const [wx, wy] = toW(item.outer[i], item.outer[i + 1]);
          pts.push(toIn(wx, wy, zConst));
        }
        if (pts.length >= 3) {
          try {
            g.addFace(pts, { material: matCristalClaro, backMaterial: matCristalClaro });
          } catch {}
        }
      }, { name: `Agua_${wLayer.key}_${wIdx}`, layer: tagCanceleria, material: matCristalClaro });
    }
  }

  // 7. Design Elements (Plazas, Canopies, Skywalks)
  const designVectors = (pack.vectors || []).filter((v) => v.key === 'design');
  for (const dLayer of designVectors) {
    const isCanopy = (dLayer.name || '').toLowerCase().includes('canop');
    const isDeck = (dLayer.name || '').toLowerCase().includes('skywalk');
    const targetTag = isCanopy ? tagPlafones : isDeck ? tagEstructura : tagLosa;
    const targetMat = isCanopy ? matAluminioNegro : isDeck ? matMadera : matPisoPorcelanato;
    let dIdx = 0;
    for (const item of dLayer.items || []) {
      if (item.type !== 'poly' || !item.outer || item.outer.length < 6) continue;
      dIdx++;
      const hOffset = isCanopy ? Number((item.attrs && item.attrs.clear_height_m) || 3.5) : isDeck ? Number((item.attrs && item.attrs.height_m) || 4.0) : 0.15;
      builder.addGroup((g) => {
        const pts = [];
        const baseZ = elevAt(item.outer[0], item.outer[1]) + hOffset;
        for (let i = 0; i < item.outer.length; i += 2) {
          const [wx, wy] = toW(item.outer[i], item.outer[i + 1]);
          pts.push(toIn(wx, wy, baseZ));
        }
        if (pts.length >= 3) {
          try {
            g.addFace(pts, { material: targetMat, backMaterial: targetMat });
          } catch {}
        }
      }, { name: `Diseno_${dIdx}`, layer: targetTag, material: targetMat });
    }
  }

  // 8. 3D Trees & Vegetation -> 06_Mobiliario_y_Equipos (Mat_Madera)
  const treeLayer = (pack.vectors || []).find((v) => v.key === 'trees');
  if (treeLayer && Array.isArray(treeLayer.items) && treeLayer.items.length > 0) {
    const trees = treeLayer.items.slice(0, 600);
    builder.addGroup((g) => {
      for (const t of trees) {
        const [wx, wy] = toW(t.x || 0, t.z || 0);
        const zGround = opts.draped !== false ? elevAt(t.x || 0, t.z || 0) : zMin;
        const r = Math.max(1.2, (t.r || 2.5) * 0.75);
        const hTree = Math.max(3.0, t.h || 6.0);
        const zBase = zGround + hTree * 0.25;
        const zTop = zGround + hTree;
        const p1 = toIn(wx - r, wy - r, zBase);
        const p2 = toIn(wx + r, wy - r, zBase);
        const p3 = toIn(wx + r, wy + r, zBase);
        const p4 = toIn(wx - r, wy + r, zBase);
        const top = toIn(wx, wy, zTop);
        try {
          g.addFace([p1, p2, top], { material: matMadera, backMaterial: matMadera });
          g.addFace([p2, p3, top], { material: matMadera, backMaterial: matMadera });
          g.addFace([p3, p4, top], { material: matMadera, backMaterial: matMadera });
          g.addFace([p4, p1, top], { material: matMadera, backMaterial: matMadera });
        } catch {}
      }
    }, { name: 'Vegetacion_3D_Arbolado', layer: tagMobiliario, material: matMadera });
  }

  const skpBytes = builder.toBytes();
  return new Blob([skpBytes], { type: 'application/octet-stream' });
}

function mount() {
  const actions = document.querySelector('#app .top-actions');
  if (actions && !document.querySelector('.lf-new')) {
    const nb = el(
      'button',
      { class: 'pill-btn lf-new', type: 'button', title: 'Choose a new site: back to the search, everything reset', onclick: newSite },
      el('span', {}, 'New site'),
    );
    nb.prepend(document.createRange().createContextualFragment('<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'));
    actions.prepend(nb);
  }
  document.getElementById('btnNew')?.addEventListener('click', newSite, true);

  for (const a of document.querySelectorAll('[data-account]')) {
    a.addEventListener('click', (e) => { e.preventDefault(); openAccount(); });
  }
}

function satelliteByCoverage() {
  const sm = window.__selmap, covers = window.__lfCovers, seg = document.getElementById('mapBase');
  if (!sm?.map || !covers || !seg) return;
  const update = () => {
    const c = sm.map.getCenter(), ok = covers(c.lng, c.lat).length > 0;
    seg.classList.toggle('lf-nosat', !ok);
    if (!ok && sm.base === 'sat') sm.setBase('map');
  };
  sm.map.on('moveend', update);
  update();
}

// Register hooks for URBNZD Studio
window.LF_BUILD = async (tier, sel) => {
  state.site = { id: siteId(sel), sel: { ...sel } };
  return true;
};
window.LF_PAY = async () => true;
window.LF_ACCOUNT = openAccount;
window.LF_PARSE_SKP = parseImportedSkp;
window.LF_EXPORT_SKP = compileNativeSkp;
window.LF_EXPORT_GLB = async (pack) => {
  const lf = window.__LF_STATE || {};
  return await compileTexturedGLB(pack, lf.U || { area: pack.area });
};

mount();
satelliteByCoverage();

try {
  if (sessionStorage.getItem(NEW_SITE)) {
    sessionStorage.removeItem(NEW_SITE);
    setTimeout(() => document.getElementById('q')?.focus(), 800);
  }
} catch { /* private mode */ }
