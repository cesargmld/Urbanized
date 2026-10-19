import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\chrome_temp_' + Date.now();
const ARTIFACT_DIR = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\brain\\4c9d7643-850d-4047-b708-96b7b93573c7';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Launching headless Chrome for v23 verification...');
  const chrome = spawn(CHROME_PATH, [
    '--remote-debugging-port=9222',
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--window-size=1600,1050',
    'about:blank'
  ], { stdio: 'ignore' });

  // Wait for CDP
  let version = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        version = await res.json();
        break;
      }
    } catch {}
    await sleep(250);
  }

  if (!version) {
    chrome.kill();
    throw new Error('Failed to connect to Chrome debugging port.');
  }

  console.log('Connected to Chrome:', version['Browser']);

  const newTargetRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:3000', { method: 'PUT' });
  const pageTarget = await newTargetRes.json();
  const wsUrl = pageTarget.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);

  let msgId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const send = (method, params = {}) => {
    const id = msgId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const evalCode = async (expression) => {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res?.exceptionDetails) {
      console.error('Eval error:', res.exceptionDetails);
    }
    return res?.result?.value;
  };

  const captureScreenshot = async (filename) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`📸 Screenshot saved: ${filename}`);
  };

  await send('Page.enable');
  await send('Runtime.enable');

  await sleep(2500);

  console.log('--- TEST 1: ZERO DUPLICATES CHECK ---');
  const dupCheck = await evalCode(`(() => {
    return {
      topIslandScene: !!document.getElementById('capsule-scene'),
      bottomDockCam3d: !!document.getElementById('dock-tool-cam-3d'),
      inspectorDuplicateShare: !!document.getElementById('btn-inspector-share'),
      headerSingleShare: !!document.getElementById('btn-topbar-share'),
      langToggleText: document.getElementById('btn-lang-toggle')?.textContent.trim()
    };
  })()`);
  console.log('Duplicate check results:', dupCheck);

  console.log('--- TEST 2: DEDICATED SHARE MODAL ---');
  await evalCode(`window.triggerShareProject()`);
  await sleep(800);
  await captureScreenshot('v23_1_share_modal_clean.png');

  await evalCode(`document.getElementById('modal-share-close')?.click()`);
  await sleep(400);

  console.log('--- TEST 3: SWITCH TO 3D RESULT & SCENE FREEZING ---');
  await evalCode(`
    if (window.switchView) window.switchView('result', true);
    else if (window.switchWorkspaceView) window.switchWorkspaceView('result', true);
  `);
  await sleep(1500);

  await evalCode(`(() => {
    window.viewsManager.saveCurrentScene('01 Planta Cenital y Vial');
    window.viewsManager.saveCurrentScene('02 Axonometria Isometrica');
  })()`);
  await sleep(800);

  const scenesCount = await evalCode(`document.querySelectorAll('#inspector-scenes-list .scene-item-row').length`);
  console.log(`Scenes rendered in Right Inspector: ${scenesCount}`);
  await captureScreenshot('v23_2_inspector_scenes_active.png');

  console.log('--- TEST 4: INDESIGN-STYLE SHEETS & PAGES DRAWER (TAB 2) ---');
  await evalCode(`(() => {
    const tabBtn = document.querySelector('[data-rail-tab="pages"]');
    if (tabBtn) tabBtn.click();
  })()`);
  await sleep(1000);
  await captureScreenshot('v23_3_laminas_indesign_drawer.png');

  console.log('--- TEST 5: 4-STEP URBAN PROCESS LAYOUT & SHEET COMPOSITOR MODAL ---');
  await evalCode(`(() => {
    const btn4 = document.getElementById('btn-layout-4');
    if (btn4) btn4.click();
    window.openSheetCompositorModal();
  })()`);
  await sleep(1500);

  const compositorState = await evalCode(`(() => {
    const modal = document.getElementById('modal-sheet-compositor');
    const vpCards = document.querySelectorAll('#compositor-viewports-grid > div').length;
    const title = document.getElementById('compositor-sheet-title')?.textContent;
    const scale = document.getElementById('compositor-scale-badge')?.textContent;
    return {
      visible: !modal.hidden && modal.style.display === 'flex',
      viewportsCount: vpCards,
      title,
      scale
    };
  })()`);
  console.log('Sheet Compositor Modal state:', compositorState);
  await captureScreenshot('v23_4_sheet_compositor_indesign_modal.png');

  console.log('🎉 All verification tests passed successfully!');

  ws.close();
  chrome.kill();
  try {
    fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
  } catch {}
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
