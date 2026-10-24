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

  console.log('[Capture]: Launching Chrome headless...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--window-size=1680,1050',
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ]);

  try {
    await sleep(1500);
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

    console.log('[Capture]: Navigating to http://localhost:3000...');
    await send('Page.navigate', { url: 'http://localhost:3000' });
    await sleep(2500);

    // Screenshot 1: Tab 1 Map Screen (Home / Setup Card with Cyber-Obsidian UI)
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'v31_tab1_map_cyber_hud.png'), Buffer.from(shot1.data, 'base64'));
    console.log('[Capture]: Saved v31_tab1_map_cyber_hud.png');

    // Switch to section mode
    await send('Runtime.evaluate', {
      expression: `
        document.querySelector('.mode-seg [data-mode="section"]')?.click();
      `
    });
    await sleep(800);

    // Screenshot 2: Section Mode Active with CAD Guidance and Sliders
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'v31_tab1_section_mode_active.png'), Buffer.from(shot2.data, 'base64'));
    console.log('[Capture]: Saved v31_tab1_section_mode_active.png');

    // Trigger dummy section profile to view Section HUD Modal
    await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const fakeSec = {
            id: 'demo_section',
            length: 1250,
            minZ: 532,
            maxZ: 586,
            exaggeration: 2.0,
            buildings: [
              { d0: 150, d1: 190, h: 24, z: 538 },
              { d0: 320, d1: 370, h: 45, z: 546 },
              { d0: 600, d1: 680, h: 18, z: 560 }
            ],
            trees: [{ d: 250, z: 540, h: 8 }, { d: 450, z: 550, h: 10 }],
            water: [],
            points: [[25.6866, -100.3161], [25.6700, -100.3100]],
            profile: [
              { d: 0, z: 532 },
              { d: 200, z: 538 },
              { d: 400, z: 547 },
              { d: 700, z: 562 },
              { d: 1000, z: 578 },
              { d: 1250, z: 586 }
            ],
            layers: { ground: true, buildings: true, grid: true, trees: true }
          };
          if (window.showSection) {
            await window.showSection(fakeSec);
          } else {
            // Trigger through modal display directly
            const m = document.getElementById('section-modal');
            if (m) {
              m.hidden = false;
              m.removeAttribute('hidden');
              m.style.display = 'flex';
            }
          }
        })();
      `
    });
    await sleep(1000);

    // Screenshot 3: Section Modal HUD (Hero Visual Profile at Top, KPIs Below)
    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'v31_tab1_section_hud_modal.png'), Buffer.from(shot3.data, 'base64'));
    console.log('[Capture]: Saved v31_tab1_section_hud_modal.png');

    ws.close();
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    chromeProc.kill();
    console.log('[Capture]: Finished.');
  }
})();
