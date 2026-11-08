// Base-path e2e: serve the GitHub Pages build (BASE_PATH=/restart-fitness/) under /restart-fitness/
// and run the full e2e suite against it. Usage: npm run build:pages && npm run e2e:pages
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4180;
const BASE = '/restart-fitness/';
const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
if (!html.includes(`${BASE}assets/`)) throw new Error(`dist/ is not a ${BASE} build. Run npm run build:pages first.`);

const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', env: { ...process.env, BASE_PATH: BASE } });
await new Promise((res, rej) => {
  const to = setTimeout(() => rej(new Error('preview did not start')), 20000);
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(to); res(); } });
  server.stderr.on('data', (d) => { if (/already in use/.test(String(d))) { clearTimeout(to); rej(new Error(`Port ${PORT} is busy`)); } });
});
const url = `http://localhost:${PORT}${BASE}`;
console.log(`Serving dist under ${url}`);
const e2e = spawn(process.execPath, [join(root, 'e2e/run.mjs')], { cwd: root, stdio: 'inherit', env: { ...process.env, E2E_URL: url, SHOTS: '0' } });
const code = await new Promise((res) => e2e.on('exit', res));
server.kill();
process.exit(code ?? 1);
