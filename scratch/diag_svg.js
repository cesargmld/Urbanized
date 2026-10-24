const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const USER_DATA_DIR = path.join(process.env.USERPROFILE, '.gemini/antigravity/scratch/chrome_temp_svg_diag');
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
        if (msg.method === 'Runtime.consoleAPICalled') {
          console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
        }
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

  close() {
    if (this.ws) this.ws.close();
  }
}

(async () => {
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
    await cdp.send('Page.navigate', { url: 'http://localhost:3000' });
    await sleep(2000);

    // Inject model
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
          if (Math.abs(bx) < 70 && Math.abs(by) < 70) continue;
          const bw = 50;
          const bh = 40;
          const h = 20;
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
        ROADS_MINOR: [],
        PATHS: [],
        WATER: [],
        BRIDGES: [],
        RAILWAYS: []
      };

      const polygons = {
        WATER: [],
        GREEN: []
      };

      const trees = [];
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
          trees: 0
        }
      };

      window.loadModelDirectly(customModel);
    })()`);
    await sleep(1000);

    const testCall = await cdp.eval(`(async () => {
      try {
        await window.openVectorMapStudio();
        return {
          hasModel: window.hasActiveModel?.(),
          openVectorMapStudio: typeof window.openVectorMapStudio,
        };
      } catch(e) {
        return { error: e.message, stack: e.stack };
      }
    })()`);
    const svgDirect = await cdp.eval(`(async () => {
      try {
        const mod = await import('./js/mapplan.js?v=6.0');
        const opts = mod.presetOptions('classic');
        const m = window.getActiveModelData ? window.getActiveModelData() : null;
        if (!m) return { error: 'No active model data' };
        const svg = mod.mapSVG(m, opts);
        return { svgLen: svg ? svg.length : 0, svgSlice: svg ? svg.slice(0, 100) : null };
      } catch(e) {
        return { error: e.message, stack: e.stack };
      }
    })()`);
    console.log('--- DIRECT MAP SVG TEST ---', svgDirect);

    const imgInfo = await cdp.eval(`(() => {
      const img = document.querySelector('#map-flat img');
      const flat = document.getElementById('map-flat');
      return {
        imgSrc: img ? img.src.slice(0, 50) : null,
        naturalWidth: img ? img.naturalWidth : null,
        naturalHeight: img ? img.naturalHeight : null,
        imgDisplay: img ? window.getComputedStyle(img).display : null,
        imgWidth: img ? window.getComputedStyle(img).width : null,
        imgHeight: img ? window.getComputedStyle(img).height : null,
        flatRect: flat ? flat.getBoundingClientRect() : null,
      };
    })()`);

    console.log('--- MAP FLAT IMG INFO ---', JSON.stringify(imgInfo, null, 2));

  } catch (err) {
    console.error('Error during diag:', err);
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill();
  }
})();
