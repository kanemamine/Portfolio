/* RIFT CLIMB — monter à travers des portes qui glissent.

   Maintenir pousse vers le haut, lâcher fait retomber. Chaque barrière n'a qu'une
   ouverture, et cette ouverture ne tient pas en place. Le vide monte par-dessous.

   Pourquoi ce prototype : c'est le seul du lot où l'on pilote une inertie plutôt
   qu'un déclenchement — hésiter se voit à l'image, et l'hésitation est ce qui
   rend un clip haletant. */

import { L, vec2, rgb, hsl, textWorld, fade, shade } from '../../engine/shell.js';

const THRUST = 48;
const GRAVITY = 27;
const MAX_VY = 17;
const BALL_R = 0.85;
const BAR_STEP = 8;

export default {
  meta: {
    slug: 'rift-climb',
    title: 'Rift Climb',
    hook: 'Maintiens pour monter',
    tagline: 'L’ouverture bouge. Le vide, lui, monte tout droit.',
    tags: ['pilotage', 'one-button', 'ascension'],
    palette: {
      bg: rgb(0.03, 0.04, 0.09),
      ink: rgb(1, 1, 1),
      a: hsl(0.55, 0.95, 0.64),
      b: hsl(0.93, 0.95, 0.62),
      c: hsl(0.15, 1, 0.62),
    },
  },

  reset(r) {
    const d = r.data;
    d.y = 0;
    d.vy = 0;
    d.camY = -6;
    d.bars = [];
    d.nextBar = 10;
    d.trail = [];
    d.passed = 0;
    while (d.nextBar < 60) addBar(r);
  },

  update(r) {
    const d = r.data;

    d.vy += (r.down ? THRUST - GRAVITY : -GRAVITY) * r.dt;
    d.vy = L.clamp(d.vy, -MAX_VY, MAX_VY);
    const prevY = d.y;
    d.y += d.vy * r.dt;

    /* Franchissement : on ne teste qu'au moment où la barrière est traversée,
       dans un sens comme dans l'autre. */
    for (const bar of d.bars) {
      const crossedUp = prevY + BALL_R <= bar.y && d.y + BALL_R > bar.y;
      const crossedDown = prevY - BALL_R >= bar.y && d.y - BALL_R < bar.y;
      if (!crossedUp && !crossedDown) continue;
      const gap = gapCenter(bar, r.t);
      if (Math.abs(gap) > bar.w / 2 - BALL_R) {
        r.burst(vec2(gap, bar.y), r.palette.b, 46, { speed: 13 });
        r.impact(2);
        return r.gameOver();
      }
      if (crossedUp && !bar.done) {
        bar.done = true;
        d.passed++;
        r.combo++;
        r.addScore(5 * Math.min(6, r.combo), vec2(0, bar.y));
        r.impact(0.45);
        r.glow(0.3);
        r.burst(vec2(0, bar.y), r.palette.c, 16, { speed: 7 });
        if (!r.cfg.mute) r.sfx.score.play();
      }
    }

    const rise = 2 + r.score * 0.04;
    d.camY = Math.max(d.camY + rise * r.dt, d.y - 7);
    if (d.y < d.camY + r.bottom + 2) {
      r.burst(vec2(0, d.y), r.palette.b, 40, { speed: 12 });
      r.impact(2);
      return r.gameOver();
    }

    d.trail.push(vec2(0, d.y));
    if (d.trail.length > 16) d.trail.shift();

    while (d.nextBar < d.y + 60) addBar(r);
    while (d.bars.length && d.bars[0].y < d.camY + r.bottom - 5) d.bars.shift();
  },

  draw(r) {
    const d = r.data;
    const { a, b, c, ink } = r.palette;
    const sy = (y) => y - d.camY;

    const voidY = sy(d.camY + r.bottom + 2);
    L.drawRect(vec2(0, (r.bottom + voidY) / 2), vec2(r.W, Math.max(0, voidY - r.bottom)), fade(b, 0.12));
    L.drawLine(vec2(r.left, voidY), vec2(r.right, voidY), 0.09, fade(b, 0.6));

    for (const bar of d.bars) {
      const y = sy(bar.y);
      if (y < r.bottom - 2 || y > r.top + 2) continue;
      const gap = gapCenter(bar, r.t);
      const half = bar.w / 2;
      /* Deux segments plutôt qu'un trou : l'ouverture se lit sans ambiguïté. */
      const leftEnd = gap - half, rightEnd = gap + half;
      seg(r.left, leftEnd, y, bar.done ? fade(a, 0.35) : b);
      seg(rightEnd, r.right, y, bar.done ? fade(a, 0.35) : b);
      L.drawLine(vec2(leftEnd, y), vec2(rightEnd, y), 0.06, fade(c, 0.35));
    }

    for (let i = 1; i < d.trail.length; i++) {
      const f = i / d.trail.length;
      L.drawLine(vec2(0, sy(d.trail[i - 1].y)), vec2(0, sy(d.trail[i].y)), 0.7 * f * f, fade(a, f * 0.6));
    }

    const p = vec2(0, sy(d.y));
    L.drawCircle(p, BALL_R * 2, fade(a, 0.16));
    L.drawCircle(p, BALL_R, a);
    L.drawCircle(p.add(vec2(-0.28, 0.3)), BALL_R * 0.3, fade(ink, 0.6));
    if (r.down) L.drawCircle(p.add(vec2(0, -BALL_R - 0.5)), 0.55, fade(c, 0.7));
  },

  /* Pilote automatique : il attend sous la barrière que l'ouverture revienne au
     centre, puis pousse. Le vide qui monte transforme chaque attente en pari. */
  bot(r) {
    const d = r.data;
    let next = null;
    for (const bar of d.bars) {
      if (bar.y > d.y + BALL_R && (!next || bar.y < next.y)) next = bar;
    }
    if (!next) return r.hold(d.y < d.camY + 4);

    /* Estimation du temps de montée, pour viser l'ouverture telle qu'elle sera
       à l'arrivée et non telle qu'elle est maintenant. */
    const eta = Math.max(0.12, (next.y - d.y) / 8);
    const margin = next.w / 2 - BALL_R - 0.7;
    /* L'ouverture doit rester franche pendant toute la traversée, pas seulement
       à l'instant estimé d'arrivée. */
    const safe = [0.6, 1, 1.4].every((k) => Math.abs(gapCenter(next, r.t + eta * k)) < margin);
    const target = safe ? next.y + 3 : next.y - 3.4;

    /* Commande prédictive : la poussée est vive, un pilotage en tout-ou-rien sur
       la position seule dépasse la cible et traverse la barrière par le dessus. */
    r.hold(d.y + d.vy * 0.24 < target);
  },
};

function seg(x0, x1, y, col) {
  if (x1 - x0 <= 0.05) return;
  L.drawRect(vec2((x0 + x1) / 2, y), vec2(x1 - x0, 0.55), col);
}

const gapCenter = (bar, t) => bar.amp * Math.sin(t * bar.speed + bar.phase);

function addBar(r) {
  const d = r.data;
  const n = d.bars.length + Math.floor(d.nextBar / BAR_STEP);
  d.bars.push({
    y: d.nextBar,
    /* L'ouverture rétrécit et glisse de plus en plus vite. */
    w: Math.max(3.2, 6.4 - n * 0.09),
    amp: Math.min(6.5, 2.2 + n * 0.22),
    speed: Math.min(2.6, 0.9 + n * 0.055),
    phase: r.rng.angle(),
    done: false,
  });
  d.nextBar += BAR_STEP;
}
