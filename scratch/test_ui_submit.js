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

  console.log('Selecting Monterrey Centro template and submitting panel...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const tpl = document.querySelector('[data-tpl="tpl_mty_centro"]');
      if (tpl) tpl.click();
      setTimeout(() => {
        const form = document.getElementById('panel');
        if (form) form.requestSubmit();
      }, 300);
    })()`
  });

  // Poll for up to 25s
  for (let i = 0; i < 25; i++) {
    await sleep(1000);
    const mode = await send('Runtime.evaluate', {
      expression: 'window.currentWorkspaceMode',
      returnByValue: true
    });
    console.log(`Poll ${i}s mode:`, mode.result?.value);
    if (mode.result?.value === 'result') {
      console.log('SUCCESS! Switched to result screen!');
      break;
    }
  }

  await sleep(2500);

  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\brain\\4c9d7643-850d-4047-b708-96b7b93573c7\\v29_ui_created_3d_model.png', Buffer.from(ss.data, 'base64'));
  console.log('Screenshot saved to v29_ui_created_3d_model.png');

  ws.close();
  chromeProc.kill();
})();
