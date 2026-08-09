#!/usr/bin/env node
/* Fabrique un clip vertical prêt à poster à partir d'un prototype.
 *
 *   node tools/capture.mjs neon-drift
 *   node tools/capture.mjs neon-drift --scout 40 --seconds 22 --scale 1
 *
 * Le pipeline en trois temps :
 *
 *  1. REPÉRAGE — on rejoue N graines en mode sans rendu (?headless=1). Aucun
 *     pixel n'est dessiné, donc des milliers de frames passent en quelques
 *     secondes. On garde la graine qui donne le meilleur run : une vidéo ne
 *     vaut que si la partie montrée est bonne.
 *
 *  2. CAPTURE — on rejoue cette graine avec le rendu complet et le réalisateur
 *     (?rec=1). L'horloge du navigateur est verrouillée (voir CLOCK_LOCK) : le
 *     jeu croit tourner à 60 im/s constantes quelle que soit la lenteur réelle
 *     du rendu logiciel. Chaque frame est saisie en JPEG dans la même tâche que
 *     son rendu — obligatoire, WebGL ne conserve pas son tampon.
 *
 *  3. ENCODAGE — les JPEG sont poussés directement dans ffmpeg (aucun fichier
 *     intermédiaire) et ressortent en MP4 H.264 1080×1920, format attendu par
 *     TikTok, Reels et Shorts.
 */

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn, execSync } from 'node:child_process';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------------- Arguments ---------------- */

const argv = process.argv.slice(2);
const opts = {
  game: null,
  seed: null,          // graine imposée (court-circuite le repérage)
  scout: 32,           // nombre de graines évaluées
  offset: 0,           // décalage dans la suite de graines (variantes d'un même jeu)
  seconds: 20,         // durée max du gameplay
  minSeconds: 6,       // en dessous, le run est trop court pour un clip
  scale: 0.6,          // résolution de rendu (× 1080×1920), ré-agrandie ensuite
  fps: 60,
  crf: 20,
  out: 'clips',
  keepIntro: true,
};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { if (!opts.game) opts.game = a; continue; }
  const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) opts[key] = true;
  else { opts[key] = isNaN(+next) ? next : +next; i++; }
}
if (!opts.game) {
  console.error('usage : node tools/capture.mjs <slug> [--scout N] [--seconds N] [--scale F] [--seed N]');
  process.exit(1);
}

const RENDER_W = Math.round(1080 * opts.scale / 2) * 2;   // dimensions paires : H.264 l'exige
const RENDER_H = Math.round(1920 * opts.scale / 2) * 2;
const MAX_FRAMES = Math.ceil((opts.seconds + 5) * opts.fps);

/* ---------------- Horloge verrouillée ----------------
   Injecté avant tout script de la page. On remplace requestAnimationFrame et
   l'horloge par un pas fixe piloté depuis Node : le rendu peut prendre une
   seconde par image, le jeu ne s'en aperçoit pas. setTimeout reste réel pour
   que les chargements asynchrones se terminent normalement. */

const CLOCK_LOCK = `(() => {
  const STEP = 1000 / 60;
  let now = 0, nextId = 1, pending = [];
  performance.now = () => now;
  Date.now = () => 1735689600000 + now;
  window.requestAnimationFrame = (cb) => { const id = nextId++; pending.push({ id, cb }); return id; };
  window.cancelAnimationFrame = (id) => { pending = pending.filter(p => p.id !== id); };
  window.__CLOCK = {
    errors: [],
    step(n = 1) {
      for (let k = 0; k < n; k++) {
        now += STEP;
        const due = pending; pending = [];
        for (const p of due) { try { p.cb(now); } catch (e) { this.errors.push(String(e && e.stack || e)); } }
      }
    },
  };
})();`;

/* ---------------- Serveur statique ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
};

function serve() {
  return new Promise((ok) => {
    const server = createServer(async (req, res) => {
      try {
        const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const file = join(ROOT, p.endsWith('/') ? p + 'index.html' : p);
        if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch { res.writeHead(404).end('not found'); }
    });
    server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port }));
  });
}

function loadPlaywright() {
  for (const id of ['playwright', 'playwright-core']) {
    try { return require(id); } catch { /* suivant */ }
  }
  try { return require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
  catch { throw new Error("playwright introuvable — `npm i -D playwright`"); }
}

/* ---------------- Étape 1 : repérage de graines ---------------- */

async function scout(page, base) {
  const results = [];
  const budget = Math.ceil((opts.seconds + 2) * opts.fps);

  for (let i = 0; i < opts.scout; i++) {
    const seed = 1000 + ((i + opts.offset) * 2654435761) % 100000;
    await page.goto(`${base}&headless=1&seed=${seed}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.LAB && window.LAB.stats', null, { timeout: 15000, polling: 50 });

    /* Par paquets de 60 frames : moins d'allers-retours CDP, donc bien plus vite. */
    let stats = null;
    for (let f = 0; f < budget; f += 60) {
      stats = await page.evaluate(() => {
        window.__CLOCK.step(60);
        return window.LAB.stats;
      });
      if (stats.deaths > 0) break;
    }
    results.push({ seed, score: stats.score || stats.best, t: stats.t, died: stats.deaths > 0 });
    process.stdout.write(`\r  repérage ${i + 1}/${opts.scout} — meilleur ${Math.max(...results.map(r => r.score))}   `);
  }
  process.stdout.write('\n');

  /* On veut un run long ET fort : un score énorme obtenu en 3 s ne raconte rien. */
  const usable = results.filter((r) => r.t >= opts.minSeconds);
  const pool = usable.length ? usable : results;
  pool.sort((a, b) => b.score - a.score || b.t - a.t);
  return pool[0];
}

/* ---------------- Étape 2+3 : capture et encodage ---------------- */

async function capture(page, base, seed, outFile) {
  const url = `${base}&rec=1&seed=${seed}&scale=${opts.scale}&maxTime=${opts.seconds}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.LAB && window.LAB.canvas', null, { timeout: 20000, polling: 50 });

  const ffmpegPath = require('ffmpeg-static');
  const ff = spawn(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', String(opts.fps), '-i', 'pipe:0',
    '-vf', `scale=1080:1920:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opts.crf),
    '-profile:v', 'high', '-level', '4.1',
    '-movflags', '+faststart',
    outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const write = (buf) => new Promise((ok, ko) => {
    if (ff.stdin.write(buf)) return ok();
    ff.stdin.once('drain', ok);
    ff.stdin.once('error', ko);
  });

  const t0 = Date.now();
  let frames = 0;
  for (; frames < MAX_FRAMES; frames++) {
    const data = await page.evaluate(() => {
      window.__CLOCK.step(1);
      /* La saisie doit rester dans la même tâche que le rendu. */
      return { img: window.LAB.grab(0.95), done: window.LAB.done, err: window.__CLOCK.errors[0] };
    });
    if (data.err) throw new Error('erreur dans la page : ' + data.err);
    await write(Buffer.from(data.img.slice(data.img.indexOf(',') + 1), 'base64'));
    if (data.done) { frames++; break; }
    if (frames % 30 === 0) {
      const fps = frames / ((Date.now() - t0) / 1000 || 1);
      process.stdout.write(`\r  capture ${frames}/${MAX_FRAMES} — ${fps.toFixed(1)} im/s   `);
    }
  }
  process.stdout.write('\n');

  ff.stdin.end();
  await new Promise((ok, ko) => ff.on('close', (c) => (c === 0 ? ok() : ko(new Error('ffmpeg a échoué (code ' + c + ')')))));
  return { frames, seconds: frames / opts.fps };
}

/* ---------------- Orchestration ---------------- */

const { chromium } = loadPlaywright();
const { server, port } = await serve();
const base = `http://127.0.0.1:${port}/lab/play.html?g=${opts.game}&bot=1`;

const browser = await chromium.launch({
  args: [
    '--enable-unsafe-swiftshader',   // WebGL2 sans GPU
    '--use-gl=angle', '--use-angle=swiftshader',
    '--disable-frame-rate-limit',
    '--hide-scrollbars', '--mute-audio',
  ],
});
const page = await browser.newPage({
  viewport: { width: RENDER_W, height: RENDER_H },
  deviceScaleFactor: 1,
});
await page.addInitScript(CLOCK_LOCK);
page.on('pageerror', (e) => console.error('  ⚠ page:', e.message));

try {
  console.log(`\n▸ ${opts.game} — rendu ${RENDER_W}×${RENDER_H} → sortie 1080×1920 @ ${opts.fps} im/s`);

  let seed = opts.seed;
  if (seed == null) {
    console.log('▸ repérage des graines (sans rendu)…');
    const best = await scout(page, base);
    seed = best.seed;
    console.log(`▸ graine retenue : ${seed} (score ${best.score}, ${best.t.toFixed(1)} s)`);
  }

  await mkdir(join(ROOT, opts.out), { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outFile = join(ROOT, opts.out, `${opts.game}-${seed}-${stamp}.mp4`);

  console.log('▸ capture…');
  const res = await capture(page, base, seed, outFile);

  const meta = await page.evaluate(() => ({ ...window.LAB.meta, score: window.LAB.stats.best }));
  await writeFile(outFile.replace(/\.mp4$/, '.json'),
    JSON.stringify({ ...meta, seed, ...res, capturedAt: new Date().toISOString() }, null, 2));

  console.log(`\n✅ ${outFile}`);
  console.log(`   ${res.frames} images · ${res.seconds.toFixed(1)} s · score ${meta.score}`);
  console.log(`   légende : « ${meta.hook} » — ${meta.tagline || ''}`);
} finally {
  await browser.close();
  server.close();
}
