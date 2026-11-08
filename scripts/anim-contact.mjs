// Contact sheets: renders every animation at 0/25/50/75 % of its loop and composes one sheet per move.
// Usage: node scripts/anim-contact.mjs [baseUrl] [outDir] [id,id,...]   (DARK=1 for dark theme)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:5173';
const OUT = process.argv[3] || 'screenshots/anim';
const only = process.argv[4] ? process.argv[4].split(',') : null;
const dark = process.env.DARK === '1';
const FR = [0, 0.25, 0.5, 0.75];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 420, height: 400 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${BASE}/anim.html?anim=goblet-squat&sheet=1`);
await page.waitForFunction(() => window.__anim);
const ids = only ?? (await page.evaluate(() => window.__anim.ids));
const sheet = await browser.newPage({ viewport: { width: 4 * 300, height: 360 }, deviceScaleFactor: 1 });
for (const id of ids) {
  await page.goto(`${BASE}/anim.html?anim=${id}&sheet=1${dark ? '&dark=1' : ''}`);
  await page.waitForFunction(() => window.__anim);
  const imgs = [];
  for (const f of FR) {
    await page.evaluate((x) => window.__anim.v.renderAt(x), f);
    await page.waitForTimeout(60);
    imgs.push((await page.locator('canvas').screenshot()).toString('base64'));
  }
  const bg = dark ? '#14181b' : '#eef0f2';
  const fg = dark ? '#e6e9eb' : '#1d2327';
  await sheet.setContent(`<body style="margin:0;background:${bg};font:600 13px system-ui;color:${fg}">
    <div style="display:flex">${imgs.map((b, i) => `<div style="position:relative;width:300px;height:360px;border-right:1px solid ${dark ? '#2a3136' : '#d6dade'}">
      <img src="data:image/png;base64,${b}" style="width:300px;height:330px;object-fit:cover;display:block;margin-top:30px">
      <div style="position:absolute;top:8px;left:10px">${i === 0 ? id + ' · ' : ''}${FR[i] * 100}%</div></div>`).join('')}</div></body>`);
  await sheet.screenshot({ path: path.join(OUT, `${id}.png`) });
  process.stdout.write('.');
}
console.log(`\n${ids.length} sheets -> ${OUT}`);
console.log('errors', errs);
await browser.close();
