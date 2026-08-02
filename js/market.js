/* Simulation de marché : marche aléatoire, retour à la moyenne, événements. */

import { ASSETS, ASSET_BY_ID, NEWS } from './data.js';
import { HISTORY_LEN } from './state.js';
import { gauss, pick } from './util.js';

export const STEP_MS = 2000;      // un point de cotation toutes les 2 s
const REVERSION = 0.0035;         // force de rappel vers le prix d'ancrage
const SHOCK_DECAY = 0.55;         // part du choc restante à chaque pas

/** Fait avancer un actif d'un pas. */
function stepAsset(a, st) {
  const anchor = a.start;
  const pull = REVERSION * Math.log(anchor / st.p);      // évite les dérives infinies
  const shock = st.shock || 0;
  const ret = a.drift + pull + shock + a.vol * gauss();
  st.p = Math.max(anchor * 0.02, st.p * (1 + ret));
  st.shock = Math.abs(shock) < 1e-5 ? 0 : shock * SHOCK_DECAY;
}

/** Fait avancer tout le marché d'un pas et enregistre l'historique. */
export function stepMarket(s, record = true) {
  for (const a of ASSETS) {
    const st = s.assets[a.id];
    stepAsset(a, st);
    if (record) {
      st.hist.push(st.p);
      if (st.hist.length > HISTORY_LEN) st.hist.shift();
    }
  }
}

/** Rattrape le marché après une absence (nombre de pas borné). */
export function fastForward(s, seconds) {
  const steps = Math.min(Math.floor(seconds / (STEP_MS / 1000)), 400);
  for (let i = 0; i < steps; i++) stepMarket(s, i % 5 === 0);
  return steps;
}

/** Applique un événement d'actualité ; renvoie son texte. */
export function fireNews(s) {
  const n = pick(NEWS);
  for (const a of ASSETS) {
    if (a.kind !== n.kind) continue;
    if (n.sector && a.sector !== n.sector) continue;
    if (a.sector === 'Stablecoin') continue;            // le stablecoin ne bouge pas
    const st = s.assets[a.id];
    const amp = n.sector ? 1 : 0.6;                      // choc large = plus dilué
    st.shock = (st.shock || 0) + (n.shock * amp) / 3;    // étalé sur quelques pas
  }
  return n.text;
}

/** Variation en % sur la fenêtre d'historique conservée. */
export function change(st) {
  const first = st.hist[0] || st.p;
  return ((st.p - first) / first) * 100;
}

/** Plus haut / plus bas sur la fenêtre. */
export function range(st) {
  let lo = Infinity, hi = -Infinity;
  for (const v of st.hist) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (!isFinite(lo)) { lo = st.p; hi = st.p; }
  return { lo, hi };
}

/** Plus-value latente d'une position. */
export function unrealized(id, st) {
  if (!st.q) return { value: 0, pnl: 0, pct: 0 };
  const value = st.q * st.p;
  const cost = st.q * st.avg;
  return { value, pnl: value - cost, pct: cost > 0 ? ((value - cost) / cost) * 100 : 0 };
}

export const assetsOf = (kind) => ASSETS.filter((a) => a.kind === kind);
export { ASSET_BY_ID };
