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

    // Explicitly open ONLY section modal
    await send('Runtime.evaluate', {
      expression: `
        const loader = document.getElementById('axiom-loading-modal');
        if (loader) {
          loader.hidden = true;
          loader.style.display = 'none';
        }
        const s = document.getElementById('section-modal');
        if (s) {
          s.hidden = false;
          s.removeAttribute('hidden');
          s.style.display = 'flex';
          const len = document.getElementById('sec-stat-len'); if (len) len.textContent = '1.85 KM';
          const max = document.getElementById('sec-stat-max'); if (max) max.textContent = '482 M';
          const min = document.getElementById('sec-stat-min'); if (min) min.textContent = '391 M';
          const drop = document.getElementById('sec-stat-drop'); if (drop) drop.textContent = '91 M';
          const meta = document.getElementById('sec-meta-drawer'); if (meta) meta.textContent = '1.85 KM · COTAS 391M A 482M · 42 ESTRUCTURAS';
        }
      `
    });
    await sleep(1200);

    const shotSection = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'v35_tech_hud_section_modal_preview.png'), Buffer.from(shotSection.data, 'base64'));
    console.log('[Capture]: Successfully re-saved v35_tech_hud_section_modal_preview.png');

    ws.close();
  } catch (err) {
    console.error('[Capture Error]:', err);
  } finally {
    chromeProc.kill();
  }
})();
