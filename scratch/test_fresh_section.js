const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\brain\\4c9d7643-850d-4047-b708-96b7b93573c7';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\chrome_test_fresh_' + Date.now();

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
  console.log('Launching clean Chrome instance...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9444',
    '--user-data-dir=' + USER_DATA_DIR,
    '--window-size=1540,940',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:3000'
  ]);

  await sleep(2000);

  const tabs = await fetchJson('http://127.0.0.1:9444/json');
  const pageTab = tabs.find(t => t.type === 'page');
  const cdp = new CDPClient(pageTab.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await sleep(1000);

  console.log('Testing buildSection in fresh browser...');
  const res = await cdp.eval(`
    (async () => {
      const pts = [[39.8561, -104.6737], [39.8610, -104.6700]];
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
        buildings: sec.buildings.map(b => ({ name: b.name, d0: b.d0, d1: b.d1, top: b.top, base: b.base })),
        trees: sec.trees.length
      };
    })()
  `);
  console.log('Fresh Section Result:', JSON.stringify(res, null, 2));

  await sleep(400);

  // Check overlap geometry
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
  console.log('Overlap geometry:', overlapCheck);
  if (overlapCheck && overlapCheck.dock) {
    console.log('Left Clearance:', overlapCheck.dock.left - overlapCheck.cardRight, 'px (> 0 means NO OVERLAP)');
    console.log('Right Clearance:', overlapCheck.scaleLeft - overlapCheck.dock.right, 'px (> 0 means NO OVERLAP)');
  }

  await cdp.captureScreenshot('v39_7_section_with_real_building_and_clearance.png');

  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
