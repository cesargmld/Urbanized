const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const USER_DATA_DIR = path.join(process.env.USERPROFILE, '.gemini/antigravity/scratch/chrome_temp_svg_bldg');
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

    // Set model and switch to mapper
    const out = await cdp.eval(`(async () => {
      try {
        const mod = await import('./js/mapplan.js?v=6.0');
        const figureOpts = mod.presetOptions('figure');

        const size = 1000;
        const buildings = [
          {
            id: 'b1',
            cls: 'commercial',
            height: 25,
            rings: [[[-100, -100], [100, -100], [100, 100], [-100, 100]]]
          }
        ];

        const model = {
          id: 'test',
          center: { lat: 25.6866, lon: -100.3161 },
          size,
          buildings,
          lines: {},
          polygons: {},
          trees: [],
          warnings: [],
          stats: { buildings: 1, relief: 10, roadsKm: 1, trees: 0 }
        };

        const svg = mod.mapSVG(model, figureOpts);
        const bldgGroupMatch = svg.match(/<g id="BUILDINGS"[^>]*>/);

        return {
          figurePreset: figureOpts.preset,
          buildingColor: figureOpts.colors.building,
          bldgGroupTag: bldgGroupMatch ? bldgGroupMatch[0] : null,
          fullSvgLen: svg.length
        };
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    })()`);

    console.log('--- FIGURE PRESET CHECK ---', JSON.stringify(out, null, 2));

  } catch (err) {
    console.error('Error during check:', err);
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill();
  }
})();
