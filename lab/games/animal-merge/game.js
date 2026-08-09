/* ZOO FUSION — deux mêmes animaux n'en font qu'un plus gros.

   Le largueur balaie le haut de la caisse, un appui lâche l'animal. Deux animaux
   identiques fusionnent en l'animal du rang au-dessus, et une fusion en déclenche
   souvent d'autres. La caisse déborde, la partie s'arrête.

   Le sujet fait tout le travail : personne n'a besoin qu'on lui explique qu'un
   lapin est plus petit qu'un éléphant. La règle se comprend sans texte, ce qui
   est la seule chose qui compte sur une vidéo de vingt secondes.

   La physique (cercles, résolution par position) est celle de la version
   précédente — elle marchait. Ce qui change, c'est tout le reste : de vrais
   personnages au lieu de disques colorés, de la matière (écrasement à l'impact),
   un décor qui situe la scène, et du son.

   Art : Kenney Animal Pack, CC0 — voir lab/art/animals/LICENCE.txt */

import { L, vec2, rgb, hsl, textWorld, fade, shade } from '../../engine/shell.js';

const JAR_W = 11;
const JAR_H = 19;
const GRAVITY = 42;
const RESTITUTION = 0.18;
const ITER = 4;
const DROP_LEVELS = 4;

/* Neuf rangs, dans l'ordre de taille de l'animal réel.
   `artW` : largeur du sprite rapportée au diamètre physique.
   `anchorY` : remontée du sprite pour que sa partie ronde — la tête — tombe sur
   le centre du cercle, et non le centre de l'image. Un lapin a des oreilles, une
   girafe des cornes : sans ce décalage, les animaux flottent au-dessus du sol. */
const ANIMALS = [
  { key: 'parrot', name: 'PERROQUET', artW: 1.12, anchorY: 0.03 },
  { key: 'rabbit', name: 'LAPIN', artW: 1.06, anchorY: 0.20 },
  { key: 'penguin', name: 'PINGOUIN', artW: 1.10, anchorY: 0.03 },
  { key: 'monkey', name: 'SINGE', artW: 1.16, anchorY: 0.00 },
  { key: 'pig', name: 'COCHON', artW: 1.16, anchorY: 0.00 },
  { key: 'panda', name: 'PANDA', artW: 1.16, anchorY: 0.00 },
  { key: 'hippo', name: 'HIPPO', artW: 1.12, anchorY: 0.02 },
  { key: 'giraffe', name: 'GIRAFE', artW: 1.06, anchorY: 0.12 },
  { key: 'elephant', name: 'ÉLÉPHANT', artW: 1.18, anchorY: 0.00 },
];
const MAX_LEVEL = ANIMALS.length - 1;

const radiusOf = (lvl) => 0.78 + lvl * 0.42;

let SFX = null;

export default {
  meta: {
    slug: 'animal-merge',
    title: 'Zoo Fusion',
    hook: 'Deux pareils, un plus gros',
    tagline: 'Du perroquet à l’éléphant. Une chaîne bien placée et la caisse explose.',
    tags: ['fusion', 'physique', 'animaux'],
    cta: 'JOUE GRATUITEMENT · LIEN EN BIO',
    /* Le clip démarre sur une caisse déjà garnie. Filmée depuis le début, la
       partie ouvre sur une caisse vide : l'accroche s'afficherait sur un décor
       inerte, et c'est la première seconde qui décide du partage. */
    warmup: 9,

    sprites: Object.fromEntries(ANIMALS.map((a) => [a.key, `animals/${a.key}.png`])),

    /* Dosage sobre : le post-traitement néon d'origine délavait les sprites.
       Un peu de halo sur les éclats de fusion, rien de plus. */
    fx: { bloom: 0.14, bloomRadius: 18, aberration: 0.35, scanlines: 0, vignette: 0.3, saturation: 1.04 },

    palette: {
      bg: rgb(0.10, 0.13, 0.20),
      ink: rgb(1, 1, 1),
      a: hsl(0.09, 0.55, 0.55),
      b: hsl(0.99, 0.85, 0.62),
      c: hsl(0.13, 1, 0.6),
    },
  },

  reset(r) {
    const d = r.data;
    if (!SFX) {
      SFX = {
        /* Choc mat : le volume suivra la vitesse d'impact, le ton la taille. */
        bounce: r.makeSfx([0.7, , 160, , 0.01, 0.05, 1, 1.6, , , , , , 1.8, , , , 0.5, 0.02]),
        merge: r.makeSfx([1.1, , 480, 0.01, 0.05, 0.13, , 1.7, , , 220, 0.03, , , , , , 0.7, 0.02]),
        drop: r.makeSfx([0.5, , 300, , 0.01, 0.04, 1, 1.4, , , , , , , , , , 0.5, 0.02]),
      };
    }
    d.animals = [];
    /* La caisse est calée haut : le HUD du shell occupe le sommet, l'échelle
       des rangs occupe le pied, la caisse prend tout ce qu'il reste. */
    d.floor = r.bottom + 4.2;
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
    d.best = 0;             // plus haut rang atteint, montré en bas
    d.loudest = 0;          // choc le plus violent de l'image courante
    d.loudestLvl = 0;
  },

  update(r) {
    const d = r.data;
    const halfJar = JAR_W / 2;

    const rad = radiusOf(d.level);
    d.x += d.dir * 9 * r.dt;
    if (d.x > halfJar - rad) { d.x = halfJar - rad; d.dir = -1; }
    if (d.x < -halfJar + rad) { d.x = -halfJar + rad; d.dir = 1; }

    d.cooldown = Math.max(0, d.cooldown - r.dt);
    if (r.pressed && d.cooldown === 0) {
      d.animals.push(makeAnimal(d.x, d.dropY, d.level, r.t));
      d.level = d.nextLevel;
      d.nextLevel = r.rng.int(DROP_LEVELS);
      d.cooldown = 0.22;
      SFX.drop.play(0.6);
    }

    for (const o of d.animals) {
      o.vy -= GRAVITY * r.dt;
      o.x += o.vx * r.dt;
      o.y += o.vy * r.dt;
      o.vx *= Math.pow(0.2, r.dt);
      /* Écrasement : c'est ce qui donne l'illusion de matière. Bien plus que les
         particules — un disque parfaitement rigide ne pèse rien à l'œil. */
      o.squash = Math.max(0, o.squash - r.dt * 4.5);
      o.pop = Math.max(0, o.pop - r.dt * 3.2);
    }

    for (let k = 0; k < ITER; k++) {
      for (const o of d.animals) {
        const ra = radiusOf(o.lvl);
        if (o.y - ra < d.floor) {
          if (k === 0) hit(d, o, Math.abs(o.vy));
          o.y = d.floor + ra;
          o.vy = Math.max(0, -o.vy * RESTITUTION);
        }
        if (o.x - ra < -halfJar) { o.x = -halfJar + ra; o.vx = Math.abs(o.vx) * RESTITUTION; }
        if (o.x + ra > halfJar) { o.x = halfJar - ra; o.vx = -Math.abs(o.vx) * RESTITUTION; }
      }
      for (let i = 0; i < d.animals.length; i++) {
        for (let j = i + 1; j < d.animals.length; j++) {
          const a = d.animals[i], b = d.animals[j];
          const ra = radiusOf(a.lvl), rb = radiusOf(b.lvl);
          let dx = b.x - a.x, dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          const min = ra + rb;
          if (dist >= min) continue;

          if (dist < 1e-4) { dx = 0.01; dy = 0.01; dist = 0.014; }
          const nx = dx / dist, ny = dy / dist;

          if (a.lvl === b.lvl && a.lvl < MAX_LEVEL) { merge(r, i, j); return; }

          const push = (min - dist) * 0.5;
          const ma = ra * ra, mb = rb * rb, tot = ma + mb;
          a.x -= nx * push * (mb / tot) * 2; a.y -= ny * push * (mb / tot) * 2;
          b.x += nx * push * (ma / tot) * 2; b.y += ny * push * (ma / tot) * 2;

          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            if (k === 0) { hit(d, a, -rel * 0.5); hit(d, b, -rel * 0.5); }
            const imp = -rel * (1 + RESTITUTION) * 0.5;
            a.vx -= nx * imp; a.vy -= ny * imp;
            b.vx += nx * imp; b.vy += ny * imp;
          }
        }
      }
    }

    const over = d.animals.some((o) => o.y - radiusOf(o.lvl) > d.danger && r.t - o.born > 0.8 && Math.abs(o.vy) < 3);
    d.overflow = over ? d.overflow + r.dt : 0;
    if (d.overflow > 1.1) {
      for (const o of d.animals) r.burst(vec2(o.x, o.y), r.palette.c, 8, { speed: 9 });
      r.impact(2);
      r.gameOver();
    }

    d.chainTimer = Math.max(0, d.chainTimer - r.dt);
    if (d.chainTimer === 0) { d.chain = 0; r.combo = 0; }

    /* Le son des chocs est émis une fois par image, pour le plus violent : sinon
       une pile qui se tasse produit trente sons par seconde. */
    if (d.loudest > 0.6) {
      SFX.bounce.play(Math.min(0.55, d.loudest * 0.06), 1 + (1 - d.loudestLvl / MAX_LEVEL) * 0.5);
    }
    d.loudest = 0;
  },

  /* Décor : une chambre d'enfant en fin de journée. Chaud, lisible, et surtout
     pas la grille néon partagée par tous les autres prototypes. */
  background(r) {
    const top = rgb(0.13, 0.16, 0.26);
    const bot = rgb(0.24, 0.20, 0.26);
    const bands = 22;
    for (let i = 0; i < bands; i++) {
      const f = i / (bands - 1);
      const y = r.bottom + f * (r.H + 2);
      L.drawRect(vec2(0, y), vec2(r.W, r.H / bands + 0.6),
        rgb(L.lerp(bot.r, top.r, f), L.lerp(bot.g, top.g, f), L.lerp(bot.b, top.b, f)));
    }
    /* Halo derrière la caisse : concentre l'œil au centre de l'action. */
    const d = r.data;
    const midY = (d.floor + d.jarTop) / 2;
    L.drawCircle(vec2(0, midY), JAR_W * 1.15, fade(rgb(1, 0.85, 0.6), 0.05));
    L.drawCircle(vec2(0, midY), JAR_W * 0.8, fade(rgb(1, 0.85, 0.6), 0.04));
  },

  draw(r) {
    const d = r.data;
    const half = JAR_W / 2;
    const { c, ink } = r.palette;

    /* Caisse en bois : deux montants, un fond, quelques planches. */
    const wood = rgb(0.55, 0.36, 0.22);
    const woodLight = rgb(0.68, 0.46, 0.29);
    const midY = (d.floor + d.jarTop) / 2;
    for (const s of [-1, 1]) {
      L.drawRect(vec2(s * (half + 0.45), midY), vec2(0.9, JAR_H), wood);
      L.drawRect(vec2(s * (half + 0.45), midY), vec2(0.28, JAR_H), fade(woodLight, 0.7));
    }
    L.drawRect(vec2(0, d.floor - 0.55), vec2(JAR_W + 1.8, 1.1), wood);
    L.drawRect(vec2(0, d.floor - 0.2), vec2(JAR_W + 1.8, 0.22), fade(woodLight, 0.8));

    /* Ligne de débordement : discrète tant que tout va bien, alarmante ensuite. */
    const alert = d.overflow > 0 ? 0.4 + 0.5 * Math.abs(Math.sin(r.t * 12)) : 0.14;
    L.drawLine(vec2(-half, d.danger), vec2(half, d.danger), 0.08, fade(r.palette.b, alert));

    for (const o of d.animals) drawAnimal(r, o.x, o.y, o.lvl, o.squash, o.pop);

    /* Largueur : l'animal suspendu et sa ligne de visée. */
    const rad = radiusOf(d.level);
    L.drawLine(vec2(d.x, d.dropY - rad), vec2(d.x, d.floor), 0.05, fade(ink, 0.15));
    drawAnimal(r, d.x, d.dropY, d.level, 0, 0);

    /* Aperçu du suivant, hors caisse. */
    const px = (r.right + half) / 2 + 0.3;
    textWorld('SUIVANT', vec2(px, d.dropY + 1.7), 0.5, fade(ink, 0.55), 0.09, shade(0.6));
    drawAnimal(r, px, d.dropY, d.nextLevel, 0, 0, 0.62);

    if (d.chain > 1) {
      const pop = 1 + 0.25 * d.chainTimer;
      textWorld('CHAÎNE ×' + d.chain, vec2(0, d.danger + 1.8), 1.3 * pop, c, 0.16, shade(0.7));
    }

    /* Échelle des rangs, sous la caisse : montre d'un coup d'œil où on en est et
       ce qui reste à atteindre. C'est ce qui donne un but à quelqu'un qui
       découvre le jeu en trois secondes de vidéo. */
    const n = ANIMALS.length;
    const ladderY = r.bottom + 1.6;
    const step = (r.W - 2.4) / n;
    L.drawRect(vec2(0, ladderY), vec2(r.W, 2.5), fade(rgb(0, 0, 0), 0.25));
    for (let i = 0; i < n; i++) {
      const x = -((n - 1) / 2) * step + i * step;
      const reached = i <= d.best;
      drawAnimal(r, x, ladderY, i, 0, 0, 0.42, reached ? 1 : 0.2);
    }
  },

  bot(r) {
    const d = r.data;
    if (d.cooldown > 0) return r.hold(false);

    let target = null;
    let bestY = Infinity;
    for (const o of d.animals) {
      if (o.lvl !== d.level) continue;
      if (o.y < bestY) { bestY = o.y; target = o.x; }
    }
    if (target === null) {
      let leftTop = -99, rightTop = -99;
      for (const o of d.animals) {
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

function makeAnimal(x, y, lvl, t) {
  return { x, y, vx: 0, vy: -2, lvl, born: t, squash: 0, pop: 0 };
}

/** Enregistre un choc : écrasement proportionnel, et mémorise le plus violent
    de l'image pour n'émettre qu'un seul son au lieu de trente. */
function hit(d, o, speed) {
  if (speed < 1.5) return;
  o.squash = Math.min(1, Math.max(o.squash, speed / 22));
  if (speed > d.loudest) { d.loudest = speed; d.loudestLvl = o.lvl; }
}

function drawAnimal(r, x, y, lvl, squash = 0, pop = 0, scale = 1, alpha = 1) {
  const a = ANIMALS[lvl];
  const diameter = radiusOf(lvl) * 2 * scale;
  /* Écrasement à volume constant : large et bas, ou étroit et haut. */
  const s = squash * 0.32;
  const grow = 1 + pop * 0.45;
  const width = diameter * a.artW * (1 + s) * grow;
  const t = r.sprite(a.key);
  const aspect = t.size.y / (t.size.x || 1);
  const height = width * aspect * ((1 - s) / (1 + s));
  const pos = vec2(x, y + diameter * a.anchorY * grow - diameter * s * 0.5);
  L.drawTile(pos, vec2(width, height), t, alpha < 1 ? fade(rgb(1, 1, 1), alpha) : undefined);
}

function merge(r, i, j) {
  const d = r.data;
  const a = d.animals[i], b = d.animals[j];
  const lvl = a.lvl + 1;
  const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;

  d.animals.splice(Math.max(i, j), 1);
  d.animals.splice(Math.min(i, j), 1);
  const born = makeAnimal(x, y, lvl, r.t);
  born.vy = 1.2;
  born.pop = 1;
  d.animals.push(born);

  d.best = Math.max(d.best, lvl);
  d.chain++;
  d.chainTimer = 0.55;
  r.combo = d.chain;
  r.addScore(lvl * 3 * Math.min(6, d.chain), vec2(x, y));
  r.impact(0.4 + lvl * 0.12);
  r.glow(0.2 + lvl * 0.06);
  r.burst(vec2(x, y), r.palette.c, 12 + lvl * 3, { speed: 5 + lvl, size: 0.3 });
  /* Le ton monte avec le rang : l'oreille suit la progression sans y penser. */
  SFX.merge.play(0.55, 0.85 + lvl * 0.09);

  if (lvl === MAX_LEVEL) {
    r.popup(vec2(x, y + 2), 'ÉLÉPHANT !', r.palette.c, 1.6);
    r.flash(0.25);
  }
}
