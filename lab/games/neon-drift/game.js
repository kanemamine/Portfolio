/* NEON DRIFT — un seul bouton, une seule règle.

   Maintenir = dériver à droite, relâcher = dériver à gauche. Passer dans la
   brèche. La vitesse monte sans arrêt.

   Pourquoi ce prototype : la règle se comprend en une seconde sans texte, et la
   traînée du vaisseau donne une image très lisible en miniature. */

import { L, vec2, rgb, hsl } from '../../engine/shell.js';

const PLAYER_Y = -11;
const ACCEL = 46;
const MAX_VX = 13;
const GATE_GAP_Y = 7.5;

export default {
  meta: {
    slug: 'neon-drift',
    title: 'Neon Drift',
    hook: 'Maintiens pour dériver',
    tagline: 'Un doigt. Une brèche. Zéro pardon.',
    tags: ['one-button', 'endless', 'reflexe'],
    scroll: 6,
    palette: {
      bg: rgb(0.03, 0.03, 0.08),
      ink: rgb(1, 1, 1),
      a: hsl(0.52, 1, 0.62),
      b: hsl(0.88, 1, 0.66),
      c: hsl(0.14, 1, 0.62),
    },
  },

  reset(r) {
    const d = r.data;
    d.x = 0;
    d.vx = 0;
    d.speed = 11;
    d.trail = [];
    d.gates = [];
    d.orbs = [];
    for (let i = 0; i < 6; i++) spawn(r);
  },

  update(r) {
    const d = r.data;

    /* Le rythme monte vite : un clip doit être dense dès les premières secondes. */
    d.speed = 15 + r.score * 0.32;
    const dir = r.down ? 1 : -1;
    d.vx = L.clamp(d.vx + dir * ACCEL * r.dt, -MAX_VX, MAX_VX);
    d.vx *= Math.pow(0.5, r.dt * 3);
    d.x += d.vx * r.dt;

    /* Les bords tuent : pas de rebond, pas de refuge. */
    if (d.x < r.left + 0.6 || d.x > r.right - 0.6) {
      d.x = L.clamp(d.x, r.left + 0.6, r.right - 0.6);
      r.burst(vec2(d.x, PLAYER_Y), r.palette.b, 40, { speed: 14 });
      return r.gameOver();
    }

    /* Traînée : c'est elle qui fait 80 % de l'image. */
    d.trail.push(vec2(d.x, PLAYER_Y));
    if (d.trail.length > 26) d.trail.shift();
    for (const p of d.trail) p.y -= d.speed * r.dt;

    const dy = d.speed * r.dt;

    for (let i = d.gates.length; i--;) {
      const g = d.gates[i];
      const was = g.y;
      g.y -= dy;
      if (was > PLAYER_Y && g.y <= PLAYER_Y) {
        if (Math.abs(d.x - g.cx) > g.w / 2) {
          r.burst(vec2(d.x, PLAYER_Y), r.palette.b, 56, { speed: 18 });
          r.impact(2);
          return r.gameOver();
        }
        r.addScore(1);
        r.impact(0.5);
        r.burst(vec2(d.x, PLAYER_Y), r.palette.a, 18, { speed: 9, angle: Math.PI / 2, cone: 0.9 });
        if (!r.cfg.mute) r.sfx.score.play();
      }
      if (g.y < r.bottom - 3) d.gates.splice(i, 1);
    }

    for (let i = d.orbs.length; i--;) {
      const o = d.orbs[i];
      o.y -= dy;
      if (Math.abs(o.y - PLAYER_Y) < 0.8 && Math.abs(o.x - d.x) < 0.9) {
        r.combo++;
        r.addScore(5 * Math.min(5, r.combo), vec2(o.x, o.y));
        r.glow(0.5);
        r.burst(vec2(o.x, o.y), r.palette.c, 24, { speed: 8 });
        if (!r.cfg.mute) r.sfx.score.play();
        d.orbs.splice(i, 1);
      } else if (o.y < r.bottom - 2) {
        r.combo = 0;                    // un orbe manqué casse la chaîne
        d.orbs.splice(i, 1);
      }
    }

    while (d.gates.length < 6) spawn(r);
  },

  draw(r) {
    const d = r.data;
    const { a, b, c, ink } = r.palette;

    for (const g of d.gates) {
      const halfOuter = (r.W - g.w) / 4;
      const lx = r.left + halfOuter;
      const rx = r.right - halfOuter;
      const glow = new L.Color(b.r, b.g, b.b, 0.22);
      L.drawRect(vec2(lx, g.y), vec2(halfOuter * 2, 1.4), glow);
      L.drawRect(vec2(rx, g.y), vec2(halfOuter * 2, 1.4), glow);
      L.drawRect(vec2(lx, g.y), vec2(halfOuter * 2, 0.5), b);
      L.drawRect(vec2(rx, g.y), vec2(halfOuter * 2, 0.5), b);
    }

    for (const o of d.orbs) {
      const pulse = 0.45 + 0.08 * Math.sin(r.t * 9 + o.x);
      L.drawCircle(vec2(o.x, o.y), pulse * 1.9, new L.Color(c.r, c.g, c.b, 0.2));
      L.drawCircle(vec2(o.x, o.y), pulse, c);
    }

    for (let i = 1; i < d.trail.length; i++) {
      const f = i / d.trail.length;
      L.drawLine(d.trail[i - 1], d.trail[i], 0.75 * f * f,
        new L.Color(a.r, a.g, a.b, f * 0.85));
    }

    /* Le vaisseau s'incline dans le sens de la dérive : lecture instantanée. */
    const tilt = -d.vx / MAX_VX * 0.55;
    const p = vec2(d.x, PLAYER_Y);
    L.drawCircle(p, 1.5, new L.Color(a.r, a.g, a.b, 0.18));
    L.drawPoly([vec2(0, 0.95), vec2(-0.72, -0.7), vec2(0, -0.32), vec2(0.72, -0.7)],
      ink, 0.1, a, p, tilt);
  },

  /* Pilote automatique : vise le centre de la brèche la plus proche devant,
     avec une anticipation proportionnelle à la vitesse actuelle. */
  bot(r) {
    const d = r.data;
    let target = 0, best = 1e9;
    for (const g of d.gates) {
      const dist = g.y - PLAYER_Y;
      if (dist > -0.5 && dist < best) { best = dist; target = g.cx; }
    }
    /* Un orbe sur la route vaut le détour s'il ne coûte pas la brèche. */
    for (const o of d.orbs) {
      const dist = o.y - PLAYER_Y;
      if (dist > 0 && dist < best && Math.abs(o.x - target) < 2.5) target = o.x;
    }
    const predicted = d.x + d.vx * 0.16;
    r.hold(target > predicted);
  },
};

/* Les portes vivent dans le repère mobile : chacune se place simplement au-dessus
   de la précédente, ce qui évite tout compteur absolu à resynchroniser. */
function spawn(r) {
  const d = r.data;
  const last = d.gates.length ? d.gates[d.gates.length - 1].y : PLAYER_Y + 14;
  const y = d.gates.length ? last + GATE_GAP_Y : last;
  /* La brèche se resserre avec le score, mais jamais en dessous du jouable. */
  const w = Math.max(3.4, 7.5 - r.score * 0.09);
  const cx = r.rng.float(r.left + w / 2 + 1, r.right - w / 2 - 1);
  d.gates.push({ y, cx, w });
  if (r.rng.bool(0.45)) d.orbs.push({ x: cx + r.rng.float(-w / 3, w / 3), y: y + GATE_GAP_Y / 2 });
}
