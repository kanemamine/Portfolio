/* Briques d'interface : toasts, feuille modale, graphiques, retours haptiques. */

import { $ } from './util.js';

/* ---------------- Toasts ---------------- */
const toasts = $('#toasts');

export function toast(msg, kind = '') {
  if (!toasts) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  toasts.appendChild(el);
  if (toasts.children.length > 3) toasts.firstElementChild.remove();
  setTimeout(() => el.remove(), 2800);
}

/** Petit gain flottant à l'endroit du tap. */
export function floatGain(x, y, text) {
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.transform = 'translate(-50%,-100%)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

/* Les navigateurs refusent la vibration tant que l'utilisateur n'a pas interagi. */
let interacted = false;
document.addEventListener('pointerdown', () => { interacted = true; }, { once: true, capture: true });

export function vibrate(ms = 8) {
  if (!interacted || !navigator.vibrate) return;
  try { navigator.vibrate(ms); } catch (e) { /* ignore */ }
}

/* ---------------- Feuille modale ---------------- */
const wrap = $('#sheet-wrap');
const sheet = $('#sheet');
let onClose = null;

export function openSheet(html, closeCb = null) {
  sheet.innerHTML = '<div class="sheet-grip"></div>' + html;
  wrap.hidden = false;
  onClose = closeCb;
}

export function closeSheet() {
  wrap.hidden = true;
  sheet.innerHTML = '';
  const cb = onClose; onClose = null;
  if (cb) cb();
}

export const sheetOpen = () => !wrap.hidden;
export const sheetEl = () => sheet;

wrap.addEventListener('click', (e) => {
  if (e.target.dataset.close || e.target.closest('[data-close]')) closeSheet();
});

/* ---------------- Graphiques ---------------- */

function prep(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function bounds(data) {
  let lo = Infinity, hi = -Infinity;
  for (const v of data) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  if (hi - lo < 1e-9) { hi = lo + Math.max(1e-9, Math.abs(lo) * 0.01); }
  return { lo, hi };
}

/** Mini courbe sans axes. */
export function sparkline(canvas, data, up) {
  if (!canvas || !data || data.length < 2) return;
  const { ctx, w, h } = prep(canvas);
  const { lo, hi } = bounds(data);
  const pad = 2;
  const x = (i) => (i / (data.length - 1)) * w;
  const y = (v) => h - pad - ((v - lo) / (hi - lo)) * (h - pad * 2);

  ctx.beginPath();
  ctx.moveTo(x(0), y(data[0]));
  for (let i = 1; i < data.length; i++) ctx.lineTo(x(i), y(data[i]));
  ctx.strokeStyle = up ? '#35d07f' : '#ff5f6d';
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Graphique détaillé avec dégradé et ligne de prix moyen. */
export function chart(canvas, data, up, avgLine = 0) {
  if (!canvas || !data || data.length < 2) return;
  const { ctx, w, h } = prep(canvas);
  const all = avgLine > 0 ? data.concat([avgLine]) : data;
  const { lo, hi } = bounds(all);
  const pad = 8;
  const x = (i) => (i / (data.length - 1)) * w;
  const y = (v) => h - pad - ((v - lo) / (hi - lo)) * (h - pad * 2);
  const color = up ? '#35d07f' : '#ff5f6d';

  // grille
  ctx.strokeStyle = 'rgba(255,255,255,.06)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const gy = (h / 4) * i;
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
  }

  // remplissage
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, up ? 'rgba(53,208,127,.35)' : 'rgba(255,95,109,.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < data.length; i++) ctx.lineTo(x(i), y(data[i]));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // prix de revient
  if (avgLine > 0) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(242,201,76,.75)';
    ctx.beginPath(); ctx.moveTo(0, y(avgLine)); ctx.lineTo(w, y(avgLine)); ctx.stroke();
    ctx.setLineDash([]);
  }

  // courbe
  ctx.beginPath();
  ctx.moveTo(x(0), y(data[0]));
  for (let i = 1; i < data.length; i++) ctx.lineTo(x(i), y(data[i]));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // point courant
  ctx.beginPath();
  ctx.arc(x(data.length - 1), y(data[data.length - 1]), 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
