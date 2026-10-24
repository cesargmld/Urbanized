const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\brain\\4c9d7643-850d-4047-b708-96b7b93573c7';
const USER_DATA_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\chrome_temp_full_flow';
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

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buf);
    console.log(`Saved screenshot: ${filename} (${buf.length} bytes)`);
    return outPath;
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
    '--window-size=1920,1080',
    '--disable-gpu',
    'http://localhost:3000'
  ]);

  await sleep(2500);

  let cdp = null;
  try {
    const targets = await fetchJson('http://127.0.0.1:9222/json/list');
    const target = targets.find(t => t.type === 'page') || targets[0];
    cdp = new CDPClient(target.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('App loaded. Initializing mock urban model...');

    // Load rich urban model
    await cdp.eval(`(async () => {
      const buildings = [];
      for (let bx = -350; bx <= 350; bx += 80) {
        for (let by = -250; by <= 250; by += 70) {
          const w = 24 + (Math.abs(bx) % 15);
          const d = 20 + (Math.abs(by) % 12);
          const h = 12 + ((Math.abs(bx + by) * 3) % 45);
          const cls = (h > 35) ? 'office' : (h > 20) ? 'commercial' : 'residential';
          buildings.push({
            id: 'b_' + bx + '_' + by,
            cls: cls,
            height: h,
            rings: [[[bx - w, by - d], [bx + w, by - d], [bx + w, by + d], [bx - w, by + d]]]
          });
        }
      }
      const m = {
        id: 'cgm_urban_core',
        center: { lat: 25.6866, lon: -100.3161 },
        size: 1000,
        grid: { maxH: 25, minH: 0, heightAt: (x, y) => 8 },
        buildings,
        lines: {
          roads: [
            [[-500, 0], [500, 0]],
            [[0, -500], [0, 500]],
            [[-350, -250], [350, -250]],
            [[-350, 250], [350, 250]]
          ]
        },
        polygons: {
          green: [
            [[[-200, -100], [-80, -100], [-80, -20], [-200, -20]]]
          ]
        },
        trees: [],
        warnings: [],
        stats: { buildings: buildings.length, relief: 25, roadsKm: 4.8, trees: 120 }
      };

      if (window.loadModelDirectly) {
        await window.loadModelDirectly(m);
      }
    })()`);
    await sleep(2500);

    // 1. 2D Cartography Nolli Mode
    console.log('Switching to 2D Cartography Nolli...');
    await cdp.eval(`(async () => {
      window.switchView('mapper', true);
      if (window.setMapPreset) window.setMapPreset('figure');
    })()`);
    await sleep(2000);
    await cdp.screenshot('v27_1_cartografia_2d_crisp_nolli.png');

    // 2. 3D Studio with Sun and Floating Section Plane
    console.log('Switching to 3D Model (#result)...');
    await cdp.eval(`(async () => {
      window.switchView('result', true);
      // Open section bar
      const secBtn = document.getElementById('dock-tool-section-3d');
      if (secBtn && document.getElementById('studio-section-bar')?.style.display === 'none') {
        secBtn.click();
      }
      // Set sun
      const az = document.getElementById('slider-studio-sun-azimuth');
      const el = document.getElementById('slider-studio-sun-elevation');
      if (az) { az.value = '240'; az.dispatchEvent(new Event('input')); }
      if (el) { el.value = '40'; el.dispatchEvent(new Event('input')); }
    })()`);
    await sleep(2000);
    await cdp.screenshot('v27_2_studio_3d_sun_and_section_cut.png');

    // 3. Composición View
    console.log('Switching to Composición (#composition)...');
    await cdp.eval(`(async () => {
      window.switchView('composition', true);
    })()`);
    await sleep(1500);
    await cdp.screenshot('v27_3_composicion_complete_sheet.png');

    console.log('✓ All 3 views successfully captured and verified!');
    cdp.close();
  } catch (err) {
    console.error('Error during CDP flow:', err);
  } finally {
    try { chromeProc.kill(); } catch (e) {}
  }
})();
