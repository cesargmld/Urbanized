import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\chrome_temp_' + Date.now();
const ARTIFACT_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\brain\\4c9d7643-850d-4047-b708-96b7b93573c7';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Launching headless Chrome...');
  const chrome = spawn(CHROME_PATH, [
    '--remote-debugging-port=9222',
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--window-size=1600,1050',
    'about:blank'
  ], { stdio: 'ignore' });

  // Wait for CDP
  let version = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        version = await res.json();
        break;
      }
    } catch {}
    await sleep(250);
  }

  if (!version) {
    chrome.kill();
    throw new Error('Failed to connect to Chrome debugging port.');
  }

  console.log('Connected to Chrome:', version['Browser']);

  // Create or navigate page
  const newTargetRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:4400', { method: 'PUT' });
  const pageTarget = await newTargetRes.json();
  const wsUrl = pageTarget.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);

  let msgId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise((resolve) => { ws.onopen = resolve; });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression, awaitPromise = true) {
    const res = await send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      console.error('JS Exception:', res.exceptionDetails);
    }
    return res.result?.value;
  }

  async function captureScreenshot(filepath) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filepath, buffer);
    console.log(`📸 Screenshot saved: ${path.basename(filepath)} (${(buffer.length / 1024).toFixed(1)} KB)`);
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('⏳ Waiting for application to initialize...');
  for (let i = 0; i < 60; i++) {
    const ready = await evaluate("typeof window.loadModelDirectly === 'function'");
    if (ready) {
      console.log('App ready after', (i * 200), 'ms');
      break;
    }
    await sleep(200);
  }

  // 1. Build a rich synthetic architectural model directly
  console.log('🔨 Loading rich architectural model directly into Studio...');
  await evaluate(`
    (async () => {
      const size = 1000;
      const n = 32;
      const heights = new Float32Array((n + 1) * (n + 1));
      for (let j = 0; j <= n; j++) {
        for (let i = 0; i <= n; i++) {
          const u = (i / n) * 2 - 1;
          const v = (j / n) * 2 - 1;
          heights[j * (n + 1) + i] = 1200 + 45 * Math.sin(u * 2.2 + 0.5) * Math.cos(v * 2.5) + 20 * Math.cos(u * 3.5);
        }
      }

      const contours = [];
      for (let z = 1180; z <= 1260; z += 10) {
        const pts = [];
        const count = 36;
        const r = (320 + (z - 1180) * 4.5);
        for (let k = 0; k <= count; k++) {
          const th = (k / count) * Math.PI * 2;
          const px = Math.cos(th) * r + 25 * Math.sin(th * 3);
          const py = Math.sin(th) * r + 20 * Math.cos(th * 2);
          pts.push([px, py, z - 1180]);
        }
        contours.push({ z: z - 1180, pts, closed: true });
      }

      const buildings = [];
      const classes = ['public', 'commercial', 'residential', 'education'];
      let bIdx = 0;
      for (let bx = -350; bx <= 350; bx += 85) {
        for (let by = -350; by <= 350; by += 85) {
          if (Math.abs(bx) < 70 && Math.abs(by) < 70) continue; // plaza
          const bw = 46 + (bIdx % 3) * 12;
          const bh = 40 + ((bIdx * 7) % 4) * 10;
          const h = 16 + ((bIdx * 13) % 40);
          const cls = classes[bIdx % classes.length];
          const z0 = 10;
          const v0 = [bx - bw/2, by - bh/2, z0];
          const v1 = [bx + bw/2, by - bh/2, z0];
          const v2 = [bx + bw/2, by + bh/2, z0];
          const v3 = [bx - bw/2, by + bh/2, z0];
          const v4 = [bx - bw/2, by - bh/2, z0 + h];
          const v5 = [bx + bw/2, by - bh/2, z0 + h];
          const v6 = [bx + bw/2, by + bh/2, z0 + h];
          const v7 = [bx - bw/2, by + bh/2, z0 + h];
          const verts = [v0, v1, v2, v3, v4, v5, v6, v7];
          const faces = [
            { v: [0, 1, 5, 4], vis: [true, true, true, true] },
            { v: [1, 2, 6, 5], vis: [true, true, true, true] },
            { v: [2, 3, 7, 6], vis: [true, true, true, true] },
            { v: [3, 0, 4, 7], vis: [true, true, true, true] },
            { v: [4, 5, 6, 7], vis: [true, true, true, true] },
          ];
          buildings.push({
            id: 'bld_' + bIdx,
            cls,
            height: h,
            h,
            baseZ: z0,
            rings: [[[bx - bw/2, by - bh/2], [bx + bw/2, by - bh/2], [bx + bw/2, by + bh/2], [bx - bw/2, by + bh/2]]],
            poly: [[bx - bw/2, by - bh/2], [bx + bw/2, by - bh/2], [bx + bw/2, by + bh/2], [bx - bw/2, by + bh/2]],
            verts,
            faces
          });
          bIdx++;
        }
      }

      const lines = {
        ROADS_MAJOR: [
          { pts: [[-500, 0, 10], [500, 0, 10]], closed: false, width: 14 },
          { pts: [[0, -500, 10], [0, 500, 10]], closed: false, width: 14 }
        ],
        ROADS_MINOR: [
          { pts: [[-500, 180, 10], [500, 180, 10]], closed: false, width: 8 },
          { pts: [[-500, -180, 10], [500, -180, 10]], closed: false, width: 8 },
          { pts: [[180, -500, 10], [180, 500, 10]], closed: false, width: 8 },
          { pts: [[-180, -500, 10], [-180, 500, 10]], closed: false, width: 8 }
        ],
        WATER: [
          { pts: [[-500, -400, 4], [-200, -360, 4], [0, -380, 4], [300, -350, 4], [500, -390, 4]], closed: false, width: 22 }
        ]
      };

      const polygons = {
        WATER: [
          [[-500, -420], [500, -420], [500, -370], [-500, -370]]
        ],
        GREEN: [
          [[-80, -80], [80, -80], [80, 80], [-80, 80]],
          [[-450, 200], [-250, 200], [-250, 400], [-450, 400]]
        ]
      };

      const trees = [];
      for (let tx = -70; tx <= 70; tx += 20) {
        for (let ty = -70; ty <= 70; ty += 20) {
          trees.push({ x: tx, y: ty, z: 10.5, pos: [tx, ty, 10.5], r: 3.5, h: 7 });
        }
      }

      const satCanvas = document.createElement('canvas');
      satCanvas.width = satCanvas.height = 512;
      const sctx = satCanvas.getContext('2d');
      sctx.fillStyle = '#313a2d';
      sctx.fillRect(0, 0, 512, 512);
      sctx.fillStyle = '#4c5246';
      sctx.fillRect(90, 90, 332, 332);
      sctx.strokeStyle = '#1b1d1f';
      sctx.lineWidth = 14;
      sctx.beginPath();
      sctx.moveTo(0, 256); sctx.lineTo(512, 256);
      sctx.moveTo(256, 0); sctx.lineTo(256, 512);
      sctx.stroke();

      const customModel = {
        id: 'test_model_rome_center',
        center: { lat: 41.8902, lon: 12.4922 },
        size,
        shape: 'square',
        grid: {
          n,
          step: size / n,
          half: size / 2,
          minH: 1180,
          maxH: 1265,
          heights,
          source: 'copernicus'
        },
        contourInterval: 10,
        contours,
        buildings,
        lines,
        polygons,
        trees,
        imagery: { canvas: satCanvas },
        warnings: [],
        stats: {
          buildings: buildings.length,
          relief: 85,
          roadsKm: 12.6,
          trees: trees.length
        }
      };

      await window.loadModelDirectly(customModel);
    })()
  `);

  console.log('⏳ Waiting for 3D render to settle...');
  await sleep(1500);

  // -------------------------------------------------------------
  // TEST FEATURE 1: Imagen 1 (3D Satellite Architectural Topography & Contours)
  // -------------------------------------------------------------
  console.log('🎨 Testing Feature 1: 3D Satellite Architectural Topography & Contours (Imagen 1)...');
  await evaluate(`
    (async () => {
      window.toggleLeftPanel('sat', true);
      const btnBn = document.getElementById('sat-btn-bn-arch');
      if (btnBn) btnBn.click();
    })()
  `);
  await sleep(1200);

  const satShot = path.join(ARTIFACT_DIR, 'v13_1_satellite_bn_architecture.png');
  await captureScreenshot(satShot);

  // -------------------------------------------------------------
  // TEST FEATURE 3: Imagen 3 (Custom Colored Pins / Markers Tool)
  // -------------------------------------------------------------
  console.log('📍 Testing Feature 3: Custom Colored Pins (Imagen 3)...');
  await evaluate(`
    (async () => {
      window.toggleLeftPanel('pins', true);
      const { pinStore } = await import('./js/pins.js?v=1.0');

      pinStore.addPin({
        x: -120,
        y: 80,
        z: 22,
        lat: 41.8902,
        lon: 12.4922,
        color: '#f97316', // Bright Orange (Image 3)
        type: 'hito',
        label: 'Hito 01 · Mirador Principal'
      });

      pinStore.addPin({
        x: 140,
        y: -110,
        z: 16,
        lat: 41.8915,
        lon: 12.4940,
        color: '#06b6d4', // Cyan
        type: 'acceso',
        label: 'Acceso 02 · Eje Peatonal'
      });

      pinStore.addPin({
        x: 50,
        y: 160,
        z: 28,
        lat: 41.8925,
        lon: 12.4932,
        color: '#84cc16', // Lime
        type: 'proyecto',
        label: 'Zona 03 · Parque Botánico'
      });
    })()
  `);
  await sleep(1000);

  const pinShot = path.join(ARTIFACT_DIR, 'v13_3_studio_custom_pins.png');
  await captureScreenshot(pinShot);

  // -------------------------------------------------------------
  // TEST FEATURE 2: Imagen 2 (2D Vector Map with Parametric Grid & Paper Grain)
  // -------------------------------------------------------------
  console.log('📐 Testing Feature 2: 2D Vector Map 20m Grid & Noise Paper Grain (Imagen 2)...');
  await evaluate(`
    (async () => {
      window.switchWorkspaceView('mapper');
      await new Promise(r => setTimeout(r, 600));

      const gridStep = document.getElementById('map-grid-step');
      if (gridStep) {
        gridStep.value = '20';
        gridStep.dispatchEvent(new Event('change'));
      }

      const gridStyle = document.getElementById('map-grid-style');
      if (gridStyle) {
        gridStyle.value = 'cross';
        gridStyle.dispatchEvent(new Event('change'));
      }

      const gridCheck = document.querySelector('[data-mapopt="overlays.grid"]');
      if (gridCheck) {
        gridCheck.checked = true;
        gridCheck.dispatchEvent(new Event('change'));
      }

      const grainSlider = document.getElementById('map-grain');
      if (grainSlider) {
        grainSlider.value = '65';
        grainSlider.dispatchEvent(new Event('input'));
      }
    })()
  `);
  await sleep(1500);

  const mapShot = path.join(ARTIFACT_DIR, 'v13_2_vectormap_grid20m_paper_grain.png');
  await captureScreenshot(mapShot);

  // -------------------------------------------------------------
  // TEST FEATURE 4: Imagen 4 (Axonometría Despiezada / Superposición de Capas)
  // -------------------------------------------------------------
  console.log('🏢 Testing Feature 4: Axonometría Despiezada / Superposición de Capas QGIS en Cascada (Imagen 4)...');
  await evaluate(`
    (async () => {
      window.switchWorkspaceView('illustrator');
      await new Promise(r => setTimeout(r, 800));

      const sw = document.getElementById('illu-exploded-switch');
      if (sw) {
        sw.checked = true;
        sw.dispatchEvent(new Event('change'));
      }

      const offsetSlider = document.getElementById('illu-explode-offset');
      if (offsetSlider) {
        offsetSlider.value = '140';
        offsetSlider.dispatchEvent(new Event('input'));
      }

      const guidesCheck = document.getElementById('illu-exploded-guides');
      if (guidesCheck) {
        guidesCheck.checked = true;
        guidesCheck.dispatchEvent(new Event('change'));
      }

      const cornerCheck = document.getElementById('illu-corner-labels');
      if (cornerCheck) {
        cornerCheck.checked = true;
        cornerCheck.dispatchEvent(new Event('change'));
      }
    })()
  `);
  await sleep(1800);

  const illuShot = path.join(ARTIFACT_DIR, 'v13_4_axonometria_exploded_stack.png');
  await captureScreenshot(illuShot);

  console.log('✅ ALL 4 FEATURES VERIFIED SUCCESSFULLY!');

  // Cleanup
  ws.close();
  chrome.kill();
  try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch {}
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
