/* __TITLE__ — __HOOK__

   Décris ici la règle en une phrase, puis pourquoi ce prototype mérite d'être
   filmé : qu'est-ce qui se comprend en une seconde, et qu'est-ce qui donne le
   pic d'émotion ?

   Tout le reste (format vertical, HUD, particules, post-traitement, capture)
   vient du shell : ce fichier ne contient que la mécanique. */

import { L, vec2, rgb, hsl, textWorld, fade, shade } from '../../engine/shell.js';

export default {
  meta: {
    slug: '__SLUG__',
    title: '__TITLE__',
    hook: '__HOOK__',                    // la phrase de l'intro du clip
    tagline: '__TAGLINE__',              // la légende du post
    tags: ['one-button'],
    palette: {
      bg: rgb(0.04, 0.04, 0.08),
      ink: rgb(1, 1, 1),
      a: hsl(0.55, 0.95, 0.62),          // couleur du joueur
      b: hsl(0.95, 0.95, 0.62),          // couleur du danger
      c: hsl(0.13, 1, 0.6),              // couleur des gains
    },
  },

  /** (Re)démarrage. Tout l'état vit dans `r.data`. */
  reset(r) {
    const d = r.data;
    d.x = 0;
    d.vx = 0;
    d.things = [];
  },

  /** Logique. Pas de temps fixe : `r.dt`. N'utilise que `r.rng`, jamais Math.random. */
  update(r) {
    const d = r.data;

    /* Entrée unique : r.down (maintenu), r.pressed (cette frame), r.released. */
    d.vx += (r.down ? 1 : -1) * 40 * r.dt;
    d.vx *= Math.pow(0.5, r.dt * 3);
    d.x = L.clamp(d.x + d.vx * r.dt, r.left + 0.6, r.right - 0.6);

    /* Marquer un point :
         r.addScore(1, vec2(d.x, 0));
       Faire claquer un impact :
         r.impact(1);  r.burst(vec2(d.x, 0), r.palette.c, 24, { speed: 9 });
       Terminer :
         r.gameOver(); */
  },

  /** Rendu en unités monde, y vers le haut, origine au centre. */
  draw(r) {
    const { a } = r.palette;
    L.drawCircle(vec2(r.data.x, r.bottom + 5), 1.4, fade(a, 0.2));
    L.drawCircle(vec2(r.data.x, r.bottom + 5), 0.8, a);
  },

  /** Pilote automatique — obligatoire : c'est lui qui joue dans les vidéos.
      Il doit bien jouer, mais finir par perdre, sinon le clip n'a pas de fin. */
  bot(r) {
    r.hold(r.data.x < 0);
  },
};
