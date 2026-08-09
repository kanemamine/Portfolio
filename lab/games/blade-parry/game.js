/* BLADE PARRY — tout arrive sur toi, tu n'as qu'un geste.

   Un appui pare la menace la plus proche, à condition qu'elle soit dans l'anneau.
   Trop tôt : tu frappes dans le vide et tu restes découvert. Trop tard : elle est
   déjà sur toi.

   Pourquoi ce prototype : le gel d'image et le ralenti sur chaque parade donnent
   un pic sensoriel toutes les demi-secondes — exactement ce qui retient sur un
   format court. */

import { L, vec2, rgb, hsl, textWorld, fade, shade } from '../../engine/shell.js';

const PARRY_IN = 2.4;      // en deçà, trop tard
const PARRY_OUT = 5.8;     // au-delà, trop tôt
const DEATH_R = 1.5;
const WHIFF_COOL = 0.42;   // punition d'une parade dans le vide
const PARRY_COOL = 0.13;   // une parade = une menace, pas deux

export default {
  meta: {
    slug: 'blade-parry',
    title: 'Blade Parry',
    hook: 'Pare au dernier instant',
    tagline: 'Un geste, une menace. Frappe dans le vide et tu es découvert.',
    tags: ['timing', 'one-button', 'défense'],
    palette: {
      bg: rgb(0.06, 0.03, 0.05),
      ink: rgb(1, 1, 1),
      a: hsl(0.52, 1, 0.66),
      b: hsl(0.99, 0.95, 0.6),
      c: hsl(0.12, 1, 0.62),
    },
  },

  reset(r) {
    const d = r.data;
    d.foes = [];
    d.timer = 1;
    d.cool = 0;
    d.flashRing = 0;
  },

  update(r) {
    const d = r.data;
    d.cool = Math.max(0, d.cool - r.dt);
    d.flashRing = Math.max(0, d.flashRing - r.dt * 3.5);

    d.timer -= r.dt;
    if (d.timer <= 0) {
      /* La densité monte : c'est elle qui finit par déborder le joueur, puisqu'une
         parade ne neutralise qu'une menace. */
      const burst = r.score > 25 && r.rng.bool(0.3) ? 2 : 1;
      for (let i = 0; i < burst; i++) spawn(r);
      d.timer = Math.max(0.34, 1.05 - r.score * 0.013);
    }

    if (r.pressed && d.cool === 0) {
      let target = null, best = Infinity;
      for (const f of d.foes) {
        const dist = Math.hypot(f.x, f.y);
        if (dist >= PARRY_IN && dist <= PARRY_OUT && dist < best) { best = dist; target = f; }
      }
      if (target) {
        d.foes.splice(d.foes.indexOf(target), 1);
        r.combo++;
        r.addScore(Math.min(9, r.combo), vec2(target.x, target.y));
        r.burst(vec2(target.x, target.y), r.palette.a, 24, { speed: 12 });
        r.impact(1.1);
        r.slowmo(0.32, 0.14);
        r.glow(0.45);
        d.flashRing = 1;
        d.cool = PARRY_COOL;
        if (!r.cfg.mute) r.sfx.score.play();
      } else {
        d.cool = WHIFF_COOL;
        r.combo = 0;
        r.shake(0.4);
        r.aberrate(0.25);
        if (!r.cfg.mute) r.sfx.tap.play();
      }
    }

    for (const f of d.foes) {
      f.x += f.vx * r.dt;
      f.y += f.vy * r.dt;
      if (Math.hypot(f.x, f.y) < DEATH_R) {
        r.burst(vec2(0, 0), r.palette.b, 70, { speed: 17 });
        r.impact(2.5);
        return r.gameOver();
      }
    }
  },

  draw(r) {
    const d = r.data;
    const { a, b, c, ink } = r.palette;

    /* Anneau de parade : rouge tant que la garde est baissée. */
    const guardDown = d.cool > PARRY_COOL;
    const ringCol = guardDown ? b : a;
    L.drawCircle(vec2(0, 0), PARRY_OUT, fade(ringCol, 0.05 + d.flashRing * 0.25));
    L.drawCircle(vec2(0, 0), PARRY_OUT, undefined, 0.08, fade(ringCol, 0.45 + d.flashRing * 0.5));
    L.drawCircle(vec2(0, 0), PARRY_IN, undefined, 0.05, fade(ringCol, 0.18));

    for (const f of d.foes) {
      const ang = Math.atan2(f.vy, f.vx) - Math.PI / 2;
      const p = vec2(f.x, f.y);
      /* Traînée orientée vers l'arrière : la trajectoire se lit d'un coup d'œil. */
      const back = vec2(f.x - f.vx * 0.16, f.y - f.vy * 0.16);
      L.drawLine(p, back, 0.22, fade(b, 0.4));
      L.drawPoly([vec2(0, 0.85), vec2(-0.55, -0.6), vec2(0.55, -0.6)], b, 0.08, fade(ink, 0.8), p, ang);
    }

    /* Le joueur : losange qui pivote, brutalement agrandi à chaque parade. */
    const pulse = 1 + d.flashRing * 0.5;
    const spin = r.t * 1.1;
    L.drawCircle(vec2(0, 0), DEATH_R * 1.6 * pulse, fade(guardDown ? b : a, 0.16));
    L.drawPoly([vec2(0, 1.05), vec2(-0.8, 0), vec2(0, -1.05), vec2(0.8, 0)]
      .map((v) => v.scale(pulse)), ink, 0.1, guardDown ? b : a, vec2(0, 0), spin);

    if (guardDown) textWorld('DÉCOUVERT', vec2(0, -3.2), 0.95, b, 0.14, shade(0.7));
    if (r.combo > 2) textWorld('×' + r.combo, vec2(0, 3.4), 1.2, c, 0.16, shade(0.7));
  },

  /* Pilote automatique : pare la menace la plus proche dès qu'elle entre dans
     l'anneau. Il ne rate jamais un geste — il perd quand deux menaces arrivent
     dans la même fenêtre, ce que le rythme de spawn finit toujours par produire. */
  bot(r) {
    const d = r.data;
    if (d.cool > 0) return r.hold(false);
    let best = Infinity;
    for (const f of d.foes) best = Math.min(best, Math.hypot(f.x, f.y));
    if (best <= PARRY_OUT - 0.4 && best >= PARRY_IN + 0.5) r.tap();
    else r.hold(false);
  },
};

function spawn(r) {
  const d = r.data;
  /* Apparition sur une ellipse calée sur le cadre vertical : les menaces entrent
     toujours juste hors champ, jamais en plein écran. */
  const ang = r.rng.angle();
  const x = Math.cos(ang) * 12;
  const y = Math.sin(ang) * 19;
  const dist = Math.hypot(x, y);
  const speed = 6.5 + r.score * 0.07 + r.rng.float(0, 1.6);
  d.foes.push({ x, y, vx: (-x / dist) * speed, vy: (-y / dist) * speed });
}
