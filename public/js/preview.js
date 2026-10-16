// 3D-превью модели (three.js).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import earcut from 'https://cdn.jsdelivr.net/npm/earcut@3.0.1/+esm';
import { triangulate, UNIT_TREE } from './data.js?v=4.1';

let ctx;

function init(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0c0e);
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-0.6, -0.9, 1.4);
  scene.add(sun);
  const group = new THREE.Group();
  scene.add(group);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
  return { renderer, scene, camera, controls, group };
}

function meshGeometry(bodies) {
  let count = 0;
  for (const b of bodies) count += triangulate(b.faces).length;
  const pos = new Float32Array(count * 3);
  let k = 0;
  for (const b of bodies)
    for (const i of triangulate(b.faces)) { const p = b.verts[i]; pos[k++] = p[0]; pos[k++] = p[1]; pos[k++] = p[2]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function edgeGeometry(bodies) {
  const pos = [];
  for (const b of bodies)
    for (const { v, vis } of b.faces)
      v.forEach((a, i) => {
        if (!vis[i]) return;
        const p = b.verts[a], q = b.verts[v[(i + 1) % v.length]];
        pos.push(p[0], p[1], p[2], q[0], q[1], q[2]);
      });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

function lineGeometry(lines, lift) {
  const pos = [];
  for (const { pts, closed } of lines) {
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      pos.push(p[0], p[1], p[2] + lift, q[0], q[1], q[2] + lift);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

let chunkModeActive = false;

function buildTerrainSkirtGeometry(grid, size, baseZ) {
  const half = size / 2;
  const n = grid.n;
  const step = size / n;
  const pos = [];

  // Edge 1: South (y = -half, x from -half to +half)
  for (let i = 0; i < n; i++) {
    const x1 = -half + i * step, x2 = -half + (i + 1) * step;
    const y = -half;
    const z1 = grid.heightAt(x1, y), z2 = grid.heightAt(x2, y);
    pos.push(x1, y, z1, x2, y, z2, x1, y, baseZ);
    pos.push(x2, y, z2, x2, y, baseZ, x1, y, baseZ);
  }
  // Edge 2: North (y = +half, x from -half to +half)
  for (let i = 0; i < n; i++) {
    const x1 = -half + i * step, x2 = -half + (i + 1) * step;
    const y = half;
    const z1 = grid.heightAt(x1, y), z2 = grid.heightAt(x2, y);
    pos.push(x1, y, z1, x1, y, baseZ, x2, y, z2);
    pos.push(x2, y, z2, x1, y, baseZ, x2, y, baseZ);
  }
  // Edge 3: West (x = -half, y from -half to +half)
  for (let j = 0; j < n; j++) {
    const y1 = -half + j * step, y2 = -half + (j + 1) * step;
    const x = -half;
    const z1 = grid.heightAt(x, y1), z2 = grid.heightAt(x, y2);
    pos.push(x, y1, z1, x, y1, baseZ, x, y2, z2);
    pos.push(x, y2, z2, x, y1, baseZ, x, y2, baseZ);
  }
  // Edge 4: East (x = +half, y from -half to +half)
  for (let j = 0; j < n; j++) {
    const y1 = -half + j * step, y2 = -half + (j + 1) * step;
    const x = half;
    const z1 = grid.heightAt(x, y1), z2 = grid.heightAt(x, y2);
    pos.push(x, y1, z1, x, y2, z2, x, y1, baseZ);
    pos.push(x, y2, z2, x, y2, baseZ, x, y1, baseZ);
  }
  // Bottom slab cap at baseZ
  pos.push(-half, -half, baseZ, half, -half, baseZ, -half, half, baseZ);
  pos.push(half, -half, baseZ, half, half, baseZ, -half, half, baseZ);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

function createTextSprite(tag, subtitle, size) {
  const canvas = document.createElement('canvas');
  canvas.width = 440;
  canvas.height = 180;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);

  // High contrast architectural label (Moodboard style)
  c.fillStyle = '#ffffff';
  c.font = 'bold 36px "Space Grotesk", sans-serif';
  c.fillText(tag, 12, 48);

  c.fillStyle = 'rgba(255, 255, 255, 0.75)';
  c.font = '500 22px "JetBrains Mono", monospace';
  c.fillText(subtitle, 12, 88);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  const scale = (size || 1000) * 0.18;
  sprite.scale.set(scale, scale * (180 / 440), 1);
  return sprite;
}

function createDashedHairline(p1, p2, s) {
  const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
  const dash = Math.max(3, s * 0.008);
  const gap = Math.max(2, s * 0.005);
  const mat = new THREE.LineDashedMaterial({
    color: 0xffffff,
    dashSize: dash,
    gapSize: gap,
    transparent: true,
    opacity: 0.65
  });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  return line;
}

export function showModel(container, model, { keepCamera = false, chunkMode = false } = {}) {
  ctx ??= init(container || document.getElementById('viewer'));
  ctx.lastModel = model;
  chunkModeActive = chunkMode;
  const { group, camera, controls, scene } = ctx;
  group.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
  group.clear();

  const s = model.size;
  ctx.modelSize = s;
  const zMid = (model.grid?.maxH ?? 0) / 2;
  ctx.zMid = zMid;

  // Initialize Layer Groups for QGIS instant interactive toggling
  const layerGroups = {
    terrain: new THREE.Group(),
    education: new THREE.Group(),
    commercial: new THREE.Group(),
    health: new THREE.Group(),
    residential: new THREE.Group(),
    other_buildings: new THREE.Group(),
    roads_major: new THREE.Group(),
    roads_minor: new THREE.Group(),
    water: new THREE.Group(),
    green: new THREE.Group(),
    trees: new THREE.Group(),
    contours: new THREE.Group(),
    skirt: new THREE.Group()
  };
  ctx.layerGroups = layerGroups;
  Object.values(layerGroups).forEach((g) => group.add(g));

  const isMaqueta = chunkModeActive;

  // Lighting & Background setup
  ctx.sun = ctx.sun || scene.children.find((c) => c.isDirectionalLight);
  if (isMaqueta) {
    scene.background = new THREE.Color(0x090a0d);
    if (ctx.sun) {
      ctx.sun.position.set(-1.1, -1.0, 1.8);
      ctx.sun.intensity = 2.3;
    }
  } else {
    scene.background = new THREE.Color(0x090a0d);
    if (ctx.sun) {
      ctx.sun.position.set(-0.6, -0.9, 1.4);
      ctx.sun.intensity = 1.75;
    }
  }

  // 1. Terrain & Physical Pedestal Skirt
  if (model.terrain) {
    const geo = meshGeometry([model.terrain]);
    let mat;
    if (isMaqueta) {
      // Monochrome architectural plaster scale model
      mat = new THREE.MeshStandardMaterial({
        color: 0xe4e4e8,
        roughness: 0.92,
        metalness: 0.02,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2
      });
    } else {
      mat = new THREE.MeshLambertMaterial({
        color: 0xdad6cc,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2
      });
      if (model.imagery) {
        const pos = geo.attributes.position, uv = new Float32Array(pos.count * 2), h = s / 2;
        for (let i = 0; i < pos.count; i++) { uv[2 * i] = (pos.getX(i) + h) / s; uv[2 * i + 1] = (pos.getY(i) + h) / s; }
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        const n = Math.min(2048, model.imagery.canvas.width);
        const tex = document.createElement('canvas');
        tex.width = tex.height = n;
        const tctx = tex.getContext('2d');
        tctx.drawImage(model.imagery.canvas, 0, 0, n, n);
        mat.map = new THREE.CanvasTexture(tex);
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.anisotropy = 8;
        mat.color.set(0xffffff);
      }
    }
    layerGroups.terrain.add(new THREE.Mesh(geo, mat));

    // Physical architectural pedestal base (visible in both modes, styled to match)
    if (model.grid) {
      const minH = model.grid?.minH ?? 0;
      const baseZ = minH - s * 0.055;
      const skirtGeo = buildTerrainSkirtGeometry(model.grid, s, baseZ);
      const skirtMat = new THREE.MeshStandardMaterial({
        color: isMaqueta ? 0x1c1d22 : 0x14151a,
        roughness: 0.94,
        metalness: 0.02
      });
      layerGroups.skirt.add(new THREE.Mesh(skirtGeo, skirtMat));
      const skirtEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(skirtGeo, 30),
        new THREE.LineBasicMaterial({ color: isMaqueta ? 0x3f3f46 : 0x27272a, transparent: true, opacity: 0.55 })
      );
      layerGroups.skirt.add(skirtEdges);
    }
  }

  // 2. Buildings (Separated by QGIS POI subcategories with distinct GIS colors in Urbano mode & pure plaster in Maqueta mode)
  const categorized = {
    education: [],
    commercial: [],
    health: [],
    residential: [],
    other_buildings: []
  };

  for (const b of model.buildings || []) {
    let sub = b.subtype || 'other_buildings';
    if (sub === 'other' || sub === 'other_buildings') {
      sub = b.cls === 'commercial' ? 'commercial'
          : b.cls === 'public' ? 'education'
          : (b.cls === 'residential' || !b.cls || b.cls === 'other') ? 'residential'
          : 'other_buildings';
    }
    if (categorized[sub]) categorized[sub].push(b);
    else categorized.other_buildings.push(b);
  }

  const gisColors = {
    residential: 0xf4f4f6,
    commercial: 0xf97316,
    education: 0x60a5fa,
    health: 0x2dd4bf,
    other_buildings: 0xd4d4d8
  };

  const edgeColor = isMaqueta ? 0x27272a : 0x18181b;
  const edgeOp = isMaqueta ? 0.38 : 0.5;

  for (const [catKey, bList] of Object.entries(categorized)) {
    if (!bList.length) continue;
    const geo = meshGeometry(bList);
    const edges = edgeGeometry(bList);
    const targetGroup = layerGroups[catKey] || layerGroups.other_buildings;
    const mat = isMaqueta
      ? new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.85, metalness: 0.02, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
      : new THREE.MeshLambertMaterial({ color: gisColors[catKey] || 0xf4f4f6, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    targetGroup.add(new THREE.Mesh(geo, mat));
    targetGroup.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: edgeOp })));
  }

  // 3. Roads, Railways & Paths
  const road = (layers) => layers.flatMap((l) => (model.lines[l] ?? []).map((pts) => ({ pts, closed: false })));
  const addLinesTo = (targetGroup, items, color, opacity) => {
    if (!items.length) return;
    targetGroup.add(new THREE.LineSegments(lineGeometry(items, 0.9), new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
  };

  if (isMaqueta) {
    addLinesTo(layerGroups.roads_major, road(['ROADS_MAJOR']), 0x52525b, 0.85);
    addLinesTo(layerGroups.roads_minor, road(['ROADS_MINOR', 'PATHS']), 0x71717a, 0.6);
    addLinesTo(layerGroups.roads_major, road(['RAILWAYS']), 0x3f3f46, 0.8);
  } else {
    if (model.roadMeshes?.length) {
      const overlay = (color, opacity, factor) => new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity, polygonOffset: true, polygonOffsetFactor: factor, polygonOffsetUnits: factor, depthWrite: opacity >= 1 });
      for (const rm of model.roadMeshes) {
        const isRoad = rm.layer === 'ROADS_AREA';
        layerGroups.roads_minor.add(new THREE.Mesh(meshGeometry([rm]), overlay(isRoad ? 0x8e8e93 : 0xcdb894, isRoad ? 0.9 : 0.75, isRoad ? -5 : -4)));
      }
    } else {
      addLinesTo(layerGroups.roads_major, road(['ROADS_MAJOR']), 0xf97316, 0.95);
      addLinesTo(layerGroups.roads_minor, road(['ROADS_MINOR']), 0x71717a, 0.75);
      addLinesTo(layerGroups.roads_minor, road(['PATHS']), 0xa1a1aa, 0.55);
    }
    addLinesTo(layerGroups.roads_major, road(['RAILWAYS']), 0x52525b, 0.9);
  }

  // 4. Water (Hydrology)
  if (model.water?.length) {
    const waterColor = isMaqueta ? 0xd4d4d8 : 0x38bdf8;
    const waterOp = isMaqueta ? 0.9 : 0.92;
    const waterMat = isMaqueta
      ? new THREE.MeshStandardMaterial({ color: waterColor, roughness: 0.35, metalness: 0.05, transparent: true, opacity: waterOp, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
      : new THREE.MeshLambertMaterial({ color: waterColor, transparent: true, opacity: waterOp, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    layerGroups.water.add(new THREE.Mesh(meshGeometry(model.water), waterMat));
  }

  // 5. Green Areas
  const greens = (model.areas?.GREEN ?? []).filter((r) => r.length > 2).map((ring) => {
    const flat = [];
    for (const [x, y] of ring) flat.push(x, y);
    const tri = earcut(flat, [], 2);
    const faces = [];
    for (let i = 0; i < tri.length; i += 3) faces.push({ v: [tri[i], tri[i + 1], tri[i + 2]] });
    return { verts: ring, faces };
  });
  if (greens.length) {
    const greenMat = isMaqueta
      ? new THREE.MeshStandardMaterial({ color: 0xdadadd, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
      : new THREE.MeshLambertMaterial({ color: 0x4ade80, transparent: true, opacity: 0.45, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    layerGroups.green.add(new THREE.Mesh(meshGeometry(greens), greenMat));
  }

  // 6. Contours (Topography)
  if (model.contours?.length) {
    const cColor = isMaqueta ? 0x71717a : 0xd97706;
    addLinesTo(layerGroups.contours, model.contours.map((c) => ({ pts: c.pts, closed: c.closed })), cColor, 0.65);
  }

  // 7. Trees
  if (model.trees?.length) {
    const unit = meshGeometry([UNIT_TREE]);
    const treeMat = isMaqueta
      ? new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.95, metalness: 0.01 })
      : new THREE.MeshLambertMaterial({ color: 0x22c55e });
    const trees = new THREE.InstancedMesh(unit, treeMat, model.trees.length);
    const mtx = new THREE.Matrix4();
    model.trees.forEach((t, i) => trees.setMatrixAt(i, mtx.makeScale(t.r, t.r, t.h).setPosition(t.x, t.y, t.z)));
    layerGroups.trees.add(trees);
  }

  // 8. Bridges
  if (model.bridges?.length) {
    layerGroups.roads_major.add(new THREE.Mesh(meshGeometry(model.bridges), new THREE.MeshLambertMaterial({ color: isMaqueta ? 0xf5f5f7 : 0xd9d6cf, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
    layerGroups.roads_major.add(new THREE.LineSegments(edgeGeometry(model.bridges), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })));
  }

  // Camera placement
  if (!keepCamera) {
    camera.fov = 35;
    controls.target.set(0, 0, zMid);
    if (isMaqueta) {
      camera.position.set(s * 0.82, -s * 0.82, s * 0.76 + zMid);
    } else {
      camera.position.set(s * 0.62, -s * 0.95, s * 0.72 + zMid);
    }
    camera.near = Math.max(1, s / 1000);
    camera.far = s * 40;
    camera.updateProjectionMatrix();
    controls.update();
    triggerResize();
  }
}

export function setLayerVisibility(key, visible) {
  if (!ctx || !ctx.layerGroups) return;
  const g = ctx.layerGroups[key];
  if (g) g.visible = Boolean(visible);
}

export function getLayerStats(model) {
  const m = model || ctx?.lastModel;
  if (!m) return { education: 0, commercial: 0, health: 0, residential: 0, other_buildings: 0, roadsMajorKm: '0', roadsMinorKm: '0', totalBuildings: 0, trees: 0, relief: 0 };
  const counts = { education: 0, commercial: 0, health: 0, residential: 0, other_buildings: 0 };
  for (const b of m.buildings || []) {
    let sub = b.subtype || 'other_buildings';
    if (sub === 'other' || sub === 'other_buildings') {
      sub = b.cls === 'commercial' ? 'commercial'
          : b.cls === 'public' ? 'education'
          : (b.cls === 'residential' || !b.cls || b.cls === 'other') ? 'residential'
          : 'other_buildings';
    }
    if (counts[sub] !== undefined) counts[sub]++;
    else counts.other_buildings++;
  }
  return {
    ...counts,
    roadsMajorKm: ((m.lines?.ROADS_MAJOR?.length || 0) * (m.size / 1000) * 0.08).toFixed(1),
    roadsMinorKm: ((m.lines?.ROADS_MINOR?.length || 0) * (m.size / 1000) * 0.12).toFixed(1),
    totalBuildings: m.buildings?.length || 0,
    trees: m.trees?.length || 0,
    relief: Math.round(m.stats?.relief || 0)
  };
}

export function toggleMaquetaMode(enabled) {
  if (!ctx || !ctx.lastModel) return;
  showModel(null, ctx.lastModel, { keepCamera: true, chunkMode: enabled });
}
export const toggleChunkMode = toggleMaquetaMode;
export const isMaquetaModeActive = () => chunkModeActive;

export function triggerResize() {
  if (!ctx) return;
  const { renderer, camera } = ctx;
  const container = renderer.domElement?.parentElement;
  if (!container) return;
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  if (w > 0 && h > 0) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

export function setCameraView(type) {
  if (!ctx) return;
  const { camera, controls } = ctx;
  const s = ctx.modelSize || 1000;
  const zMid = ctx.zMid || 0;
  controls.target.set(0, 0, zMid);

  if (type === 'iso' || type === 'chunk') {
    // True 45-degree architectural axonometric / isometric projection via narrow telephoto FOV
    camera.fov = 10;
    camera.position.set(s * 3.5, -s * 3.5, s * 3.1 + zMid);
  } else if (type === 'top') {
    camera.fov = 20;
    camera.position.set(0, -0.001, s * 2.8 + zMid);
  } else {
    camera.fov = 35;
    camera.position.set(s * 0.62, -s * 0.95, s * 0.72 + zMid);
  }
  camera.near = Math.max(1, s / 500);
  camera.far = s * 50;
  camera.updateProjectionMatrix();
  controls.update();
}

export function setWalkRings(enabled, minutes = 15) {
  if (!ctx || !ctx.group) return;
  if (!ctx.walkRingsGroup) {
    ctx.walkRingsGroup = new THREE.Group();
    ctx.group.add(ctx.walkRingsGroup);
  }
  ctx.walkRingsGroup.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  ctx.walkRingsGroup.clear();
  if (!enabled) return;

  const model = ctx.lastModel;
  const heightAt = (x, y) => (model?.grid?.heightAt ? model.grid.heightAt(x, y) : (ctx.zMid || 0));
  const modelRadius = (ctx.modelSize || 1000) / 2;

  const rings = [
    { r: Math.min(400, modelRadius * 0.42), min: 5, color: 0xe2e8f0, fillOp: 0.10, ringOp: 0.90 },
    { r: Math.min(800, modelRadius * 0.72), min: 10, color: 0xcbd5e1, fillOp: 0.06, ringOp: 0.65 },
    { r: Math.min(1200, modelRadius * 0.96), min: 15, color: 0x94a3b8, fillOp: 0.03, ringOp: 0.45 }
  ];

  for (const { r, min, color, fillOp, ringOp } of rings) {
    if (minutes !== 'all' && min > Number(minutes)) continue;

    // 1. Elevated 3D Ring Ribbon following terrain height
    const segments = 128;
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      const z = heightAt(x, y) + 3.5;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: ringOp, depthTest: false });
    const line = new THREE.Line(lineGeo, lineMat);
    line.renderOrder = 999;
    ctx.walkRingsGroup.add(line);

    // 2. Subtle Translucent Ring Band on Ground
    const bandGeo = new THREE.RingGeometry(Math.max(0, r - 6), r + 6, 96);
    const pos = bandGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      pos.setZ(i, heightAt(vx, vy) + 2.2);
    }
    bandGeo.computeVertexNormals();
    const bandMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: ringOp * 0.65,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const bandMesh = new THREE.Mesh(bandGeo, bandMat);
    bandMesh.renderOrder = 998;
    ctx.walkRingsGroup.add(bandMesh);

    // 3. Subtle Isochrone Fill Disc
    const discGeo = new THREE.CircleGeometry(r, 64);
    const dPos = discGeo.attributes.position;
    for (let i = 0; i < dPos.count; i++) {
      const vx = dPos.getX(i);
      const vy = dPos.getY(i);
      dPos.setZ(i, heightAt(vx, vy) + 1.5);
    }
    const discMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: fillOp,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.renderOrder = 997;
    ctx.walkRingsGroup.add(discMesh);
  }
}

export function setFloraZoneHighlight(enabled, speciesIndex = -1) {
  if (!ctx || !ctx.group) return;
  if (!ctx.floraZoneGroup) {
    ctx.floraZoneGroup = new THREE.Group();
    ctx.group.add(ctx.floraZoneGroup);
  }
  ctx.floraZoneGroup.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  ctx.floraZoneGroup.clear();
  if (!enabled) return;

  const model = ctx.lastModel;
  if (!model) return;
  const heightAt = (x, y) => (model?.grid?.heightAt ? model.grid.heightAt(x, y) : (ctx.zMid || 0));

  const palette = [0x4ade80, 0x2dd4bf, 0xa3e635, 0x34d399, 0x60a5fa];
  const zoneColor = speciesIndex >= 0 ? palette[speciesIndex % palette.length] : 0x4ade80;

  // Highlight Green Park Polygons as Ecological Flora Zones
  const greens = (model.areas?.GREEN ?? []).filter((r) => r.length > 2);
  greens.forEach((ring, idx) => {
    if (speciesIndex >= 0 && (idx % 3) !== (speciesIndex % 3) && greens.length > 3) return;
    const flat = [];
    const lifted = [];
    for (const [x, y] of ring) {
      flat.push(x, y);
      lifted.push([x, y, heightAt(x, y) + 2.0]);
    }
    const tri = earcut(flat, [], 2);
    const faces = [];
    for (let i = 0; i < tri.length; i += 3) faces.push({ v: [tri[i], tri[i + 1], tri[i + 2]] });
    const meshGeo = meshGeometry([{ verts: lifted, faces }]);
    const meshMat = new THREE.MeshBasicMaterial({
      color: zoneColor,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const m = new THREE.Mesh(meshGeo, meshMat);
    m.renderOrder = 995;
    ctx.floraZoneGroup.add(m);

    // Outline around the flora zone
    const pts = lifted.map(([x, y, z]) => new THREE.Vector3(x, y, z + 0.8));
    if (pts.length > 0) pts.push(pts[0].clone());
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({ color: zoneColor, transparent: true, opacity: 0.85, depthTest: false });
    const line = new THREE.Line(lineGeo, lineMat);
    line.renderOrder = 996;
    ctx.floraZoneGroup.add(line);
  });

  // Also highlight Tree Canopy Clusters in 3D
  const trees = model.trees || [];
  const step = Math.max(1, Math.floor(trees.length / 45));
  for (let i = 0; i < trees.length; i += step) {
    if (speciesIndex >= 0 && ((i / step) | 0) % 3 !== (speciesIndex % 3)) continue;
    const t = trees[i];
    const r = Math.max(14, (t.r || 4) * 3.2);
    const circleGeo = new THREE.RingGeometry(r * 0.72, r, 32);
    const pos = circleGeo.attributes.position;
    for (let j = 0; j < pos.count; j++) {
      const vx = t.x + pos.getX(j);
      const vy = t.y + pos.getY(j);
      pos.setXYZ(j, vx, vy, heightAt(vx, vy) + 2.2);
    }
    const mat = new THREE.MeshBasicMaterial({
      color: zoneColor,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const ringMesh = new THREE.Mesh(circleGeo, mat);
    ringMesh.renderOrder = 996;
    ctx.floraZoneGroup.add(ringMesh);
  }
}




