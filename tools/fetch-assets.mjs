#!/usr/bin/env node
/* Récupère les assets CC0 déclarés dans le manifeste ci-dessous.
 *
 *   node tools/fetch-assets.mjs            extrait les fichiers déclarés
 *   node tools/fetch-assets.mjs --list sports    liste le contenu de l'archive
 *
 * On ne garde que les fichiers listés : un pack complet pèse des méga-octets
 * dont on n'utilise qu'une poignée, et tout ce qui atterrit dans lab/art/ est
 * committé puis servi par GitHub Pages.
 *
 * Chaque pack doit porter sa licence et sa source — c'est ce qui rend l'usage
 * commercial défendable, et ça se perd très vite si on ne l'écrit pas tout de
 * suite.
 */

import { mkdir, writeFile, rm, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'lab/art');
const TMP = join(ROOT, '.asset-cache');

const PACKS = {
  animals: {
    title: 'Kenney Animal Pack',
    source: 'https://kenney.nl/assets/animal-pack',
    license: 'CC0 1.0 Universal (domaine public) — Kenney.nl',
    url: 'https://kenney.nl/media/pages/assets/animal-pack/480cf9f223-1677669996/kenney_animal-pack.zip',
    /* Les têtes rondes du pack, dans l'ordre de taille de l'animal réel : la
       progression se comprend sans qu'on l'explique, ce qui est tout l'intérêt.
       Variante « outline » : le contour détache les animaux du décor, sans quoi
       une pile de neuf couleurs devient illisible.
       Le serpent est écarté — il ne se range nulle part dans une échelle de
       taille, et le palier doit se deviner. */
    from: 'PNG/Round (outline)/',
    files: [
      'parrot.png',
      'rabbit.png',
      'penguin.png',
      'monkey.png',
      'pig.png',
      'panda.png',
      'hippo.png',
      'giraffe.png',
      'elephant.png',
    ],
  },
};

const args = process.argv.slice(2);
const listIdx = args.indexOf('--list');

await mkdir(TMP, { recursive: true });

/** Télécharge l'archive si elle n'est pas déjà en cache. */
async function fetchZip(name, pack) {
  const zip = join(TMP, `${name}.zip`);
  try {
    const s = await stat(zip);
    if (s.size > 1000) return zip;
  } catch { /* pas en cache */ }

  process.stdout.write(`  téléchargement de ${pack.title}… `);
  const res = await fetch(pack.url);
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${pack.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 2).toString() !== 'PK') throw new Error('la réponse n’est pas une archive ZIP');
  await writeFile(zip, buf);
  console.log(`${(buf.length / 1048576).toFixed(1)} Mo`);
  return zip;
}

if (listIdx >= 0) {
  const name = args[listIdx + 1];
  const pack = PACKS[name];
  if (!pack) { console.error(`pack inconnu : ${name}. Connus : ${Object.keys(PACKS).join(', ')}`); process.exit(1); }
  const zip = await fetchZip(name, pack);
  const out = execFileSync('unzip', ['-Z1', zip]).toString();
  console.log(out.split('\n').filter((l) => l.endsWith('.png')).join('\n'));
  process.exit(0);
}

console.log('');
for (const [name, pack] of Object.entries(PACKS)) {
  const zip = await fetchZip(name, pack);
  const dest = join(ART, name);
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });

  /* Le chemin `from` est obligatoire dès qu'un pack décline le même nom dans
     plusieurs dossiers — le pack animaux propose huit variantes de `pig.png`.
     Un motif `*pig.png` en prendrait une au hasard.
     -j aplatit ensuite l'arborescence : on veut lab/art/animals/pig.png. */
  const patterns = pack.files.map((f) => (pack.from ? pack.from + f : `*${f}`));
  execFileSync('unzip', ['-j', '-o', '-q', zip, ...patterns, '-d', dest]);

  const got = (await readdir(dest)).filter((f) => f.endsWith('.png'));
  const missing = pack.files.filter((f) => !got.includes(f));
  if (missing.length) {
    console.error(`  ✗ ${name} : fichiers introuvables dans l’archive — ${missing.join(', ')}`);
    console.error('    (lister le contenu réel : node tools/fetch-assets.mjs --list ' + name + ')');
    process.exit(1);
  }

  await writeFile(join(dest, 'LICENCE.txt'),
    `${pack.title}\n${pack.license}\nSource : ${pack.source}\n\n` +
    `Fichiers conservés dans ce dossier :\n${got.sort().map((f) => '  ' + f).join('\n')}\n`);

  let bytes = 0;
  for (const f of got) bytes += (await stat(join(dest, f))).size;
  console.log(`  ✅ ${name} — ${got.length} fichiers, ${(bytes / 1024).toFixed(0)} Ko → lab/art/${name}/`);
}

console.log(`\nArchives en cache dans .asset-cache/ (ignoré par git).\n`);
