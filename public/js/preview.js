// 3D-превью модели (three.js).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import earcut from 'https://cdn.jsdelivr.net/npm/earcut@3.0.1/+esm';
import { triangulate, UNIT_TREE } from './data.js?v=4.1';
import { pinStore } from './pins.js?v=1.0';
import { feasibilityStore, LEVEL_HEIGHT_M } from './feasibility.js?v=1.0';

let ctx;

export const studioState = {
  satellite: {
    enabled: true,
    saturation: 100,
    contrast: 100,
    brightness: 100,
    invert: 0
  },
  contours: {
    visible: true,
    color: '#ffffff',
    labels: false, // Etiquetas apagadas en modelo abierto 3D navegable (solo en edición)
    opacity: 0.9
  },
  buildings: {
    finish: 'gis',  // 'white' (pure architectural chalk) | 'gis' (category colors) | 'mono' (graphite)
    edgeOpacity: 0.45
  },
  pins: {
    visible: false // Pines apagados en modelo abierto 3D navegable (solo en edición)
  }
};

function init(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0c0e);
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x828b94, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-600, -900, 1400);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 4000;
  const d = 1400;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const group = new THREE.Group();
  scene.add(group);

  // Click handler for interactive 3D pin dropping and lot location placement
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!ctx || !ctx.lastModel) return;
    const isPlacingPin = pinStore.isPlacing();
    const isPlacingLot = feasibilityStore.isPlacingLot;
    if (!isPlacingPin && !isPlacingLot) {
      // Raycast to select element for Inspector de Selección
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const targets = [];
      if (ctx.buildingMeshes?.length) targets.push(...ctx.buildingMeshes);
      if (conceptualBlocksGroup?.children?.length) targets.push(...conceptualBlocksGroup.children);
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        const hitObj = hits[0].object;
        const u = hitObj.userData || {};
        const selType = document.getElementById('sel-elem-type');
        const selH = document.getElementById('sel-elem-height');
        const selL = document.getElementById('sel-elem-levels');
        const selF = document.getElementById('sel-elem-footprint');
        const selT = document.getElementById('sel-elem-tag');
        if (selType) selType.textContent = u.type || 'Edificación Urbana';
        if (selH) selH.textContent = u.height || '18.0 m';
        if (selL) selL.textContent = u.levels || '5 pisos';
        if (selF) selF.textContent = u.footprint || '850 m²';
        if (selT) selT.textContent = u.tag || '02_Estructura_y_Nucleos';
      }
      return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const targets = [];
    if (ctx.terrainMesh) targets.push(ctx.terrainMesh);
    if (ctx.buildingMeshes?.length) targets.push(...ctx.buildingMeshes);
    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
      const hit = hits[0].point;
      const model = ctx.lastModel;

      if (isPlacingLot) {
        feasibilityStore.setSiteOrigin(hit.x, hit.y, hit.z);
        feasibilityStore.setPlacingMode(false);
        renderFeasibilityVolume();
        return;
      }

      if (isPlacingPin) {
        const lat = model.center.lat + (hit.y / 111319.49);
        const lon = model.center.lon + (hit.x / (111319.49 * Math.cos((model.center.lat * Math.PI) / 180)));
        pinStore.addPin({
          x: hit.x,
          y: hit.y,
          z: hit.z,
          lat,
          lon
        });
        pinStore.setPlacingMode(false);
      }
    }
  });

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
  for (const b of (bodies || [])) {
    if (b && b.faces && Array.isArray(b.faces)) {
      count += triangulate(b.faces).length;
    }
  }
  const pos = new Float32Array(count * 3);
  let k = 0;
  for (const b of (bodies || [])) {
    if (b && b.faces && b.verts && Array.isArray(b.faces)) {
      for (const i of triangulate(b.faces)) {
        const p = b.verts[i];
        if (p) {
          pos[k++] = p[0];
          pos[k++] = p[1];
          pos[k++] = p[2];
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function edgeGeometry(bodies) {
  const pos = [];
  for (const b of (bodies || [])) {
    if (!b || !b.faces || !b.verts || !Array.isArray(b.faces)) continue;
    for (const { v, vis } of b.faces) {
      if (!v || !Array.isArray(v)) continue;
      v.forEach((a, i) => {
        if (vis && !vis[i]) return;
        const p = b.verts[a], q = b.verts[v[(i + 1) % v.length]];
        if (p && q) pos.push(p[0], p[1], p[2], q[0], q[1], q[2]);
      });
    }
  }
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
let nolliModeActive = false;
let nolliInverted = false;

function buildTerrainSkirtGeometry(grid, size, baseZ, isCircle = false) {
  const half = size / 2;
  const pos = [];

  if (isCircle) {
    const segments = 96;
    const radius = half;
    for (let i = 0; i < segments; i++) {
      const theta1 = (i / segments) * Math.PI * 2;
      const theta2 = ((i + 1) / segments) * Math.PI * 2;
      const x1 = Math.cos(theta1) * radius, y1 = Math.sin(theta1) * radius;
      const x2 = Math.cos(theta2) * radius, y2 = Math.sin(theta2) * radius;
      const z1 = grid.heightAt ? grid.heightAt(x1, y1) : 0;
      const z2 = grid.heightAt ? grid.heightAt(x2, y2) : 0;

      // Vertical curtain wall
      pos.push(x1, y1, z1, x2, y2, z2, x1, y1, baseZ);
      pos.push(x2, y2, z2, x2, y2, baseZ, x1, y1, baseZ);

      // Bottom cap triangular fan (solid closed base)
      pos.push(0, 0, baseZ, x2, y2, baseZ, x1, y1, baseZ);
    }
  } else {
    const n = grid.n || 64;
    const step = size / n;

    // Edge 1: South (y = -half, x from -half to +half)
    for (let i = 0; i < n; i++) {
      const x1 = -half + i * step, x2 = -half + (i + 1) * step;
      const y = -half;
      const z1 = grid.heightAt ? grid.heightAt(x1, y) : 0, z2 = grid.heightAt ? grid.heightAt(x2, y) : 0;
      pos.push(x1, y, z1, x2, y, z2, x1, y, baseZ);
      pos.push(x2, y, z2, x2, y, baseZ, x1, y, baseZ);
    }
    // Edge 2: North (y = +half, x from -half to +half)
    for (let i = 0; i < n; i++) {
      const x1 = -half + i * step, x2 = -half + (i + 1) * step;
      const y = half;
      const z1 = grid.heightAt ? grid.heightAt(x1, y) : 0, z2 = grid.heightAt ? grid.heightAt(x2, y) : 0;
      pos.push(x1, y, z1, x1, y, baseZ, x2, y, z2);
      pos.push(x2, y, z2, x1, y, baseZ, x2, y, baseZ);
    }
    // Edge 3: West (x = -half, y from -half to +half)
    for (let j = 0; j < n; j++) {
      const y1 = -half + j * step, y2 = -half + (j + 1) * step;
      const x = -half;
      const z1 = grid.heightAt ? grid.heightAt(x, y1) : 0, z2 = grid.heightAt ? grid.heightAt(x, y2) : 0;
      pos.push(x, y1, z1, x, y1, baseZ, x, y2, z2);
      pos.push(x, y2, z2, x, y1, baseZ, x, y2, baseZ);
    }
    // Edge 4: East (x = +half, y from -half to +half)
    for (let j = 0; j < n; j++) {
      const y1 = -half + j * step, y2 = -half + (j + 1) * step;
      const x = half;
      const z1 = grid.heightAt ? grid.heightAt(x, y1) : 0, z2 = grid.heightAt ? grid.heightAt(x, y2) : 0;
      pos.push(x, y1, z1, x, y2, z2, x, y1, baseZ);
      pos.push(x, y2, z2, x, y2, baseZ, x, y1, baseZ);
    }

    // Bottom slab cap (both winding directions to guarantee solid hermetic fill)
    pos.push(-half, -half, baseZ, half, -half, baseZ, -half, half, baseZ);
    pos.push(half, -half, baseZ, half, half, baseZ, -half, half, baseZ);
    pos.push(-half, -half, baseZ, -half, half, baseZ, half, -half, baseZ);
    pos.push(half, -half, baseZ, -half, half, baseZ, half, half, baseZ);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

function createAltitudeSprite(text, size) {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 76;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);

  // High contrast architectural altitude tag (Moodboard Image 1 style)
  c.fillStyle = 'rgba(12, 13, 17, 0.88)';
  c.beginPath();
  const r = 10, w = 236, h = 72, x = 2, y = 2;
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  c.lineWidth = 2.5;
  c.stroke();

  c.fillStyle = '#ffffff';
  c.font = 'bold 32px "JetBrains Mono", monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 120, 38);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  const scale = (size || 1000) * 0.055;
  sprite.scale.set(scale, scale * (76 / 240), 1);
  return sprite;
}

function createPinBadgeSprite(label, colorHex, size, style = 'glass') {
  const canvas = document.createElement('canvas');
  canvas.width = 380;
  canvas.height = 84;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);

  const r = 12, w = 376, h = 80, x = 2, y = 2;
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();

  let textFill = '#ffffff';
  let dotFill = colorHex || '#f97316';

  if (style === 'white') {
    c.fillStyle = '#ffffff';
    c.fill();
    c.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    c.lineWidth = 2.5;
    c.stroke();
    textFill = '#090a0f';
  } else if (style === 'accent') {
    c.fillStyle = colorHex || '#f97316';
    c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    c.lineWidth = 2.5;
    c.stroke();
    textFill = '#ffffff';
    dotFill = '#ffffff';
  } else if (style === 'wire') {
    c.fillStyle = 'rgba(10, 11, 15, 0.4)';
    c.fill();
    c.strokeStyle = colorHex || '#f97316';
    c.lineWidth = 2.5;
    c.stroke();
    textFill = '#ffffff';
  } else {
    // Glass default
    c.fillStyle = 'rgba(10, 11, 15, 0.92)';
    c.fill();
    c.strokeStyle = colorHex || '#f97316';
    c.lineWidth = 3;
    c.stroke();
    textFill = '#ffffff';
  }

  // Color beacon dot
  c.beginPath();
  c.arc(36, 42, 12, 0, Math.PI * 2);
  c.fillStyle = dotFill;
  c.fill();

  // Text label
  c.fillStyle = textFill;
  c.font = 'bold 26px "Inter", sans-serif';
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  const cleanLabel = (label || 'Marcador').length > 18 ? (label.slice(0, 17) + '…') : label;
  c.fillText(cleanLabel, 62, 42);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  const scale = (size || 1000) * 0.085;
  sprite.scale.set(scale, scale * (84 / 380), 1);
  return sprite;
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
    skirt: new THREE.Group(),
    pins: new THREE.Group(),
    feasibility: new THREE.Group()
  };
  ctx.layerGroups = layerGroups;
  ctx.buildingMeshes = [];
  Object.values(layerGroups).forEach((g) => group.add(g));

  const isMaqueta = chunkModeActive;
  const isNolli = nolliModeActive;

  // Lighting & Background setup
  ctx.sun = ctx.sun || scene.children.find((c) => c.isDirectionalLight);
  if (isNolli) {
    scene.background = new THREE.Color(nolliInverted ? 0x090a0d : 0xffffff);
    if (ctx.sun) {
      ctx.sun.position.set(0, 0, 2.5 * s);
      ctx.sun.intensity = 1.0;
    }
  } else if (isMaqueta) {
    scene.background = new THREE.Color(0x090a0d);
    if (ctx.sun) {
      ctx.sun.position.set(-0.9 * s, -1.1 * s, 1.8 * s);
      ctx.sun.intensity = 2.3;
    }
  } else {
    scene.background = new THREE.Color(0x090a0d);
    if (ctx.sun) {
      ctx.sun.position.set(-0.7 * s, -1.0 * s, 1.5 * s);
      ctx.sun.intensity = 1.75;
    }
  }

  if (ctx.sun && ctx.sun.shadow) {
    const d = Math.max(1200, s * 1.5);
    ctx.sun.shadow.camera.left = -d;
    ctx.sun.shadow.camera.right = d;
    ctx.sun.shadow.camera.top = d;
    ctx.sun.shadow.camera.bottom = -d;
    ctx.sun.shadow.camera.near = 10;
    ctx.sun.shadow.camera.far = s * 6.0;
    ctx.sun.shadow.camera.updateProjectionMatrix();
  }

  // 1. Terrain & Physical Pedestal Skirt
  if (model.terrain) {
    const geo = meshGeometry([model.terrain]);
    let mat;
    if (isNolli) {
      mat = new THREE.MeshBasicMaterial({
        color: nolliInverted ? 0x090a0d : 0xffffff,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2
      });
    } else if (isMaqueta) {
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
      mat = new THREE.MeshStandardMaterial({
        color: 0xdad6cc,
        roughness: 0.90,
        metalness: 0.02,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2
      });
      if (model.imagery) {
        const pos = geo.attributes.position, uv = new Float32Array(pos.count * 2), h = s / 2;
        for (let i = 0; i < pos.count; i++) { uv[2 * i] = (pos.getX(i) + h) / s; uv[2 * i + 1] = (pos.getY(i) + h) / s; }
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      }
    }
    ctx.terrainMesh = new THREE.Mesh(geo, mat);
    ctx.terrainMesh.receiveShadow = true;
    layerGroups.terrain.add(ctx.terrainMesh);

    // Apply live satellite filter if imagery is available
    if (!isNolli && !isMaqueta && model.imagery) {
      updateSatelliteTexture();
    }

    // Physical architectural pedestal base (visible in both modes, styled to match)
    if (model.grid) {
      const minH = model.grid?.minH ?? 0;
      const baseZ = minH - s * 0.055;
      const skirtGeo = buildTerrainSkirtGeometry(model.grid, s, baseZ, model.shape === 'circle');
      const skirtMat = new THREE.MeshStandardMaterial({
        color: isNolli ? (nolliInverted ? 0x090a0d : 0xffffff) : (isMaqueta ? 0x1c1d22 : 0x14151a),
        roughness: 0.94,
        metalness: 0.02,
        side: THREE.DoubleSide
      });
      const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
      skirtMesh.receiveShadow = true;
      layerGroups.skirt.add(skirtMesh);
      const skirtEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(skirtGeo, 30),
        new THREE.LineBasicMaterial({ color: isNolli ? (nolliInverted ? 0x27272a : 0xd4d4d8) : (isMaqueta ? 0x3f3f46 : 0x27272a), transparent: true, opacity: 0.55 })
      );
      layerGroups.skirt.add(skirtEdges);
    }
  }

  // 2. Buildings (Architectural White Chalk, GIS Typology, or Graphite)
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

  const edgeColor = isNolli ? (nolliInverted ? 0xffffff : 0x000000) : (isMaqueta ? 0x27272a : 0x18181b);
  const edgeOp = isNolli ? 1.0 : (isMaqueta ? 0.38 : (studioState.buildings.edgeOpacity || 0.45));
  const finish = studioState.buildings.finish || 'white';

  for (const [catKey, bList] of Object.entries(categorized)) {
    if (!bList.length) continue;
    const geo = meshGeometry(bList);
    const edges = edgeGeometry(bList);
    const targetGroup = layerGroups[catKey] || layerGroups.other_buildings;

    let bldgColor = 0xfcfcfd; // Architectural white chalk
    if (finish === 'gis') {
      bldgColor = gisColors[catKey] || 0xf4f4f6;
    } else if (finish === 'mono') {
      bldgColor = 0x27272a;
    } else {
      bldgColor = 0xfafafa;
    }

    let mat;
    if (isNolli) {
      mat = new THREE.MeshBasicMaterial({
        color: nolliInverted ? 0xffffff : 0x111114,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      });
    } else if (isMaqueta) {
      mat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.85, metalness: 0.02, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    } else {
      mat = new THREE.MeshStandardMaterial({ color: bldgColor, roughness: 0.88, metalness: 0.02, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    }
    const bMesh = new THREE.Mesh(geo, mat);
    bMesh.castShadow = !isNolli;
    bMesh.receiveShadow = !isNolli;
    targetGroup.add(bMesh);
    ctx.buildingMeshes.push(bMesh);
    targetGroup.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: edgeOp })));
  }

  // 3. Roads, Railways & Paths
  const road = (layers) => layers.flatMap((l) => (model.lines?.[l] ?? []).map((pts) => ({ pts, closed: false })));
  const addLinesTo = (targetGroup, items, color, opacity) => {
    if (!items.length) return;
    targetGroup.add(new THREE.LineSegments(lineGeometry(items, 0.9), new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
  };

  if (isNolli) {
    addLinesTo(layerGroups.roads_major, road(['ROADS_MAJOR']), nolliInverted ? 0x27272a : 0xe4e4e7, 0.4);
    addLinesTo(layerGroups.roads_minor, road(['ROADS_MINOR', 'PATHS']), nolliInverted ? 0x1e2024 : 0xf4f4f5, 0.3);
  } else if (isMaqueta) {
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
    const waterColor = isNolli ? (nolliInverted ? 0x090a0d : 0xffffff) : (isMaqueta ? 0xd4d4d8 : 0x38bdf8);
    const waterOp = isNolli ? 1.0 : (isMaqueta ? 0.9 : 0.92);
    const waterMat = isNolli
      ? new THREE.MeshBasicMaterial({ color: waterColor, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
      : (isMaqueta
          ? new THREE.MeshStandardMaterial({ color: waterColor, roughness: 0.35, metalness: 0.05, transparent: true, opacity: waterOp, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
          : new THREE.MeshLambertMaterial({ color: waterColor, transparent: true, opacity: waterOp, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
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
    const greenMat = isNolli
      ? new THREE.MeshBasicMaterial({ color: nolliInverted ? 0x090a0d : 0xffffff, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
      : (isMaqueta
          ? new THREE.MeshStandardMaterial({ color: 0xdadadd, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
          : new THREE.MeshLambertMaterial({ color: 0x4ade80, transparent: true, opacity: 0.45, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    layerGroups.green.add(new THREE.Mesh(meshGeometry(greens), greenMat));
  }

  // 6. Contours (Topography) & Elevation Labels (Moodboard Image 1)
  if (model.contours?.length && !isNolli) {
    const cColor = studioState.contours.color ? parseInt(studioState.contours.color.replace('#', '0x'), 16) : (isMaqueta ? 0x71717a : 0xffffff);
    // Add contour line segments with +0.5m elevation lift so they float cleanly over satellite texture
    const pos = [];
    for (const { pts, closed } of model.contours) {
      const n = closed ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        pos.push(p[0], p[1], p[2] + 0.6, q[0], q[1], q[2] + 0.6);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: cColor, transparent: true, opacity: studioState.contours.opacity || 0.9, depthTest: true });
    layerGroups.contours.add(new THREE.LineSegments(g, lineMat));

    // Numeric altitude labels
    if (studioState.contours.labels) {
      const minH = model.grid?.minH ?? 0;
      const ci = model.contourInterval || 5;
      const stepInterval = ci <= 5 ? 20 : (ci * 2);
      const labeled = model.contours.filter((c) => Math.round(c.z) % stepInterval === 0 && c.pts.length > 8);
      for (const c of labeled) {
        const midIdx = Math.floor(c.pts.length * 0.45);
        const pt = c.pts[midIdx];
        if (!pt) continue;
        const elevationMeters = Math.round(c.z + minH);
        const sprite = createAltitudeSprite(`${elevationMeters} m`, s);
        sprite.position.set(pt[0], pt[1], pt[2] + 2.0);
        layerGroups.contours.add(sprite);
      }
    }
  }

  // 7. Trees (hidden in Nolli mode for pure architectural full/empty contrast)
  if (model.trees?.length && !isNolli) {
    const unit = meshGeometry([UNIT_TREE]);
    const treeMat = isMaqueta
      ? new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.95, metalness: 0.01 })
      : new THREE.MeshLambertMaterial({ color: 0x22c55e });
    const trees = new THREE.InstancedMesh(unit, treeMat, model.trees.length);
    const mtx = new THREE.Matrix4();
    model.trees.forEach((t, i) => {
      const tx = t.x ?? t.pos?.[0] ?? 0;
      const ty = t.y ?? t.pos?.[1] ?? 0;
      const tz = t.z ?? t.pos?.[2] ?? 0;
      const tr = t.r || 3.5;
      const th = t.h || 7;
      trees.setMatrixAt(i, mtx.makeScale(tr, tr, th).setPosition(tx, ty, tz));
    });
    layerGroups.trees.add(trees);
  }

  // 8. Bridges
  if (model.bridges?.length) {
    layerGroups.roads_major.add(new THREE.Mesh(meshGeometry(model.bridges), new THREE.MeshLambertMaterial({ color: isMaqueta ? 0xf5f5f7 : 0xd9d6cf, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
    layerGroups.roads_major.add(new THREE.LineSegments(edgeGeometry(model.bridges), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })));
  }

  // 9. Interactive 3D Architectural Pins
  render3DPins();
  renderFeasibilityVolume();

  // Camera placement: Centered in middle viewport at true 45° architectural isometric angle
  if (!keepCamera) {
    camera.fov = 35;
    controls.target.set(0, 0, zMid);
    const isoDist = s * 1.55;
    const cos45 = Math.SQRT1_2; // 0.707106...
    camera.position.set(isoDist * cos45, -isoDist * cos45, s * 1.05 + zMid);
    camera.near = Math.max(1, s / 1000);
    camera.far = s * 40;
    camera.updateProjectionMatrix();
    controls.update();
    triggerResize();
  }
  document.getElementById('view-btn-studio')?.classList.remove('disabled');
  document.getElementById('view-btn-mapper')?.classList.remove('disabled');
  document.getElementById('view-btn-illu')?.classList.remove('disabled');
  document.getElementById('view-btn-comp')?.classList.remove('disabled');
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

  const d = s * 4.2;
  if (type === 'iso-nw') {
    camera.fov = 10;
    camera.position.set(-d * 0.7071, d * 0.7071, d * 0.7071 + zMid);
  } else if (type === 'iso-ne') {
    camera.fov = 10;
    camera.position.set(d * 0.7071, d * 0.7071, d * 0.7071 + zMid);
  } else if (type === 'iso-sw' || type === 'iso' || type === 'iso45') {
    camera.fov = 10;
    camera.position.set(-d * 0.7071, -d * 0.7071, d * 0.7071 + zMid);
  } else if (type === 'iso-se') {
    camera.fov = 10;
    camera.position.set(d * 0.7071, -d * 0.7071, d * 0.7071 + zMid);
  } else if (type === 'top') {
    camera.fov = 16;
    camera.position.set(0, -0.001, s * 3.4 + zMid);
  } else if (type === 'eye') {
    camera.fov = 48;
    camera.position.set(0, -s * 0.52, zMid + 32);
  } else {
    camera.fov = 35;
    camera.position.set(s * 0.62, -s * 0.95, s * 0.72 + zMid);
  }
  camera.near = Math.max(1, s / 500);
  camera.far = s * 50;
  camera.updateProjectionMatrix();
  controls.update();
}
window.setCameraView = setCameraView;

export function setPreviewSun(azDeg = 135, altDeg = 45) {
  if (!ctx || !ctx.sun) return;
  const s = ctx.modelSize || 1000;
  const azRad = (azDeg * Math.PI) / 180;
  const altRad = (Math.max(10, altDeg) * Math.PI) / 180;
  const dist = s * 2.0;
  const sx = dist * Math.sin(azRad) * Math.cos(altRad);
  const sy = dist * Math.cos(azRad) * Math.cos(altRad);
  const sz = dist * Math.sin(altRad);
  ctx.sun.position.set(sx, sy, sz);
  ctx.sun.target.position.set(0, 0, ctx.zMid || 0);
  ctx.sun.target.updateMatrixWorld();
}
window.setPreviewSun = setPreviewSun;

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

export function updateSatelliteTexture(customFilters) {
  if (!ctx || !ctx.terrainMesh) return;
  if (customFilters) Object.assign(studioState.satellite, customFilters);
  const { enabled, saturation, contrast, brightness, invert } = studioState.satellite;
  const mat = ctx.terrainMesh.material;
  if (!mat) return;

  if (!enabled || !ctx.lastModel?.imagery) {
    if (mat.map) {
      mat.map.dispose();
      mat.map = null;
    }
    mat.color.set(chunkModeActive ? 0xe4e4e8 : 0xdad6cc);
    mat.needsUpdate = true;
    return;
  }

  const imgCanvas = ctx.lastModel.imagery.canvas;
  const n = Math.min(2048, imgCanvas.width);
  if (!ctx.satelliteCanvas) {
    ctx.satelliteCanvas = document.createElement('canvas');
    ctx.satelliteCanvas.width = ctx.satelliteCanvas.height = n;
  }
  const sctx = ctx.satelliteCanvas.getContext('2d');
  sctx.clearRect(0, 0, n, n);
  sctx.filter = `saturate(${saturation}%) contrast(${contrast}%) brightness(${brightness}%) invert(${invert}%)`;
  sctx.drawImage(imgCanvas, 0, 0, n, n);
  sctx.filter = 'none';

  if (!mat.map) {
    mat.map = new THREE.CanvasTexture(ctx.satelliteCanvas);
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.map.anisotropy = 8;
  } else {
    mat.map.image = ctx.satelliteCanvas;
    mat.map.needsUpdate = true;
  }
  mat.color.set(0xffffff);
  mat.needsUpdate = true;
}

export function setContourOptions(opts) {
  if (!ctx || !ctx.layerGroups?.contours || !ctx.lastModel) return;
  if (opts) Object.assign(studioState.contours, opts);
  const { visible, color, labels, opacity } = studioState.contours;
  ctx.layerGroups.contours.visible = Boolean(visible);
  if (!visible) return;

  ctx.layerGroups.contours.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
  ctx.layerGroups.contours.clear();

  const model = ctx.lastModel;
  const s = ctx.modelSize || 1000;
  if (model.contours?.length) {
    const colHex = color ? parseInt(color.replace('#', '0x'), 16) : 0xffffff;
    const pos = [];
    for (const { pts, closed } of model.contours) {
      const n = closed ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        pos.push(p[0], p[1], p[2] + 0.6, q[0], q[1], q[2] + 0.6);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: colHex, transparent: true, opacity: opacity || 0.9, depthTest: true });
    ctx.layerGroups.contours.add(new THREE.LineSegments(g, lineMat));

    if (labels) {
      const minH = model.grid?.minH ?? 0;
      const ci = model.contourInterval || 5;
      const stepInterval = ci <= 5 ? 20 : (ci * 2);
      const labeled = model.contours.filter((c) => Math.round(c.z) % stepInterval === 0 && c.pts.length > 8);
      for (const c of labeled) {
        const midIdx = Math.floor(c.pts.length * 0.45);
        const pt = c.pts[midIdx];
        if (!pt) continue;
        const elevationMeters = Math.round(c.z + minH);
        const sprite = createAltitudeSprite(`${elevationMeters} m`, s);
        sprite.position.set(pt[0], pt[1], pt[2] + 2.0);
        ctx.layerGroups.contours.add(sprite);
      }
    }
  }
}

export function setBuildingFinish(finish) {
  if (finish) studioState.buildings.finish = finish;
  if (!ctx || !ctx.lastModel) return;
  showModel(null, ctx.lastModel, { keepCamera: true, chunkMode: chunkModeActive });
}

export function render3DPins() {
  if (!ctx || !ctx.layerGroups?.pins) return;
  const pinGroup = ctx.layerGroups.pins;
  pinGroup.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
  pinGroup.clear();

  if (!studioState.pins.visible) return;
  const pins = pinStore.getPins().filter((p) => p.visible);
  const s = ctx.modelSize || 1000;
  for (const pin of pins) {
    const colHex = parseInt(pin.color.replace('#', '0x'), 16);
    const pinStemHeight = pin.needleHeight ? Number(pin.needleHeight) : (s * 0.048);

    // 1. Ground Anchor Ring
    const groundGeo = new THREE.RingGeometry(s * 0.005, s * 0.011, 24);
    const groundMat = new THREE.MeshBasicMaterial({ color: colHex, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthTest: false });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(pin.x, pin.y, pin.z + 0.4);
    pinGroup.add(groundMesh);

    // 2. Vertical Slender Stem / Leader Line
    const stemGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(pin.x, pin.y, pin.z + 0.3),
      new THREE.Vector3(pin.x, pin.y, pin.z + pinStemHeight)
    ]);
    const stemMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false });
    const stem = new THREE.Line(stemGeo, stemMat);
    pinGroup.add(stem);

    // 3. Glowing Spherical Beacon at Top
    const beaconGeo = new THREE.SphereGeometry(s * 0.009, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: colHex, depthTest: false });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(pin.x, pin.y, pin.z + pinStemHeight);
    pinGroup.add(beacon);

    // 4. Sleek High-Res Architectural Text Badge (With customizable styles)
    const labelSprite = createPinBadgeSprite(pin.label, pin.color, s, pin.style || 'glass');
    labelSprite.position.set(pin.x, pin.y, pin.z + pinStemHeight + s * 0.024);
    pinGroup.add(labelSprite);
  }
}

// Keep 3D pins updated whenever the pinStore changes
pinStore.subscribe(() => {
  render3DPins();
});

export function renderFeasibilityVolume() {
  if (!ctx || !ctx.layerGroups?.feasibility || !ctx.lastModel) return;
  const fGroup = ctx.layerGroups.feasibility;
  fGroup.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
  fGroup.clear();

  if (!feasibilityStore.params.enabled) return;
  const metrics = feasibilityStore.compute(ctx.lastModel);
  const { lotRingLocal, footprintRingLocal, maxHeightM, effectiveLevels } = metrics;
  const mode = feasibilityStore.geometryMode || 'envelope';

  if (!lotRingLocal || lotRingLocal.length < 3) return;
  const baseZ = (lotRingLocal[0]?.[2] ?? 0) + 0.5;

  // 1. Contorno del lote original ('01_LOTE_OBJETIVO' - Rojo)
  const lotPts = lotRingLocal.map(([x, y]) => new THREE.Vector3(x, y, baseZ + 0.2));
  lotPts.push(lotPts[0].clone());
  const lotLineGeo = new THREE.BufferGeometry().setFromPoints(lotPts);
  const lotLineMat = new THREE.LineBasicMaterial({ color: 0xff3b30, depthTest: false, transparent: true, opacity: 0.95 });
  const lotLine = new THREE.Line(lotLineGeo, lotLineMat);
  lotLine.renderOrder = 1001;
  fGroup.add(lotLine);

  if (!footprintRingLocal || footprintRingLocal.length < 3 || maxHeightM <= 0.1) return;

  const shape = new THREE.Shape();
  footprintRingLocal.forEach(([x, y], idx) => {
    if (idx === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();

  // 2. MODO 1: ENVOLVENTE NORMATIVA (Caja translúcida CUS/COS)
  if (mode === 'envelope') {
    const extrudeGeo = new THREE.ExtrudeGeometry(shape, { depth: maxHeightM, bevelEnabled: false });
    extrudeGeo.translate(0, 0, baseZ);

    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.22,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const volumeMesh = new THREE.Mesh(extrudeGeo, boxMat);
    volumeMesh.renderOrder = 1000;
    fGroup.add(volumeMesh);

    // Aristas del volumen normativo
    const edgesGeo = new THREE.EdgesGeometry(extrudeGeo, 20);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.9 });
    const edgesLine = new THREE.LineSegments(edgesGeo, edgesMat);
    edgesLine.renderOrder = 1002;
    fGroup.add(edgesLine);

    // Líneas de entrepiso (niveles) sobre el volumen translúcido
    const wholeLevels = Math.floor(effectiveLevels);
    for (let lvl = 1; lvl <= wholeLevels; lvl++) {
      const zLvl = baseZ + lvl * LEVEL_HEIGHT_M;
      if (zLvl >= baseZ + maxHeightM - 0.1) break;
      const ringPts = footprintRingLocal.map(([x, y]) => new THREE.Vector3(x, y, zLvl));
      ringPts.push(ringPts[0].clone());
      const flGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
      const flMat = new THREE.LineBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.55 });
      const flLine = new THREE.Line(flGeo, flMat);
      flLine.renderOrder = 1002;
      fGroup.add(flLine);
    }
  }

  // 3. MODO 2: LEVANTAMIENTO PARAMÉTRICO (Masa arquitectónica sólida tipo maqueta)
  else if (mode === 'massing') {
    const massingGeo = new THREE.ExtrudeGeometry(shape, { depth: maxHeightM, bevelEnabled: false });
    massingGeo.translate(0, 0, baseZ);

    const massMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const massMesh = new THREE.Mesh(massingGeo, massMat);
    massMesh.castShadow = true;
    massMesh.receiveShadow = true;
    fGroup.add(massMesh);

    // Siluetas y aristas arquitectónicas de masa
    const massEdges = new THREE.EdgesGeometry(massingGeo, 15);
    const massEdgesMat = new THREE.LineBasicMaterial({ color: 0x1e293b, linewidth: 1.5 });
    const massLine = new THREE.LineSegments(massEdges, massEdgesMat);
    fGroup.add(massLine);

    // Franjas de losa / entrepisos arquitectónicos
    const wholeLevels = Math.floor(effectiveLevels);
    for (let lvl = 1; lvl <= wholeLevels; lvl++) {
      const zLvl = baseZ + lvl * LEVEL_HEIGHT_M;
      if (zLvl >= baseZ + maxHeightM - 0.1) break;
      const ringPts = footprintRingLocal.map(([x, y]) => new THREE.Vector3(x, y, zLvl));
      ringPts.push(ringPts[0].clone());
      const flGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
      const flMat = new THREE.LineBasicMaterial({ color: 0x0284c7, opacity: 0.85 });
      fGroup.add(new THREE.Line(flGeo, flMat));
    }
  }

  // 4. MODO 3: PROYECTO 3D IMPORTADO (Modelo exportado de SketchUp / OBJ / GLTF)
  else if (mode === 'project') {
    if (feasibilityStore.projectModel?.object) {
      const pObj = feasibilityStore.projectModel.object.clone();
      const s = feasibilityStore.projectScale || 1.0;
      pObj.scale.set(s, s, s);
      const totalRot = (feasibilityStore.siteRotation + (feasibilityStore.projectRotY || 0)) * (Math.PI / 180);
      pObj.rotation.z = totalRot;
      const posX = (feasibilityStore.siteOrigin.x || 0) + (feasibilityStore.projectOffsetX || 0);
      const posY = (feasibilityStore.siteOrigin.y || 0) + (feasibilityStore.projectOffsetY || 0);
      const terrainZ = ctx.lastModel?.grid?.heightAt ? ctx.lastModel.grid.heightAt(posX, posY) : baseZ;
      const pZ = terrainZ + (feasibilityStore.projectOffsetZ || 0);
      pObj.position.set(posX, posY, pZ);

      // Apply finish and shadow casting
      applyFinishToObject(pObj, feasibilityStore.projectFinish || 'white');
      fGroup.add(pObj);
    }

    // Dibujar wireframe de envolvente como referencia normativa
    const ghostExtrude = new THREE.ExtrudeGeometry(shape, { depth: maxHeightM, bevelEnabled: false });
    ghostExtrude.translate(0, 0, baseZ);
    const ghostEdges = new THREE.EdgesGeometry(ghostExtrude, 20);
    const ghostLine = new THREE.LineSegments(ghostEdges, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 }));
    fGroup.add(ghostLine);
  }
}

function applyFinishToObject(root, finish = 'white') {
  if (!root) return;
  const finishConfigs = {
    white: { color: 0xf8fafc, roughness: 0.35, metalness: 0.05 },
    travertine: { color: 0xf3e8d9, roughness: 0.65, metalness: 0.05 },
    concrete: { color: 0x94a3b8, roughness: 0.85, metalness: 0.10 },
    steel: { color: 0x18181b, roughness: 0.25, metalness: 0.85 },
    accent: { color: 0x0284c7, roughness: 0.30, metalness: 0.10 }
  };
  const cfg = finishConfigs[finish] || finishConfigs.white;
  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.material = new THREE.MeshStandardMaterial({
        color: cfg.color,
        roughness: cfg.roughness,
        metalness: cfg.metalness,
        side: THREE.DoubleSide
      });
    }
  });
}

/**
 * Carga un archivo 3D de proyecto (.glb, .gltf, .obj) exportado desde SketchUp, Revit, Rhino, etc.
 */
export async function loadProject3DFile(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();

  if (ext === 'skp') {
    const res = await fetch('/api/convert-skp', {
      method: 'POST',
      body: file,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status} al procesar archivo SketchUp (.skp)`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.parse(arrayBuffer, '', (gltf) => {
        const root = gltf.scene || gltf.scenes[0];
        const bbox = new THREE.Box3().setFromObject(root);
        const center = bbox.getCenter(new THREE.Vector3());
        root.position.set(-center.x, -center.y, -bbox.min.z);
        const wrapper = new THREE.Group();
        wrapper.add(root);
        feasibilityStore.setProjectModel(wrapper, file.name);
        resolve(wrapper);
      }, reject);
    });
  } else if (ext === 'glb' || ext === 'gltf') {
    return new Promise((resolve, reject) => {
      reader.onload = async (e) => {
        try {
          const loader = new GLTFLoader();
          loader.parse(e.target.result, '', (gltf) => {
            const root = gltf.scene || gltf.scenes[0];
            const bbox = new THREE.Box3().setFromObject(root);
            const center = bbox.getCenter(new THREE.Vector3());
            root.position.set(-center.x, -center.y, -bbox.min.z);
            const wrapper = new THREE.Group();
            wrapper.add(root);
            feasibilityStore.setProjectModel(wrapper, file.name);
            resolve(wrapper);
          }, reject);
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  } else if (ext === 'obj') {
    return new Promise((resolve, reject) => {
      reader.onload = async (e) => {
        try {
          const loader = new OBJLoader();
          const obj = loader.parse(e.target.result);
          obj.traverse((child) => {
            if (child.isMesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0xf1f5f9,
                roughness: 0.35,
                metalness: 0.05,
                side: THREE.DoubleSide,
              });
            }
          });
          const bbox = new THREE.Box3().setFromObject(obj);
          const center = bbox.getCenter(new THREE.Vector3());
          obj.position.set(-center.x, -center.y, -bbox.min.z);
          const wrapper = new THREE.Group();
          wrapper.add(obj);
          feasibilityStore.setProjectModel(wrapper, file.name);
          resolve(wrapper);
        } catch (err) { reject(err); }
      };
      reader.readAsText(file);
    });
  } else {
    throw new Error('Formato no compatible. Por favor sube un archivo .skp (SketchUp), .glb, .gltf o .obj.');
  }
}

feasibilityStore.subscribe(() => {
  renderFeasibilityVolume();
});

let activeCanvasBg = '#090A0D';

// Integración con el Gestor de Vistas Guardadas (viewsManager)
window.getCamera3DState = () => {
  if (!ctx || !ctx.camera || !ctx.controls) return null;
  return {
    position: [ctx.camera.position.x, ctx.camera.position.y, ctx.camera.position.z],
    target: [ctx.controls.target.x, ctx.controls.target.y, ctx.controls.target.z],
    zoom: ctx.camera.zoom || 1,
    fov: ctx.camera.fov || 35,
  };
};

window.applyCamera3DView = (cam) => {
  if (!ctx || !ctx.camera || !ctx.controls || !cam) return;
  if (cam.fov) ctx.camera.fov = cam.fov;
  if (cam.position) ctx.camera.position.set(...cam.position);
  if (cam.target) ctx.controls.target.set(...cam.target);
  if (cam.zoom) ctx.camera.zoom = cam.zoom;
  ctx.camera.updateProjectionMatrix();
  ctx.controls.update();
};

window.getActiveCanvasBg = () => activeCanvasBg;

export function setProjectModelStyle({ color = '#1e3a8a', texture = 'solid' } = {}) {
  const obj = feasibilityStore.projectModel?.object || feasibilityStore.projectModel;
  if (!obj || !obj.traverse) return;
  const col = parseInt(color.replace('#', '0x'), 16);
  obj.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        if (texture === 'travertine') {
          child.material.color = new THREE.Color(0xf3e8d9);
          child.material.roughness = 0.65;
          child.material.metalness = 0.05;
        } else if (texture === 'concrete') {
          child.material.color = new THREE.Color(0x94a3b8);
          child.material.roughness = 0.85;
          child.material.metalness = 0.1;
        } else if (texture === 'wood') {
          child.material.color = new THREE.Color(0xd4a373);
          child.material.roughness = 0.6;
          child.material.metalness = 0.05;
        } else {
          child.material.color = new THREE.Color(col);
          child.material.roughness = 0.35;
          child.material.metalness = 0.1;
        }
        child.material.needsUpdate = true;
      }
    }
  });
}
window.setProjectModelStyle = setProjectModelStyle;


// --- Dynamic Background & Conceptual Massing Helpers ---
let conceptualBlocksGroup = null;

export function set3DCanvasBackground(hexColor) {
  activeCanvasBg = hexColor;
  if (!ctx || !ctx.scene) return;
  const col = new THREE.Color(hexColor);
  ctx.scene.background = col;
  if (ctx.renderer) {
    ctx.renderer.setClearColor(col, 1);
  }
  const viewer = document.getElementById('viewer');
  if (viewer) viewer.style.backgroundColor = hexColor;
  const isLight = hexColor.toUpperCase() === '#FFFFFF';
  if (ctx.sun) {
    ctx.sun.intensity = isLight ? 2.5 : 2.0;
  }
}
window.set3DCanvasBackground = set3DCanvasBackground;

export function addConceptualMassBlock({ width = 30, depth = 25, levels = 6, use = 'residential' } = {}) {
  if (!ctx || !ctx.scene || !ctx.group) return;
  if (!conceptualBlocksGroup) {
    conceptualBlocksGroup = new THREE.Group();
    ctx.group.add(conceptualBlocksGroup);
  }

  const height = levels * 3.2; // 3.2m per floor
  const geo = new THREE.BoxGeometry(width, depth, height);
  geo.translate(0, 0, height / 2);

  const colorMap = {
    residential: 0xf4f4f6,
    commercial: 0xa8a29e,
    office: 0x94a3b8,
    mixed: 0xd4d4d8,
    equipment: 0x78716c
  };
  const mat = new THREE.MeshStandardMaterial({
    color: colorMap[use] || 0xf4f4f6,
    roughness: 0.65,
    metalness: 0.08
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    type: `Bloque ${use.charAt(0).toUpperCase() + use.slice(1)}`,
    height: `${height.toFixed(1)} m`,
    levels: `${levels} pisos`,
    footprint: `${(width * depth).toFixed(0)} m²`,
    tag: '02_Estructura_y_Nucleos'
  };

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, 15),
    new THREE.LineBasicMaterial({ color: 0x18181b, transparent: true, opacity: 0.7 })
  );
  mesh.add(edges);

  const offsetCount = conceptualBlocksGroup.children.length;
  mesh.position.set((offsetCount - 1) * (width + 15), 0, 0);

  conceptualBlocksGroup.add(mesh);

  const selType = document.getElementById('sel-elem-type');
  const selH = document.getElementById('sel-elem-height');
  const selL = document.getElementById('sel-elem-levels');
  const selF = document.getElementById('sel-elem-footprint');
  const selT = document.getElementById('sel-elem-tag');
  if (selType) selType.textContent = mesh.userData.type;
  if (selH) selH.textContent = mesh.userData.height;
  if (selL) selL.textContent = mesh.userData.levels;
  if (selF) selF.textContent = mesh.userData.footprint;
  if (selT) selT.textContent = mesh.userData.tag;

  return mesh;
}
window.addConceptualMassBlock = addConceptualMassBlock;

export function removeLastConceptualMassBlock() {
  if (!conceptualBlocksGroup || conceptualBlocksGroup.children.length === 0) return;
  const last = conceptualBlocksGroup.children.pop();
  if (last) {
    if (last.geometry) last.geometry.dispose();
    if (last.material) {
      if (Array.isArray(last.material)) last.material.forEach(m => m.dispose());
      else last.material.dispose();
    }
  }
}
window.removeLastConceptualMassBlock = removeLastConceptualMassBlock;

let current3DGridHelper = null;
let current3DAxesHelper = null;

export function set3DWireframeMode(enabled) {
  if (!ctx || !ctx.group) return;
  ctx.group.traverse((obj) => {
    if (obj.isMesh && obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => { m.wireframe = enabled; });
      } else {
        obj.material.wireframe = enabled;
      }
    }
  });
}
window.set3DWireframeMode = set3DWireframeMode;

export function set3DGridHelper(enabled) {
  if (!ctx || !ctx.scene) return;
  if (enabled) {
    if (!current3DGridHelper) {
      const size = ctx.modelSize || 1000;
      current3DGridHelper = new THREE.GridHelper(size, 20, 0x38bdf8, 0x27272a);
      current3DGridHelper.rotation.x = Math.PI / 2;
      current3DGridHelper.position.z = ctx.zMid || 0;
      ctx.scene.add(current3DGridHelper);
    }
    current3DGridHelper.visible = true;
  } else if (current3DGridHelper) {
    current3DGridHelper.visible = false;
  }
}
window.set3DGridHelper = set3DGridHelper;

export function set3DAxesHelper(enabled) {
  if (!ctx || !ctx.scene) return;
  if (enabled) {
    if (!current3DAxesHelper) {
      const size = (ctx.modelSize || 1000) * 0.25;
      current3DAxesHelper = new THREE.AxesHelper(size);
      current3DAxesHelper.position.z = ctx.zMid || 0;
      ctx.scene.add(current3DAxesHelper);
    }
    current3DAxesHelper.visible = true;
  } else if (current3DAxesHelper) {
    current3DAxesHelper.visible = false;
  }
}
window.set3DAxesHelper = set3DAxesHelper;

export async function loadExternal3DModel(file) {
  if (!ctx || !ctx.scene || !ctx.group) return null;
  if (!conceptualBlocksGroup) {
    conceptualBlocksGroup = new THREE.Group();
    ctx.group.add(conceptualBlocksGroup);
  }

  const ext = file.name.split('.').pop().toLowerCase();
  
  if (ext === 'glb' || ext === 'gltf') {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const url = URL.createObjectURL(file);
    return new Promise((resolve, reject) => {
      loader.load(url, (gltf) => {
        URL.revokeObjectURL(url);
        const obj = gltf.scene;
        const bbox = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        
        obj.position.x = -center.x;
        obj.position.y = -center.y;
        obj.position.z = -bbox.min.z;
        
        obj.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        conceptualBlocksGroup.add(obj);
        
        const footprint = Math.round(size.x * size.y);
        const height = size.z.toFixed(1);
        const levels = Math.max(1, Math.round(size.z / 3.2));
        const gfa = Math.round(footprint * levels);
        const volume = Math.round(footprint * size.z);
        const envelope = Math.round(2 * (size.x + size.y) * size.z + footprint);
        
        const metrics = { footprint, height, levels, gfa, volume, envelope, name: file.name };
        window.updateQuantificationUI?.(metrics);
        resolve(metrics);
      }, undefined, reject);
    });
  } else if (ext === 'obj') {
    const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
    const loader = new OBJLoader();
    const text = await file.text();
    const obj = loader.parse(text);
    const bbox = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    
    obj.position.x = -center.x;
    obj.position.y = -center.y;
    obj.position.z = -bbox.min.z;
    
    obj.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({ color: 0xe4e4e7, roughness: 0.6 });
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    conceptualBlocksGroup.add(obj);
    const footprint = Math.round(size.x * size.y);
    const height = size.z.toFixed(1);
    const levels = Math.max(1, Math.round(size.z / 3.2));
    const gfa = Math.round(footprint * levels);
    const volume = Math.round(footprint * size.z);
    const envelope = Math.round(2 * (size.x + size.y) * size.z + footprint);
    
    const metrics = { footprint, height, levels, gfa, volume, envelope, name: file.name };
    window.updateQuantificationUI?.(metrics);
    return metrics;
  }
}
window.loadExternal3DModel = loadExternal3DModel;

// URBNZD Real-time 3D Section Plane Cut Engine
const sectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
let isSectionActive = false;
let sectionPlaneHelper = null;

export function toggleSectionCut3D(forceState) {
  isSectionActive = typeof forceState === 'boolean' ? forceState : !isSectionActive;
  if (!ctx || !ctx.renderer) return isSectionActive;
  
  if (isSectionActive) {
    ctx.renderer.clippingPlanes = [sectionPlane];
    if (!sectionPlaneHelper && ctx.scene) {
      sectionPlaneHelper = new THREE.PlaneHelper(sectionPlane, 1400, 0x38bdf8);
      ctx.scene.add(sectionPlaneHelper);
    }
    if (sectionPlaneHelper) sectionPlaneHelper.visible = true;
  } else {
    ctx.renderer.clippingPlanes = [];
    if (sectionPlaneHelper) sectionPlaneHelper.visible = false;
  }
  return isSectionActive;
}

export function setSectionCutPosition(constantVal) {
  sectionPlane.constant = Number(constantVal) || 0;
}

export function setSectionCutAxis(axis) {
  if (axis === 'x') sectionPlane.normal.set(-1, 0, 0);
  else if (axis === 'y') sectionPlane.normal.set(0, -1, 0);
  else if (axis === 'z') sectionPlane.normal.set(0, 0, -1);
}

export function set3DNolliMode(enabled, inverted = false) {
  nolliModeActive = Boolean(enabled);
  nolliInverted = Boolean(inverted);
  if (nolliModeActive) {
    chunkModeActive = false;
    setCameraView('top');
  }
  if (!ctx || !ctx.lastModel) return;
  showModel(null, ctx.lastModel, { keepCamera: true, chunkMode: false });
}
export const is3DNolliActive = () => nolliModeActive;

window.toggleSectionCut3D = toggleSectionCut3D;
window.setSectionCutPosition = setSectionCutPosition;
window.setSectionCutAxis = setSectionCutAxis;
window.isSectionCutActive = () => isSectionActive;
window.toggleMaquetaMode = toggleMaquetaMode;
window.isMaquetaModeActive = isMaquetaModeActive;
window.set3DNolliMode = set3DNolliMode;
window.is3DNolliActive = is3DNolliActive;

