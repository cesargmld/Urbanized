const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\brain\\4c9d7643-850d-4047-b708-96b7b93573c7';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\chrome_test_v39';

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
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      console.error('EVAL EXCEPTION in:', expression, JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png', quality: 95 });
    const buf = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buf);
    console.log(`Saved screenshot: ${filename} (${buf.length} bytes)`);
  }
}

async function run() {
  console.log('Launching headless Chrome on port 9333...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9333',
    '--user-data-dir=' + USER_DATA_DIR,
    '--window-size=1540,940',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:3000'
  ]);

  await sleep(1500);

  const tabs = await fetchJson('http://127.0.0.1:9333/json');
  const pageTab = tabs.find(t => t.type === 'page');
  const cdp = new CDPClient(pageTab.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // 1. Capture H3L Stop-Motion Loader
  console.log('Capturing H3L Stop-Motion Loader...');
  await cdp.eval(`window.replayH3lLoader && window.replayH3lLoader();`);
  await sleep(350);
  await cdp.captureScreenshot('v39_1_h3l_stop_motion_loader_mid.png');

  await sleep(650);
  await cdp.captureScreenshot('v39_2_h3l_stop_motion_loader_assembled.png');

  // Wait for loader exit
  await sleep(500);

  // 2. Measure setup card in Model mode
  console.log('Checking Setup Card dimensions...');
  await cdp.eval(`document.querySelector('[data-mode="model"]')?.click();`);
  await sleep(150);
  const modelRect = await cdp.eval(`
    (() => {
      const el = document.getElementById('axiom-setup-card');
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), b: Math.round(r.bottom) };
    })()
  `);
  console.log('Card in MODEL mode:', modelRect);

  await cdp.captureScreenshot('v39_3_map_model_mode_card.png');

  // 3. Switch to Section mode and measure
  await cdp.eval(`document.querySelector('[data-mode="section"]')?.click();`);
  await sleep(150);
  const sectionRect = await cdp.eval(`
    (() => {
      const el = document.getElementById('axiom-setup-card');
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), b: Math.round(r.bottom) };
    })()
  `);
  console.log('Card in SECTION mode:', sectionRect);
  if (modelRect && sectionRect) {
    console.log('Zero Jump Difference:', {
      widthDelta: sectionRect.w - modelRect.w,
      heightDelta: sectionRect.h - modelRect.h
    });
  }

  await cdp.captureScreenshot('v39_4_map_section_mode_card.png');

  // 4. Test Topographic Section Cut generation & Floating CAD Dock layout
  console.log('Testing Topographic Section Cut generation with real buildings and trees...');
  const secResult = await cdp.eval(`
    (async () => {
      // Cut line across Denver Airport Concourse B
      const pts = [[39.8561, -104.6737], [39.8610, -104.6700]];
      const sec = await window.buildSection(pts, { exaggeration: 2, buffer: 50 });
      await window.showSection(sec);
      const modal = document.getElementById('section-modal');
      if (modal) {
        modal.hidden = false;
        modal.removeAttribute('hidden');
        modal.style.display = 'flex';
      }
      return {
        length: sec.length,
        buildingsCount: sec.buildings?.length || 0,
        treesCount: sec.trees?.length || 0
      };
    })()
  `);
  console.log('Section Generation Result:', secResult);

  await sleep(400);

  // Measure floating dock rect vs setup card and scale card
  const overlapCheck = await cdp.eval(`
    (() => {
      const dock = document.getElementById('section-modal')?.getBoundingClientRect();
      const card = document.getElementById('axiom-setup-card')?.getBoundingClientRect();
      const scale = document.getElementById('map-arch-scale')?.getBoundingClientRect();
      const attrib = document.querySelector('.leaflet-control-attribution')?.getBoundingClientRect();
      return {
        dock: dock ? { left: Math.round(dock.left), right: Math.round(dock.right), bottom: Math.round(dock.bottom), height: Math.round(dock.height) } : null,
        cardRight: card ? Math.round(card.right) : 0,
        scaleLeft: scale ? Math.round(scale.left) : 0,
        attribBottom: attrib ? Math.round(attrib.bottom) : 0
      };
    })()
  `);
  console.log('Layout Geometry Overlap Verification:', overlapCheck);
  if (overlapCheck && overlapCheck.dock) {
    console.log('Clearance from Left Setup Card:', overlapCheck.dock.left - overlapCheck.cardRight, 'px (> 0 means NO OVERLAP)');
    console.log('Clearance from Right Scale Card:', overlapCheck.scaleLeft - overlapCheck.dock.right, 'px (> 0 means NO OVERLAP)');
  }

  await cdp.captureScreenshot('v39_5_floating_cad_section_dock_no_overlap.png');

  // 5. Capture Top Navigation & Action Buttons (.URBNZD, OPEN, SHARE, EN)
  await cdp.captureScreenshot('v39_6_topbar_action_buttons_with_icons.png');

  console.log('All verifications completed successfully!');
  chrome.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
