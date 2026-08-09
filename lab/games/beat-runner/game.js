/* BEAT RUNNER — taper sur le temps.

   Les notes tombent vers la ligne. On tape quand elles y sont. Frapper dans le
   vide casse la chaîne ; laisser passer coûte une vie, et il y en a trois.

   Pourquoi ce prototype : le rythme est le seul genre où la vidéo *est* le jeu —
   le spectateur entend le tempo dans sa tête et juge la performance sans y jouer. */

import { L, vec2, rgb, hsl, textWorld, textScreen, fade, shade } from '../../engine/shell.js';

const LINE_Y = -10;
const FALL = 17;
const WINDOW = 1.5;        // tolérance d'un appui réussi
const PERFECT = 0.5;
const LIVES = 3;

export default {
  meta: {
    slug: 'beat-runner',
    title: 'Beat Runner',
    hook: 'Tape pile sur le temps',
    tagline: 'Trois vies. Le tempo, lui, n’attend pas.',
    tags: ['rythme', 'one-button', 'précision'],
    scroll: 9,
    palette: {
      bg: rgb(0.04, 0.03, 0.09),
      ink: rgb(1, 1, 1),
      a: hsl(0.72, 0.95, 0.66),
      b: hsl(0.97, 0.95, 0.62),
      c: hsl(0.16, 1, 0.62),
    },
  },

  reset(r) {
    const d = r.data;
    d.notes = [];
    d.lives = LIVES;
    d.timer = 1.2;
    d.beat = 0;
    d.pulse = 0;
    d.judge = null;
    d.judgeT = 0;
  },

  update(r) {
    const d = r.data;
    d.pulse = Math.max(0, d.pulse - r.dt * 3);
    d.judgeT = Math.max(0, d.judgeT - r.dt);

    /* Le tempo monte doucement, et un temps sur cinq est doublé : le motif reste
       lisible tout en cessant d'être mécanique. */
    const interval = Math.max(0.28, 0.62 - r.score * 0.0022);
    d.timer -= r.dt;
    if (d.timer <= 0) {
      d.beat++;
      spawn(r);
      if (d.beat % 5 === 0 && r.score > 12) spawn(r, interval * 0.5);
      d.timer = interval;
      d.pulse = 1;
    }

    if (r.pressed) {
      let target = null, best = Infinity;
      for (const n of d.notes) {
        const dy = Math.abs(n.y - LINE_Y);
        if (!n.dead && dy < best) { best = dy; target = n; }
      }
      if (target && best <= WINDOW) {
        target.dead = true;
        r.combo++;
        const perfect = best <= PERFECT;
        r.addScore((perfect ? 3 : 1) * Math.min(6, r.combo), vec2(0, LINE_Y + 1.6));
        r.impact(perfect ? 0.8 : 0.35);
        if (perfect) r.glow(0.45);
        r.burst(vec2(0, LINE_Y), perfect ? r.palette.c : r.palette.a, perfect ? 26 : 14, { speed: 9 });
        d.judge = perfect ? 'PARFAIT' : 'BIEN';
        d.judgeT = 0.45;
        if (!r.cfg.mute) r.sfx.score.play();
      } else {
        r.combo = 0;
        d.judge = 'RATÉ';
        d.judgeT = 0.4;
        r.shake(0.3);
        if (!r.cfg.mute) r.sfx.tap.play();
      }
    }

    for (let i = d.notes.length; i--;) {
      const n = d.notes[i];
      n.y -= FALL * r.dt;
      if (n.dead) { d.notes.splice(i, 1); continue; }
      if (n.y < LINE_Y - WINDOW) {
        /* Note laissée passer : une vie en moins, et ça se voit. */
        d.notes.splice(i, 1);
        d.lives--;
        r.combo = 0;
        d.judge = 'MANQUÉ';
        d.judgeT = 0.5;
        r.impact(1.4);
        r.flash(0.2);
        if (!r.cfg.mute) r.sfx.fail.play();
        if (d.lives <= 0) {
          r.burst(vec2(0, LINE_Y), r.palette.b, 60, { speed: 15 });
          return r.gameOver();
        }
      }
    }
  },

  draw(r) {
    const d = r.data;
    const { a, b, c, ink } = r.palette;

    /* Ligne de frappe : elle pulse sur le temps, ce qui donne le tempo à l'œil. */
    const glow = 0.25 + d.pulse * 0.5;
    L.drawRect(vec2(0, LINE_Y), vec2(r.W, 0.1 + d.pulse * 0.5), fade(a, glow));
    L.drawRect(vec2(0, LINE_Y), vec2(r.W, 2.6), fade(a, 0.06 + d.pulse * 0.1));
    for (const s of [-1, 1]) L.drawCircle(vec2(s * 4.6, LINE_Y), 0.4 + d.pulse * 0.35, fade(a, 0.7));

    /* Couloir. */
    for (const s of [-1, 1]) L.drawLine(vec2(s * 4.6, LINE_Y), vec2(s * 4.6, r.top), 0.05, fade(a, 0.15));

    for (const n of d.notes) {
      const near = 1 - Math.min(1, Math.abs(n.y - LINE_Y) / 8);
      L.drawRect(vec2(0, n.y), vec2(7.4, 1.5), fade(c, 0.12 + near * 0.2));
      L.drawRect(vec2(0, n.y), vec2(6.8, 0.9), c);
      L.drawRect(vec2(0, n.y), vec2(6.8, 0.24), fade(ink, 0.7));
    }

    if (d.judgeT > 0) {
      const col = d.judge === 'PARFAIT' ? c : d.judge === 'BIEN' ? a : b;
      textWorld(d.judge, vec2(0, LINE_Y + 3.4), 1.5, fade(col, Math.min(1, d.judgeT * 3)), 0.18, shade(0.7));
    }
  },

  drawUI(r) {
    const d = r.data;
    const w = L.mainCanvas.width, h = L.mainCanvas.height;
    const px = w / 1080;
    /* Vies : trois pastilles, lisibles même en miniature. */
    for (let i = 0; i < LIVES; i++) {
      const on = i < d.lives;
      textScreen(on ? '●' : '○', vec2(w / 2 + (i - 1) * 54 * px, h * 0.20), 44 * px,
        on ? r.palette.b : fade(r.palette.ink, 0.3), 6 * px, shade(0.6));
    }
  },

  /* Pilote automatique : chaque note reçoit une erreur de timing tirée d'avance,
     qui grandit avec le score. C'est cette dérive qui met fin à la partie. */
  bot(r) {
    const d = r.data;
    let target = null, best = Infinity;
    for (const n of d.notes) {
      if (n.dead || n.botDone) continue;
      const dy = n.y - LINE_Y;
      if (dy > -WINDOW && dy < best) { best = dy; target = n; }
    }
    if (target && best <= target.bias) { target.botDone = true; return r.tap(); }
    r.hold(false);
  },
};

function spawn(r, offset = 0) {
  const d = r.data;
  const amp = Math.min(2.2, 0.25 + r.score * 0.006);
  d.notes.push({
    y: r.top + 2 + offset * FALL,
    dead: false,
    botDone: false,
    /* Décalage d'appui du bot, en unités de distance à la ligne. */
    bias: r.rng.float(-1, 1) * amp,
  });
}
