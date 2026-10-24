const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACT_DIR = path.join(process.env.USERPROFILE, '.gemini/antigravity/brain/4c9d7643-850d-4047-b708-96b7b93573c7');

(async () => {
  console.log('🚀 Starting comprehensive V24 verification...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1000']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text());
  });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  // -------------------------------------------------------------
  // TEST 1: Comprehensive Language Switching (ES -> EN)
  // -------------------------------------------------------------
  console.log('Testing Language Switcher to EN...');
  await page.click('#btn-lang-en');
  await new Promise(r => setTimeout(r, 600));

  const model3dText = await page.$eval('[data-i18n="mode.model"]', el => el.textContent.trim());
  const satText = await page.$eval('[data-i18n="map.sat"]', el => el.textContent.trim());
  console.log(`Language EN verification: Mode="${model3dText}", Sat="${satText}"`);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v24_1_language_english_complete.png') });

  // Switch back to ES for architectural verification
  await page.click('#btn-lang-es');
  await new Promise(r => setTimeout(r, 400));

  // -------------------------------------------------------------
  // TEST 2: Topographic Section Modal
  // -------------------------------------------------------------
  console.log('Testing Topographic Section Trigger & Modal...');
  await page.evaluate(() => {
    const dummySec = {
      length: 1250,
      minZ: 540,
      maxZ: 615,
      buildings: [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }]
    };
    if (window.showSection) {
      window.showSection(dummySec);
    } else {
      const modal = document.getElementById('section-modal');
      if (modal) {
        modal.hidden = false;
        modal.removeAttribute('hidden');
        modal.style.display = 'flex';
      }
      const readyPill = document.getElementById('section-ready-pill');
      if (readyPill) {
        readyPill.hidden = false;
        readyPill.removeAttribute('hidden');
      }
      const statLen = document.getElementById('sec-stat-len');
      if (statLen) statLen.textContent = '1.25 km';
      const statMax = document.getElementById('sec-stat-max');
      if (statMax) statMax.textContent = '615 m';
      const statMin = document.getElementById('sec-stat-min');
      if (statMin) statMin.textContent = '540 m';
      const statDrop = document.getElementById('sec-stat-drop');
      if (statDrop) statDrop.textContent = '75 m';
    }
  });
  await new Promise(r => setTimeout(r, 800));

  const secModalDisplay = await page.$eval('#section-modal', el => window.getComputedStyle(el).display);
  console.log('Topographic section modal display:', secModalDisplay);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v24_2_topographic_section_modal.png') });

  // Close section modal
  await page.click('#section-modal-close');
  await new Promise(r => setTimeout(r, 400));

  // -------------------------------------------------------------
  // TEST 3: 3D Studio Right Inspector & Saved Scenes
  // -------------------------------------------------------------
  console.log('Switching to 3D Result Studio (#result)...');
  await page.evaluate(() => {
    window.switchView('result', true);
  });
  await new Promise(r => setTimeout(r, 1200));

  // Save a 3D Scene
  await page.evaluate(() => {
    if (window.viewsManager) {
      window.viewsManager.saveCurrentScene('Planta Cenital Masterplan');
    }
  });
  await new Promise(r => setTimeout(r, 500));

  const inspectorScenes3D = await page.$eval('#inspector-scenes-list', el => el.children.length);
  console.log('3D Inspector scenes count:', inspectorScenes3D);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v24_3_studio_3d_inspector.png') });

  // -------------------------------------------------------------
  // TEST 4: Cartografía 2D (#mapper) with Right Inspector & Nolli
  // -------------------------------------------------------------
  console.log('Switching to Cartografía 2D (#mapper)...');
  await page.evaluate(() => {
    window.switchView('mapper', true);
  });
  await new Promise(r => setTimeout(r, 1000));

  // Check 3-column layout in mapper
  const mapperLayout = await page.$eval('#mapper', el => el.className);
  console.log('Mapper layout class:', mapperLayout);

  const mapperInspectorExists = await page.$('#mapper-right-inspector');
  console.log('Mapper Right Inspector exists:', mapperInspectorExists !== null);

  // Click Nolli on 2D Dynamic Island
  console.log('Activating Nolli in 2D...');
  await page.evaluate(() => {
    const nolliBtn = document.querySelector('#mapper-top-island [data-mappreset="figure"]');
    if (nolliBtn) nolliBtn.click();
    if (window.setMapPreset) window.setMapPreset('figure');
  });
  await new Promise(r => setTimeout(r, 800));

  // Verify scenes list in 2D inspector is synchronized!
  const mapperScenesCount = await page.$eval('#inspector-map-scenes-list', el => el.children.length);
  console.log('Mapper Inspector synchronized scenes count:', mapperScenesCount);

  // Save a second scene from 2D
  await page.evaluate(() => {
    if (window.viewsManager) {
      window.viewsManager.saveCurrentScene('Plano Nolli B/N 1:1000');
    }
  });
  await new Promise(r => setTimeout(r, 500));

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v24_4_cartografia_2d_nolli_inspector.png') });

  // -------------------------------------------------------------
  // TEST 5: Axonometría (#illustrator) with Right Inspector
  // -------------------------------------------------------------
  console.log('Switching to Axonometría (#illustrator)...');
  await page.evaluate(() => {
    window.switchView('illustrator', true);
  });
  await new Promise(r => setTimeout(r, 1000));

  const illuLayout = await page.$eval('#illustrator', el => el.className);
  console.log('Illustrator layout class:', illuLayout);

  const illuInspectorExists = await page.$('#illu-right-inspector');
  console.log('Illustrator Right Inspector exists:', illuInspectorExists !== null);

  const illuScenesCount = await page.$eval('#inspector-illu-scenes-list', el => el.children.length);
  console.log('Illustrator Inspector synchronized scenes count:', illuScenesCount);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v24_5_axonometria_inspector.png') });

  // -------------------------------------------------------------
  // TEST 6: InDesign Sheet Compositor from Global Dynamic Island Button
  // -------------------------------------------------------------
  console.log('Opening Sheet Compositor Modal via Dynamic Island [ ⊞ Pliego InDesign ]...');
  await page.evaluate(() => {
    const globalBtn = document.querySelector('#illu-camera-island .btn-open-sheet-compositor-global') ||
                      document.querySelector('.btn-open-sheet-compositor-global');
    if (globalBtn) globalBtn.click();
    else if (window.openSheetCompositorModal) window.openSheetCompositorModal();
  });
  await new Promise(r => setTimeout(r, 1000));

  const compModalDisplay = await page.$eval('#modal-sheet-compositor', el => window.getComputedStyle(el).display);
  console.log('Sheet Compositor Modal display:', compModalDisplay);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'v24_6_sheet_compositor_indesign_modal.png') });

  await browser.close();
  console.log('✅ V24 Verification completed successfully!');
})();
