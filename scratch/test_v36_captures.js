const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

(async () => {
  const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const artifactDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\brain\\4c9d7643-850d-4047-b708-96b7b93573c7';

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--window-size=1680,1050',
    '--disable-gpu',
    '--no-first-run',
    '--disable-web-security',
    '--allow-running-insecure-content',
    'about:blank'
  ]);

  try {
    await sleep(2000);
    const targets = await fetchJson('http://127.0.0.1:9222/json/list');
    const target = targets.find(t => t.type === 'page') || targets[0];
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const msgId = id++;
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: 'http://localhost:3000' });
    await sleep(3500);

    // 1. Capture clean Map with new rectangular search, larger arrow, centered island, setup card with 4-corner brackets
    const shotMap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'v36_map_clean_precision.png'), Buffer.from(shotMap.data, 'base64'));
    console.log('[Capture 1]: Saved v36_map_clean_precision.png');

    // 2. Trigger Search Input with results dropdown to show terracotta accent & rectangular shape
    await send('Runtime.evaluate', {
      expression: `
        const q = document.getElementById('q');
        if (q) {
          q.focus();
          q.value = 'Monterrey';
          const res = document.getElementById('results');
          if (res) {
            res.hidden = false;
            res.removeAttribute('hidden');
            res.style.display = 'block';
            res.innerHTML = \`
              <li class="search-preview-item">
                <div class="search-item-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <div class="search-item-info">
                  <span class="search-item-title">Monterrey, Nuevo León, México</span>
                  <span class="search-item-subtitle">Centro Histórico & Obispado</span>
                  <div class="search-item-meta">
                    <span class="search-badge-type">METRÓPOLI</span>
                    <span class="search-badge-coords">25°40'N 100°18'W</span>
                  </div>
                </div>
              </li>
              <li class="search-preview-item">
                <div class="search-item-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <div class="search-item-info">
                  <span class="search-item-title">Monterrey, Casanare, Colombia</span>
                  <span class="search-item-subtitle">Región de la Orinoquía</span>
                  <div class="search-item-meta">
                    <span class="search-badge-type">CIUDAD</span>
                    <span class="search-badge-coords">4°52'N 72°53'W</span>
                  </div>
                </div>
              </li>
            \`;
          }
        }
      `
    });
    await sleep(800);
    const shotSearch = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'v36_search_terracotta.png'), Buffer.from(shotSearch.data, 'base64'));
    console.log('[Capture 2]: Saved v36_search_terracotta.png');

    // 3. Trigger Full-Horizon Topographic Section Cad Dock (in context with Map)
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('results').style.display = 'none';
        const s = document.getElementById('section-modal');
        if (s) {
          s.hidden = false;
          s.style.display = 'flex';
          const len = document.getElementById('sec-stat-len'); if (len) len.textContent = '1.85 KM';
          const max = document.getElementById('sec-stat-max'); if (max) max.textContent = '482 M';
          const min = document.getElementById('sec-stat-min'); if (min) min.textContent = '391 M';
          const drop = document.getElementById('sec-stat-drop'); if (drop) drop.textContent = '91 M';
          const meta = document.getElementById('sec-meta-drawer'); if (meta) meta.textContent = '1.85 KM · COTAS 391M A 482M · 42 ESTRUCTURAS';
        }
      `
    });
    await sleep(800);
    const shotSection = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'v36_full_horizon_section.png'), Buffer.from(shotSection.data, 'base64'));
    console.log('[Capture 3]: Saved v36_full_horizon_section.png');

    // 4. Trigger Share Modal (Liquid Glass + Rectilinear + Terracotta)
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('section-modal').style.display = 'none';
        const sm = document.getElementById('modal-share-project');
        if (sm) {
          sm.hidden = false;
          sm.style.display = 'flex';
        }
      `
    });
    await sleep(800);
    const shotShare = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'v36_modal_share_terracotta.png'), Buffer.from(shotShare.data, 'base64'));
    console.log('[Capture 4]: Saved v36_modal_share_terracotta.png');

    // 5. Trigger Tech HUD Loader (with URBNZD logo, no CGM Atelier in loader)
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('modal-share-project').style.display = 'none';
        const lm = document.getElementById('axiom-loading-modal');
        if (lm) {
          lm.hidden = false;
          lm.style.display = 'flex';
        }
        if (typeof renderLoadingProgress === 'function') {
          renderLoadingProgress(64);
        }
      `
    });
    await sleep(800);
    const shotLoader = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'v36_loader_urbnzd_logo.png'), Buffer.from(shotLoader.data, 'base64'));
    console.log('[Capture 5]: Saved v36_loader_urbnzd_logo.png');

  } catch (e) {
    console.error('Error during capture:', e);
  } finally {
    try { chromeProc.kill(); } catch (e) {}
    process.exit(0);
  }
})();
