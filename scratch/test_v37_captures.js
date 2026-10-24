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

    // Wait for page + fonts to load
    await sleep(2800);

    // 1. Capture H3L Stop-Motion Page Loader mid-animation (Frame 7: wireframe globe + inverted stamp block on 'r'/'b')
    await send('Runtime.evaluate', { expression: `window.setH3lFrame && window.setH3lFrame(7);` });
    await sleep(250);
    const shotH3lMid = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'v37_h3l_stop_motion_loader_mid.png'), Buffer.from(shotH3lMid.data, 'base64'));
    console.log('[Capture 1]: Saved v37_h3l_stop_motion_loader_mid.png');

    // 2. Capture H3L Stop-Motion Page Loader fully assembled (Frame 18: full urbnzd wordmark + globe)
    await send('Runtime.evaluate', { expression: `window.setH3lFrame && window.setH3lFrame(18);` });
    await sleep(250);
    const shotH3lEnd = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'v37_h3l_stop_motion_loader_assembled.png'), Buffer.from(shotH3lEnd.data, 'base64'));
    console.log('[Capture 2]: Saved v37_h3l_stop_motion_loader_assembled.png');

    // Hide page loader to reveal map screen
    await send('Runtime.evaluate', {
      expression: `
        const pl = document.getElementById('h3l-page-loader');
        if (pl) pl.style.display = 'none';
      `
    });
    await sleep(800);

    // 3. Capture Main Map Screen (Monochrome Grayscale Brackets, No Outer Frames, Workspace Badge, Liquid Glass Credits)
    const shotMap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'v37_map_grayscale_brackets_clean.png'), Buffer.from(shotMap.data, 'base64'));
    console.log('[Capture 3]: Saved v37_map_grayscale_brackets_clean.png');

    // 4. Capture Extraction HUD Loader with inverted bright white URBNZD logo
    await send('Runtime.evaluate', {
      expression: `
        const lm = document.getElementById('axiom-loading-modal');
        if (lm) {
          lm.hidden = false;
          lm.style.display = 'flex';
        }
        if (typeof renderLoadingProgress === 'function') {
          renderLoadingProgress(68);
        }
      `
    });
    await sleep(500);
    const shotHudLoader = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'v37_extraction_loader_fixed_logo.png'), Buffer.from(shotHudLoader.data, 'base64'));
    console.log('[Capture 4]: Saved v37_extraction_loader_fixed_logo.png');

  } catch (e) {
    console.error('Error during capture:', e);
  } finally {
    try { chromeProc.kill(); } catch (e) {}
    process.exit(0);
  }
})();
