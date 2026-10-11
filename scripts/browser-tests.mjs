// Tests navigateur (Chromium via Playwright) : compilation de tous les shaders, rendu, non-régression visuelle,
// export MP4/GIF, démarrage de l'application. Usage : node scripts/browser-tests.mjs [--update]
// Prérequis : npm i -D playwright-core ; CHROMIUM_PATH ou Chromium installé par Playwright.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const port = 8899;
const server = spawn(process.execPath, [join(root, 'scripts/dev-server.mjs')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? '✓' : '✗'} ${name}${info ? ` — ${info}` : ''}`); if (!ok) failed++; };
async function page(path, wait = '__result') {
  const p = await browser.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`http://localhost:${port}/${path}`);
  await p.waitForFunction(`window.${wait}`, null, { timeout: 240000 });
  const res = await p.evaluate(`window.${wait}`);
  await p.close();
  return { res, errors };
}
try {
  const s = await page('tests/shaders.html');
  check('compilation des shaders (effets, transitions, générateurs, presets)', s.res.failures.length === 0, `${s.res.programs} programmes${s.res.failures.length ? ` · échecs : ${JSON.stringify(s.res.failures).slice(0, 400)}` : ''}`);
  const v = await page('tests/visual.html');
  check('déterminisme du rendu (même entrée = même image)', v.res.nonDeterministic.length === 0, v.res.nonDeterministic.join(', '));
  const refFile = join(root, 'tests/visual-hashes.json');
  if (process.argv.includes('--update') || !existsSync(refFile)) { writeFileSync(refFile, JSON.stringify(v.res.hashes, null, 2)); console.log('  empreintes de référence enregistrées'); }
  else {
    const ref = JSON.parse(readFileSync(refFile, 'utf8'));
    const diff = Object.keys(ref).filter((k) => ref[k] !== v.res.hashes[k]);
    check('non-régression visuelle (empreintes par image)', diff.length === 0, diff.length ? `différences : ${diff.join(', ')} (GPU différent ? --update)` : `${Object.keys(ref).length} images`);
  }
  for (const fmt of ['mp4', 'gif']) {
    const e = await page(`tests/export.html?format=${fmt}`);
    const ok = e.res.status === 'done' && (fmt !== 'mp4' || e.res.result.validation?.valid) && e.res.decoded && !e.res.decoded.err;
    check(`export ${fmt.toUpperCase()}`, ok, `${e.res.method || e.res.error} · ${JSON.stringify(e.res.decoded)}`);
  }
  const app = await page('index.html', '__motionReady');
  check('démarrage de l\'application sans erreur', app.errors.length === 0, app.errors.join(' | '));
} finally {
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
