// End-to-end run against the production build (vite preview) with system Chrome.
// Usage: npm run build && npm run e2e   (SHOTS=0 to skip screenshots)
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright-core';
import { demoBackup } from './demo-data.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4173;
const BASE = process.env.E2E_URL || `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS !== '0';
const shotDir = join(root, 'screenshots');
const tmp = join(root, 'test-results');
mkdirSync(shotDir, { recursive: true });
mkdirSync(tmp, { recursive: true });
const CHROME = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));

let passed = 0;
let currentPage = null;
const results = [];
function ok(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
  passed++;
}
async function step(name, fn) {
  const t = Date.now();
  try { await fn(); results.push(`PASS  ${name} (${Date.now() - t} ms)`); console.log(`PASS  ${name}`); }
  catch (e) { if (currentPage) await currentPage.screenshot({ path: join(tmp, 'failure.png') }).catch(() => {}); results.push(`FAIL  ${name}: ${e.message}`); console.log(`FAIL  ${name}\n${e.stack}`); throw e; }
}

let server = null;
if (!process.env.E2E_URL) {
  if (!existsSync(join(root, 'dist/index.html'))) throw new Error('Run npm run build first');
  server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('preview did not start')), 20000);
    server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(to); res(); } });
    server.stderr.on('data', (d) => { if (/already in use/.test(String(d))) { clearTimeout(to); rej(new Error(`Port ${PORT} is busy: a previous preview is still running. Stop it with: pkill -f "vite.js preview"`)); } });
  });
}

const CHROME_ARGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ executablePath: CHROME, args: CHROME_ARGS });
const errors = [];

async function newPage(opts = {}, b = browser) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light', acceptDownloads: true, ...opts });
  await ctx.addInitScript(() => {
    window.__vibes = [];
    window.__locks = 0;
    navigator.vibrate = (p) => { window.__vibes.push(p); return true; };
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { window.__locks++; return { release: async () => {}, addEventListener() {} }; } } });
  });
  const page = await ctx.newPage();
  currentPage = page;
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(`console: ${m.text()}`); });
  return { ctx, page };
}
const tid = (page, id) => page.locator(`[data-testid="${id}"]`);
const text = async (page, id) => (await tid(page, id).first().innerText()).trim();
async function toast(page, re) {
  await page.waitForFunction((r) => { const t = document.querySelector('[data-testid=toast]'); return t && new RegExp(r).test(t.textContent || ''); }, re.source, { timeout: 5000 });
}

async function settle(page) { await page.waitForTimeout(250); }

try {
  // ---------------- main flow: fresh install ----------------
  const { ctx, page } = await newPage();
  await page.goto(BASE);
  await tid(page, 'tab-today').waitFor();

  await step('first run shows a next session and empty logs', async () => {
    await tid(page, 'start-session').waitFor();
    ok(/Full Body A/.test(await page.locator('main').innerText()), 'Full Body A planned');
    ok(await tid(page, 'welcome').count() === 1, 'first-run welcome shown');
  });

  await step('keyboard: skip link, sheet focus moves in, Escape closes and returns focus', async () => {
    await page.keyboard.press('Tab');
    ok(await page.evaluate(() => document.activeElement?.classList.contains('kbd-skip')), 'first Tab reaches the skip link');
    const opener = page.getByRole('button', { name: 'Choose a different session' });
    await opener.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').waitFor();
    await page.waitForFunction(() => !!document.activeElement?.closest('[role=dialog]'), null, { timeout: 3000 }).catch(() => {});
    ok(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), 'focus moved into the sheet');
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    ok(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), 'Tab stays inside the sheet');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.textContent?.includes('Choose a different session'), null, { timeout: 3000 }).catch(() => {});
    ok(await page.evaluate(() => document.activeElement?.textContent?.includes('Choose a different session')), 'focus returned to the opener');
  });

  await step('quick log rejects out-of-range values with a field error', async () => {
    await tid(page, 'ql-weight').fill('925');
    await tid(page, 'ql-save').click();
    await toast(page, /Check the highlighted/);
    ok((await tid(page, 'ql-weight').getAttribute('aria-invalid')) === 'true', 'weight marked invalid');
    if (SHOTS) { await page.waitForTimeout(400); await page.screenshot({ path: join(shotDir, 'phone-light-error-quicklog.png') }); }
  });

  await step('quick daily log saves weight, steps, sleep, waist', async () => {
    await tid(page, 'ql-weight').fill('99.5');
    await tid(page, 'ql-steps').fill('8200');
    await tid(page, 'ql-sleep').fill('6.5');
    await tid(page, 'ql-waist').fill('104');
    await tid(page, 'ql-save').click();
    await toast(page, /Saved/i);
  });

  await step('warm-up: timer runs, next move, skip', async () => {
    await tid(page, 'start-session').click();
    await tid(page, 'move-name').waitFor();
    const first = await text(page, 'move-name');
    const t0 = await text(page, 'guided-timer');
    await tid(page, 'guided-toggle').click();
    await page.waitForTimeout(2300);
    const t1 = await text(page, 'guided-timer');
    ok(t0 !== t1, `warm-up timer counts down (${t0} -> ${t1})`);
    ok(await page.evaluate(() => window.__locks) > 0, 'wake lock requested during session');
    await tid(page, 'guided-next').click();
    await settle(page);
    ok((await text(page, 'move-name')) !== first, 'next warm-up move');
    const st = await page.locator('[data-anim]').first().getAttribute('data-state');
    ok(st !== 'error', `3D stage is not in error state (${st})`);
    await tid(page, 'guided-skip').click();
    await tid(page, 'exercise-name').waitFor();
  });

  await step('lift: 3D mannequin renders, suggestion, steppers, RPE, log set, rest timer', async () => {
    ok((await text(page, 'exercise-name')) === 'Goblet Squat', 'first lift is Goblet Squat');
    await page.waitForFunction(() => document.querySelector('[data-anim]')?.getAttribute('data-state') === 'ok', null, { timeout: 15000 });
    const canvasOk = await page.evaluate(() => { const c = document.querySelector('[data-anim] canvas'); return !!c && c.width > 100; });
    ok(canvasOk, 'WebGL canvas present');
    ok(/kg/.test(await text(page, 'suggestion')), 'has a load suggestion');
    if (SHOTS) await page.screenshot({ path: join(tmp, 'flow-lift.png') });
    const w0 = Number((await tid(page, 'weight-stepper').locator('.num').innerText()).replace(/[^\d.]/g, ''));
    await tid(page, 'weight-stepper').getByRole('button', { name: /Increase/ }).click();
    const w1 = Number((await tid(page, 'weight-stepper').locator('.num').innerText()).replace(/[^\d.]/g, ''));
    ok(w1 > w0, `weight stepper snaps up (${w0} -> ${w1})`);
    await tid(page, 'reps-stepper').getByRole('button', { name: /Increase/ }).click();
    await tid(page, 'rpe-7').click();
    await tid(page, 'log-set').click();
    await tid(page, 'rest-time').waitFor();
    ok(/,? done/.test(await tid(page, 'set-0').getAttribute('aria-label')), 'set 0 marked done');
    ok(/RPE 7/.test(await tid(page, 'set-0').getAttribute('aria-label')), 'RPE stored');
    const set1 = await tid(page, 'set-1').getAttribute('aria-label');
    ok(set1.includes(`${w1} kilograms`), 'weight carried forward to next set');
    const r0 = await text(page, 'rest-time');
    ok(/^[12]:\d\d$/.test(r0), `rest started automatically (${r0})`);
    await tid(page, 'rest-plus').click();
    const toSec = (s) => { const [m, x] = s.split(':').map(Number); return m * 60 + x; };
    const r1 = await text(page, 'rest-time');
    ok(toSec(r1) - toSec(r0) >= 13, `+15 s (${r0} -> ${r1})`);
    await tid(page, 'rest-pause').click();
    const p0 = await text(page, 'rest-time');
    await page.waitForTimeout(1500);
    ok((await text(page, 'rest-time')) === p0, 'paused rest holds');
    await tid(page, 'rest-resume').click();
    await tid(page, 'rest-stop').click();
    await tid(page, 'rest-start').waitFor();
    // short rest that runs out: start then subtract down to a few seconds
    await tid(page, 'rest-start').click();
    for (let i = 0; i < 8; i++) { await tid(page, 'rest-minus').click(); }
    await page.waitForFunction(() => /Go!/.test(document.querySelector('[data-testid=rest-time]')?.textContent || ''), null, { timeout: 15000 });
    await page.waitForFunction(() => window.__vibes.length > 0, null, { timeout: 3000 });
    ok(true, 'vibrated when rest ended');
    // regression: a paused rest must not leave the dock stuck in "paused" when the next set starts a new rest
    await tid(page, 'rest-stop').click();
    await tid(page, 'rest-start').click();
    await tid(page, 'rest-pause').click();
    await tid(page, 'rest-resume').waitFor();
    await tid(page, 'log-set').click();
    await tid(page, 'rest-pause').waitFor({ timeout: 3000 });
    ok((await tid(page, 'rest-resume').count()) === 0, 'new rest after logging replaces the paused one');
  });

  await step('resume an interrupted session after reload', async () => {
    await page.reload();
    await tid(page, 'tab-today').waitFor({ timeout: 10000 }).catch(() => {});
    await page.evaluate(() => { location.hash = '#/today'; });
    await tid(page, 'resume').waitFor();
    await tid(page, 'resume').click();
    await tid(page, 'exercise-name').waitFor();
    ok(/done/.test(await tid(page, 'set-0').getAttribute('aria-label')), 'logged set survived reload');
  });

  await step('swap exercise for today only', async () => {
    await page.getByRole('button', { name: /^Flat Dumbbell Press/ }).click();
    await settle(page);
    ok((await text(page, 'exercise-name')) === 'Flat Dumbbell Press', 'on the press');
    await tid(page, 'swap-open').click();
    await tid(page, 'alt-push-up').click();
    await tid(page, 'swap-today').click();
    await settle(page);
    ok((await text(page, 'exercise-name')) === 'Push-Up', 'swapped to Push-Up');
    ok((await tid(page, 'weight-stepper').count()) === 0, 'bodyweight exercise has no weight stepper');
  });

  await step('log every set and finish lifts', async () => {
    await page.locator('.ex-dots button').first().click();
    await settle(page);
    for (let guard = 0; guard < 80; guard++) {
      if (await tid(page, 'log-set').count()) {
        const label = await tid(page, 'log-set').innerText();
        if (/Log set/.test(label)) { await tid(page, 'log-set').click(); await settle(page); continue; }
      }
      if (await tid(page, 'finish-lifts').count()) {
        const allDone = await page.locator('.ex-dots button.complete').count() === await page.locator('.ex-dots button').count();
        if (allDone) break;
      }
      if (await tid(page, 'next-exercise').count()) { await tid(page, 'next-exercise').click(); await settle(page); continue; }
      // on last exercise but earlier ones open: jump to first incomplete
      await page.locator('.ex-dots button:not(.complete)').first().click(); await settle(page);
    }
    if (await tid(page, 'rest-stop').count()) await tid(page, 'rest-stop').click();
    await tid(page, 'finish-lifts').click();
  });

  await step('finisher interval timer, then cool-down, summary, save', async () => {
    await tid(page, 'finisher-toggle').waitFor();
    const f0 = await text(page, 'finisher-time');
    await tid(page, 'finisher-toggle').click();
    await page.waitForTimeout(1600);
    ok((await text(page, 'finisher-time')) !== f0, 'finisher timer runs');
    await tid(page, 'finisher-toggle').click();
    await tid(page, 'finisher-skip').click();
    await tid(page, 'move-name').waitFor();
    ok(/Cool-down|cool-down|stretch/i.test(await page.locator('main').innerText()), 'cool-down phase');
    await tid(page, 'guided-skip').click();
    await tid(page, 'save-session').waitFor();
    await tid(page, 'save-session').click();
    await tid(page, 'tab-today').waitFor();
    ok(/1\/3 this week|1 of 3/.test(await page.locator('body').innerText()), 'week progress counts the session');
  });

  await step('progress shows the logged lift and body data', async () => {
    await tid(page, 'tab-progress').click();
    await tid(page, 'lift-pick').waitFor();
    ok(/Goblet Squat/.test(await page.locator('main').innerText()), 'lift history lists Goblet Squat');
  });

  await step('change schedule to 4 days and swap in the programme', async () => {
    await tid(page, 'tab-program').click();
    await tid(page, 'day-3').click();
    await settle(page);
    ok(/4/.test(await text(page, 'days-count')), 'shows 4 days');
    ok((await page.locator('[data-testid^="slot-3-"]').count()) > 0, 'fourth session exists');
    await tid(page, 'swap-0-knee:0').click();
    await tid(page, 'alt-step-up').click();
    await page.locator('[data-testid="swap-always"]').last().click();
    await settle(page);
    ok(/Step-Up/i.test(await tid(page, 'slot-0-knee:0').innerText()), 'programme swap applied');
    const before = Number((await tid(page, 'slot-0-knee:0').innerText()).match(/(\d+) ×/)[1]);
    await tid(page, 'edit-0-knee:0').click();
    await tid(page, 'edit-sets').getByRole('button', { name: /Increase/ }).click();
    await tid(page, 'edit-save').click();
    await settle(page);
    ok(new RegExp(`${before + 1} ×`).test(await tid(page, 'slot-0-knee:0').innerText()), `set count edited ${before} -> ${before + 1}`);
    await page.reload();
    await tid(page, 'day-3').waitFor();
    ok((await tid(page, 'day-3').getAttribute('aria-pressed')) === 'true', 'schedule persisted after reload');
    await tid(page, 'day-3').click();
    await settle(page);
  });

  await step('weights list: add and remove', async () => {
    await tid(page, 'tab-settings').click();
    await tid(page, 'weight-new').fill('18.5');
    await tid(page, 'weight-add').click();
    await tid(page, 'w-18.5').waitFor();
    await tid(page, 'w-del-18.5').click();
    await settle(page);
    ok((await tid(page, 'w-18.5').count()) === 0, 'removed 18.5');
  });

  await step('theme toggle persists after reload', async () => {
    await tid(page, 'theme-dark').click();
    ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'dark applied');
    await page.reload();
    await tid(page, 'theme-dark').waitFor();
    ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'dark after reload');
    ok((await tid(page, 'theme-dark').getAttribute('aria-pressed')) === 'true', 'dark selected after reload');
    await tid(page, 'theme-light').click();
    await page.reload();
    await tid(page, 'theme-light').waitFor();
    ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'light', 'light after reload');
    await tid(page, 'theme-system').click();
  });

  let exported;
  await step('export backup, reset, import restores', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), tid(page, 'export').click()]);
    exported = join(tmp, 'backup.json');
    await dl.saveAs(exported);
    const data = JSON.parse(readFileSync(exported, 'utf8'));
    ok(data.app === 'restart-fitness' && data.workouts.length === 1, 'backup has the session');
    ok(data.daily.some((d) => d.weight === 99.5), 'backup has the daily log');
    await tid(page, 'reset').click();
    await page.getByRole('button', { name: 'Delete everything' }).click();
    await toast(page, /reset/i);
    await tid(page, 'import-input').setInputFiles(exported);
    await page.getByRole('button', { name: 'Replace' }).click();
    await toast(page, /Restored 1 sessions?/);
  });

  await step('Garmin CSV import: preview and merge', async () => {
    await tid(page, 'garmin-input').setInputFiles(join(root, 'e2e/fixtures/garmin-steps.csv'));
    await tid(page, 'garmin-preview').waitFor({ timeout: 6000 });
    ok(/7,?812/.test(await tid(page, 'garmin-preview').innerText()), 'preview shows parsed steps');
    await tid(page, 'garmin-apply').click();
    await toast(page, /Imported 5 days/i);
    await tid(page, 'garmin-preview').waitFor({ state: 'detached' });
    await tid(page, 'garmin-input').setInputFiles(join(root, 'e2e/fixtures/garmin-sleep.csv'));
    await tid(page, 'garmin-preview').waitFor({ timeout: 6000 });
    ok(/6\.4/.test(await tid(page, 'garmin-preview').innerText()), 'preview shows parsed sleep');
    await tid(page, 'garmin-apply').click();
    await toast(page, /Imported 3 days/i);
    await tid(page, 'tab-progress').click();
    await page.getByRole('tab', { name: /^Body$/ }).or(page.getByRole('button', { name: /^Body$/ })).first().click();
    await settle(page);
    ok(/8,?800|10,?233|Steps/.test(await page.locator('main').innerText()), 'body tab shows imported steps');
    await tid(page, 'tab-settings').click();
  });

  await step('bad backup file and bad CSV show clear errors and change nothing', async () => {
    const junk = join(tmp, 'not-a-backup.json');
    writeFileSync(junk, 'Date,Steps\n2026-11-01,8000\n');
    await tid(page, 'import-input').setInputFiles(junk);
    await page.getByRole('button', { name: 'Replace' }).click();
    await toast(page, /not valid JSON/);
    if (SHOTS) { await page.waitForTimeout(400); await page.screenshot({ path: join(shotDir, 'phone-light-error-import.png') }); }
    const csv = join(tmp, 'random.csv');
    writeFileSync(csv, 'foo,bar\nhello,world\n');
    await tid(page, 'garmin-input').setInputFiles(csv);
    await toast(page, /No steps, sleep or weight/);
    ok((await tid(page, 'garmin-preview').count()) === 0, 'no preview for a useless CSV');
  });

  await step('offline reload via service worker', async () => {
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload(); // make sure the page is controlled
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
    await page.waitForFunction(() => /Ready/.test(document.querySelector('[data-testid=offline-status]')?.textContent || ''), null, { timeout: 15000 });
    await ctx.setOffline(true);
    await page.reload();
    await tid(page, 'tab-today').waitFor();
    await tid(page, 'tab-today').click();
    await tid(page, 'start-session').click();
    await tid(page, 'guided-skip').click();
    await page.waitForFunction(() => document.querySelector('[data-anim]')?.getAttribute('data-state') === 'ok', null, { timeout: 15000 });
    ok(true, 'app and 3D viewer load offline');
    await tid(page, 'leave').click();
    await tid(page, 'leave-keep').click();
    await ctx.setOffline(false);
  });
  await ctx.close();

  // ---------------- fresh install: empty states ----------------
  for (const scheme of ['light', 'dark']) {
    await step(`empty states (fresh install, ${scheme})`, async () => {
      const { ctx: c, page: p } = await newPage({ colorScheme: scheme });
      const snap = async (name) => { if (SHOTS) { await p.waitForTimeout(400); await p.screenshot({ path: join(shotDir, `phone-${scheme}-empty-${name}.png`) }); } };
      await p.goto(BASE);
      await tid(p, 'welcome').waitFor();
      await snap('today');
      await tid(p, 'tab-progress').click();
      await tid(p, 'empty-lifts').waitFor();
      await snap('progress');
      await p.getByRole('button', { name: /^Body$/ }).click();
      await tid(p, 'empty-body').waitFor();
      await snap('body');
      await p.getByRole('button', { name: /^Photos$/ }).click();
      await tid(p, 'empty-photos').waitFor();
      await snap('photos');
      ok(true, 'empty states render');
      await c.close();
    });
  }

  await step('reduced motion: demonstration starts paused and can be played', async () => {
    const { ctx: c, page: p } = await newPage({ reducedMotion: 'reduce' });
    await p.goto(BASE);
    await tid(p, 'start-session').click();
    await p.waitForFunction(() => document.querySelector('[data-anim]')?.getAttribute('data-state') === 'ok', null, { timeout: 15000 });
    ok((await tid(p, 'anim-toggle').getAttribute('aria-pressed')) === 'true', 'paused under reduced motion');
    await tid(p, 'anim-toggle').click();
    ok((await tid(p, 'anim-toggle').getAttribute('aria-pressed')) === 'false', 'play toggles');
    await c.close();
  });

  await step('storage blocked: clear error screen', async () => {
    const { ctx: c, page: p } = await newPage();
    await c.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open() { throw new Error('IndexedDB is disabled'); } } }); });
    await p.goto(BASE);
    await tid(p, 'storage-error').waitFor();
    ok(/Storage is unavailable/.test(await p.locator('main').innerText()), 'storage error explains the problem');
    if (SHOTS) { await p.waitForTimeout(500); await p.screenshot({ path: join(shotDir, 'phone-light-error-storage.png') }); }
    await c.close();
  });

  await step('3D unavailable: session still usable with cues', async () => {
    const noGl = await chromium.launch({ executablePath: CHROME, args: [...CHROME_ARGS.filter((a) => !/swiftshader|gpu-blocklist/.test(a)), '--disable-webgl', '--disable-3d-apis'] });
    try {
      const { page: p } = await newPage({ colorScheme: 'dark' }, noGl);
      await p.goto(BASE);
      await tid(p, 'start-session').click();
      await tid(p, 'guided-skip').click();
      await p.waitForFunction(() => document.querySelector('[data-anim]')?.getAttribute('data-state') === 'error', null, { timeout: 15000 });
      ok(/3D preview unavailable/.test(await p.locator('main').innerText()), 'fallback message shown');
      ok(await tid(p, 'log-set').count() === 1, 'set logging still available');
      if (SHOTS) { await p.waitForTimeout(300); await p.screenshot({ path: join(shotDir, 'phone-dark-error-3d.png') }); }
    } finally { await noGl.close(); }
  });

  // ---------------- screenshots with demo history ----------------
  if (SHOTS) {
    const demoPath = join(tmp, 'demo.json');
    writeFileSync(demoPath, JSON.stringify(demoBackup()));
    for (const [vw, vh, tag] of [[390, 844, 'phone'], [1280, 800, 'desktop']]) {
      for (const scheme of ['light', 'dark']) {
        await step(`screenshots ${tag} ${scheme}`, async () => {
          const { ctx: c, page: p } = await newPage({ viewport: { width: vw, height: vh }, colorScheme: scheme, deviceScaleFactor: tag === 'phone' ? 2 : 1 });
          await p.goto(BASE + '#/settings');
          await tid(p, 'import-input').setInputFiles(demoPath);
          await p.getByRole('button', { name: 'Replace' }).click();
          await toast(p, /Restored/);
          await p.waitForTimeout(3600);
          const snap = async (name) => { await p.waitForTimeout(450); await p.screenshot({ path: join(shotDir, `${tag}-${scheme}-${name}.png`) }); };
          await tid(p, 'tab-settings').click(); await p.evaluate(() => window.scrollTo(0, 0)); await snap('settings');
          await tid(p, 'tab-today').click(); await p.evaluate(() => window.scrollTo(0, 0)); await snap('today');
          await tid(p, 'tab-program').click(); await p.evaluate(() => window.scrollTo(0, 0)); await snap('programme');
          await tid(p, 'tab-progress').click(); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300); await snap('progress');
          await p.getByRole('button', { name: /^Body$/ }).click().catch(() => {}); await snap('progress-body');
          await tid(p, 'tab-today').click();
          await tid(p, 'start-session').click();
          await tid(p, 'move-name').waitFor();
          await p.waitForFunction(() => document.querySelector('[data-anim]')?.getAttribute('data-state') === 'ok', null, { timeout: 15000 });
          await p.waitForTimeout(900); await snap('warmup');
          await tid(p, 'guided-skip').click();
          await p.waitForFunction(() => document.querySelector('[data-anim]')?.getAttribute('data-state') === 'ok', null, { timeout: 15000 });
          await p.waitForTimeout(1200); await snap('lift');
          await tid(p, 'log-set').click(); await p.waitForTimeout(1200); await snap('rest');
          await tid(p, 'swap-open').click(); await snap('swap');
          await c.close();
        });
      }
    }
  }
} finally {
  await browser.close();
  if (server) server.kill();
  const real = errors.filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource|WebGL|THREE\.WebGLRenderer/i.test(e));
  console.log(`\n${results.length} steps, ${passed} assertions`);
  if (real.length) { console.log('Browser errors:\n' + real.join('\n')); process.exitCode = 1; }
  writeFileSync(join(tmp, 'e2e-report.txt'), results.join('\n') + `\n${passed} assertions\n` + (real.length ? 'Errors:\n' + real.join('\n') : 'No browser errors') + '\n');
}
