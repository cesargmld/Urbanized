const http = require('http');

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
}

async function main() {
  const tabs = await fetchJson('http://127.0.0.1:9222/json');
  const targetTab = tabs.find(t => t.url.includes('localhost:3000')) || tabs[0];
  if (!targetTab) {
    console.error('No Chrome tab found');
    return;
  }
  const cdp = new CDPClient(targetTab.webSocketDebuggerUrl);
  await cdp.connect();

  const cardModel = await cdp.eval(`
    window.setMode('model');
    const card = document.getElementById('axiom-setup-card');
    const r = card.getBoundingClientRect();
    ({ width: r.width, height: r.height, top: r.top, bottom: r.bottom })
  `);
  console.log('MODEL MODE CARD RECT:', cardModel);

  const cardSection = await cdp.eval(`
    window.setMode('section');
    const card = document.getElementById('axiom-setup-card');
    const r = card.getBoundingClientRect();
    ({ width: r.width, height: r.height, top: r.top, bottom: r.bottom })
  `);
  console.log('SECTION MODE CARD RECT:', cardSection);
}

main().catch(console.error);
