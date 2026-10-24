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

async function debugOverpass() {
  const tabs = await fetchJson('http://127.0.0.1:9333/json');
  const pageTab = tabs.find(t => t.type === 'page');
  const cdp = new CDPClient(pageTab.webSocketDebuggerUrl);
  await cdp.connect();

  const res = await cdp.eval(`
    (async () => {
      const pts = [[39.8561, -104.6737], [39.8610, -104.6700]];
      try {
        const sec = await window.buildSection(pts, { exaggeration: 2, buffer: 80 });
        return {
          length: sec.length,
          buildings: sec.buildings,
          trees: sec.trees
        };
      } catch (e) {
        return { error: e.message, stack: e.stack };
      }
    })()
  `);
  console.log('Build section debug:', JSON.stringify(res, null, 2));
}

debugOverpass().catch(console.error);
