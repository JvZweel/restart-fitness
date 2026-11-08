// Renders every animation at each keyframe into /tmp/anim/<id>-<k>.png, then a contact sheet per batch.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const BASE = process.argv[2] || 'http://localhost:5173';
const only = process.argv[3] ? process.argv[3].split(',') : null;
const dark = process.env.DARK === '1' ? '&dark=1' : '';
fs.mkdirSync('/tmp/anim', { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 360, height: 320 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${BASE}/anim.html?anim=goblet-squat&k=0`);
await page.waitForFunction(() => window.__anim);
const ids = only ?? (await page.evaluate(() => window.__anim.ids));
const files = [];
for (const id of ids) {
  for (let k = 0; k < 2; k++) {
    await page.goto(`${BASE}/anim.html?anim=${id}&k=${k}${dark}`);
    await page.waitForFunction(() => window.__anim);
    await page.waitForTimeout(150);
    const f = `/tmp/anim/${id}-${k}.png`;
    await page.locator('canvas').screenshot({ path: f });
    files.push(f);
  }
}
console.log('errors', errs);
console.log(files.length, 'shots');
await browser.close();
