/* KNIFE SPIN — planter une lame dans un disque qui tourne.

   Chaque lame plantée devient l'obstacle de la suivante. Le chrono ne s'arrête
   jamais : attendre la fenêtre parfaite finit par coûter la partie.

   Pourquoi ce prototype : la tension est entièrement lisible à l'image — on voit
   le disque se remplir et on sait, avant le joueur, que ça ne passera pas. */

import { L, vec2, rgb, hsl, textWorld, fade, shade } from '../../engine/shell.js';

const DISC_Y = 5.5;
const DISC_R = 4.3;
const LAUNCH_Y = -12;
const KNIFE_SPEED = 27;
const MIN_SEP = 0.3;                       // écart angulaire minimal entre lames
const TRAVEL = (DISC_Y - DISC_R - LAUNCH_Y) / KNIFE_SPEED;

export default {
  meta: {
    slug: 'knife-spin',
    title: 'Knife Spin',
    hook: 'Plante sans toucher',
    tagline: 'Chaque lame plantée rétrécit la fenêtre suivante.',
    tags: ['précision', 'one-button', 'timing'],
    palette: {
      bg: rgb(0.05, 0.04, 0.06),
      ink: rgb(1, 1, 1),
      a: hsl(0.09, 0.85, 0.6),
      b: hsl(0.99, 0.95, 0.6),
      c: hsl(0.14, 1, 0.62),
    },
  },

  reset(r) {
    const d = r.data;
    d.level = 1;
    d.rot = 0;
    d.stuck = [];
    d.flying = null;
    d.left = 6;                            // lames restantes pour ce niveau
    startLevel(r);
  },

  update(r) {
    const d = r.data;
    d.rot += d.omega * r.dt;
    d.clock -= r.dt;

    if (d.clock <= 0) {
      r.burst(vec2(0, LAUNCH_Y + 1), r.palette.b, 40, { speed: 12 });
      r.impact(2);
      return r.gameOver();
    }

    if (r.pressed && !d.flying) {
      d.flying = { y: LAUNCH_Y };
      if (!r.cfg.mute) r.sfx.tap.play();
    }

    if (d.flying) {
      d.flying.y += KNIFE_SPEED * r.dt;
      if (d.flying.y >= DISC_Y - DISC_R) {
        d.flying = null;
        /* La lame se plante toujours par le bas du disque : son angle local est
           donc l'opposé de la rotation courante. */
        const local = norm(-Math.PI / 2 - d.rot);
        if (d.stuck.some((s) => Math.abs(norm(s - local)) < MIN_SEP)) {
          r.burst(vec2(0, DISC_Y - DISC_R), r.palette.b, 50, { speed: 14 });
          r.impact(2.2);
          return r.gameOver();
        }
        d.stuck.push(local);
        d.left--;
        r.combo++;
        r.addScore(Math.min(8, r.combo), vec2(0, DISC_Y - DISC_R - 1));
        r.impact(0.7);
        r.glow(0.3);
        r.burst(vec2(0, DISC_Y - DISC_R), r.palette.c, 18, { speed: 7 });
        if (!r.cfg.mute) r.sfx.score.play();
        if (d.left <= 0) startLevel(r, true);
        else d.clock = d.throwTime;
      }
    }
  },

  draw(r) {
    const d = r.data;
    const { a, b, c, ink } = r.palette;
    const centre = vec2(0, DISC_Y);

    /* Disque. */
    L.drawCircle(centre, DISC_R * 1.22, fade(a, 0.14));
    L.drawCircle(centre, DISC_R, a);
    L.drawCircle(centre, DISC_R * 0.72, fade(rgb(0, 0, 0), 0.45));
    for (let i = 0; i < 8; i++) {
      const ang = d.rot + (i * Math.PI) / 4;
      L.drawLine(centre, centre.add(vec2(Math.cos(ang), Math.sin(ang)).scale(DISC_R)), 0.06, fade(ink, 0.16));
    }

    /* Lames plantées : elles pointent vers le centre. */
    for (const s of d.stuck) knife(centre, s + d.rot, ink, c);

    if (d.flying) knife(vec2(0, d.flying.y + 1.1), -Math.PI / 2, ink, c, true);

    /* Réserve de lames et chrono : la pression doit être visible. */
    for (let i = 0; i < d.left; i++) {
      L.drawRect(vec2(r.left + 1.2, r.bottom + 2 + i * 1.1), vec2(0.5, 0.8), fade(c, 0.75));
    }
    const frac = Math.max(0, d.clock / d.throwTime);
    const barCol = frac < 0.3 ? b : a;
    L.drawRect(vec2(0, LAUNCH_Y - 2.4), vec2(12, 0.45), fade(ink, 0.12));
    L.drawRect(vec2(-6 + 6 * frac, LAUNCH_Y - 2.4), vec2(12 * frac, 0.45), barCol);

    textWorld('NIVEAU ' + d.level, vec2(0, DISC_Y + DISC_R + 2.2), 1, fade(ink, 0.6), 0.12, shade(0.6));
  },

  /* Pilote automatique : il calcule l'angle d'impact à l'avance et n'envoie que
     si la fenêtre est franche. Quand le chrono est presque écoulé, il tente
     quand même — et c'est ainsi que la partie se termine. */
  bot(r) {
    const d = r.data;
    if (d.flying) return r.hold(false);
    const local = norm(-Math.PI / 2 - (d.rot + d.omega * TRAVEL));
    let closest = Infinity;
    for (const s of d.stuck) closest = Math.min(closest, Math.abs(norm(s - local)));
    if (closest > MIN_SEP * 1.7 || d.clock < 0.3) r.tap();
    else r.hold(false);
  },
};

const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function knife(base, ang, ink, edge, flying = false) {
  const dir = vec2(Math.cos(ang), Math.sin(ang));
  const tip = flying ? base : base.add(dir.scale(DISC_R * 0.72));
  const tail = flying ? base.add(vec2(0, -2.2)) : base.add(dir.scale(DISC_R * 1.5));
  L.drawLine(tip, tail, 0.34, fade(edge, 0.35));
  L.drawLine(tip, tail, 0.16, ink);
}

function startLevel(r, advance = false) {
  const d = r.data;
  if (advance) {
    d.level++;
    d.stuck = [];
    d.rot = 0;
    r.flash(0.25);
    r.glow(0.6);
    if (!r.cfg.mute) r.sfx.score.play();
  }
  /* Chaque niveau : plus de lames, moins de temps, rotation plus vive — et le
     sens change, ce qui interdit d'apprendre un rythme par cœur. */
  d.left = 5 + Math.min(7, d.level);
  d.throwTime = Math.max(0.75, 2.4 - d.level * 0.13);
  d.omega = r.rng.sign() * (1.5 + d.level * 0.28 + r.rng.float(0, 0.6));
  d.clock = d.throwTime;
}
