// Экспорт модели: AutoCAD (DXF R12), SketchUp 8+ (COLLADA), Rhino 5+ (3DM), Illustrator (SVG), ArchiCAD (IFC).
// Все координаты — метры, начало в центре участка, Z — вверх, ноль — самая низкая точка рельефа.
import { LAYERS, triangulate, UNIT_TREE, treeBody, mergeBodies, BUILDING_CLASSES } from './data.js?v=e9ed68a96e';
import { imageryBlob } from './satellite.js?v=e9ed68a96e';

const TOOL = 'Urbanized';
const f = (v) => (Math.round(v * 1000) / 1000).toString();

// Цвета слоёв: индекс цвета AutoCAD (ACI) и RGB для Rhino, SketchUp и чертежа.
const STYLE = {
  [LAYERS.BUILDINGS]: { aci: 7, rgb: '#3a3a3c' },
  [LAYERS.TERRAIN]: { aci: 9, rgb: '#d9d6cf' },
  [LAYERS.ROADS_MAJOR]: { aci: 30, rgb: '#e8912d' },
  [LAYERS.ROADS_MINOR]: { aci: 8, rgb: '#8e8e93' },
  [LAYERS.PATHS]: { aci: 42, rgb: '#c2a27a' },
  [LAYERS.RAILWAYS]: { aci: 250, rgb: '#55555a' },
  [LAYERS.WATER]: { aci: 150, rgb: '#4a90d9' },
  [LAYERS.GREEN]: { aci: 82, rgb: '#8cc26b' },
  [LAYERS.CONTOURS]: { aci: 34, rgb: '#b88a5a' },
  [LAYERS.BRIDGES]: { aci: 7, rgb: '#6b6b70' },
  [LAYERS.ROADS_AREA]: { aci: 253, rgb: '#b9b9bd' },
  [LAYERS.PATHS_AREA]: { aci: 41, rgb: '#e2d6c2' },
  [LAYERS.TREES]: { aci: 94, rgb: '#4f9a3c' },
  [LAYERS.SITE]: { aci: 1, rgb: '#c0392b' },
};
// подслои по типам зданий: аккуратные приглушённые цвета
export const CLASS_COLORS = {
  residential: '#d8cfbd',
  public: '#b9c7cf',
  commercial: '#d9c3a5',
  industrial: '#c2bdb6',
  utility: '#cfcdc6',
  other: '#c9c7c2',
};
const CLASS_ACI = { residential: 43, public: 151, commercial: 42, industrial: 8, utility: 9, other: 7 };
export const buildingLayer = (cls) => `BUILDINGS_${(cls ?? 'other').toUpperCase()}`;
for (const cls of BUILDING_CLASSES) STYLE[buildingLayer(cls)] = { aci: CLASS_ACI[cls], rgb: CLASS_COLORS[cls] };

const rgb01 = (hex) => [1, 3, 5].map((i) => Math.round((parseInt(hex.slice(i, i + 2), 16) / 255) * 1000) / 1000);

function linesOf(model) {
  const out = Object.entries(model.lines).map(([layer, lines]) => ({ layer, items: lines.map((pts) => ({ pts, closed: false })) }));
  for (const [layer, rings] of Object.entries(model.areas)) out.push({ layer, items: rings.map((pts) => ({ pts, closed: true })) });
  for (const { layer, polys } of model.roadAreas ?? []) out.push({ layer, items: polys.flatMap((rings) => rings.map((pts) => ({ pts, closed: true }))) });
  if (model.contours.length) out.push({ layer: LAYERS.CONTOURS, items: model.contours.map((c) => ({ pts: c.pts, closed: c.closed })) });
  if (model.site?.length > 2) out.push({ layer: LAYERS.SITE, items: [{ pts: model.site, closed: true }] });
  return out;
}

/* ---------------- DXF (AutoCAD R12, читается всеми версиями AutoCAD) ---------------- */

export function toDXF(model) {
  const o = [];
  const w = (code, value) => o.push(code, value);
  const layers = Object.keys(STYLE);
  const h = model.frame.half;

  w(0, 'SECTION'); w(2, 'HEADER');
  w(9, '$ACADVER'); w(1, 'AC1009');
  w(9, '$INSBASE'); w(10, 0); w(20, 0); w(30, 0);
  w(9, '$EXTMIN'); w(10, f(-h)); w(20, f(-h)); w(30, 0);
  w(9, '$EXTMAX'); w(10, f(h)); w(20, f(h)); w(30, f(model.grid.maxH + 200));
  w(0, 'ENDSEC');

  w(0, 'SECTION'); w(2, 'TABLES');
  w(0, 'TABLE'); w(2, 'LTYPE'); w(70, 1);
  w(0, 'LTYPE'); w(2, 'CONTINUOUS'); w(70, 0); w(3, 'Solid line'); w(72, 65); w(73, 0); w(40, 0);
  w(0, 'ENDTAB');
  w(0, 'TABLE'); w(2, 'LAYER'); w(70, layers.length + 1);
  w(0, 'LAYER'); w(2, '0'); w(70, 0); w(62, 7); w(6, 'CONTINUOUS');
  for (const l of layers) { w(0, 'LAYER'); w(2, l); w(70, 0); w(62, STYLE[l].aci); w(6, 'CONTINUOUS'); }
  w(0, 'ENDTAB');
  w(0, 'ENDSEC');

  // Дерево — блок TREE (крона радиусом 1, высота 1), вставки масштабируются по дереву.
  const blockAt = o.length;
  w(0, 'SECTION'); w(2, 'ENTITIES');
  // Полигональная сетка (POLYFACE): одно тело — один объект, диагонали скрыты.
  const polyface = (layer, { verts, faces }) => {
    w(0, 'POLYLINE'); w(8, layer); w(66, 1); w(10, 0); w(20, 0); w(30, 0); w(70, 64); w(71, verts.length); w(72, faces.length);
    for (const [x, y, z] of verts) { w(0, 'VERTEX'); w(8, layer); w(10, f(x)); w(20, f(y)); w(30, f(z)); w(70, 192); }
    for (const { v, vis } of faces) {
      w(0, 'VERTEX'); w(8, layer); w(10, 0); w(20, 0); w(30, 0); w(70, 128);
      v.forEach((idx, k) => w(71 + k, vis[k] ? idx + 1 : -(idx + 1)));
    }
    w(0, 'SEQEND'); w(8, layer);
  };
  const polyline = (layer, pts, closed) => {
    w(0, 'POLYLINE'); w(8, layer); w(66, 1); w(10, 0); w(20, 0); w(30, 0); w(70, closed ? 9 : 8);
    for (const [x, y, z] of pts) { w(0, 'VERTEX'); w(8, layer); w(10, f(x)); w(20, f(y)); w(30, f(z)); w(70, 32); }
    w(0, 'SEQEND'); w(8, layer);
  };

  if (model.terrain) polyface(LAYERS.TERRAIN, model.terrain);
  for (const w of model.water ?? []) polyface(LAYERS.WATER, w);
  for (const br of model.bridges ?? []) polyface(LAYERS.BRIDGES, br);
  for (const rm of model.roadMeshes ?? []) polyface(rm.layer, rm);
  for (const b of model.buildings) polyface(buildingLayer(b.cls), b);
  for (const t of model.trees) {
    w(0, 'INSERT'); w(8, LAYERS.TREES); w(2, 'TREE');
    w(10, f(t.x)); w(20, f(t.y)); w(30, f(t.z)); w(41, f(t.r)); w(42, f(t.r)); w(43, f(t.h));
  }
  for (const { layer, items } of linesOf(model)) for (const it of items) polyline(layer, it.pts, it.closed);
  w(0, 'ENDSEC');
  w(0, 'EOF');
  if (model.trees.length) {
    const main = o.splice(blockAt);
    w(0, 'SECTION'); w(2, 'BLOCKS');
    w(0, 'BLOCK'); w(8, '0'); w(2, 'TREE'); w(70, 0); w(10, 0); w(20, 0); w(30, 0); w(3, 'TREE');
    polyface('0', UNIT_TREE);
    w(0, 'ENDBLK'); w(8, '0');
    w(0, 'ENDSEC');
    for (const x of main) o.push(x);
  }

  let s = '';
  for (let i = 0; i < o.length; i += 2) s += `${String(o[i]).padStart(3)}\r\n${o[i + 1]}\r\n`;
  return new Blob([s], { type: 'application/dxf' });
}

/* ---------------- COLLADA (SketchUp 8+: Файл → Импорт → .dae) ---------------- */

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

export function toDAE(model) {
  const geos = [], nodes = [];
  const mats = {
    white: [1, 1, 1], ground: [0.86, 0.85, 0.82], road: rgb01(STYLE[LAYERS.ROADS_AREA].rgb), path: rgb01(STYLE[LAYERS.PATHS_AREA].rgb), line: [0.2, 0.2, 0.2], tree: rgb01(STYLE[LAYERS.TREES].rgb), water: rgb01(STYLE[LAYERS.WATER].rgb),
    ...Object.fromEntries(BUILDING_CLASSES.map((c) => [`cls-${c}`, rgb01(CLASS_COLORS[c])])),
  };
  let gid = 0, treeLib = '';
  const meshGeo = (name, { verts, faces }, mat) => {
    const id = `g${gid++}`;
    const pos = verts.map((p) => p.map(f).join(' ')).join(' ');
    const tri = triangulate(faces);
    geos.push(
      `<geometry id="${id}" name="${esc(name)}"><mesh>` +
      `<source id="${id}-p"><float_array id="${id}-a" count="${verts.length * 3}">${pos}</float_array>` +
      `<technique_common><accessor source="#${id}-a" count="${verts.length}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>` +
      `<vertices id="${id}-v"><input semantic="POSITION" source="#${id}-p"/></vertices>` +
      `<triangles material="m" count="${tri.length / 3}"><input semantic="VERTEX" source="#${id}-v" offset="0"/><p>${tri.join(' ')}</p></triangles>` +
      `</mesh></geometry>`,
    );
    return `<node id="n${id}" name="${esc(name)}"><instance_geometry url="#${id}"><bind_material><technique_common><instance_material symbol="m" target="#${mat}"/></technique_common></bind_material></instance_geometry></node>`;
  };
  const lineGeo = (name, items) => {
    const id = `g${gid++}`;
    const pts = [], idx = [];
    for (const { pts: p, closed } of items) {
      const base = pts.length;
      p.forEach((q) => pts.push(q));
      for (let i = 0; i < p.length - 1; i++) idx.push(base + i, base + i + 1);
      if (closed) idx.push(base + p.length - 1, base);
    }
    geos.push(
      `<geometry id="${id}" name="${esc(name)}"><mesh>` +
      `<source id="${id}-p"><float_array id="${id}-a" count="${pts.length * 3}">${pts.map((p) => p.map(f).join(' ')).join(' ')}</float_array>` +
      `<technique_common><accessor source="#${id}-a" count="${pts.length}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>` +
      `<vertices id="${id}-v"><input semantic="POSITION" source="#${id}-p"/></vertices>` +
      `<lines material="m" count="${idx.length / 2}"><input semantic="VERTEX" source="#${id}-v" offset="0"/><p>${idx.join(' ')}</p></lines>` +
      `</mesh></geometry>`,
    );
    return `<node id="n${id}" name="${esc(name)}"><instance_geometry url="#${id}"><bind_material><technique_common><instance_material symbol="m" target="#line"/></technique_common></bind_material></instance_geometry></node>`;
  };

  if (model.terrain) nodes.push(`<node id="L_TERRAIN" name="${LAYERS.TERRAIN}">${meshGeo('terrain', model.terrain, 'ground')}</node>`);
  if (model.water?.length)
    nodes.push(`<node id="L_WATER_S" name="${LAYERS.WATER}">${model.water.map((w, i) => meshGeo(`water-${i + 1}`, w, 'water')).join('')}</node>`);
  if (model.bridges?.length)
    nodes.push(`<node id="L_BRIDGES" name="${LAYERS.BRIDGES}">${model.bridges.map((b, i) => meshGeo(`bridge-${i + 1}`, b, 'ground')).join('')}</node>`);
  for (const rm of model.roadMeshes ?? [])
    nodes.push(`<node id="L_${rm.layer}_S" name="${rm.layer}">${meshGeo(rm.layer.toLowerCase(), rm, rm.layer === LAYERS.ROADS_AREA ? 'road' : 'path')}</node>`);
  if (model.buildings.length)
    for (const cls of BUILDING_CLASSES) {
      const group = model.buildings.filter((b) => (b.cls ?? 'other') === cls);
      if (group.length) nodes.push(`<node id="L_${buildingLayer(cls)}" name="${buildingLayer(cls)}">${group.map((b) => meshGeo(b.name, b, `cls-${cls}`)).join('')}</node>`);
    }
  for (const { layer, items } of linesOf(model)) if (items.length) nodes.push(`<node id="L_${layer}" name="${layer}">${lineGeo(layer, items)}</node>`);
  if (model.trees.length) {
    // одна геометрия дерева + экземпляры с матрицами → в SketchUp это компонент TREE
    meshGeo('TREE', UNIT_TREE, 'tree');
    const tid = `g${gid - 1}`;
    const inst = model.trees
      .map((t, i) => `<node id="t${i}" name="TREE"><matrix>${f(t.r)} 0 0 ${f(t.x)} 0 ${f(t.r)} 0 ${f(t.y)} 0 0 ${f(t.h)} ${f(t.z)} 0 0 0 1</matrix><instance_node url="#TREE_DEF"/></node>`)
      .join('');
    nodes.push(`<node id="L_TREES" name="${LAYERS.TREES}">${inst}</node>`);
    treeLib = `<library_nodes><node id="TREE_DEF" name="TREE"><instance_geometry url="#${tid}"><bind_material><technique_common><instance_material symbol="m" target="#tree"/></technique_common></bind_material></instance_geometry></node></library_nodes>`;
  }

  const now = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
<asset><contributor><authoring_tool>${TOOL}</authoring_tool></contributor><created>${now}</created><modified>${now}</modified><unit name="meter" meter="1"/><up_axis>Z_UP</up_axis></asset>
<library_effects>${Object.entries(mats).map(([k, c]) => `<effect id="${k}-fx"><profile_COMMON><technique sid="common"><lambert><diffuse><color>${c.join(' ')} 1</color></diffuse></lambert></technique></profile_COMMON></effect>`).join('')}</library_effects>
<library_materials>${Object.keys(mats).map((k) => `<material id="${k}" name="${k}"><instance_effect url="#${k}-fx"/></material>`).join('')}</library_materials>
<library_geometries>${geos.join('\n')}</library_geometries>
${treeLib}
<library_visual_scenes><visual_scene id="scene" name="urban-export">${nodes.join('\n')}</visual_scene></library_visual_scenes>
<scene><instance_visual_scene url="#scene"/></scene>
</COLLADA>`;
  return new Blob([xml], { type: 'model/vnd.collada+xml' });
}

/* ---------------- Rhino 3DM (версия файла 5 — открывается в Rhino 5, 6, 7, 8) ---------------- */

const RHINO_URL = 'https://cdn.jsdelivr.net/npm/rhino3dm@8.32.2/';
let rhinoPromise;
function loadRhino() {
  rhinoPromise ??= import(RHINO_URL + 'rhino3dm.module.min.js').then(({ default: init }) => init({ locateFile: (file) => RHINO_URL + file }));
  return rhinoPromise;
}

export async function to3DM(model) {
  const rh = await loadRhino();
  const doc = new rh.File3dm();
  doc.settings().modelUnitSystem = rh.UnitSystem.Meters;
  const layerIdx = {};
  const attrs = (layer, name) => {
    if (layerIdx[layer] == null) {
      const l = new rh.Layer();
      l.name = layer;
      const [r, g, b] = rgb01(STYLE[layer].rgb).map((v) => Math.round(v * 255));
      l.color = { r, g, b, a: 255 };
      layerIdx[layer] = doc.layers().add(l);
    }
    const a = new rh.ObjectAttributes();
    a.layerIndex = layerIdx[layer];
    if (name) a.name = name;
    return a;
  };
  const addMesh = (layer, name, { verts, faces }) => {
    const m = new rh.Mesh();
    const vs = m.vertices();
    for (const [x, y, z] of verts) vs.add(x, y, z);
    const fs = m.faces();
    for (const { v } of faces) (v.length === 4 ? fs.addQuadFace(v[0], v[1], v[2], v[3]) : fs.addTriFace(v[0], v[1], v[2]));
    m.normals().computeNormals();
    m.compact();
    doc.objects().add(m, attrs(layer, name));
    m.delete();
  };
  if (model.terrain) addMesh(LAYERS.TERRAIN, 'terrain', model.terrain);
  // здания — NURBS-экструзии: в Rhino это настоящие тела с гранями и рёбрами, а не сетка
  const addBuilding = (b) => {
    try {
      // экструзия — только для простой призмы (контур × высота); крыши, купола и башни идут сеткой
      const n = b.rings.reduce((s, r) => s + r.length, 0);
      if (b.verts.length !== 2 * n) throw new Error('not a prism');
      const z0 = b.verts[0][2], z1 = b.verts[n][2];
      for (let i = 0; i < n; i++) if (Math.abs(b.verts[i][2] - z0) > 1e-6 || Math.abs(b.verts[n + i][2] - z1) > 1e-6) throw new Error('not a prism');
      const ring = (pts) => {
        const pl = new rh.Polyline(pts.length + 1);
        for (const [x, y] of pts) pl.add(x, y, z0);
        pl.add(pts[0][0], pts[0][1], z0);
        return pl.toPolylineCurve();
      };
      const ex = rh.Extrusion.create(ring(b.rings[0]), z1 - z0, true);
      if (!ex) throw new Error('extrusion');
      for (const hole of b.rings.slice(1)) ex.addInnerProfile(ring(hole));
      doc.objects().add(ex, attrs(buildingLayer(b.cls), b.name));
    } catch {
      addMesh(buildingLayer(b.cls), b.name, b); // сложная форма — оставляем сетку
    }
  };
  for (const b of model.buildings) addBuilding(b);
  (model.water ?? []).forEach((w, i) => addMesh(LAYERS.WATER, `water-${i + 1}`, w));
  (model.bridges ?? []).forEach((b, i) => addMesh(LAYERS.BRIDGES, `bridge-${i + 1}`, b));
  for (const rm of model.roadMeshes ?? []) addMesh(rm.layer, rm.layer.toLowerCase(), rm);
  if (model.trees.length) {
    // дерево — блок (instance definition), деревья — вставки: можно заменить одним махом
    const unit = new rh.Mesh();
    const uv = unit.vertices();
    for (const [x, y, z] of UNIT_TREE.verts) uv.add(x, y, z);
    const uf = unit.faces();
    for (const { v } of UNIT_TREE.faces) (v.length === 4 ? uf.addQuadFace(v[0], v[1], v[2], v[3]) : uf.addTriFace(v[0], v[1], v[2]));
    unit.normals().computeNormals();
    const defAttrs = new rh.ObjectAttributes();
    defAttrs.layerIndex = attrs(LAYERS.TREES).layerIndex;
    const idx = doc.instanceDefinitions().add('TREE', 'urban:EXPORT tree', '', '', [0, 0, 0], [unit], [defAttrs]);
    const idef = doc.instanceDefinitions().get(idx);
    for (const t of model.trees) {
      const xf = rh.Transform.identity();
      xf.m00 = t.r; xf.m11 = t.r; xf.m22 = t.h;
      xf.m03 = t.x; xf.m13 = t.y; xf.m23 = t.z;
      doc.objects().add(new rh.InstanceReference(idef.id, xf), attrs(LAYERS.TREES));
    }
    unit.delete();
  }
  for (const { layer, items } of linesOf(model))
    for (const { pts, closed } of items) doc.objects().addPolyline(closed ? [...pts, pts[0]] : pts, attrs(layer));

  const opts = new rh.File3dmWriteOptions();
  opts.version = 5;
  const bytes = doc.toByteArrayOptions(opts);
  doc.delete();
  return new Blob([bytes], { type: 'application/octet-stream' });
}

/* ---------------- SVG (Adobe Illustrator: план, слои, масштаб 1:2000) ---------------- */

export function toSVG(model) {
  const h = model.frame.half;
  const scale = 2000;
  const mm = (model.size * 1000) / scale;
  const p2 = ([x, y]) => `${f(x + h)},${f(h - y)}`;
  const path = (items) => items.map(({ pts, closed }) => `M${pts.map(p2).join('L')}${closed ? 'Z' : ''}`).join('');
  const lw = (mmWidth) => f((mmWidth * scale) / 1000); // толщина пера в мм на листе → метры модели

  const groups = [];
  const g = (id, attrs, body) => body && groups.push(`<g id="${id}" ${attrs}>${body}</g>`);
  const byLayer = Object.fromEntries(linesOf(model).map(({ layer, items }) => [layer, items]));
  const d = (layer) => (byLayer[layer]?.length ? `<path d="${path(byLayer[layer])}"/>` : '');

  g(LAYERS.CONTOURS, `fill="none" stroke="#c9a47c" stroke-width="${lw(0.08)}"`, d(LAYERS.CONTOURS));
  g(LAYERS.GREEN, `fill="#cfe5b8" stroke="none"`, d(LAYERS.GREEN));
  g(LAYERS.WATER, `fill="#a9d1f0" stroke="#4a90d9" stroke-width="${lw(0.08)}"`, d(LAYERS.WATER));
  if (model.roadAreas?.length) {
    // дороги реальной ширины — заливкой с тонким контуром бордюра
    g(LAYERS.PATHS_AREA, `fill="#efe6d6" stroke="#c9b48f" stroke-width="${lw(0.05)}" fill-rule="evenodd"`, d(LAYERS.PATHS_AREA));
    g(LAYERS.ROADS_AREA, `fill="#ffffff" stroke="#8e8e93" stroke-width="${lw(0.08)}" fill-rule="evenodd"`, d(LAYERS.ROADS_AREA));
  } else {
    g(LAYERS.PATHS, `fill="none" stroke="#c2a27a" stroke-width="${lw(0.1)}" stroke-dasharray="${lw(0.5)} ${lw(0.3)}" stroke-linecap="round" stroke-linejoin="round"`, d(LAYERS.PATHS));
    g(LAYERS.ROADS_MINOR, `fill="none" stroke="#9a9aa0" stroke-width="${lw(0.18)}" stroke-linecap="round" stroke-linejoin="round"`, d(LAYERS.ROADS_MINOR));
    g(LAYERS.ROADS_MAJOR, `fill="none" stroke="#e8912d" stroke-width="${lw(0.4)}" stroke-linecap="round" stroke-linejoin="round"`, d(LAYERS.ROADS_MAJOR));
  }
  g(LAYERS.BRIDGES, `fill="none" stroke="#5a5a5f" stroke-width="${lw(0.45)}" stroke-linecap="butt" stroke-linejoin="round"`, d(LAYERS.BRIDGES));
  if (model.site?.length > 2)
    g(LAYERS.SITE, `fill="none" stroke="#c0392b" stroke-width="${lw(0.5)}" stroke-dasharray="${lw(3)} ${lw(1.5)}"`,
      `<path d="${path([{ pts: model.site, closed: true }])}"/>`);
  g(LAYERS.RAILWAYS, `fill="none" stroke="#55555a" stroke-width="${lw(0.2)}" stroke-dasharray="${lw(1.2)} ${lw(0.6)}"`, d(LAYERS.RAILWAYS));
  if (model.trees.length)
    g(LAYERS.TREES, `fill="#6fb04f" fill-opacity="0.75" stroke="#3f7f2f" stroke-width="${lw(0.05)}"`,
      model.trees.map((t) => `<circle cx="${f(t.x + h)}" cy="${f(h - t.y)}" r="${f(t.r)}"/>`).join(''));
  if (model.buildings.length) {
    for (const cls of BUILDING_CLASSES) {
      const group = model.buildings.filter((b) => (b.cls ?? 'other') === cls);
      if (!group.length) continue;
      const paths = group.map((b) => `<path d="${path(b.rings.map((pts) => ({ pts, closed: true })))}"/>`).join('');
      g(buildingLayer(cls), `fill="${CLASS_COLORS[cls]}" stroke="#4a4a4c" stroke-width="${lw(0.08)}" fill-rule="evenodd"`, paths);
    }
  }

  const frameShape = model.shape === 'circle'
    ? `<circle cx="${f(h)}" cy="${f(h)}" r="${f(h)}"/>`
    : `<rect x="0" y="0" width="${model.size}" height="${model.size}"/>`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${TOOL} · ${model.center.lat.toFixed(6)}, ${model.center.lon.toFixed(6)} · ${model.size} x ${model.size} m · scale 1:${scale} -->
<svg xmlns="http://www.w3.org/2000/svg" width="${f(mm)}mm" height="${f(mm)}mm" viewBox="0 0 ${model.size} ${model.size}">
<defs><clipPath id="clip">${frameShape}</clipPath></defs>
<g id="FRAME" fill="#f7f5f0" stroke="#000" stroke-width="${lw(0.2)}">${frameShape}</g>
<g clip-path="url(#clip)">
${groups.join('\n')}
</g>
</svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

/* ---------------- FBX (ASCII 7.4): Blender, 3ds Max, Maya, Unreal ---------------- */

export function toFBX(model) {
  const L = [];
  const now = new Date();
  const geoms = [], models = [], mats = [], conns = [];
  let id = 1000000;
  const nextId = () => ++id;
  const hex = (h) => [1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4)).join(',');

  const material = (name, color) => {
    const mid = nextId();
    mats.push(`	Material: ${mid}, "Material::${name}", "" {
		Version: 102
		ShadingModel: "phong"
		Properties70:  {
			P: "DiffuseColor", "Color", "", "A",${hex(color)}
			P: "SpecularFactor", "double", "Number", "",0.05
		}
	}`);
    return mid;
  };

  const meshNode = (name, verts, faces, matId, transform) => {
    const gid = nextId(), mid = nextId();
    const vtx = [];
    for (const v of verts) vtx.push(f(v[0]), f(v[1]), f(v[2]));
    const idx = [];
    for (const { v } of faces) v.forEach((n, i) => idx.push(i === v.length - 1 ? -(n + 1) : n));
    geoms.push(`	Geometry: ${gid}, "Geometry::${name}", "Mesh" {
		Vertices: *${vtx.length} {
			a: ${vtx.join(',')}
		}
		PolygonVertexIndex: *${idx.length} {
			a: ${idx.join(',')}
		}
		GeometryVersion: 124
	}`);
    const t = transform ?? { pos: [0, 0, 0], scale: [1, 1, 1] };
    models.push(`	Model: ${mid}, "Model::${name}", "Mesh" {
		Version: 232
		Properties70:  {
			P: "Lcl Translation", "Lcl Translation", "", "A",${t.pos.map(f).join(',')}
			P: "Lcl Scaling", "Lcl Scaling", "", "A",${t.scale.map(f).join(',')}
		}
		Shading: T
		Culling: "CullingOff"
	}`);
    conns.push(`	C: "OO",${gid},${mid}`, `	C: "OO",${mid},0`);
    if (matId) conns.push(`	C: "OO",${matId},${mid}`);
    return { gid, mid };
  };

  // одна геометрия дерева на все экземпляры — в FBX это тоже «блок»
  const instanced = (name, gid, matId, list) => {
    for (const t of list) {
      const mid = nextId();
      models.push(`	Model: ${mid}, "Model::${name}", "Mesh" {
		Version: 232
		Properties70:  {
			P: "Lcl Translation", "Lcl Translation", "", "A",${f(t.x)},${f(t.y)},${f(t.z)}
			P: "Lcl Scaling", "Lcl Scaling", "", "A",${f(t.r)},${f(t.r)},${f(t.h)}
		}
	}`);
      conns.push(`	C: "OO",${gid},${mid}`, `	C: "OO",${mid},0`, `	C: "OO",${matId},${mid}`);
    }
  };

  if (model.terrain) meshNode('TERRAIN', model.terrain.verts, model.terrain.faces, material('TERRAIN', STYLE[LAYERS.TERRAIN].rgb));
  if (model.water?.length) {
    const m = mergeBodies(model.water);
    meshNode('WATER', m.verts, m.faces, material('WATER', STYLE[LAYERS.WATER].rgb));
  }
  if (model.bridges?.length) {
    const m = mergeBodies(model.bridges);
    meshNode('BRIDGES', m.verts, m.faces, material('BRIDGES', STYLE[LAYERS.BRIDGES].rgb));
  }
  for (const rm of model.roadMeshes ?? []) meshNode(rm.layer, rm.verts, rm.faces, material(rm.layer, STYLE[rm.layer].rgb));
  for (const cls of BUILDING_CLASSES) {
    const group = model.buildings.filter((b) => (b.cls ?? 'other') === cls);
    if (!group.length) continue;
    const layer = buildingLayer(cls);
    const merged = mergeBodies(group);
    meshNode(layer, merged.verts, merged.faces, material(layer, CLASS_COLORS[cls]));
  }
  if (model.trees.length) {
    const matId = material('TREES', STYLE[LAYERS.TREES].rgb);
    const { gid } = meshNode('TREE', UNIT_TREE.verts, UNIT_TREE.faces, matId, { pos: [0, 0, -1e6], scale: [1, 1, 1] });
    instanced('TREE', gid, matId, model.trees);
  }

  // шапка ровно как у Autodesk: импортёры узнают ASCII-FBX по первым строкам
  L.push(`; FBX 7.4.0 project file
; ----------------------------------------------------

FBXHeaderExtension:  {
	FBXHeaderVersion: 1003
	FBXVersion: 7400
	CreationTimeStamp:  {
		Version: 1000
		Year: ${now.getUTCFullYear()}
		Month: ${now.getUTCMonth() + 1}
		Day: ${now.getUTCDate()}
		Hour: ${now.getUTCHours()}
		Minute: ${now.getUTCMinutes()}
		Second: ${now.getUTCSeconds()}
		Millisecond: 0
	}
	Creator: "${TOOL}"
}
GlobalSettings:  {
	Version: 1000
	Properties70:  {
		P: "UpAxis", "int", "Integer", "",2
		P: "UpAxisSign", "int", "Integer", "",1
		P: "FrontAxis", "int", "Integer", "",1
		P: "FrontAxisSign", "int", "Integer", "",-1
		P: "CoordAxis", "int", "Integer", "",0
		P: "CoordAxisSign", "int", "Integer", "",1
		P: "UnitScaleFactor", "double", "Number", "",100
	}
}
Definitions:  {
	Version: 100
	Count: ${geoms.length + models.length + mats.length}
	ObjectType: "Geometry" {
		Count: ${geoms.length}
	}
	ObjectType: "Model" {
		Count: ${models.length}
	}
	ObjectType: "Material" {
		Count: ${mats.length}
	}
}
Objects:  {
${geoms.join('\n')}
${models.join('\n')}
${mats.join('\n')}
}
Connections:  {
${conns.join('\n')}
}
`);
  return new Blob([L.join('')], { type: 'application/octet-stream' });
}

/* ---------------- STL (3D-печать, бинарный, миллиметры) ---------------- */

// Масштаб подбирается так, чтобы модель была не больше 200 мм по стороне.
export function stlScale(size) {
  return [500, 1000, 2000, 5000, 10000, 25000].find((k) => (size * 1000) / k <= 200) ?? 50000;
}

export function toSTL(model) {
  const k = 1000 / stlScale(model.size); // метры → миллиметры в масштабе
  const tris = [];
  const push = (a, b, c) => tris.push([a, b, c]);
  const body = (verts, faces) => {
    for (const { v } of faces) {
      push(verts[v[0]], verts[v[1]], verts[v[2]]);
      if (v.length === 4) push(verts[v[0]], verts[v[2]], verts[v[3]]);
    }
  };
  // рельеф с бортиком и дном — замкнутое основание
  const t = model.terrain;
  if (t) {
    body(t.verts, t.faces);
    const base = -Math.max(3, model.size * 0.01);
    const loop = t.boundary ?? [];
    const low = loop.map((i) => [t.verts[i][0], t.verts[i][1], base]);
    for (let i = 0; i < loop.length; i++) {
      const j = (i + 1) % loop.length;
      const a = t.verts[loop[i]], b = t.verts[loop[j]];
      push(a, low[i], low[j]);
      push(a, low[j], b);
    }
    const c = [0, 0, base];
    for (let i = 0; i < loop.length; i++) push(c, low[(i + 1) % loop.length], low[i]);
  }
  for (const b of model.buildings) body(b.verts, b.faces);
  for (const br of model.bridges ?? []) body(br.verts, br.faces);
  for (const tr of model.trees) { const tb = treeBody(tr); body(tb.verts, tb.faces); }

  const buf = new ArrayBuffer(84 + tris.length * 50);
  const dv = new DataView(buf);
  new Uint8Array(buf, 0, 80).set(new TextEncoder().encode(`${TOOL} ${model.size}m 1:${stlScale(model.size)}`.slice(0, 80)));
  dv.setUint32(80, tris.length, true);
  let o = 84;
  for (const [a, b, c] of tris) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx / len, true); dv.setFloat32(o + 4, ny / len, true); dv.setFloat32(o + 8, nz / len, true);
    o += 12;
    for (const p of [a, b, c]) {
      dv.setFloat32(o, p[0] * k, true); dv.setFloat32(o + 4, p[1] * k, true); dv.setFloat32(o + 8, p[2] * k, true);
      o += 12;
    }
    dv.setUint16(o, 0, true);
    o += 2;
  }
  return new Blob([buf], { type: 'model/stl' });
}

/* ---------------- IFC 2x3 (ArchiCAD: Файл → Открыть, также Revit, BricsCAD, Solibri) ---------------- */

const IFC_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
const ifcGuid = () => {
  let g = IFC_CHARS[Math.floor(Math.random() * 4)];
  for (let i = 1; i < 22; i++) g += IFC_CHARS[Math.floor(Math.random() * 64)];
  return g;
};
const ifcReal = (v) => {
  const s = (Math.round(v * 1000) / 1000).toString();
  return s.includes('.') ? s : `${s}.`;
};
const ifcStr = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/[^\x20-\x7e]/g, '_')}'`;
const dms = (deg) => {
  const sign = deg < 0 ? -1 : 1;
  let a = Math.abs(deg);
  const d = Math.floor(a); a = (a - d) * 60;
  const m = Math.floor(a); a = (a - m) * 60;
  const sec = Math.floor(a);
  const mic = Math.round((a - sec) * 1e6);
  return `(${[d, m, sec, mic].map((x) => sign * x).join(',')})`;
};

export function toIFC(model) {
  const L = [];
  let n = 0;
  const add = (s) => { L.push(`#${++n}=${s};`); return `#${n}`; };
  const ts = Math.floor(Date.now() / 1000);

  const person = add(`IFCPERSON($,$,${ifcStr(TOOL)},$,$,$,$,$)`);
  const org = add(`IFCORGANIZATION($,${ifcStr(TOOL)},$,$,$)`);
  const po = add(`IFCPERSONANDORGANIZATION(${person},${org},$)`);
  const app = add(`IFCAPPLICATION(${org},'1.0',${ifcStr(TOOL)},'urban-export')`);
  const oh = add(`IFCOWNERHISTORY(${po},${app},$,.ADDED.,$,$,$,${ts})`);
  const units = add(`IFCUNITASSIGNMENT((${[
    add('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)'), add('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)'),
    add('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)'), add('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)'),
  ].join(',')}))`);
  const origin = add('IFCCARTESIANPOINT((0.,0.,0.))');
  const zDir = add('IFCDIRECTION((0.,0.,1.))'), xDir = add('IFCDIRECTION((1.,0.,0.))');
  const axis = add(`IFCAXIS2PLACEMENT3D(${origin},${zDir},${xDir})`);
  const ctx = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${axis},${add('IFCDIRECTION((0.,1.))')})`);
  const project = add(`IFCPROJECT('${ifcGuid()}',${oh},${ifcStr(`${TOOL} ${model.center.lat.toFixed(5)}, ${model.center.lon.toFixed(5)}`)},$,$,$,$,(${ctx}),${units})`);
  const sitePl = add(`IFCLOCALPLACEMENT($,${axis})`);
  const site = add(`IFCSITE('${ifcGuid()}',${oh},'Site',$,$,${sitePl},$,$,.ELEMENT.,${dms(model.center.lat)},${dms(model.center.lon)},0.,$,$)`);
  const bldPl = add(`IFCLOCALPLACEMENT(${sitePl},${axis})`);
  const bld = add(`IFCBUILDING('${ifcGuid()}',${oh},'Context',$,$,${bldPl},$,$,.ELEMENT.,$,$,$)`);
  const stPl = add(`IFCLOCALPLACEMENT(${bldPl},${axis})`);
  const storey = add(`IFCBUILDINGSTOREY('${ifcGuid()}',${oh},'Ground',$,$,${stPl},$,$,.ELEMENT.,0.)`);
  add(`IFCRELAGGREGATES('${ifcGuid()}',${oh},$,$,${project},(${site}))`);
  add(`IFCRELAGGREGATES('${ifcGuid()}',${oh},$,$,${site},(${bld}))`);
  add(`IFCRELAGGREGATES('${ifcGuid()}',${oh},$,$,${bld},(${storey}))`);

  // цвета поверхностей — по слою
  const styles = {};
  const styleFor = (layer) => {
    if (styles[layer]) return styles[layer];
    const [r, g, b] = rgb01(STYLE[layer]?.rgb ?? '#cccccc');
    const colour = add(`IFCCOLOURRGB($,${ifcReal(r)},${ifcReal(g)},${ifcReal(b)})`);
    const render = add(`IFCSURFACESTYLERENDERING(${colour},0.,$,$,$,$,$,$,.NOTDEFINED.)`);
    const surf = add(`IFCSURFACESTYLE(${ifcStr(layer)},.BOTH.,(${render}))`);
    return (styles[layer] = add(`IFCPRESENTATIONSTYLEASSIGNMENT((${surf}))`));
  };
  const layerReps = {};
  const elements = [];
  // сетка → грани IFC; замкнутые тела — Brep, поверхности (рельеф, дороги) — модель оболочек
  const shapeItem = ({ verts, faces }, closed) => {
    const pts = verts.map(([x, y, z]) => add(`IFCCARTESIANPOINT((${ifcReal(x)},${ifcReal(y)},${ifcReal(z)}))`));
    const fs = [];
    for (const { v } of faces) {
      if (v.length < 3) continue;
      const loop = add(`IFCPOLYLOOP((${v.map((i) => pts[i]).join(',')}))`);
      fs.push(add(`IFCFACE((${add(`IFCFACEOUTERBOUND(${loop},.T.)`)}))`));
    }
    if (closed) return { item: add(`IFCFACETEDBREP(${add(`IFCCLOSEDSHELL((${fs.join(',')}))`)})`), type: 'Brep' };
    return { item: add(`IFCSHELLBASEDSURFACEMODEL((${add(`IFCOPENSHELL((${fs.join(',')}))`)}))`), type: 'SurfaceModel' };
  };
  const proxy = (name, objectType, layer, items, type) => {
    for (const it of items) add(`IFCSTYLEDITEM(${it},(${styleFor(layer)}),$)`);
    const rep = add(`IFCSHAPEREPRESENTATION(${ctx},'Body',${ifcStr(type)},(${items.join(',')}))`);
    (layerReps[layer] ??= []).push(rep);
    const pds = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${rep}))`);
    const pl = add(`IFCLOCALPLACEMENT(${stPl},${axis})`);
    elements.push(add(`IFCBUILDINGELEMENTPROXY('${ifcGuid()}',${oh},${ifcStr(name)},$,${ifcStr(objectType)},${pl},${pds},$,$)`));
  };
  const surface = (name, layer, mesh) => { const { item, type } = shapeItem(mesh, false); proxy(name, layer, layer, [item], type); };

  if (model.terrain) surface('Terrain', LAYERS.TERRAIN, model.terrain);
  (model.water ?? []).forEach((w, i) => surface(`Water ${i + 1}`, LAYERS.WATER, w));
  for (const rm of model.roadMeshes ?? []) surface(rm.layer === LAYERS.ROADS_AREA ? 'Roads' : 'Paths', rm.layer, rm);
  (model.bridges ?? []).forEach((b, i) => { const { item, type } = shapeItem(b, true); proxy(`Bridge ${i + 1}`, 'Bridge', LAYERS.BRIDGES, [item], type); });
  for (const b of model.buildings) {
    const { item, type } = shapeItem(b, true);
    proxy(b.name, b.cls ?? 'other', buildingLayer(b.cls), [item], type);
  }
  if (model.trees.length) {
    // дерево — один образец (representation map), деревья — его вставки с масштабом
    const unit = shapeItem(UNIT_TREE, true);
    add(`IFCSTYLEDITEM(${unit.item},(${styleFor(LAYERS.TREES)}),$)`);
    const unitRep = add(`IFCSHAPEREPRESENTATION(${ctx},'Body','Brep',(${unit.item}))`);
    const map = add(`IFCREPRESENTATIONMAP(${axis},${unitRep})`);
    const ax1 = add('IFCDIRECTION((1.,0.,0.))'), ax2 = add('IFCDIRECTION((0.,1.,0.))'), ax3 = add('IFCDIRECTION((0.,0.,1.))');
    const items = model.trees.map((t) => {
      const o = add(`IFCCARTESIANPOINT((${ifcReal(t.x)},${ifcReal(t.y)},${ifcReal(t.z)}))`);
      const op = add(`IFCCARTESIANTRANSFORMATIONOPERATOR3DNONUNIFORM(${ax1},${ax2},${o},${ifcReal(t.r)},${ax3},${ifcReal(t.r)},${ifcReal(t.h)})`);
      return add(`IFCMAPPEDITEM(${map},${op})`);
    });
    const rep = add(`IFCSHAPEREPRESENTATION(${ctx},'Body','MappedRepresentation',(${items.join(',')}))`);
    (layerReps[LAYERS.TREES] ??= []).push(rep);
    const pds = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${rep}))`);
    elements.push(add(`IFCBUILDINGELEMENTPROXY('${ifcGuid()}',${oh},'Trees',$,'Trees',${add(`IFCLOCALPLACEMENT(${stPl},${axis})`)},${pds},$,$)`));
  }
  if (elements.length) add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${ifcGuid()}',${oh},$,$,(${elements.join(',')}),${storey})`);
  // слои IFC → слои ArchiCAD
  for (const [layer, reps] of Object.entries(layerReps)) add(`IFCPRESENTATIONLAYERASSIGNMENT(${ifcStr(layer)},$,(${reps.join(',')}),$)`);

  const name = `urban-export_${model.center.lat.toFixed(4)}_${model.center.lon.toFixed(4)}.ifc`;
  const text = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');
FILE_NAME(${ifcStr(name)},'${new Date().toISOString().slice(0, 19)}',(${ifcStr(TOOL)}),(${ifcStr(TOOL)}),${ifcStr(TOOL)},${ifcStr(TOOL)},'');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
${L.join('\n')}
ENDSEC;
END-ISO-10303-21;
`;
  return new Blob([text], { type: 'application/x-step' });
}

/* ---------------- GeoJSON (QGIS, Blender-GIS, ArcGIS, Mapbox) ---------------- */

export function toGeoJSON(model) {
  const { lat, lon } = model.center;
  const phi = (lat * Math.PI) / 180;
  const mLat = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
  const mLon = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
  const toCoord = (x, y, z) => {
    const c = [
      Number((lon + x / mLon).toFixed(7)),
      Number((lat + y / mLat).toFixed(7))
    ];
    if (z !== undefined && !Number.isNaN(z)) c.push(Number(z.toFixed(2)));
    return c;
  };

  const features = [];

  // 1. Buildings (Polygon) with heights, levels, and classifications
  for (const b of model.buildings || []) {
    const coords = (b.rings || []).map((ring) => {
      const pts = ring.map(([x, y]) => toCoord(x, y));
      if (pts.length && (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1])) {
        pts.push(pts[0]);
      }
      return pts;
    }).filter((r) => r.length >= 4);

    if (coords.length) {
      features.push({
        type: 'Feature',
        properties: {
          layer: 'buildings',
          building_class: b.cls || 'other',
          height_m: b.height || 0,
          levels: b.levels || 1,
          name: b.name || ''
        },
        geometry: {
          type: 'Polygon',
          coordinates: coords
        }
      });
    }
  }

  // 2. Roads and Railways (LineStrings)
  for (const [layerKey, lines] of Object.entries(model.lines || {})) {
    for (const pts of lines) {
      if (pts.length >= 2) {
        features.push({
          type: 'Feature',
          properties: {
            layer: layerKey.toLowerCase(),
            type: layerKey
          },
          geometry: {
            type: 'LineString',
            coordinates: pts.map(([x, y, z]) => toCoord(x, y, z))
          }
        });
      }
    }
  }

  // 3. Water and Green Areas (Polygons)
  for (const [layerKey, rings] of Object.entries(model.areas || {})) {
    for (const ring of rings) {
      if (ring.length >= 3) {
        const pts = ring.map(([x, y]) => toCoord(x, y));
        if (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1]) {
          pts.push(pts[0]);
        }
        features.push({
          type: 'Feature',
          properties: {
            layer: layerKey.toLowerCase(),
            type: layerKey
          },
          geometry: {
            type: 'Polygon',
            coordinates: [pts]
          }
        });
      }
    }
  }

  // 4. Contours (LineStrings)
  for (const c of model.contours || []) {
    if (c.pts && c.pts.length >= 2) {
      features.push({
        type: 'Feature',
        properties: {
          layer: 'contours',
          elevation_m: c.pts[0][2] || 0
        },
        geometry: {
          type: 'LineString',
          coordinates: c.pts.map(([x, y, z]) => toCoord(x, y, z))
        }
      });
    }
  }

  // 5. Trees (Points)
  for (const t of model.trees || []) {
    features.push({
      type: 'Feature',
      properties: {
        layer: 'trees',
        radius_m: t.r,
        height_m: t.h
      },
      geometry: {
        type: 'Point',
        coordinates: toCoord(t.x, t.y, t.z)
      }
    });
  }

  const fc = {
    type: 'FeatureCollection',
    name: `Urbanized_${model.center.lat.toFixed(4)}_${model.center.lon.toFixed(4)}`,
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
    },
    features
  };
  return new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' });
}

export const FORMATS = {
  dxf: { label: 'AutoCAD', ext: 'dxf', make: toDXF },
  dae: { label: 'SketchUp', ext: 'dae', make: toDAE },
  '3dm': { label: 'Rhino', ext: '3dm', make: to3DM },
  svg: { label: 'Illustrator', ext: 'svg', make: toSVG },
  geojson: { label: 'GeoJSON', ext: 'geojson', make: toGeoJSON },
  fbx: { label: 'FBX', ext: 'fbx', make: toFBX },
  ifc: { label: 'ArchiCAD', ext: 'ifc', make: toIFC },
  stl: { label: '3D print', ext: 'stl', make: toSTL },
  jpg: { label: 'Satellite', ext: 'jpg', make: (model) => imageryBlob(model.imagery) },
};

