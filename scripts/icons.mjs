// Renders public/icon.svg into the PNG sizes the manifest needs (uses the system Chrome).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const svg = fs.readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
const render = async (size, file, pad = 0, bg = 'transparent') => {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - pad * 2;
  await page.setContent(`<html><body style="margin:0;background:${bg}"><div style="width:${size}px;height:${size}px;display:grid;place-items:center">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  await page.screenshot({ path: `public/${file}`, omitBackground: bg === 'transparent' });
};
await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(180, 'apple-touch-icon.png', 0, '#0f766e');
// maskable: full-bleed background with the mark inside the 80% safe zone
await render(512, 'icon-maskable-512.png', 56, '#0f766e');
await browser.close();
console.log('icons written');
