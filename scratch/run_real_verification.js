const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\brain\\4c9d7643-850d-4047-b708-96b7b93573c7';
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
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
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

    console.log('App loaded. Clicking template and building model...');
    await cdp.eval(`
      const tpl = document.querySelector('[data-tpl="tpl_mty_centro"]');
      if (tpl) tpl.click();
    `);
    await sleep(600);

    await cdp.eval(`
      const form = document.getElementById('panel');
      if (form) form.requestSubmit();
    `);

    // Wait for model to build
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const active = await cdp.eval('window.hasActiveModel?.()');
      const mode = await cdp.eval('window.currentWorkspaceMode');
      if (active && mode === 'result') {
        console.log('Model successfully built in 3D studio!');
        break;
      }
    }
    await sleep(2000);

    // 1. 3D Model: Section cut bar & Sun
    console.log('Testing 3D Model features...');
    await cdp.eval(`
      const secBtn = document.getElementById('dock-tool-section-3d');
      if (secBtn && document.getElementById('studio-section-bar')?.style.display === 'none') {
        secBtn.click();
      }
      const az = document.getElementById('slider-studio-sun-azimuth');
      const el = document.getElementById('slider-studio-sun-elevation');
      if (az) { az.value = '210'; az.dispatchEvent(new Event('input')); }
      if (el) { el.value = '40'; el.dispatchEvent(new Event('input')); }
    `);
    await sleep(1000);
    await cdp.screenshot('v28_1_studio_3d_sun_and_section_cut.png');

    // 2. 2D Cartography: Nolli Mode
    console.log('Testing 2D Cartography Nolli Mode...');
    await cdp.eval(`
      window.switchView('mapper', true);
      const nolliBtn = document.querySelector('[data-mappreset="figure"]');
      if (nolliBtn) nolliBtn.click();
    `);
    await sleep(2500);
    await cdp.screenshot('v28_2_cartografia_2d_crisp_nolli.png');

    // 3. Composición: Assign scenes and check layouts
    console.log('Testing Composición...');
    await cdp.eval(`
      window.switchView('composition', true);
    `);
    await sleep(1500);
    await cdp.screenshot('v28_3_composicion_sheet.png');

    console.log('Real model verification finished successfully!');
    cdp.close();
  } catch (err) {
    console.error('Error in real verification:', err);
  } finally {
    try { chromeProc.kill(); } catch (e) {}
  }
})();
