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
  ctx ??= init(container);
  ctx.lastModel = model;
  chunkModeActive = chunkMode;
  const { group, camera, controls, scene } = ctx;
  group.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
  group.clear();

  const s = model.size;
  ctx.modelSize = s;
  const zMid = (model.grid?.maxH ?? 0) / 2;
  ctx.zMid = zMid;

  if (chunkMode) {
    // ----------------------------------------------------
    // MOODBOARD IMAGE 4: CHUNK 3D (PURE TOPOGRAPHIC RELIEF)
    // ----------------------------------------------------
    scene.background = new THREE.Color(0x000000);

    // Dramatic high-contrast directional lighting for razor-sharp ridge relief
    ctx.sun = ctx.sun || scene.children.find((c) => c.isDirectionalLight);
    if (ctx.sun) {
      ctx.sun.position.set(-1.1, -1.0, 1.7);
      ctx.sun.intensity = 2.4;
    }

    if (model.terrain) {
      // 1. Sculptural monochrome terrain
      const geo = meshGeometry([model.terrain]);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xdedede,
        roughness: 0.82,
        metalness: 0.04,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      });
      group.add(new THREE.Mesh(geo, mat));

      // 2. Solid extruded architectural block skirt / strata base
      const minH = model.grid?.minH ?? 0;
      const baseZ = minH - s * 0.07;
      const skirtGeo = buildTerrainSkirtGeometry(model.grid, s, baseZ);
      const skirtMat = new THREE.MeshStandardMaterial({
        color: 0x121214,
        roughness: 0.94,
        metalness: 0.02
      });
      group.add(new THREE.Mesh(skirtGeo, skirtMat));

      // Subtle base wireframe outline
      const skirtEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(skirtGeo, 30),
        new THREE.LineBasicMaterial({ color: 0x333338, transparent: true, opacity: 0.45 })
      );
      group.add(skirtEdges);

      // 3. Topographic Beacon Pins (Image 4 Mare Nubium Style)
      if (model.grid) {
        const half = s / 2;
        const n = model.grid.n;
        const step = s / n;
        let peakX = 0, peakY = 0, peakZ = -Infinity;
        let secX = 0, secY = 0, secZ = -Infinity;

        for (let j = 0; j < n; j++) {
          for (let i = 0; i < n; i++) {
            const x = -half + i * step, y = -half + j * step;
            const z = model.grid.heightAt(x, y);
            if (z > peakZ) {
              peakZ = z; peakX = x; peakY = y;
            }
          }
        }

        // Secondary peak (at least 25% away from main peak)
        for (let j = 0; j < n; j++) {
          for (let i = 0; i < n; i++) {
            const x = -half + i * step, y = -half + j * step;
            const z = model.grid.heightAt(x, y);
            const dist = Math.hypot(x - peakX, y - peakY);
            if (dist > s * 0.3 && z > secZ) {
              secZ = z; secX = x; secY = y;
            }
          }
        }

        // Add Peak 1 Beacon Pin
        const dotGeo = new THREE.SphereGeometry(s * 0.007, 16, 16);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const peakDot = new THREE.Mesh(dotGeo, dotMat);
        peakDot.position.set(peakX, peakY, peakZ + 1);
        group.add(peakDot);

        const pinHeight1 = s * 0.32;
        const line1 = createDashedHairline(
          new THREE.Vector3(peakX, peakY, peakZ),
          new THREE.Vector3(peakX, peakY, peakZ + pinHeight1),
          s
        );
        group.add(line1);

        const sprite1 = createTextSprite('01', `CUMBRE · ${Math.round(peakZ)}m`, s);
        sprite1.position.set(peakX, peakY, peakZ + pinHeight1 + s * 0.02);
        group.add(sprite1);

        // Add Peak 2 Beacon Pin if significant
        if (secZ > -Infinity && Math.abs(peakZ - secZ) < s * 0.4) {
          const secDot = new THREE.Mesh(dotGeo, dotMat);
          secDot.position.set(secX, secY, secZ + 1);
          group.add(secDot);

          const pinHeight2 = s * 0.25;
          const line2 = createDashedHairline(
            new THREE.Vector3(secX, secY, secZ),
            new THREE.Vector3(secX, secY, secZ + pinHeight2),
            s
          );
          group.add(line2);

          const sprite2 = createTextSprite('02', `TOPOGRAFÍA · ${Math.round(secZ)}m`, s);
          sprite2.position.set(secX, secY, secZ + pinHeight2 + s * 0.02);
          group.add(sprite2);
        }
      }
    }

    if (!keepCamera) {
      controls.target.set(0, 0, zMid);
      camera.position.set(s * 0.92, -s * 0.92, s * 0.88 + zMid);
      camera.near = s / 1000;
      camera.far = s * 25;
      camera.updateProjectionMatrix();
      controls.update();
      triggerResize();
    }
    return;
  }

  // ----------------------------------------------------
  // STANDARD 3D STUDIO MODEL (URBAN CARTOGRAPHY)
  // ----------------------------------------------------
  scene.background = new THREE.Color(0x0c0c0e);
  if (ctx.sun) {
    ctx.sun.position.set(-0.6, -0.9, 1.4);
    ctx.sun.intensity = 1.6;
  }

  if (model.terrain) {
    const geo = meshGeometry([model.terrain]);
    const mat = new THREE.MeshLambertMaterial({ color: 0xe4e0d6, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
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
    group.add(new THREE.Mesh(geo, mat));
  }
  if (model.trees.length) {
    const unit = meshGeometry([UNIT_TREE]);
    const trees = new THREE.InstancedMesh(unit, new THREE.MeshLambertMaterial({ color: 0x5fa545 }), model.trees.length);
    const mtx = new THREE.Matrix4();
    model.trees.forEach((t, i) => trees.setMatrixAt(i, mtx.makeScale(t.r, t.r, t.h).setPosition(t.x, t.y, t.z)));
    group.add(trees);
  }
  if (model.buildings.length) {
    group.add(new THREE.Mesh(meshGeometry(model.buildings), new THREE.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
    group.add(new THREE.LineSegments(edgeGeometry(model.buildings), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 })));
  }
  const road = (layers) => layers.flatMap((l) => (model.lines[l] ?? []).map((pts) => ({ pts, closed: false })));
  const add = (items, color, opacity) => items.length && group.add(new THREE.LineSegments(lineGeometry(items, 0.9), new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
  const overlay = (color, opacity, factor) => new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity, polygonOffset: true, polygonOffsetFactor: factor, polygonOffsetUnits: factor, depthWrite: opacity >= 1 });
  if (model.roadMeshes?.length) {
    for (const rm of model.roadMeshes) {
      const isRoad = rm.layer === 'ROADS_AREA';
      group.add(new THREE.Mesh(meshGeometry([rm]), overlay(isRoad ? 0x8e8e93 : 0xcdb894, isRoad ? 0.9 : 0.75, isRoad ? -5 : -4)));
    }
  } else {
    add(road(['ROADS_MAJOR']), 0xe8912d, 0.95);
    add(road(['ROADS_MINOR']), 0x6e6e73, 0.7);
    add(road(['PATHS']), 0xb08a5e, 0.6);
  }
  add(road(['RAILWAYS']), 0x55555a, 0.9);
  if (model.water?.length) group.add(new THREE.Mesh(meshGeometry(model.water), overlay(0x6fa8d6, 1, -4)));
  const greens = (model.areas.GREEN ?? []).filter((r) => r.length > 2).map((ring) => {
    const flat = [];
    for (const [x, y] of ring) flat.push(x, y);
    const tri = earcut(flat, [], 2);
    const faces = [];
    for (let i = 0; i < tri.length; i += 3) faces.push({ v: [tri[i], tri[i + 1], tri[i + 2]] });
    return { verts: ring, faces };
  });
  if (greens.length) group.add(new THREE.Mesh(meshGeometry(greens), overlay(0x8fbf6a, 0.55, -3)));
  if (model.bridges?.length) {
    group.add(new THREE.Mesh(meshGeometry(model.bridges), new THREE.MeshLambertMaterial({ color: 0xd9d6cf, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
    group.add(new THREE.LineSegments(edgeGeometry(model.bridges), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })));
  }
  add(model.contours.map((c) => ({ pts: c.pts, closed: c.closed })), 0xb88a5a, 0.6);

  if (keepCamera) return;
  controls.target.set(0, 0, zMid);
  camera.position.set(s * 0.62, -s * 0.95, s * 0.72 + zMid);
  camera.near = s / 1000;
  camera.far = s * 20;
  camera.updateProjectionMatrix();
  controls.update();
  triggerResize();
}

export function toggleChunkMode(enabled) {
  if (!ctx || !ctx.lastModel) return;
  showModel(null, ctx.lastModel, { keepCamera: false, chunkMode: enabled });
}

export function isChunkModeActive() {
  return chunkModeActive;
}

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
    camera.position.set(s * 0.92, -s * 0.92, s * 0.88 + zMid);
  } else if (type === 'top') {
    camera.position.set(0, -0.001, s * 1.6 + zMid);
  } else {
    camera.position.set(s * 0.62, -s * 0.95, s * 0.72 + zMid);
  }
  camera.updateProjectionMatrix();
  controls.update();
}


