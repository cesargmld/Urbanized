const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\brain\\4c9d7643-850d-4047-b708-96b7b93573c7';
const USER_DATA_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\chrome_temp_verify_all';
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

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
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

async function main() {
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=1920,1080',
    'http://localhost:3000'
  ]);

  try {
    let connected = false;
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        targets = await fetchJson('http://127.0.0.1:9222/json');
        if (targets && targets.length > 0) {
          connected = true;
          break;
        }
      } catch (e) {}
    }

    if (!connected) throw new Error('Could not connect to Chrome debugging port');

    const pageTarget = targets.find(t => t.type === 'page');
    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Waiting for application to load...');
    await sleep(3000);

    // 1. Check workspace projects and open project or create one
    console.log('Testing Workspace projects...');
    await client.eval(`
      // Click on the first project or create default
      const card = document.querySelector('.axiom-project-card');
      if (card) {
        card.click();
      } else {
        window.switchView('result');
      }
    `);
    await sleep(2500);

    // 2. Switch to 3D Model view (#result)
    console.log('Testing 3D Model view (#result)...');
    await client.eval(`
      window.switchView('result');
    `);
    await sleep(1500);

    // Toggle section plane
    await client.eval(`
      const secBtn = document.getElementById('dock-tool-section-3d');
      if (secBtn) secBtn.click();
    `);
    await sleep(500);

    // Set sun azimuth & elevation
    await client.eval(`
      const az = document.getElementById('slider-studio-sun-azimuth');
      const el = document.getElementById('slider-studio-sun-elevation');
      if (az) { az.value = '220'; az.dispatchEvent(new Event('input')); }
      if (el) { el.value = '35'; el.dispatchEvent(new Event('input')); }
    `);
    await sleep(1000);

    await client.screenshot('v26_1_studio_3d_sun_and_section_cut.png');

    // 3. Switch to 2D Cartography view (#mapper)
    console.log('Testing 2D Cartography Nolli (#mapper)...');
    await client.eval(`
      window.switchView('mapper');
      // Set Nolli B/N preset
      const nolliBtn = document.querySelector('[data-mappreset="figure"]');
      if (nolliBtn) nolliBtn.click();
    `);
    await sleep(2000);

    await client.screenshot('v26_2_cartografia_2d_crisp_nolli.png');

    // 4. Switch to Composición (#composition)
    console.log('Testing Composición (#composition)...');
    await client.eval(`
      window.switchView('composition');
    `);
    await sleep(1500);

    // Check composition controls
    const compState = await client.eval(`
      (() => {
        const page = sheetPages[activeSheetPageIndex];
        const grid = document.getElementById('compositor-viewports-grid');
        const emptyBlocks = grid ? grid.querySelectorAll('.comp-vp-empty').length : 0;
        const totalBlocks = grid ? grid.querySelectorAll('.comp-vp-block').length : 0;
        const addBtn = document.getElementById('comp-btn-add-viewport');
        const tbProj = document.getElementById('compositor-tb-project')?.textContent;
        const tbLogo = document.getElementById('compositor-tb-logo-container')?.textContent?.trim();
        return {
          pageName: page.name,
          format: page.format,
          layout: page.layout,
          emptyBlocks,
          totalBlocks,
          tbProj,
          tbLogo
        };
      })()
    `);
    console.log('Compositor state:', compState);

    await client.screenshot('v26_3_composicion_blocks_and_clean_titleblock.png');

    // 5. Test Template 1 (Hero 65% + 2 detalles)
    console.log('Switching to Hero Layout Template...');
    await client.eval(`
      document.getElementById('comp-btn-layout-1')?.click();
    `);
    await sleep(800);
    await client.screenshot('v26_4_composicion_hero_layout.png');

    // 6. Test opening the + Asignar Vista modal
    console.log('Testing + Asignar Vista Modal...');
    await client.eval(`
      const addVpBtn = document.querySelector('.comp-vp-add-btn');
      if (addVpBtn) addVpBtn.click();
    `);
    await sleep(600);
    await client.screenshot('v26_5_composicion_assign_modal.png');

    console.log('All CDP verification tests completed successfully!');
    client.close();
  } catch (err) {
    console.error('CDP test error:', err);
  } finally {
    try { chrome.kill(); } catch (e) {}
  }
}

main();
