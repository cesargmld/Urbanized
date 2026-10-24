const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1000']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // 1. Check Header & Share modal
  console.log('Testing Share Modal...');
  await page.click('#btn-topbar-share');
  await new Promise(r => setTimeout(r, 600));

  const shareModalVisible = await page.$eval('#modal-share-project', el => !el.hidden && el.style.display !== 'none');
  console.log('Share modal visible:', shareModalVisible);
  await page.screenshot({ path: path.join(process.env.USERPROFILE, '.gemini/antigravity/brain/4c9d7643-850d-4047-b708-96b7b93573c7/v23_1_share_modal_clean.png') });

  await page.click('#modal-share-close');
  await new Promise(r => setTimeout(r, 400));

  // 2. Switch to 3D result view and check Right Inspector scenes
  console.log('Switching to 3D result studio...');
  await page.evaluate(() => {
    window.switchView('result', true);
  });
  await new Promise(r => setTimeout(r, 1200));

  // Check 3D dock tools
  const cam3dExists = await page.$('#dock-tool-cam-3d');
  console.log('Duplicate dock-tool-cam-3d exists (should be null):', cam3dExists !== null);
  const topIslandSceneExists = await page.$('#capsule-scene');
  console.log('Duplicate top island capsule-scene exists (should be null):', topIslandSceneExists !== null);

  // 3. Save a scene
  console.log('Saving scene...');
  await page.evaluate(() => {
    if (window.viewsManager) {
      window.viewsManager.saveCurrentScene('Planta Cenital Masterplan');
    }
  });
  await new Promise(r => setTimeout(r, 500));

  // 4. Open Drawer Tab 2 (Láminas & Formatos)
  console.log('Opening Láminas & Formatos Drawer (Tab 2)...');
  await page.evaluate(() => {
    const tabBtn = document.querySelector('[data-tab="pages"]');
    if (tabBtn) tabBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  await page.screenshot({ path: path.join(process.env.USERPROFILE, '.gemini/antigravity/brain/4c9d7643-850d-4047-b708-96b7b93573c7/v23_2_laminas_indesign_drawer.png') });

  // 5. Click 4 Pasos layout
  console.log('Switching to 4 Pasos layout...');
  await page.click('#btn-layout-4');
  await new Promise(r => setTimeout(r, 500));

  // 6. Open Sheet Compositor Modal (InDesign Mode)
  console.log('Opening Sheet Compositor Modal...');
  await page.click('#btn-open-sheet-compositor');
  await new Promise(r => setTimeout(r, 1000));

  const compModalVisible = await page.$eval('#modal-sheet-compositor', el => !el.hidden && el.style.display !== 'none');
  console.log('Sheet Compositor Modal visible:', compModalVisible);

  await page.screenshot({ path: path.join(process.env.USERPROFILE, '.gemini/antigravity/brain/4c9d7643-850d-4047-b708-96b7b93573c7/v23_3_sheet_compositor_indesign_modal.png') });

  await browser.close();
  console.log('Browser test complete!');
})();
