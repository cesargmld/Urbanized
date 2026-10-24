const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\brain\\4c9d7643-850d-4047-b708-96b7b93573c7';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\chrome_test_v40_' + Date.now();

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
      console.error('Eval error:', res.exceptionDetails);
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
  console.log('Launching fresh Chrome instance for v40 verification...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9455',
    '--user-data-dir=' + USER_DATA_DIR,
    '--window-size=1540,940',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:3000'
  ]);

  await sleep(1500);

  const tabs = await fetchJson('http://127.0.0.1:9455/json');
  const pageTab = tabs.find(t => t.type === 'page');
  const cdp = new CDPClient(pageTab.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // 1. Capture H3L Kinetic Motion Graphics Loader
  console.log('1. Testing H3L Kinetic Motion Graphics Loader...');
  await cdp.eval(`window.replayH3lLoader && window.replayH3lLoader();`);
  await sleep(280);
  await cdp.captureScreenshot('v40_1_h3l_kinetic_scrambling_and_revolving_globe.png');

  await sleep(700);
  await cdp.captureScreenshot('v40_2_h3l_kinetic_assembled_brand.png');

  // Wait for loader exit
  await sleep(400);

  // 2. Test Slider: drag from 250 to 3500 smoothly (verify no freezing past 2.5 km)
  console.log('2. Testing #size slider up to 3500m (3.5 km)...');
  const sliderTest = await cdp.eval(`
    (() => {
      const slider = document.getElementById('size');
      slider.value = 3500;
      slider.dispatchEvent(new Event('input'));
      const label = document.getElementById('size-out')?.textContent;
      const frameLabel = document.getElementById('frame-label')?.textContent;
      slider.dispatchEvent(new Event('change'));
      return { val: slider.value, label, frameLabel };
    })()
  `);
  console.log('Slider at 3.5 km:', sliderTest);
  await sleep(200);
  await cdp.captureScreenshot('v40_3_slider_at_3_5km_smooth.png');

  // 3. Test Card Dimensions Zero-Jump
  console.log('3. Testing Setup Card zero-jump dimensions...');
  await cdp.eval(`document.querySelector('[data-mode="model"]')?.click();`);
  await sleep(100);
  const modelRect = await cdp.eval(`
    (() => {
      const el = document.getElementById('axiom-setup-card');
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), b: Math.round(r.bottom) };
    })()
  `);
  console.log('Model Mode Rect:', modelRect);

  await cdp.eval(`document.querySelector('[data-mode="section"]')?.click();`);
  await sleep(100);
  const sectionRect = await cdp.eval(`
    (() => {
      const el = document.getElementById('axiom-setup-card');
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), b: Math.round(r.bottom) };
    })()
  `);
  console.log('Section Mode Rect:', sectionRect);
  console.log('Zero Jump Verification:', {
    widthDelta: sectionRect.w - modelRect.w,
    heightDelta: sectionRect.h - modelRect.h
  });

  await cdp.captureScreenshot('v40_4_setup_card_zero_jump.png');

  // Wait for window.buildSection to be ready
  console.log('Waiting for window.buildSection...');
  for (let i = 0; i < 30; i++) {
    const ready = await cdp.eval(`typeof window.buildSection === 'function'`);
    if (ready) break;
    await sleep(200);
  }

  // 4. Test 7 km Cut across Denver Airport corridor with Interpolated Sampling
  console.log('4. Testing 7.08 km Topographic Section Cut across Denver Airport...');
  const cutTest = await cdp.eval(`
    (async () => {
      // 7 km cut across Denver Airport
      const pts = [[39.8730, -104.8500], [39.8550, -104.6800]];
      try {
        const sec = await window.buildSection(pts, { exaggeration: 2, buffer: 60 });
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
          treesCount: sec.trees?.length || 0,
          sampleBuildings: sec.buildings.slice(0, 3).map(b => ({ name: b.name, d0: Math.round(b.d0), d1: Math.round(b.d1) })),
          metaText: document.getElementById('sec-meta-drawer')?.textContent
        };
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    })()
  `);
  console.log('7 km Section Result:', JSON.stringify(cutTest, null, 2));

  await sleep(500);
  await cdp.captureScreenshot('v40_5_denver_7km_cut_with_buildings_and_dock.png');

  // 5. Capture Top Navigation & Action Buttons (.URBNZD, OPEN, SHARE, EN) with Icons
  await cdp.captureScreenshot('v40_6_topbar_action_buttons_with_icons.png');

  console.log('All v40 verifications completed!');
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
