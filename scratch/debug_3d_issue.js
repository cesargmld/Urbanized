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
        if (msg.method === 'Console.messageAdded') {
          console.log('[BROWSER CONSOLE]', msg.params.message.level, msg.params.message.text);
        } else if (msg.method === 'Runtime.consoleAPICalled') {
          console.log('[BROWSER API CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
        } else if (msg.method === 'Runtime.exceptionThrown') {
          console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails?.text, msg.params.exceptionDetails?.exception?.description);
        }

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
    if (res?.exceptionDetails) {
      console.error('[EVAL EXCEPTION]', res.exceptionDetails?.text, res.exceptionDetails?.exception?.description);
    }
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
    await cdp.send('Console.enable');

    console.log('Navigated. Checking app status...');
    await sleep(2000);

    // Click on template or submit build
    console.log('Selecting Monterrey Centro template...');
    await cdp.eval(`
      const tpl = document.querySelector('[data-tpl="tpl_mty_centro"]');
      if (tpl) tpl.click();
    `);
    await sleep(500);

    console.log('Clicking Crear Modelo 3D (#build button)...');
    await cdp.eval(`
      const b = document.getElementById('build');
      if (b) b.click();
      else document.getElementById('panel')?.requestSubmit();
    `);

    // Poll for up to 35 seconds
    for (let i = 0; i < 35; i++) {
      await sleep(1000);
      const state = await cdp.eval(`
        (() => {
          const currentMode = window.currentWorkspaceMode;
          const activeModel = window.hasActiveModel ? window.hasActiveModel() : false;
          const resultEl = document.getElementById('result');
          const resultDisplay = resultEl ? getComputedStyle(resultEl).display : 'none';
          const viewerCanvas = document.querySelector('#viewer canvas');
          const canvasW = viewerCanvas ? viewerCanvas.width : 0;
          const canvasH = viewerCanvas ? viewerCanvas.height : 0;
          const loadingModal = document.getElementById('loading-modal');
          const loadingDisplay = loadingModal ? getComputedStyle(loadingModal).display : 'none';
          return { currentMode, activeModel, resultDisplay, canvasW, canvasH, loadingDisplay };
        })()
      `);
      console.log('Poll ' + i + 's:', state);
      if (state && state.activeModel && state.currentMode === 'result') {
        console.log('Model generated and in result mode!');
        break;
      }
    }

    await sleep(2000);
    await cdp.screenshot('debug_3d_state.png');

    // Inspect Three.js scene status and errors
    const sceneInfo = await cdp.eval(`
      (() => {
        const v = document.getElementById('viewer');
        const canvas = v?.querySelector('canvas');
        return {
          viewerExists: !!v,
          viewerW: v?.clientWidth,
          viewerH: v?.clientHeight,
          viewerDisplay: v ? getComputedStyle(v).display : 'none',
          viewerVisibility: v ? getComputedStyle(v).visibility : 'none',
          viewerOpacity: v ? getComputedStyle(v).opacity : 'none',
          canvasExists: !!canvas,
          canvasW: canvas?.width,
          canvasH: canvas?.height,
          canvasStyle: canvas?.getAttribute('style')
        };
      })()
    `);
    console.log('Scene Info:', sceneInfo);

    cdp.close();
  } catch (err) {
    console.error('Error during debug:', err);
  } finally {
    try { chromeProc.kill(); } catch (e) {}
  }
})();
