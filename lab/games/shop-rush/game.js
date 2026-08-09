/* BOUTIQUE RUSH — tenir un magasin avec un seul bouton.

   La file avance vers le comptoir. Un appui sert le client en tête : si le rayon
   est plein, c'est une vente ; s'il est vide, c'est un refus, et le refus coûte
   de la réputation. Ne rien faire, c'est attendre le réassort — en laissant la
   patience de toute la file s'écouler.

   Toute la gestion tient dans cet arbitrage : vendre, refuser, ou attendre.
   C'est une réduction assumée du genre — voir la note en fin de fichier.

   Pourquoi ce prototype : le magasin grandit à vue d'œil quand le chiffre monte.
   C'est la courbe de progression qui se filme, pas la mécanique. */

import { L, vec2, rgb, hsl, textWorld, fade, shade } from '../../engine/shell.js';

/* Le HUD du shell (score, combo) occupe le haut de l'écran, soit tout ce qui est
   au-dessus de y ≈ 11,5. La boutique se compose donc sous cette ligne, sans
   enseigne ni libellé : le titre est déjà donné par l'accroche du clip. */
const SHELF_Y = [10.5, 8.1, 5.7];
const SLOT0_Y = -6.5;
const SLOT_DY = 2.3;
const QUEUE_MAX = 5;
const COUNTER_Y = -9.4;

const PRODUCTS = [
  { name: 'CAFÉ', price: 9, hue: 0.09 },
  { name: 'FLEURS', price: 15, hue: 0.93 },
  { name: 'TECH', price: 26, hue: 0.55 },
];

/* Paliers d'agrandissement : c'est la récompense visible du clip. */
const TIERS = [
  { at: 180, cap: 6, refill: 2.5, mult: 1.3, label: 'RAYONS AGRANDIS' },
  { at: 460, cap: 8, refill: 1.9, mult: 1.7, label: 'LIVRAISON EXPRESS' },
  { at: 950, cap: 10, refill: 1.6, mult: 2.3, label: 'ENSEIGNE PREMIUM' },
];

/* La patience se réduit avec le rush : c'est le second étau, après la rupture. */
const drainRate = (r) => 0.16 + r.t * 0.009;

export default {
  meta: {
    slug: 'shop-rush',
    title: 'Boutique Rush',
    hook: 'Vendre, refuser, ou attendre',
    tagline: 'Le rayon est vide et la file s’allonge. Tu fais quoi ?',
    tags: ['gestion', 'one-button', 'rush'],
    /* La montée en charge prend ~20 s : on filme le milieu de partie, pas la
       boutique vide des premières secondes. */
    warmup: 15,
    scoreLabel: 'CHIFFRE D’AFFAIRES',
    scoreSuffix: ' €',
    palette: {
      bg: rgb(0.05, 0.04, 0.07),
      ink: rgb(1, 1, 1),
      a: hsl(0.5, 0.9, 0.62),
      b: hsl(0.98, 0.95, 0.6),
      c: hsl(0.12, 1, 0.62),
    },
  },

  reset(r) {
    const d = r.data;
    d.stock = [3, 3, 3];
    d.cap = 4;
    d.refillTime = 3.2;
    d.refill = [3.2, 3.2, 3.2];
    d.mult = 1;
    d.queue = [];
    d.spawn = 0.9;
    d.stars = 3;
    d.tier = 0;
    d.sell = 0;                 // éclat du comptoir à la vente
    d.tierFx = 0;
    d.tierName = '';
  },

  update(r) {
    const d = r.data;
    d.sell = Math.max(0, d.sell - r.dt * 3);
    d.tierFx = Math.max(0, d.tierFx - r.dt);

    /* Réassort : chaque rayon se remplit tout seul, une unité à la fois. C'est
       le rythme du réassort contre le rythme des arrivées qui fait le jeu. */
    for (let i = 0; i < 3; i++) {
      if (d.stock[i] >= d.cap) { d.refill[i] = d.refillTime; continue; }
      d.refill[i] -= r.dt;
      if (d.refill[i] <= 0) { d.stock[i]++; d.refill[i] = d.refillTime; }
    }

    d.spawn -= r.dt;
    if (d.spawn <= 0 && d.queue.length < QUEUE_MAX) {
      d.queue.push({ y: SLOT0_Y + QUEUE_MAX * SLOT_DY + 2, want: r.rng.int(PRODUCTS.length), patience: 1, at: false });
      /* Le flux doit finir au-dessus de la cadence de réassort maximale
         (3 rayons / 1,6 s ≈ 1,9 client/s), sinon les agrandissements rendent la
         boutique imperdable et le clip n'a pas de fin. */
      d.spawn = Math.max(0.38, 1.8 - r.t * 0.055);
    }

    const drain = drainRate(r);
    for (let i = d.queue.length; i--;) {
      const c = d.queue[i];
      const target = SLOT0_Y + i * SLOT_DY;
      c.y += (target - c.y) * Math.min(1, r.dt * 4);
      c.at = Math.abs(c.y - target) < 0.3;
      /* La patience s'écoule dès l'entrée dans la boutique, qu'on avance ou non :
         c'est la longueur de la file qui doit coûter, sinon laisser s'accumuler
         six clients ne se paie jamais. Celui au comptoir s'use plus vite, c'est
         lui qui bloque tous les autres. */
      c.patience -= drain * r.dt * (i === 0 ? 1.3 : 1);
      if (c.patience <= 0) {
        d.queue.splice(i, 1);
        d.stars -= 1;
        r.combo = 0;
        r.popup(vec2(0, c.y), 'PARTI !', r.palette.b, 1.3);
        r.burst(vec2(0, c.y), r.palette.b, 26, { speed: 9 });
        r.impact(1.4);
        r.flash(0.18);
        if (!r.cfg.mute) r.sfx.fail.play();
        if (d.stars <= 0) return r.gameOver();
      }
    }

    const head = d.queue[0];
    if (r.pressed && head && head.at) {
      if (d.stock[head.want] > 0) {
        d.stock[head.want]--;
        const p = PRODUCTS[head.want];
        /* Le pourboire récompense le client servi vite : sur-visiter la file
           rapporte plus que de la vider mollement. */
        const tip = p.price * 0.5 * head.patience;
        const gain = Math.round((p.price + tip) * d.mult);
        r.combo++;
        r.addScore(gain, vec2(0, COUNTER_Y + 2.6));
        d.queue.shift();
        d.sell = 1;
        r.impact(0.45);
        r.glow(0.3);
        r.burst(vec2(0, COUNTER_Y + 1.4), hsl(p.hue, 0.9, 0.62), 18, { speed: 7 });
        if (!r.cfg.mute) r.sfx.score.play();
      } else {
        /* Refus : moins cher qu'un départ, mais trois refus valent un départ. */
        d.queue.shift();
        d.stars -= 0.34;
        r.combo = 0;
        r.popup(vec2(0, COUNTER_Y + 2.6), 'RUPTURE', r.palette.b, 1.2);
        r.shake(0.35);
        r.aberrate(0.3);
        if (!r.cfg.mute) r.sfx.tap.play();
        if (d.stars <= 0) return r.gameOver();
      }
    }

    while (d.tier < TIERS.length && r.score >= TIERS[d.tier].at) {
      const t = TIERS[d.tier++];
      d.cap = t.cap;
      d.refillTime = t.refill;
      d.mult = t.mult;
      d.tierFx = 1.6;
      d.tierName = t.label;
      r.flash(0.3);
      r.glow(0.8);
      r.burst(vec2(0, 0), r.palette.c, 50, { speed: 12 });
      if (!r.cfg.mute) r.sfx.score.play();
    }
  },

  draw(r) {
    const d = r.data;
    const { a, b, c, ink } = r.palette;

    /* Rayons. */
    for (let i = 0; i < 3; i++) {
      const p = PRODUCTS[i];
      const col = hsl(p.hue, 0.9, 0.62);
      const y = SHELF_Y[i];
      L.drawRect(vec2(0, y - 1.05), vec2(16.4, 0.22), fade(a, 0.45));
      textWorld(p.name, vec2(-7.6, y + 0.05), 0.62, fade(ink, 0.55), 0.1, shade(0.6), 'left');

      const slots = d.cap;
      const w = 0.72, gap = 0.26;
      const total = slots * w + (slots - 1) * gap;
      const x0 = 8 - total;
      for (let k = 0; k < slots; k++) {
        const x = x0 + k * (w + gap) + w / 2;
        const filled = k < d.stock[i];
        L.drawRect(vec2(x, y), vec2(w, 1.5), filled ? col : fade(ink, 0.07));
        if (filled) L.drawRect(vec2(x, y + 0.55), vec2(w, 0.22), fade(rgb(1, 1, 1), 0.5));
      }
      /* Jauge de réassort : on voit l'unité suivante arriver. */
      if (d.stock[i] < d.cap) {
        const f = 1 - d.refill[i] / d.refillTime;
        const x = x0 + d.stock[i] * (w + gap) + w / 2;
        L.drawRect(vec2(x, y - 0.75 + f * 0.75), vec2(w, Math.max(0.05, 1.5 * f)), fade(col, 0.3));
      }
      if (d.stock[i] === 0) {
        textWorld('VIDE', vec2(4.2, y), 0.7, fade(b, 0.6 + 0.4 * Math.abs(Math.sin(r.t * 6))), 0.1, shade(0.6));
      }
    }

    /* File d'attente. */
    for (let i = d.queue.length; i--;) {
      const cu = d.queue[i];
      const col = hsl(PRODUCTS[cu.want].hue, 0.9, 0.62);
      const head = i === 0 && cu.at;
      const x = 0;
      if (head) L.drawCircle(vec2(x, cu.y), 2.3, fade(col, 0.16 + d.sell * 0.2));
      /* Corps : capsule simple, colorée par ce que le client vient chercher. */
      L.drawRect(vec2(x, cu.y - 0.35), vec2(1.5, 1.5), col);
      L.drawCircle(vec2(x, cu.y + 0.75), 0.62, col);
      L.drawRect(vec2(x, cu.y - 0.35), vec2(1.5, 0.28), fade(rgb(1, 1, 1), 0.35));

      /* Patience : barre qui vire au rouge. */
      const pw = 2.4 * Math.max(0, cu.patience);
      const pc = cu.patience > 0.5 ? a : cu.patience > 0.25 ? c : b;
      L.drawRect(vec2(x, cu.y - 1.5), vec2(2.4, 0.28), fade(ink, 0.12));
      L.drawRect(vec2(x - (2.4 - pw) / 2, cu.y - 1.5), vec2(pw, 0.28), pc);
    }

    /* Comptoir. */
    L.drawRect(vec2(0, COUNTER_Y), vec2(r.W, 0.5 + d.sell * 0.5), fade(c, 0.5 + d.sell * 0.5));
    L.drawRect(vec2(0, COUNTER_Y - 1.6), vec2(r.W, 2.8), fade(a, 0.1));
    L.drawCircle(vec2(0, COUNTER_Y - 2.6), 1.05, fade(c, 0.8));
    L.drawRect(vec2(0, COUNTER_Y - 4.4), vec2(2.4, 2.4), fade(c, 0.6));

    /* Réputation. */
    for (let i = 0; i < 3; i++) {
      const fill = L.clamp(d.stars - i, 0, 1);
      textWorld(fill > 0.6 ? '★' : fill > 0 ? '☆' : '·', vec2(-2.6 + i * 2.6, -15.4), 1.5,
        fade(fill > 0 ? c : ink, fill > 0 ? 0.9 : 0.2), 0.14, shade(0.6));
    }

    if (d.tierFx > 0) {
      const al = Math.min(1, d.tierFx * 1.6);
      textWorld(d.tierName, vec2(0, 4.2), 1.3, fade(c, al), 0.18, shade(0.75 * al));
    }
  },

  /* Pilote automatique : il vend dès qu'il peut. En rupture, il compare le délai
     de réassort au temps qu'il reste au client le plus pressé — et refuse pour
     sauver la file quand l'attente coûterait un départ. Il perd quand les
     arrivées dépassent durablement la cadence de réassort. */
  bot(r) {
    const d = r.data;
    const head = d.queue[0];
    if (!head || !head.at) return r.hold(false);
    if (d.stock[head.want] > 0) return r.tap();

    const drain = drainRate(r);
    let worst = Infinity;
    for (const cu of d.queue) worst = Math.min(worst, cu.patience / drain);
    if (d.refill[head.want] + 0.45 < worst) return r.hold(false);
    r.tap();
  },
};

/* Réduction assumée : un vrai jeu de gestion demande plusieurs décisions
   simultanées (prix, embauche, agencement), donc un pointeur et des menus. Le
   shell n'expose qu'un bouton. Tout ce qui relevait du choix multiple a donc été
   automatisé — le réassort est continu, les agrandissements se déclenchent au
   chiffre — pour concentrer la décision du joueur sur le seul arbitrage qui se
   filme bien : vendre, refuser, ou attendre. */
