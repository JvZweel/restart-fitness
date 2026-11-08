// Quick screenshot helper: node scripts/shot.mjs <url-hash> <out.png> [w] [h] [dark] [script]
import { chromium } from 'playwright-core';
const [hash = '', out = '/tmp/s.png', w = '390', h = '844', dark = '0', js = ''] = process.argv.slice(2);
const BASE = process.env.BASE || 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, colorScheme: dark === '1' ? 'dark' : 'light' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto(BASE + hash);
await page.waitForTimeout(1200);
if (js) { await page.evaluate(js); await page.waitForTimeout(1500); }
await page.screenshot({ path: out, fullPage: process.env.FULL === '1' });
await browser.close();
