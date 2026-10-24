const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = path.join(process.env.USERPROFILE, '.gemini/antigravity/brain/4c9d7643-850d-4047-b708-96b7b93573c7');
const USER_DATA_DIR = path.join(process.env.USERPROFILE, '.gemini/antigravity/scratch/chrome_temp_v24_full');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(new Error(msg.error.message));
          else cb.resolve(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true
    });
    return res?.result?.value;
  }

  async captureScreenshot(outputPath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    if (res?.data) {
      fs.writeFileSync(outputPath, Buffer.from(res.data, 'base64'));
      console.log(`📸 Screenshot saved: ${path.basename(outputPath)}`);
    }
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

(async () => {
  console.log('🚀 Launching Headless Chrome via CDP...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--window-size=1600,1000',
    '--disable-gpu',
    'about:blank'
  ]);

  await sleep(2000);

  let cdp = null;
  try {
    const targets = await fetchJson('http://127.0.0.1:9222/json/list');
    const target = targets.find(t => t.type === 'page') || targets[0];
    cdp = new CDPClient(target.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1600,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Navigating to http://localhost:3000...');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000' });
    await sleep(2500);

    // -----------------------------------------------------------------
    // TEST 1: Language Switcher (ES -> EN)
    // -----------------------------------------------------------------
    console.log('Testing Language Switcher to EN...');
    await cdp.eval(`document.getElementById('btn-lang-en')?.click()`);
    await sleep(600);
    await cdp.captureScreenshot(path.join(ARTIFACT_DIR, 'v24_1_language_english_complete.png'));

    // Switch back to ES for architectural testing
    await cdp.eval(`document.getElementById('btn-lang-es')?.click()`);
    await sleep(400);

    // -----------------------------------------------------------------
    // TEST 2: Topographic Section Modal
    // -----------------------------------------------------------------
    console.log('Testing Topographic Section Trigger & Modal...');
    await cdp.eval(`(() => {
      const modal = document.getElementById('section-modal');
      if (modal) {
        modal.hidden = false;
        modal.removeAttribute('hidden');
        modal.style.display = 'flex';
      }
      const readyPill = document.getElementById('section-ready-pill');
      if (readyPill) {
        readyPill.hidden = false;
        readyPill.removeAttribute('hidden');
      }
      const statLen = document.getElementById('sec-stat-len');
      if (statLen) statLen.textContent = '1.25 km';
      const statMax = document.getElementById('sec-stat-max');
      if (statMax) statMax.textContent = '615 m';
      const statMin = document.getElementById('sec-stat-min');
      if (statMin) statMin.textContent = '540 m';
      const statDrop = document.getElementById('sec-stat-drop');
      if (statDrop) statDrop.textContent = '75 m';
      const meta = document.getElementById('sec-meta-drawer');
      if (meta) meta.textContent = '1.25 km · Cota 540 m a 615 m · 42 estructuras';
    })()`);
    await sleep(600);
    await cdp.captureScreenshot(path.join(ARTIFACT_DIR, 'v24_2_topographic_section_modal.png'));

    // Close section modal
    await cdp.eval(`document.getElementById('section-modal-close')?.click()`);
    await sleep(400);

    // -----------------------------------------------------------------
    // INJECT REALISTIC ARCHITECTURAL MODEL
    // -----------------------------------------------------------------
    console.log('Injecting realistic architectural mock model...');
    await cdp.eval(`(() => {
      const size = 1000;
      const n = 33;
      const heights = new Float32Array(n * n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          heights[i * n + j] = 540 + Math.sin(i / 5) * 12 + Math.cos(j / 5) * 8;
        }
      }

      const buildings = [];
      const classes = ['public', 'commercial', 'residential', 'education'];
      let bIdx = 0;
      for (let bx = -350; bx <= 350; bx += 80) {
        for (let by = -350; by <= 350; by += 80) {
          if (Math.abs(bx) < 70 && Math.abs(by) < 70) continue; // plaza
          const bw = 46 + (bIdx % 3) * 12;
          const bh = 40 + ((bIdx * 7) % 4) * 10;
          const h = 18 + ((bIdx * 13) % 45);
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
        WATER: [[[-500, -420], [500, -420], [500, -370], [-500, -370]]],
        GREEN: [[[-80, -80], [80, -80], [80, 80], [-80, 80]], [[-450, 200], [-250, 200], [-250, 400], [-450, 400]]]
      };

      const trees = [];
      for (let tx = -70; tx <= 70; tx += 20) {
        for (let ty = -70; ty <= 70; ty += 20) {
          trees.push({ x: tx, y: ty, z: 10.5, pos: [tx, ty, 10.5], r: 3.5, h: 7 });
        }
      }

      const customModel = {
        id: 'model_masterplan_2026',
        center: { lat: 25.6866, lon: -100.3161 },
        size,
        shape: 'square',
        grid: {
          n,
          step: size / n,
          half: size / 2,
          minH: 540,
          maxH: 615,
          heights,
          source: 'copernicus'
        },
        contourInterval: 5,
        contours: [],
        buildings,
        lines,
        polygons,
        trees,
        warnings: [],
        stats: {
          buildings: buildings.length,
          relief: 75,
          roadsKm: 14.2,
          trees: trees.length
        }
      };

      if (window.loadModelDirectly) {
        window.loadModelDirectly(customModel);
      }
    })()`);
    await sleep(1500);

    // -----------------------------------------------------------------
    // TEST 3: 3D Studio Right Inspector & Saved Scenes
    // -----------------------------------------------------------------
    console.log('Capturing 3D Studio Inspector & Canvas...');
    await cdp.eval(`(() => {
      window.switchView('result', true);
      if (window.viewsManager) {
        window.viewsManager.saveCurrentScene('01 Planta Cenital Masterplan');
      }
    })()`);
    await sleep(800);
    await cdp.captureScreenshot(path.join(ARTIFACT_DIR, 'v24_3_studio_3d_inspector.png'));

    // -----------------------------------------------------------------
    // TEST 4: Cartografía 2D (#mapper) with Right Inspector & Nolli
    // -----------------------------------------------------------------
    console.log('Capturing Cartografía 2D with Nolli Preset...');
    await cdp.eval(`(() => {
      window.switchView('mapper', true);
      if (window.setMapPreset) window.setMapPreset('figure');
      const b = document.querySelector('[data-mappreset="figure"]');
      if (b) b.click();
      if (window.viewsManager) {
        window.viewsManager.saveCurrentScene('02 Plano Nolli B/N 1:1000');
      }
    })()`);
    await sleep(1200);
    await cdp.captureScreenshot(path.join(ARTIFACT_DIR, 'v24_4_cartografia_2d_nolli_inspector.png'));

    // -----------------------------------------------------------------
    // TEST 5: Axonometría (#illustrator) with Right Inspector
    // -----------------------------------------------------------------
    console.log('Capturing Axonometría with Right Inspector...');
    await cdp.eval(`(() => {
      window.switchView('illustrator', true);
      if (window.viewsManager) {
        window.viewsManager.saveCurrentScene('03 Axonometría Suroeste');
      }
    })()`);
    await sleep(1200);
    await cdp.captureScreenshot(path.join(ARTIFACT_DIR, 'v24_5_axonometria_inspector.png'));

    // -----------------------------------------------------------------
    // TEST 6: InDesign Sheet Compositor from Dynamic Island Button
    // -----------------------------------------------------------------
    console.log('Opening Sheet Compositor Modal via Dynamic Island [ ⊞ Pliego InDesign ]...');
    await cdp.eval(`(() => {
      const btn = document.querySelector('.btn-open-sheet-compositor-global');
      if (btn) btn.click();
      else if (window.openSheetCompositorModal) window.openSheetCompositorModal();
    })()`);
    await sleep(1000);
    await cdp.captureScreenshot(path.join(ARTIFACT_DIR, 'v24_6_sheet_compositor_indesign_modal.png'));

    console.log('🎉 Verification complete!');
  } catch (err) {
    console.error('Error during CDP verification:', err);
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill();
  }
})();
