/* WALL CLIMB — monter en rebondissant d'un mur à l'autre.

   Collé à une paroi, on glisse. Un appui envoie de l'autre côté. Les pointes
   décident où l'on peut atterrir, et le vide monte tout seul par en dessous.

   Pourquoi ce prototype : la montée est la lecture la plus naturelle du format
   vertical — on voit immédiatement si ça va bien ou mal. */

import { L, vec2, rgb, hsl, textWorld, fade, shade } from '../../engine/shell.js';

const WALL_X = 6;
const JUMP_VX = 16;
const JUMP_VY = 14;
const GRAVITY = 26;
const SLIDE = -2.4;
const SPIKE_H = 1.5;

/* Gain d'altitude d'un saut : constant, donc entièrement prévisible par le bot
   comme par le joueur. */
const FLIGHT_T = (2 * WALL_X) / JUMP_VX;
const JUMP_DY = JUMP_VY * FLIGHT_T - 0.5 * GRAVITY * FLIGHT_T * FLIGHT_T;

export default {
  meta: {
    slug: 'wall-climb',
    title: 'Wall Climb',
    hook: 'Rebondis, ne retombe pas',
    tagline: 'Le vide monte plus vite que toi.',
    tags: ['plateforme', 'one-button', 'ascension'],
    palette: {
      bg: rgb(0.03, 0.05, 0.07),
      ink: rgb(1, 1, 1),
      a: hsl(0.42, 0.95, 0.6),
      b: hsl(0.02, 0.95, 0.62),
      c: hsl(0.14, 1, 0.62),
    },
  },

  reset(r) {
    const d = r.data;
    d.side = -1;
    d.x = -WALL_X;
    d.y = 0;
    d.vx = 0;
    d.vy = 0;
    d.air = false;
    d.camY = -8;
    d.best = 0;
    d.spikes = [];
    d.nextSpike = 12;
    d.trail = [];
    while (d.nextSpike < 60) addSpike(r);
  },

  update(r) {
    const d = r.data;

    if (d.air) {
      d.x += d.vx * r.dt;
      d.vy -= GRAVITY * r.dt;
      d.y += d.vy * r.dt;
      /* Arrivée au mur : c'est là, et seulement là, que les pointes comptent. */
      if ((d.vx < 0 && d.x <= -WALL_X) || (d.vx > 0 && d.x >= WALL_X)) {
        d.side = d.vx < 0 ? -1 : 1;
        d.x = d.side * WALL_X;
        d.air = false;
        d.vx = 0;
        d.vy = 0;
        if (spikeAt(d, d.side, d.y)) {
          r.burst(vec2(d.x, d.y), r.palette.b, 46, { speed: 13 });
          r.impact(2);
          return r.gameOver();
        }
        r.impact(0.3);
        r.burst(vec2(d.x, d.y), r.palette.a, 10, { speed: 5, angle: -d.side * Math.PI / 2, cone: 1 });
        if (!r.cfg.mute) r.sfx.tap.play();
      }
    } else {
      d.y += SLIDE * r.dt;
      if (r.pressed) {
        d.air = true;
        d.vx = -d.side * JUMP_VX;
        d.vy = JUMP_VY;
        r.shake(0.15);
        if (!r.cfg.mute) r.sfx.tap.play();
      }
    }

    /* Le score, c'est l'altitude atteinte — pas le nombre de sauts. */
    if (d.y > d.best) {
      const gained = Math.floor(d.y / 3) - Math.floor(d.best / 3);
      if (gained > 0) { r.addScore(gained); if (!r.cfg.mute && gained > 0) r.sfx.score.play(); }
      d.best = d.y;
    }

    /* Le vide monte, et de plus en plus vite : impossible de camper. */
    /* Le vide doit finir par rattraper un jeu parfait : un saut rapporte
       ~3,2 unités en 0,75 s, soit 4,3 u/s. Au-delà de ce seuil, attendre une
       fenêtre sûre devient fatal. */
    const rise = 2.4 + r.score * 0.075;
    d.camY = Math.max(d.camY + rise * r.dt, d.y - 8);

    if (d.y < d.camY + r.bottom + 2) {
      r.burst(vec2(d.x, d.y), r.palette.b, 40, { speed: 12 });
      r.impact(2);
      return r.gameOver();
    }

    d.trail.push(vec2(d.x, d.y));
    if (d.trail.length > 18) d.trail.shift();

    while (d.nextSpike < d.y + 60) addSpike(r);
    while (d.spikes.length && d.spikes[0].y < d.camY + r.bottom - 6) d.spikes.shift();
  },

  draw(r) {
    const d = r.data;
    const { a, b, c, ink } = r.palette;
    const sy = (y) => y - d.camY;

    /* Parois. */
    for (const side of [-1, 1]) {
      L.drawRect(vec2(side * (WALL_X + 0.9), 0), vec2(1.4, r.H + 2), fade(a, 0.16));
      L.drawLine(vec2(side * WALL_X, r.bottom), vec2(side * WALL_X, r.top), 0.1, fade(a, 0.55));
    }

    /* Ligne de vide : la menace doit être visible, pas seulement subie. */
    const voidY = sy(d.camY + r.bottom + 2);
    L.drawRect(vec2(0, (r.bottom + voidY) / 2), vec2(r.W, Math.max(0, voidY - r.bottom)), fade(b, 0.12));
    L.drawLine(vec2(r.left, voidY), vec2(r.right, voidY), 0.09, fade(b, 0.6));

    for (const s of d.spikes) {
      const y = sy(s.y);
      if (y < r.bottom - 3 || y > r.top + 3) continue;
      const x = s.side * WALL_X;
      for (let k = -1; k <= 1; k++) {
        L.drawPoly([vec2(0, 0.5), vec2(0, -0.5), vec2(-s.side * 0.95, 0)],
          b, 0.06, fade(ink, 0.5), vec2(x, y + k * SPIKE_H * 0.5), 0);
      }
      L.drawLine(vec2(x, y - SPIKE_H), vec2(x, y + SPIKE_H), 0.16, fade(b, 0.35));
    }

    for (let i = 1; i < d.trail.length; i++) {
      const f = i / d.trail.length;
      L.drawLine(vec2(d.trail[i - 1].x, sy(d.trail[i - 1].y)), vec2(d.trail[i].x, sy(d.trail[i].y)),
        0.5 * f * f, fade(c, f * 0.7));
    }

    const p = vec2(d.x, sy(d.y));
    L.drawCircle(p, 1.4, fade(c, 0.18));
    L.drawRect(p, vec2(1.1, 1.1), c, d.air ? r.t * 7 : 0);
  },

  /* Pilote automatique : il ne saute que si l'atterrissage est sûr. Sinon il
     glisse — et c'est le vide qui monte qui finit par le rattraper. */
  bot(r) {
    const d = r.data;
    if (d.air) return r.hold(false);
    if (!spikeAt(d, -d.side, d.y + JUMP_DY)) r.tap();
    else r.hold(false);
  },
};

function addSpike(r) {
  const d = r.data;
  /* Les pointes se densifient avec l'altitude : les fenêtres d'atterrissage
     sûres se raréfient, et l'attente devient de plus en plus coûteuse. */
  const gap = Math.max(3.8, 8.5 - d.nextSpike * 0.022);
  d.spikes.push({ side: r.rng.sign(), y: d.nextSpike });
  d.nextSpike += r.rng.float(gap, gap + 4);
}

function spikeAt(d, side, y) {
  for (const s of d.spikes) {
    if (s.side !== side) continue;
    if (Math.abs(s.y - y) < SPIKE_H + 0.6) return true;
  }
  return false;
}
