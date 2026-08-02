/* Utilitaires génériques : formatage, aléatoire, DOM. */

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd'];

/** Formate un nombre en notation compacte (1.2K, 3.4M, 5.6B...). */
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n < 1000) return sign + (n < 10 ? trimZeros(n.toFixed(2)) : Math.floor(n).toString());
  const tier = Math.min(Math.floor(Math.log10(n) / 3), UNITS.length - 1);
  if (tier >= UNITS.length - 1 && n >= 1e42) return sign + n.toExponential(2);
  const scaled = n / Math.pow(1000, tier);
  return sign + trimZeros(scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0)) + UNITS[tier];
}

/** Formate un montant en dollars. */
export const money = (n) => (n < 0 ? '-$' + fmt(-n) : '$' + fmt(n));

/** Formate un prix d'actif (plus de décimales pour les petites valeurs). */
export function price(p) {
  if (p >= 1000) return '$' + fmt(p);
  if (p >= 1) return '$' + p.toFixed(2);
  if (p >= 0.01) return '$' + p.toFixed(4);
  return '$' + p.toFixed(6);
}

/** Formate une quantité d'actifs détenus. */
export const qty = (q) => (q >= 1000 ? fmt(q) : q >= 1 ? trimZeros(q.toFixed(2)) : trimZeros(q.toFixed(4)));

/** Pourcentage signé. */
export const pct = (v) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

function trimZeros(s) {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** Durée en h/m/s lisible. */
export function dur(sec) {
  sec = Math.max(0, Math.floor(sec));
  if (sec < 60) return sec + 's';
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return m + 'm ' + String(s).padStart(2, '0') + 's';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ' + String(m % 60).padStart(2, '0') + 'm';
  return Math.floor(h / 24) + 'j ' + (h % 24) + 'h';
}

/** Chronomètre court pour les cycles (3.4s). */
export const cyc = (sec) => (sec < 10 ? sec.toFixed(1) + 's' : dur(sec));

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Loi normale centrée réduite (Box-Muller). */
export function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* --- DOM --- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Échappe le HTML pour l'injection de texte. */
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
