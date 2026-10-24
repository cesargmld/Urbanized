const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-web-security', '--allow-running-insecure-content']
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Wait 4 seconds for Esri tiles to load
  await page.waitForTimeout(4000);

  // 1. Capture default Monochrome view with opacity and new logo
  const artDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\brain\\4c9d7643-850d-4047-b708-96b7b93573c7';
  await page.screenshot({ path: path.join(artDir, 'v33_monochrome_opacity_and_logo.png') });
  console.log('Saved v33_monochrome_opacity_and_logo.png');

  // 2. Switch to Topographic Section mode to check subtle buttons & uppercase
  await page.click('button[data-mode="section"]');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(artDir, 'v33_section_subtle_buttons.png') });
  console.log('Saved v33_section_subtle_buttons.png');

  await browser.close();
  console.log('All verification screenshots captured!');
})();
