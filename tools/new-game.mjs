#!/usr/bin/env node
/* Crée un prototype à partir du gabarit et l'inscrit au registre.
 *
 *   node tools/new-game.mjs gravity-well "Gravity Well" "Tape pour changer d'orbite"
 *
 * Après ça :
 *   npm run serve   puis   http://localhost:8080/lab/play.html?g=gravity-well
 *   node tools/capture.mjs gravity-well
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [slug, title, hook, tagline] = process.argv.slice(2);

if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
  console.error('usage : node tools/new-game.mjs <slug-en-minuscules> ["Titre"] ["Hook"] ["Légende"]');
  process.exit(1);
}

const meta = {
  slug,
  title: title || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  hook: hook || 'Une règle, un doigt',
  tagline: tagline || 'À décrire en une phrase.',
};

/* Les valeurs atterrissent dans des chaînes JS à apostrophes simples, aussi bien
   dans le gabarit que dans le registre : une apostrophe non échappée dans un
   hook (« changer d'orbite ») produirait un fichier invalide. */
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const dir = join(ROOT, 'lab/games', slug);
try {
  await access(dir);
  console.error(`✗ lab/games/${slug} existe déjà.`);
  process.exit(1);
} catch { /* le dossier est libre, on continue */ }

/* 1. Le fichier du jeu. */
const template = await readFile(join(ROOT, 'lab/games/_template/game.js'), 'utf8');
/* Dans l'en-tête de commentaire les valeurs sont brutes, dans le code elles sont
   échappées : d'où les deux jeux de marqueurs. */
const source = template
  .replaceAll("'__SLUG__'", `'${esc(meta.slug)}'`)
  .replaceAll("'__TITLE__'", `'${esc(meta.title)}'`)
  .replaceAll("'__HOOK__'", `'${esc(meta.hook)}'`)
  .replaceAll("'__TAGLINE__'", `'${esc(meta.tagline)}'`)
  .replaceAll('__SLUG__', meta.slug)
  .replaceAll('__TITLE__', meta.title)
  .replaceAll('__HOOK__', meta.hook)
  .replaceAll('__TAGLINE__', meta.tagline);

await mkdir(dir, { recursive: true });
await writeFile(join(dir, 'game.js'), source);

/* 2. L'inscription au registre, à l'ancre prévue pour ça. */
const ANCHOR = '  /* NEW_GAME_ANCHOR';
const regPath = join(ROOT, 'lab/games/registry.js');
const registry = await readFile(regPath, 'utf8');
if (!registry.includes(ANCHOR)) {
  console.error('✗ ancre NEW_GAME_ANCHOR absente de registry.js — inscription manuelle nécessaire.');
  process.exit(1);
}

/* Teinte stable dérivée du slug : deux prototypes voisins ne se ressemblent pas. */
let h = 0;
for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 360;
const accent = `hsl(${h} 90% 62%)`;

const entry = `  {
    slug: '${meta.slug}',
    title: '${esc(meta.title)}',
    hook: '${esc(meta.hook)}',
    tagline: '${esc(meta.tagline)}',
    tags: ['one-button'],
    accent: '${accent}',
    status: 'mvp',
  },
`;

await writeFile(regPath, registry.replace(ANCHOR, entry + ANCHOR));

console.log(`
✅ ${meta.title}

   jouer    lab/play.html?g=${slug}
   coder    lab/games/${slug}/game.js
   filmer   node tools/capture.mjs ${slug}

   Prochaine étape : écris update() et bot(). Le bot est ce qui joue dans la
   vidéo — sans lui, pas de clip.
`);
