const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

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

(async () => {
  const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-first-run',
    'http://localhost:3000'
  ]);

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
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Console.enable');

  ws.addEventListener('message', (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
    }
  });

  await sleep(2500);

  console.log('Testing buildModel and showModel via direct build flow...');
  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      try {
        console.log('Importing buildModel and showModel...');
        const { buildModel } = await import('./js/data.js?v=6.0');
        const { showModel } = await import('./js/preview.js?v=6.0');
        
        console.log('Building model for Monterrey Centro...');
        const m = await buildModel({
          lat: 25.6866,
          lon: -100.3161,
          size: 1000,
          shape: 'square',
          layers: { buildings: true, roads: true, terrain: true },
          sensitivity: 0.5
        }, (st) => console.log('BUILD STATUS:', st));
        
        console.log('Model generated with', m.buildings?.length, 'buildings. Switching view to result...');
        window.switchView('result', true);
        
        const viewer = document.getElementById('viewer');
        showModel(viewer, m);
        
        return {
          success: true,
          buildingsCount: m.buildings?.length,
          viewerHasCanvas: !!viewer.querySelector('canvas')
        };
      } catch (err) {
        console.error('Error in build flow:', err);
        return { error: String(err) };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Build flow result:', res.result?.value);
  await sleep(2500);

  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\brain\\4c9d7643-850d-4047-b708-96b7b93573c7\\v30_3d_model_fully_rendered.png', Buffer.from(ss.data, 'base64'));
  console.log('Saved screenshot v30_3d_model_fully_rendered.png');

  ws.close();
  chromeProc.kill();
})();
