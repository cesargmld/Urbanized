const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const USER_DATA_DIR = path.join(process.env.USERPROFILE, '.gemini/antigravity/scratch/chrome_temp_check_nolli');
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
    if (res?.exceptionDetails) {
      console.error('CDP EVAL EXCEPTION:', res.exceptionDetails);
    }
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

    // Setup mock model and switch to mapper
    const res = await cdp.eval(`(async () => {
      const buildings = [];
      for (let bx = -200; bx <= 200; bx += 100) {
        buildings.push({
          id: 'b_' + bx,
          cls: 'commercial',
          height: 20,
          rings: [[[bx - 30, -30], [bx + 30, -30], [bx + 30, 30], [bx - 30, 30]]]
        });
      }
      const m = {
        id: 'test',
        center: { lat: 25.6866, lon: -100.3161 },
        size: 1000,
        grid: { maxH: 10, minH: 0 },
        buildings,
        lines: {},
        polygons: {},
        trees: [],
        warnings: [],
        stats: { buildings: buildings.length, relief: 10, roadsKm: 1, trees: 0 }
      };

      await window.loadModelDirectly(m);
      await window.switchView('mapper', true);
      await window.setMapPreset('figure');
      await new Promise(r => setTimeout(r, 600));

      const img = document.querySelector('#map-flat img');
      const blobUrl = img ? img.src : null;
      if (!blobUrl) return { error: 'No img.src' };

      const r = await fetch(blobUrl);
      const svgText = await r.text();
      const idx = svgText.indexOf('<g id="BUILDINGS"');
      const bldgSlice = idx !== -1 ? svgText.slice(idx, idx + 250) : 'NO_BUILDINGS';

      return {
        svgSnippet: bldgSlice,
        fullSvgLen: svgText.length
      };
    })()`);

    console.log('--- NOLLI RENDER RESULT ---', JSON.stringify(res, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill();
  }
})();
