/* ORB MERGE — deux orbes identiques n'en font qu'une, plus grosse.

   Le largueur balaie le haut du bocal, un appui lâche l'orbe. Deux orbes de même
   rang fusionnent, et la fusion en déclenche souvent d'autres. Le bocal déborde,
   la partie s'arrête.

   Pourquoi ce prototype : c'est le genre le plus regardé du format court — la
   réaction en chaîne se comprend sans règle et donne un pic d'émotion gratuit.

   La physique est faite maison (cercles, résolution par position) plutôt que via
   Box2D : une cinquantaine de lignes, déterministe, et sans 470 Ko de wasm. */

import { L, vec2, rgb, hsl, textWorld, fade, shade } from '../../engine/shell.js';

/* Bocal volontairement compact : il doit se remplir vite et visiblement. Un
   bocal qui occupe toute la hauteur ne montre qu'un fond d'écran vide. */
const JAR_W = 11;          // largeur intérieure
const JAR_H = 16;          // hauteur intérieure
const GRAVITY = 42;
const RESTITUTION = 0.18;
const ITER = 4;            // itérations de résolution des contacts
const MAX_LEVEL = 8;
/* Rangs pouvant sortir du largueur. Attention : `rng.int(n)` tire dans [0, n[ —
   voir la note sur les bornes dans lab/README.md. */
const DROP_LEVELS = 4;

const radiusOf = (lvl) => 0.8 + lvl * 0.5;
const colorOf = (lvl) => hsl((0.02 + lvl * 0.108) % 1, 0.85, 0.62);

export default {
  meta: {
    slug: 'orb-merge',
    title: 'Orb Merge',
    hook: 'Deux pareilles fusionnent',
    tagline: 'Une chaîne bien placée et tout le bocal s’allume.',
    tags: ['merge', 'physique', 'chaîne'],
    palette: {
      bg: rgb(0.05, 0.04, 0.09),
      ink: rgb(1, 1, 1),
      a: hsl(0.6, 0.9, 0.62),
      b: hsl(0.95, 0.9, 0.62),
      c: hsl(0.13, 1, 0.6),
    },
  },

  reset(r) {
    const d = r.data;
    d.orbs = [];
    d.floor = r.bottom + 3;
    d.jarTop = d.floor + JAR_H;
    d.danger = d.jarTop - 1.2;
    d.dropY = d.jarTop + 3.4;
    d.x = 0;
    d.dir = 1;
    d.level = r.rng.int(DROP_LEVELS);
    d.nextLevel = r.rng.int(DROP_LEVELS);
    d.cooldown = 0;
    d.overflow = 0;
    d.chain = 0;
    d.chainTimer = 0;
  },

  update(r) {
    const d = r.data;
    const halfJar = JAR_W / 2;

    /* Largueur : balayage borné par le rayon de l'orbe courante. */
    const rad = radiusOf(d.level);
    d.x += d.dir * 9 * r.dt;
    if (d.x > halfJar - rad) { d.x = halfJar - rad; d.dir = -1; }
    if (d.x < -halfJar + rad) { d.x = -halfJar + rad; d.dir = 1; }

    d.cooldown = Math.max(0, d.cooldown - r.dt);
    if (r.pressed && d.cooldown === 0) {
      d.orbs.push({ x: d.x, y: d.dropY, vx: 0, vy: -2, lvl: d.level, born: r.t });
      d.level = d.nextLevel;
      d.nextLevel = r.rng.int(DROP_LEVELS);
      d.cooldown = 0.22;
      if (!r.cfg.mute) r.sfx.tap.play();
    }

    /* Intégration. */
    for (const o of d.orbs) {
      o.vy -= GRAVITY * r.dt;
      o.x += o.vx * r.dt;
      o.y += o.vy * r.dt;
      o.vx *= Math.pow(0.2, r.dt);
    }

    /* Contacts : résolution par position, plusieurs passes pour tasser la pile. */
    for (let k = 0; k < ITER; k++) {
      for (const o of d.orbs) {
        const rad2 = radiusOf(o.lvl);
        if (o.y - rad2 < d.floor) { o.y = d.floor + rad2; o.vy = Math.max(0, -o.vy * RESTITUTION); }
        if (o.x - rad2 < -halfJar) { o.x = -halfJar + rad2; o.vx = Math.abs(o.vx) * RESTITUTION; }
        if (o.x + rad2 > halfJar) { o.x = halfJar - rad2; o.vx = -Math.abs(o.vx) * RESTITUTION; }
      }
      for (let i = 0; i < d.orbs.length; i++) {
        for (let j = i + 1; j < d.orbs.length; j++) {
          const a = d.orbs[i], b = d.orbs[j];
          const ra = radiusOf(a.lvl), rb = radiusOf(b.lvl);
          let dx = b.x - a.x, dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          const min = ra + rb;
          if (dist >= min) continue;

          if (dist < 1e-4) { dx = 0.01; dy = 0.01; dist = 0.014; }
          const nx = dx / dist, ny = dy / dist;

          if (a.lvl === b.lvl && a.lvl < MAX_LEVEL) { merge(r, i, j); return; }

          /* Répartition du recouvrement pondérée par la « masse » (le rang). */
          const push = (min - dist) * 0.5;
          const ma = ra * ra, mb = rb * rb, tot = ma + mb;
          a.x -= nx * push * (mb / tot) * 2; a.y -= ny * push * (mb / tot) * 2;
          b.x += nx * push * (ma / tot) * 2; b.y += ny * push * (ma / tot) * 2;

          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const imp = -rel * (1 + RESTITUTION) * 0.5;
            a.vx -= nx * imp; a.vy -= ny * imp;
            b.vx += nx * imp; b.vy += ny * imp;
          }
        }
      }
    }

    /* Débordement : il faut rester au-dessus de la ligne un moment, pour ne pas
       tuer sur un simple rebond. */
    const over = d.orbs.some((o) => o.y - radiusOf(o.lvl) > d.danger && r.t - o.born > 0.8 && Math.abs(o.vy) < 3);
    d.overflow = over ? d.overflow + r.dt : 0;
    if (d.overflow > 1.1) {
      for (const o of d.orbs) r.burst(vec2(o.x, o.y), colorOf(o.lvl), 8, { speed: 9 });
      r.impact(2);
      r.gameOver();
    }

    d.chainTimer = Math.max(0, d.chainTimer - r.dt);
    if (d.chainTimer === 0) { d.chain = 0; r.combo = 0; }
  },

  draw(r) {
    const d = r.data;
    const half = JAR_W / 2;
    const { a, c, ink } = r.palette;

    /* Bocal. */
    const wall = fade(a, 0.5);
    const midY = (d.floor + d.jarTop) / 2;
    L.drawRect(vec2(-half - 0.25, midY), vec2(0.35, JAR_H), wall);
    L.drawRect(vec2(half + 0.25, midY), vec2(0.35, JAR_H), wall);
    L.drawRect(vec2(0, d.floor - 0.25), vec2(JAR_W + 0.9, 0.4), wall);

    /* Ligne de débordement : clignote quand elle est menacée. */
    const alert = d.overflow > 0 ? 0.35 + 0.45 * Math.abs(Math.sin(r.t * 12)) : 0.16;
    L.drawLine(vec2(-half, d.danger), vec2(half, d.danger), 0.07, fade(r.palette.b, alert));

    for (const o of d.orbs) orb(o.x, o.y, radiusOf(o.lvl), o.lvl);

    /* Largueur : l'orbe en attente et sa ligne de visée. */
    const rad = radiusOf(d.level);
    L.drawLine(vec2(d.x, d.dropY - rad), vec2(d.x, d.floor), 0.05, fade(ink, 0.18));
    orb(d.x, d.dropY, rad, d.level);

    /* Aperçu placé hors du bocal, à droite : ne croise ni le score ni le largueur. */
    const px = (r.right + half) / 2;
    textWorld('SUIVANTE', vec2(px, d.dropY + 1.8), 0.55, fade(ink, 0.5));
    orb(px, d.dropY, radiusOf(d.nextLevel) * 0.75, d.nextLevel);

    if (d.chain > 1) {
      textWorld('CHAÎNE ×' + d.chain, vec2(0, d.danger + 1.6), 1.3, c, 0.16, shade(0.7));
    }
  },

  /* Pilote automatique : cherche une orbe de même rang à viser, sinon la colonne
     la plus basse. Il lâche quand le balayage passe devant la cible. */
  bot(r) {
    const d = r.data;
    if (d.cooldown > 0) return r.hold(false);

    let target = null;
    let bestY = Infinity;
    for (const o of d.orbs) {
      if (o.lvl !== d.level) continue;
      if (o.y < bestY) { bestY = o.y; target = o.x; }
    }
    if (target === null) {
      /* Aucune fusion possible : on remplit le côté le moins haut. */
      let leftTop = -99, rightTop = -99;
      for (const o of d.orbs) {
        const top = o.y + radiusOf(o.lvl);
        if (o.x < 0) leftTop = Math.max(leftTop, top);
        else rightTop = Math.max(rightTop, top);
      }
      target = leftTop < rightTop ? -JAR_W / 4 : JAR_W / 4;
    }

    const ahead = d.x + d.dir * 9 * r.dt;
    if (Math.abs(ahead - target) < Math.abs(d.x - target)) return r.hold(false);
    r.tap();
  },
};

function orb(x, y, rad, lvl) {
  const col = colorOf(lvl);
  L.drawCircle(vec2(x, y), rad * 1.35, fade(col, 0.18));
  L.drawCircle(vec2(x, y), rad, col);
  /* Reflet : donne du volume sans texture. */
  L.drawCircle(vec2(x - rad * 0.32, y + rad * 0.34), rad * 0.24, fade(rgb(1, 1, 1), 0.5));
}

function merge(r, i, j) {
  const d = r.data;
  const a = d.orbs[i], b = d.orbs[j];
  const lvl = a.lvl + 1;
  const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;

  /* On retire l'indice le plus grand en premier : sinon le second glisse. */
  d.orbs.splice(Math.max(i, j), 1);
  d.orbs.splice(Math.min(i, j), 1);
  d.orbs.push({ x, y, vx: (a.vx + b.vx) / 2, vy: 1.2, lvl, born: r.t });

  d.chain++;
  d.chainTimer = 0.55;
  r.combo = d.chain;
  r.addScore(lvl * 3 * Math.min(6, d.chain), vec2(x, y));
  r.impact(0.4 + lvl * 0.12);
  r.glow(0.25 + lvl * 0.08);
  r.burst(vec2(x, y), colorOf(lvl), 14 + lvl * 4, { speed: 5 + lvl, size: 0.35 });
  if (!r.cfg.mute) r.sfx.score.play();
}
