const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const USER_DATA_DIR = path.join(process.env.USERPROFILE, '.gemini/antigravity/scratch/chrome_temp_css');
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

    await cdp.eval(`window.switchView('result', true)`);
    await sleep(800);

    const info = await cdp.eval(`(() => {
      const res = document.getElementById('result');
      return Array.from(res.children).map((c, i) => ({
        index: i,
        id: c.id,
        tag: c.tagName,
        rect: {
          x: c.getBoundingClientRect().x,
          y: c.getBoundingClientRect().y,
          width: c.getBoundingClientRect().width,
          height: c.getBoundingClientRect().height
        },
        flex: window.getComputedStyle(c).flex,
        order: window.getComputedStyle(c).order
      }));
    })()`);

    console.log(JSON.stringify(info, null, 2));

  } catch (err) {
    console.error('Error during CSS check:', err);
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill();
  }
})();
