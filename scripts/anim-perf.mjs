/* global performance, requestAnimationFrame */
// Measures the 3D demo cost in headless Chrome (SwiftShader software GL: NOT representative of phone GPUs).
// Usage: node scripts/anim-perf.mjs [baseUrl] > screenshots/anim/perf.json
import { chromium } from 'playwright-core';
const BASE = process.argv[2] || 'http://localhost:5173';
const IDS = ['goblet-squat', 'flat-db-press', 'push-up', 'one-arm-row', 'childs-pose', 'thruster'];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 600 }, deviceScaleFactor: 2 });
const out = { env: 'headless Chrome, SwiftShader (CPU) WebGL, viewport 390 px wide, deviceScaleFactor 2', results: [] };
for (const id of IDS) {
  await page.goto(`${BASE}/anim.html?anim=${id}`);
  await page.waitForFunction(() => window.__anim);
  await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    const { v } = window.__anim;
    // Free-running rAF intervals while playing.
    const iv = [];
    await new Promise((res) => { let last = performance.now(); let n = 0; const f = (t) => { iv.push(t - last); last = t; if (++n < 120) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    v.setPlaying(false);
    // CPU cost of one pose + render submission.
    const cpu = [];
    for (let i = 0; i < 60; i++) { const t0 = performance.now(); v.renderAt(i / 60); cpu.push(performance.now() - t0); }
    const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];
    const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    return { rafAvgMs: +avg(iv.slice(10)).toFixed(2), rafP95Ms: +q(iv.slice(10), 0.95).toFixed(2), renderAtAvgMs: +avg(cpu).toFixed(2), renderAtP95Ms: +q(cpu, 0.95).toFixed(2), ...v.stats() };
  });
  out.results.push({ id, ...r });
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
