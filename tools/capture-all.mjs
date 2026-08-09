#!/usr/bin/env node
/* Filme tout le catalogue, en série.
 *
 *   node tools/capture-all.mjs                 tous les prototypes, 1 clip chacun
 *   node tools/capture-all.mjs --each 3        3 variantes par prototype
 *   node tools/capture-all.mjs --status mvp    seulement les MVP
 *
 * Plusieurs clips d'un même jeu ne sont pas des doublons : chaque graine donne
 * une partie différente, donc une vidéo différente. C'est le nerf du volume —
 * on poste des variantes, on regarde laquelle prend.
 */

import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { GAMES } = await import(join(ROOT, 'lab/games/registry.js'));

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i < 0 ? fallback : argv[i + 1];
};

const each = +arg('each', 1);
const scout = +arg('scout', 24);
const status = arg('status', null);
const passthrough = [];
for (const flag of ['seconds', 'scale', 'crf']) {
  const v = arg(flag, null);
  if (v != null) passthrough.push('--' + flag, v);
}

const games = GAMES.filter((g) => (status ? g.status === status : g.status !== 'parked'));
if (!games.length) {
  console.error('Aucun prototype à filmer.');
  process.exit(1);
}

console.log(`\n▸ ${games.length} prototype(s) × ${each} clip(s)\n`);

const run = (args) => new Promise((ok, ko) => {
  const p = spawn(process.execPath, [join(ROOT, 'tools/capture.mjs'), ...args], { stdio: 'inherit' });
  p.on('close', (code) => (code === 0 ? ok() : ko(new Error('capture.mjs a rendu ' + code))));
});

const failed = [];
for (const g of games) {
  for (let i = 0; i < each; i++) {
    /* Décaler la fenêtre de repérage — et non l'élargir — garantit que chaque
       variante explore des graines inédites, donc une partie réellement autre. */
    const args = [g.slug, '--scout', String(scout), '--offset', String(i * scout), ...passthrough];
    try {
      await run(args);
    } catch (e) {
      console.error(`  ✗ ${g.slug} (variante ${i + 1}) : ${e.message}`);
      failed.push(`${g.slug}#${i + 1}`);
    }
  }
}

console.log(failed.length
  ? `\n⚠ Terminé avec ${failed.length} échec(s) : ${failed.join(', ')}`
  : `\n✅ Tous les clips sont dans clips/.`);
