const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const USER_DATA_DIR = path.join(process.env.USERPROFILE, '.gemini/antigravity/scratch/chrome_temp_debug');
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
    await sleep(2500);

    // Check result inspection
    await cdp.eval(`window.switchView('result', true)`);
    await sleep(800);

    const resultDebug = await cdp.eval(`(() => {
      const res = document.getElementById('result');
      const rail = document.getElementById('studio-left-rail');
      const drawer = document.getElementById('studio-left-drawer');
      const viewerWrap = document.getElementById('result-viewer-wrap');
      const inspector = document.getElementById('studio-right-inspector');

      const getBox = el => el ? {
        rect: el.getBoundingClientRect(),
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
        flex: window.getComputedStyle(el).flex,
        width: window.getComputedStyle(el).width,
        position: window.getComputedStyle(el).position,
        order: window.getComputedStyle(el).order,
      } : null;

      return {
        result: getBox(res),
        rail: getBox(rail),
        drawer: getBox(drawer),
        viewerWrap: getBox(viewerWrap),
        inspector: getBox(inspector),
      };
    })()`);

    console.log('--- RESULT 3D DEBUG ---');
    console.log(JSON.stringify(resultDebug, null, 2));

    // Check mapper inspection
    await cdp.eval(`window.switchView('mapper', true)`);
    await sleep(800);

    const mapperDebug = await cdp.eval(`(() => {
      const mapper = document.getElementById('mapper');
      const leftSys = document.getElementById('mapper-left-system');
      const stage = document.getElementById('mapper-stage');
      const inspector = document.getElementById('mapper-right-inspector');
      const getBox = el => el ? {
        rect: el.getBoundingClientRect(),
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
        flex: window.getComputedStyle(el).flex,
        width: window.getComputedStyle(el).width,
        height: window.getComputedStyle(el).height,
        position: window.getComputedStyle(el).position,
        order: window.getComputedStyle(el).order,
        childCount: el.children.length
      } : null;

      return {
        mapper: getBox(mapper),
        leftSys: getBox(leftSys),
        stage: getBox(stage),
        inspector: getBox(inspector),
      };
    })()`);

    console.log('--- MAPPER 2D DEBUG ---');
    console.log(JSON.stringify(mapperDebug, null, 2));

    // Check illustrator inspection
    await cdp.eval(`window.switchView('illustrator', true)`);
    await sleep(800);

    const illuDebug = await cdp.eval(`(() => {
      const illu = document.getElementById('illustrator');
      const leftSys = document.getElementById('illu-left-system');
      const stage = document.getElementById('illu-stage');
      const inspector = document.getElementById('illu-right-inspector');
      const getBox = el => el ? {
        rect: el.getBoundingClientRect(),
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
        flex: window.getComputedStyle(el).flex,
        width: window.getComputedStyle(el).width,
        height: window.getComputedStyle(el).height,
        position: window.getComputedStyle(el).position,
        order: window.getComputedStyle(el).order,
        childCount: el.children.length
      } : null;

      return {
        illu: getBox(illu),
        leftSys: getBox(leftSys),
        stage: getBox(stage),
        inspector: getBox(inspector),
      };
    })()`);

    console.log('--- ILLUSTRATOR DEBUG ---');
    console.log(JSON.stringify(illuDebug, null, 2));

  } catch (err) {
    console.error('Error during CDP debug:', err);
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill();
  }
})();
