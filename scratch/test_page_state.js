const { spawn } = require('child_process');
const http = require('http');

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
    'about:blank'
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
  await send('Log.enable');

  ws.addEventListener('message', (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[RUNTIME EXCEPTION]', msg.params.exceptionDetails);
    }
  });

  await send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(3000);

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        readyState: document.readyState,
        switchView: typeof window.switchView,
        appMap: typeof window.appMap,
        scriptsCount: document.querySelectorAll('script').length
      };
    })()`,
    returnByValue: true
  });
  console.log('Page state:', res.result?.value);

  ws.close();
  chromeProc.kill();
})();
