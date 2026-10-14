// 3D-превью модели (three.js).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import earcut from 'https://cdn.jsdelivr.net/npm/earcut@3.0.1/+esm';
import { triangulate, UNIT_TREE } from './data.js?v=e9ed68a96e';

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

export function showModel(container, model, { keepCamera = false } = {}) {
  ctx ??= init(container);
  const { group, camera, controls } = ctx;
  group.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
  group.clear();

  const s = model.size;
  if (model.terrain) {
    const geo = meshGeometry([model.terrain]);
    const mat = new THREE.MeshLambertMaterial({ color: 0xe4e0d6, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
    if (model.imagery) {
      // спутниковый снимок на рельефе
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
  // вода, зелень и дороги — поверхностями со сдвигом глубины: не мерцают на рельефе
  const overlay = (color, opacity, factor) => new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity, polygonOffset: true, polygonOffsetFactor: factor, polygonOffsetUnits: factor, depthWrite: opacity >= 1 });
  if (model.roadMeshes?.length) {
    // дороги реальной ширины: полотно с кромкой бордюра
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
  const zMid = model.grid.maxH / 2;
  controls.target.set(0, 0, zMid);
  camera.position.set(s * 0.62, -s * 0.95, s * 0.72 + zMid);
  camera.near = s / 1000;
  camera.far = s * 20;
  camera.updateProjectionMatrix();
  controls.update();
}
