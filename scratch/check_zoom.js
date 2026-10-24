const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

(async () => {
  const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--window-size=1680,1050',
    '--disable-web-security',
    '--allow-running-insecure-content',
    '--disable-features=IsolateOrigins,site-per-process',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const targets = await fetchJson('http://127.0.0.1:9222/json/list');
  const target = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = id++;
    const handler = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id === msgId) { ws.removeEventListener('message', handler); resolve(msg.result); }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await new Promise(r => setTimeout(r, 6000));

  const res = await send('Runtime.evaluate', {
    expression: `
      (() => {
        return JSON.stringify({
          tiles: document.querySelectorAll('.leaflet-tile').length,
          tilesLoaded: document.querySelectorAll('.leaflet-tile-loaded').length
        });
      })()
    `
  });
  console.log('Tiles status with flags:', res.result?.value);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/Cesar Gonzalez/.gemini/antigravity/brain/4c9d7643-850d-4047-b708-96b7b93573c7/v31_map_with_satellite_tiles.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved v31_map_with_satellite_tiles.png');
  proc.kill();
})();
