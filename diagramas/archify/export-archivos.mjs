// Exportador de artefactos visuales (PNG / SVG / WebM) desde el HTML de archify.
// Uso: node export-archivos.mjs <archivo.html> <prefijo-salida> [tema] [--webm]
import { chromium } from '/home/fabian/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [htmlPath, outPrefix, themeArg, ...flags] = process.argv.slice(2);
if (!htmlPath || !outPrefix) {
  console.error('uso: node export-archivos.mjs <archivo.html> <prefijo> [light|dark] [--webm]');
  process.exit(1);
}
const theme = themeArg === 'dark' ? 'dark' : 'light';
const wantWebm = flags.includes('--webm');
const url = `${pathToFileURL(resolve(htmlPath)).href}?theme=${theme}`;

const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1200 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
});
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });

await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.Archify && window.Archify.waitForStableLayout, null, { timeout: 30000 });
await page.evaluate(async () => { await window.Archify.waitForStableLayout({ timeout: 15000 }); });
await page.waitForTimeout(1200);

const svgBox = await page.locator('svg').first().boundingBox();
console.log('svg box:', JSON.stringify(svgBox));

async function exportFormat(format, suffix) {
  await page.click('#btn-export');
  await page.waitForSelector('#export-menu.open', { timeout: 10000 });
  const btn = page.locator(`#export-menu button[data-format="${format}"]`);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 120000 }),
    btn.click(),
  ]);
  const target = `${outPrefix}${suffix}.${format === 'svg-light' ? 'svg' : format}`;
  await download.saveAs(target);
  const err = await page.getAttribute('html', 'data-last-export-error');
  if (err) console.error('export error:', err);
  console.log('exportado:', target);
}

await exportFormat('png', '');
await exportFormat('svg-light', '');

if (wantWebm) {
  const can = await page.evaluate(() => !!(window.Archify.motion && window.Archify.motion.canRecord && window.Archify.motion.canRecord()));
  console.log('canRecord:', can);
  if (can) {
    await page.click('#btn-export');
    await page.waitForSelector('#export-menu.open', { timeout: 10000 });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 180000 }),
      page.locator('#export-menu button[data-format="webm"]').click(),
    ]);
    const target = `${outPrefix}.webm`;
    await download.saveAs(target);
    console.log('exportado:', target);
  } else {
    console.error('motion no disponible para WebM');
  }
}

await browser.close();
