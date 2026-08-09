/* __TITLE__ — __HOOK__

   AVANT D'ÉCRIRE UNE LIGNE DE MÉCANIQUE, RÉPONDS À CES QUATRE QUESTIONS.
   Les neuf premiers prototypes du lab les ont sautées, et le résultat tenait en
   une phrase : des formes colorées que personne n'a envie de télécharger.

   1. LE SUJET      — qui je suis, où, et ce que je veux.
                      « Un carré qui évite des barres » n'est pas un sujet.
   2. LA SILHOUETTE — l'objet que le joueur regarde 90 % du temps. Il doit être
                      reconnaissable en miniature et avoir un visage ou une
                      identité. Déclare-le dans `meta.sprites`.
   3. LE DÉCOR      — ce qui situe la scène. Écris `background(r)` ; sans lui, le
                      shell retombe sur une grille passe-partout et ton
                      prototype ressemblera à tous les autres.
   4. LA RÉCOMPENSE — ce qu'on voit quand ça se passe bien. Un nombre qui monte
                      n'est pas une récompense : il faut quelque chose à l'image.

   LE TEST, avant de filmer : quelqu'un qui voit trois secondes SANS LE SON
   comprend-il ce qu'il regarde, et pourquoi il voudrait y jouer ?

   Tout le reste — format vertical, HUD, physique du juice, post-traitement,
   capture, piste sonore — vient du shell. */

import { L, vec2, rgb, hsl, textWorld, fade, shade } from '../../engine/shell.js';

export default {
  meta: {
    slug: '__SLUG__',
    title: '__TITLE__',
    hook: '__HOOK__',                    // la phrase de l'accroche du clip
    tagline: '__TAGLINE__',              // la légende du post
    tags: ['one-button'],

    /* Sprites, relatifs à lab/art/. Récupère des packs CC0 avec
       `node tools/fetch-assets.mjs` — le manifeste est dans ce fichier. */
    sprites: {
      // héros: 'animals/pig.png',
    },

    /* Dosage du post-traitement. Reste sobre dès qu'il y a des sprites : un
       bloom fort les délave. Le néon appuyé ne va qu'aux jeux vectoriels. */
    fx: { bloom: 0.15, aberration: 0.35, scanlines: 0, vignette: 0.3, saturation: 1.05 },

    /* Secondes simulées avant la première image du clip. À utiliser dès que le
       début de partie est calme : l'accroche ne doit jamais s'afficher sur un
       décor vide. */
    warmup: 0,

    palette: {
      bg: rgb(0.08, 0.09, 0.14),
      ink: rgb(1, 1, 1),
      a: hsl(0.55, 0.9, 0.62),
      b: hsl(0.98, 0.9, 0.62),
      c: hsl(0.13, 1, 0.6),
    },
  },

  /** (Re)démarrage. Tout l'état vit dans `r.data`. */
  reset(r) {
    const d = r.data;
    d.x = 0;
    d.vx = 0;
  },

  /** Logique. Pas de temps fixe : `r.dt`. Jamais Math.random — `r.rng` seulement.
      Attention : `r.rng.int(n)` tire dans [0, n[. */
  update(r) {
    const d = r.data;

    /* Entrée unique : r.down (maintenu), r.pressed (cette frame), r.released. */
    d.vx += (r.down ? 1 : -1) * 40 * r.dt;
    d.vx *= Math.pow(0.5, r.dt * 3);
    d.x = L.clamp(d.x + d.vx * r.dt, r.left + 0.6, r.right - 0.6);

    /* Marquer un point :   r.addScore(1, vec2(d.x, 0));
       Faire claquer :      r.impact(1); r.burst(vec2(d.x, 0), r.palette.c, 24);
       Un son :             r.sfx.score.play();  ou  r.makeSfx([...ZzFX])
       Terminer :           r.gameOver(); */
  },

  /** Décor. Sans lui, ton prototype ressemble à tous les autres. */
  background(r) {
    const top = rgb(0.10, 0.12, 0.20);
    const bot = rgb(0.18, 0.16, 0.24);
    for (let i = 0; i < 20; i++) {
      const f = i / 19;
      L.drawRect(vec2(0, r.bottom + f * (r.H + 2)), vec2(r.W, r.H / 20 + 0.6),
        rgb(L.lerp(bot.r, top.r, f), L.lerp(bot.g, top.g, f), L.lerp(bot.b, top.b, f)));
    }
  },

  /** Rendu en unités monde, y vers le haut, origine au centre.
      Avec un sprite :  r.drawSprite('héros', vec2(d.x, y), largeur); */
  draw(r) {
    const { a } = r.palette;
    L.drawCircle(vec2(r.data.x, r.bottom + 5), 1.4, fade(a, 0.2));
    L.drawCircle(vec2(r.data.x, r.bottom + 5), 0.8, a);
  },

  /** Pilote automatique — obligatoire : c'est lui qui joue dans les vidéos.
      Il doit bien jouer mais finir par perdre, sinon le clip n'a pas de fin. */
  bot(r) {
    r.hold(r.data.x < 0);
  },
};
