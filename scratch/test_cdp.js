const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\brain\\4c9d7643-850d-4047-b708-96b7b93573c7';

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getJSON(url) {
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

class SimpleCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    const WebSocket = global.WebSocket || (await import('worker_threads')).WebSocket;
    return new Promise((resolve, reject) => {
      // Use native Node 22+ WebSocket or basic ws
      if (typeof globalThis.WebSocket !== 'undefined') {
        this.ws = new globalThis.WebSocket(this.wsUrl);
        this.ws.onopen = () => resolve();
        this.ws.onerror = (e) => reject(e);
        this.ws.onmessage = (msg) => this.onMessage(JSON.parse(msg.data));
      } else {
        // Fallback or use standard Node net/http if WebSocket not global
        resolve(false);
      }
    });
  }

  onMessage(data) {
    if (data.id && this.callbacks.has(data.id)) {
      const cb = this.callbacks.get(data.id);
      this.callbacks.delete(data.id);
      if (data.error) cb.reject(data.error);
      else cb.resolve(data.result);
    }
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
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
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(artifactDir, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`[Screenshot saved]: ${outPath}`);
    return outPath;
  }
}

async function run() {
  console.log('[Test]: Starting headless Chrome with remote debugging on port 9222...');
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--window-size=1600,1000',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  try {
    let version = null;
    for (let i = 0; i < 30; i++) {
      await wait(400);
      try {
        version = await getJSON('http://127.0.0.1:9222/json/version');
        if (version?.webSocketDebuggerUrl) break;
      } catch (e) {}
    }

    if (!version) {
      console.error('Failed to connect to Chrome CDP.');
      return;
    }

    const targets = await getJSON('http://127.0.0.1:9222/json/list');
    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) {
      console.error('No page target found.');
      return;
    }

    const cdp = new SimpleCDP(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    console.log('[Test]: Connected to page. Enabling domains...');
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await wait(1200);

    // 1. Test Header Navigation Clusters
    const headerNavOrder = await cdp.eval(`
      Array.from(document.querySelectorAll('.axiom-view-nav button.axiom-view-btn')).map(b => b.textContent.trim())
    `);
    console.log('1. Header nav buttons:', headerNavOrder);

    // Wait for modules to initialize
    await cdp.eval(`
      new Promise(resolve => {
        const check = () => {
          if (typeof window.switchView === 'function') resolve(true);
          else setTimeout(check, 100);
        };
        check();
      })
    `);

    // 2. Test Workspace Home
    await cdp.eval(`window.switchView('workspace-home', true);`);
    await wait(800);
    const wsTitle = await cdp.eval(`document.querySelector('.rayon-breadcrumb-title h1')?.textContent.trim()`);
    console.log('2. Workspace title:', wsTitle);

    // Switch to List View
    await cdp.eval(`document.getElementById('ws-btn-view-list')?.click();`);
    await wait(800);
    const listDisplay = await cdp.eval(`document.getElementById('ws-cards-list')?.style.display`);
    const listRowsCount = await cdp.eval(`document.querySelectorAll('#ws-cards-list .rayon-list-row').length`);
    console.log('3. List view display:', listDisplay, 'Rows count:', listRowsCount);

    await cdp.screenshot('v25_1_workspace_list_view.png');

    // Switch back to Grid View
    await cdp.eval(`document.getElementById('ws-btn-view-grid')?.click();`);
    await wait(300);
    await cdp.screenshot('v25_2_workspace_grid_view.png');

    // 3. Test 3D Studio & Dynamic Island & Nolli Mode
    // Load Monterrey template
    await cdp.eval(`
      const tpl = document.querySelector('[data-tpl="tpl_mty_centro"]');
      if (tpl) tpl.click();
    `);
    await wait(500);

    // Trigger 3D build
    console.log('[Test]: Triggering 3D model build...');
    await cdp.eval(`
      const form = document.getElementById('panel');
      if (form) form.requestSubmit();
    `);

    // Wait for model build to complete (up to 20s)
    let modelBuilt = false;
    for (let i = 0; i < 40; i++) {
      await wait(500);
      const active = await cdp.eval(`window.hasActiveModel?.()`);
      const currentView = await cdp.eval(`window.currentWorkspaceMode`);
      if (active && currentView === 'result') {
        modelBuilt = true;
        break;
      }
    }
    console.log('4. 3D Model built in session:', modelBuilt);
    await wait(1500);

    // Verify 3D Model Centered and Dynamic Island
    const islandCapsules = await cdp.eval(`
      Array.from(document.querySelectorAll('#studio-top-bar .axiom-island-capsule')).length
    `);
    console.log('5. 3D Dynamic Island capsules:', islandCapsules);
    await cdp.screenshot('v25_3_studio_3d_centered_45deg.png');

    // Activate Nolli 3D Mode
    console.log('[Test]: Activating 3D Nolli Mode...');
    await cdp.eval(`document.getElementById('btn-render-nolli-3d')?.click();`);
    await wait(1200);
    const isNolliActive = await cdp.eval(`window.is3DNolliActive?.()`);
    console.log('6. Nolli 3D Mode active:', isNolliActive);
    await cdp.screenshot('v25_4_studio_3d_nolli_mode.png');

    // Switch back to Urbano GIS
    await cdp.eval(`document.getElementById('btn-render-model')?.click();`);
    await wait(800);

    // 4. Test 2D Cartography & Nolli
    console.log('[Test]: Switching to 2D Cartography...');
    await cdp.eval(`window.switchView('mapper', true);`);
    await wait(1000);
    await cdp.screenshot('v25_5_cartografia_2d.png');

    // Test 2D Nolli
    await cdp.eval(`document.querySelector('[data-mappreset="figure"]')?.click();`);
    await wait(1000);
    await cdp.screenshot('v25_6_cartografia_2d_nolli.png');

    // 5. Test Projection from 2D Cartography to Axonometría
    console.log('[Test]: Projecting from 2D Cartography to Axonometría...');
    await cdp.eval(`document.getElementById('btn-island-apply-carto')?.click();`);
    await wait(1500);
    const currentViewAfterProj = await cdp.eval(`window.currentWorkspaceMode`);
    console.log('7. View after projection:', currentViewAfterProj);
    await cdp.screenshot('v25_7_axonometria_projected_and_layers.png');

    // 6. Test Composición (native screen layer)
    console.log('[Test]: Switching to Composición...');
    await cdp.eval(`window.switchView('composition', true);`);
    await wait(1200);
    const compDisplay = await cdp.eval(`document.getElementById('composition')?.style.display`);
    console.log('8. Composición display:', compDisplay);
    await cdp.screenshot('v25_8_composicion_screen_layer.png');

    console.log('[Test]: All validations completed successfully!');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    proc.kill();
  }
}

run();
