const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\brain\\4c9d7643-850d-4047-b708-96b7b93573c7';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\chrome_test_fresh4_' + Date.now();

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
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9447',
    '--user-data-dir=' + USER_DATA_DIR,
    '--window-size=1540,940',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:3000'
  ]);

  await sleep(1500);

  const tabs = await fetchJson('http://127.0.0.1:9447/json');
  const pageTab = tabs.find(t => t.type === 'page');
  const cdp = new CDPClient(pageTab.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  for (let i = 0; i < 30; i++) {
    const ready = await cdp.eval(`typeof window.buildSection === 'function'`);
    if (ready) break;
    await sleep(200);
  }

  // Dismiss loader
  await cdp.eval(`
    const l = document.getElementById('h3l-page-loader');
    if (l) { l.style.display = 'none'; l.hidden = true; }
  `);
  await sleep(200);

  console.log('Testing Section Cut with both Buildings and Trees (Central Park / 5th Ave NYC)...');
  const res = await cdp.eval(`
    (async () => {
      // Cut from inside Central Park across trees to 5th Ave buildings
      const pts = [[40.7730, -73.9710], [40.7710, -73.9630]];
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
        treesCount: sec.trees?.length || 0,
        metaText: document.getElementById('sec-meta-drawer')?.textContent
      };
    })()
  `);
  console.log('NYC Result:', JSON.stringify(res, null, 2));

  await sleep(600);
  await cdp.captureScreenshot('v39_9_section_with_buildings_and_trees_nyc.png');

  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
