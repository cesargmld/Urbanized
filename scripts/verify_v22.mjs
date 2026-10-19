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
  console.log('🚀 Launching headless Chrome for v22 verification...');
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

  // Create or navigate page
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

  await new Promise((resolve) => { ws.onopen = resolve; });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression, awaitPromise = true) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise
    });
    if (res.exceptionDetails) {
      console.error('Eval error:', res.exceptionDetails);
    }
    return res.result?.value;
  }

  async function capture(filename) {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const filePath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log(`📸 Screenshot saved: ${filename}`);
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  // Wait for app initialization
  await sleep(2500);

  console.log('--- TEST 1: AUTHENTICATION ERROR CHECK ---');
  // Open Auth modal
  await evaluate(`document.getElementById('header-ws-badge')?.click();`);
  await sleep(600);

  // Type wrong password
  await evaluate(`
    document.getElementById('auth-login-email').value = 'cesar@cgmatelier.com';
    document.getElementById('auth-login-pass').value = 'clave_falsa';
    document.getElementById('btn-auth-login-submit')?.click();
  `);
  await sleep(1000);

  const errorWrongPass = await evaluate(`document.getElementById('auth-login-error')?.textContent;`);
  console.log('Login with wrong pass response:', errorWrongPass);
  await capture('v22_1_auth_error_wrong_pass.png');

  // Type non-existent user
  await evaluate(`
    document.getElementById('auth-login-email').value = 'fantasma@noexiste.com';
    document.getElementById('auth-login-pass').value = 'cualquierclave';
    document.getElementById('btn-auth-login-submit')?.click();
  `);
  await sleep(1000);

  const errorNoUser = await evaluate(`document.getElementById('auth-login-error')?.textContent;`);
  console.log('Login with non-existent user response:', errorNoUser);
  await capture('v22_2_auth_error_no_user.png');

  console.log('--- TEST 2: SUCCESSFUL AUTHENTICATION ---');
  // Log in with real credentials
  await evaluate(`
    document.getElementById('auth-login-email').value = 'cesar@cgmatelier.com';
    document.getElementById('auth-login-pass').value = 'arquitectura2026';
    document.getElementById('btn-auth-login-submit')?.click();
  `);
  await sleep(1500);

  const activeUser = await evaluate(`document.getElementById('header-ws-badge')?.textContent;`);
  const activeWs = await evaluate(`document.getElementById('header-ws-name')?.textContent;`);
  console.log(`Logged in: User="${activeUser}", Workspace="${activeWs}"`);
  await capture('v22_3_auth_success_logged_in.png');

  console.log('--- TEST 3: STUDIO 3D LEFT DRAWER (BLOCKS & TABLES) ---');
  // Switch to Studio 3D
  await evaluate(`
    if (window.switchWorkspaceView) window.switchWorkspaceView('result');
    else document.querySelector('[data-modetab="3d"]')?.click();
  `);
  await sleep(2000);

  // Open Left Drawer Tab 4: Blocks & Modeling
  await evaluate(`
    const btnBlocks = document.querySelector('[data-rail-tab="blocks"]');
    if (btnBlocks) btnBlocks.click();
  `);
  await sleep(800);
  await capture('v22_4_left_drawer_blocks_modelado.png');

  // Open Left Drawer Tab 5: Tables & Quantification
  await evaluate(`
    const btnTables = document.querySelector('[data-rail-tab="tables"]');
    if (btnTables) btnTables.click();
  `);
  await sleep(800);
  await capture('v22_5_left_drawer_tables_quantifier.png');

  console.log('--- TEST 4: RIGHT INSPECTOR (CUSTOM PROPERTIES & SCENES) ---');
  // Inspect right inspector before selection
  await capture('v22_6_right_inspector_clean.png');

  // Go back to Blocks tab and add a block
  await evaluate(`
    document.querySelector('[data-rail-tab="blocks"]')?.click();
  `);
  await sleep(400);

  await evaluate(`
    document.getElementById('block-dim-w').value = '40';
    document.getElementById('block-dim-d').value = '25';
    document.getElementById('block-dim-levels').value = '8';
    document.getElementById('block-use-select').value = 'mixed';
    document.getElementById('btn-add-conceptual-block')?.click();
  `);
  await sleep(1200);

  const selTag = await evaluate(`document.getElementById('sel-block-tag')?.textContent;`);
  const selDims = await evaluate(`document.getElementById('sel-block-dims')?.textContent;`);
  const selH = await evaluate(`document.getElementById('sel-block-height')?.textContent;`);
  console.log(`Block in Right Inspector: Tag="${selTag}", Dims="${selDims}", Height="${selH}"`);
  await capture('v22_7_right_inspector_block_selected.png');

  console.log('--- TEST 5: CANVAS BACKGROUND & PURE WHITE ---');
  await evaluate(`
    document.querySelector('[data-canvas-bg="#FFFFFF"]')?.click();
  `);
  await sleep(800);
  await capture('v22_8_canvas_pure_white.png');

  console.log('✅ All verification steps completed successfully!');
  ws.close();
  chrome.kill();
  process.exit(0);
}

main().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
