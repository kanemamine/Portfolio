/* STACK TOWER — poser une brique au bon moment.

   La brique balaie l'écran, un appui la lâche. Ce qui dépasse tombe : la tour
   se rétrécit à chaque erreur. Un poser parfait ne coûte rien et allume le combo.

   Pourquoi ce prototype : la règle est visible sans un mot, et la tour qui monte
   donne une courbe de tension lisible en trois secondes de vidéo. */

import { L, vec2, rgb, hsl, textWorld, fade, shade } from '../../engine/shell.js';

const BLOCK_H = 1.6;
const PERFECT = 0.22;

export default {
  meta: {
    slug: 'stack-tower',
    title: 'Stack Tower',
    hook: 'Lâche au bon moment',
    tagline: 'Un pixel de trop et la tour rétrécit.',
    tags: ['timing', 'one-button', 'arcade'],
    palette: {
      bg: rgb(0.04, 0.04, 0.07),
      ink: rgb(1, 1, 1),
      a: hsl(0.47, 0.9, 0.6),
      b: hsl(0.03, 0.95, 0.62),
      c: hsl(0.11, 1, 0.6),
    },
  },

  reset(r) {
    const d = r.data;
    d.tower = [{ x: 0, w: 7, y: r.bottom + 3, hue: 0 }];
    d.chips = [];
    d.camY = 0;
    d.perfects = 0;
    next(r);
  },

  update(r) {
    const d = r.data;
    const m = d.moving;

    /* Balayage en va-et-vient, borné par les murs. */
    m.x += m.dir * m.speed * r.dt;
    if (m.x > r.right - m.w / 2) { m.x = r.right - m.w / 2; m.dir = -1; }
    if (m.x < r.left + m.w / 2) { m.x = r.left + m.w / 2; m.dir = 1; }

    if (r.pressed) drop(r);

    /* La caméra suit la tour dès qu'elle dépasse le milieu de l'écran. */
    const top = d.tower[d.tower.length - 1].y;
    const want = Math.max(0, top - 2);
    d.camY += (want - d.camY) * Math.min(1, r.dt * 5);

    for (let i = d.chips.length; i--;) {
      const c = d.chips[i];
      c.vy -= 34 * r.dt;
      c.y += c.vy * r.dt;
      c.spin += c.vspin * r.dt;
      if (c.y - d.camY < r.bottom - 4) d.chips.splice(i, 1);
    }
  },

  draw(r) {
    const d = r.data;
    const { c, ink } = r.palette;

    /* On ne dessine que la portion visible : une tour de 400 briques reste fluide. */
    for (let i = d.tower.length - 1; i >= 0; i--) {
      const t = d.tower[i];
      const y = t.y - d.camY;
      if (y < r.bottom - 2) break;
      block(vec2(t.x, y), t.w, hueColor(t.hue), i === d.tower.length - 1);
    }

    for (const ch of d.chips) {
      L.drawRect(vec2(ch.x, ch.y - d.camY), vec2(ch.w, BLOCK_H), fade(hueColor(ch.hue), 0.55), ch.spin);
    }

    const m = d.moving;
    block(vec2(m.x, m.y - d.camY), m.w, c, true);

    /* Repère d'alignement : rend le « poser parfait » lisible à l'image. */
    const prev = d.tower[d.tower.length - 1];
    const py = prev.y - d.camY;
    L.drawLine(vec2(prev.x, py + BLOCK_H / 2), vec2(prev.x, m.y - d.camY - BLOCK_H / 2), 0.06, fade(ink, 0.25));

    if (d.perfects > 0) {
      textWorld('PARFAIT ×' + d.perfects, vec2(0, m.y - d.camY + 2.6), 1.1, c, 0.14, shade(0.7));
    }
  },

  /* Pilote automatique : vise l'alignement, avec une erreur qui croît avec la
     vitesse. Sans cette erreur le bot ne perdrait jamais et le clip n'aurait
     aucune fin. */
  bot(r) {
    const d = r.data;
    const m = d.moving;
    const prev = d.tower[d.tower.length - 1];
    const ahead = m.x + m.dir * m.speed * r.dt;
    const aim = prev.x + m.bias;
    /* Tant que la frame suivante rapproche du but, on attend. */
    if (Math.abs(ahead - aim) < Math.abs(m.x - aim)) return r.hold(false);
    r.tap();
  },
};

/** Dégradé cyclique le long de la tour : chaque étage se distingue du précédent. */
function hueColor(h) {
  return hsl(L.lerp(0.47, 0.95, (Math.sin(h * 0.35) + 1) / 2), 0.85, 0.6);
}

function block(pos, w, color, bright) {
  L.drawRect(pos, vec2(w + 0.5, BLOCK_H + 0.5), fade(color, bright ? 0.28 : 0.14));
  L.drawRect(pos, vec2(w, BLOCK_H), color);
  L.drawRect(pos.add(vec2(0, BLOCK_H / 2 - 0.1)), vec2(w, 0.2), fade(rgb(1, 1, 1), 0.55));
}

function next(r) {
  const d = r.data;
  const prev = d.tower[d.tower.length - 1];
  const n = d.tower.length;
  d.moving = {
    x: (n % 2 ? r.left : r.right) * 0.9,
    y: prev.y + BLOCK_H,
    w: prev.w,
    dir: n % 2 ? 1 : -1,
    speed: Math.min(20, 7 + n * 0.42),
    /* Erreur de visée du bot, proportionnelle à la vitesse. */
    bias: r.rng.float(-1, 1) * (0.012 * Math.min(20, 7 + n * 0.42)),
  };
}

function drop(r) {
  const d = r.data;
  const m = d.moving;
  const prev = d.tower[d.tower.length - 1];

  const left = Math.max(m.x - m.w / 2, prev.x - prev.w / 2);
  const right = Math.min(m.x + m.w / 2, prev.x + prev.w / 2);
  const overlap = right - left;

  if (overlap <= 0.05) {
    d.chips.push({ x: m.x, y: m.y, w: m.w, hue: d.tower.length, vy: 0, spin: 0, vspin: r.rng.float(-4, 4) });
    r.burst(vec2(m.x, m.y - d.camY), r.palette.b, 40, { speed: 12 });
    r.impact(2);
    return r.gameOver();
  }

  const dx = m.x - prev.x;
  const perfect = Math.abs(dx) < PERFECT;

  if (perfect) {
    /* Récompense franche : aucune perte de largeur, combo, et retour visuel fort. */
    d.perfects++;
    r.combo = d.perfects;
    r.addScore(2 + Math.min(8, d.perfects), vec2(prev.x, m.y - d.camY));
    r.impact(0.8);
    r.glow(0.7);
    r.burst(vec2(prev.x, m.y - d.camY), r.palette.c, 26, { speed: 7, cone: Math.PI, gravity: -0.2 });
    if (!r.cfg.mute) r.sfx.score.play();
    d.tower.push({ x: prev.x, w: prev.w, y: m.y, hue: d.tower.length });
  } else {
    d.perfects = 0;
    r.combo = 0;
    r.addScore(1);
    r.impact(0.35);
    if (!r.cfg.mute) r.sfx.tap.play();
    /* Le morceau qui dépasse tombe : la perte est montrée, pas seulement comptée. */
    const chipW = m.w - overlap;
    const chipX = dx > 0 ? right + chipW / 2 : left - chipW / 2;
    d.chips.push({ x: chipX, y: m.y, w: chipW, hue: d.tower.length, vy: 2, spin: 0, vspin: r.rng.float(-6, 6) });
    d.tower.push({ x: (left + right) / 2, w: overlap, y: m.y, hue: d.tower.length });
  }

  next(r);
}
