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
      console.log('[CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[EXCEPTION]', msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
    }
  });

  await sleep(2000);

  console.log('Testing buildModel execution...');
  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      try {
        console.log('Starting buildModel directly...');
        const { buildModel } = await import('/js/data.js');
        console.log('buildModel imported successfully');
        const m = await buildModel({
          lat: 25.6866,
          lon: -100.3161,
          size: 1000,
          shape: 'square',
          layers: { buildings: true, roads: true, terrain: true },
          sensitivity: 0.5
        }, (status) => console.log('STATUS:', status));
        console.log('buildModel returned! buildings count:', m.buildings?.length);
        
        console.log('Calling showModel...');
        const { showModel } = await import('/js/preview.js');
        console.log('showModel imported');
        window.switchWorkspaceView('result');
        showModel(document.getElementById('viewer'), m);
        console.log('showModel executed!');
        return { success: true, buildings: m.buildings?.length };
      } catch (err) {
        console.error('Error in test:', err.stack || err);
        return { error: String(err) };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Result:', res);
  await sleep(2000);

  // Take screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\brain\\4c9d7643-850d-4047-b708-96b7b93573c7\\test_direct_build.png', Buffer.from(ss.data, 'base64'));
  console.log('Screenshot saved to test_direct_build.png');

  ws.close();
  chromeProc.kill();
})();
