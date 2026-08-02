/* Moteur économique : entreprises, immobilier, portefeuille, prestige. */

import {
  BUSINESSES, MILESTONES, SPEED_MILESTONES, ASSETS, ASSET_BY_ID,
  PROPERTIES, upgradeCost, propIncome, UPGRADE_MAX, UNLOCKS,
} from './data.js';
import { OFFLINE_CAP } from './state.js';

/* ---------------- Bonus globaux ---------------- */

/** Chaque actionnaire apporte +2 % de revenus. */
export const angelMult = (s) => 1 + s.angels * 0.02;

/** Multiplicateur de revenu d'une entreprise (paliers atteints). */
export function milestoneMult(owned) {
  let m = 1;
  for (const ms of MILESTONES) if (owned >= ms) m *= 2;
  return m;
}

/** Divise le temps de cycle aux paliers 25 / 50 / 100. */
export function speedDiv(owned) {
  let d = 1;
  for (const ms of SPEED_MILESTONES) if (owned >= ms) d *= 2;
  return d;
}

export const cycleTime = (b, st) => Math.max(0.1, b.time / speedDiv(st.owned));

/** Revenu d'un cycle complet. */
export const revenue = (b, st, s) =>
  b.baseRevenue * st.owned * milestoneMult(st.owned) * angelMult(s);

/** Prochain palier non atteint (pour l'affichage). */
export function nextMilestone(owned) {
  return MILESTONES.find((m) => owned < m) || null;
}

/* ---------------- Achats d'entreprises ---------------- */

/** Coût cumulé de `count` unités supplémentaires (somme géométrique). */
export function costOf(b, owned, count) {
  const r = b.costMult;
  return b.baseCost * Math.pow(r, owned) * (Math.pow(r, count) - 1) / (r - 1);
}

/** Nombre maximum d'unités achetables avec `cash`. */
export function maxAffordable(b, owned, cash) {
  const r = b.costMult;
  const unit = b.baseCost * Math.pow(r, owned);
  const ratio = 1 - (cash * (r - 1)) / unit;
  if (ratio <= 0) return Math.floor(Math.log(1e12) / Math.log(r)); // pratiquement illimité
  return Math.max(0, Math.floor(Math.log(1 / ratio) / Math.log(r)));
}

/** Résout le mode d'achat (1/10/100/'max') en quantité réelle. */
export function resolveCount(s, b, st) {
  if (s.buyMode === 'max') return Math.max(1, maxAffordable(b, st.owned, s.cash));
  return s.buyMode;
}

export function buyBusiness(s, id) {
  const b = BUSINESSES.find((x) => x.id === id);
  const st = s.businesses[id];
  let count = resolveCount(s, b, st);
  let cost = costOf(b, st.owned, count);
  if (s.buyMode === 'max') {
    const afford = maxAffordable(b, st.owned, s.cash);
    if (afford < 1) return null;
    count = afford;
    cost = costOf(b, st.owned, count);
  }
  if (s.cash < cost) return null;
  s.cash -= cost;
  st.owned += count;
  if (st.manager) st.running = true;
  return { count, cost };
}

export function hireManager(s, id) {
  const b = BUSINESSES.find((x) => x.id === id);
  const st = s.businesses[id];
  if (st.manager || s.cash < b.manager) return false;
  s.cash -= b.manager;
  st.manager = true;
  st.running = st.owned > 0;
  return true;
}

/** Lance un cycle manuel (entreprise sans manager). */
export function startCycle(s, id) {
  const st = s.businesses[id];
  if (st.owned <= 0 || st.running) return false;
  st.running = true;
  return true;
}

/* ---------------- Boucle de production ---------------- */

/**
 * Fait avancer toutes les entreprises de `dt` secondes.
 * Forme fermée (pas de boucle par cycle) pour supporter les longues absences.
 * @returns {number} montant encaissé
 */
export function tickBusinesses(s, dt, offline = false) {
  let earned = 0;
  for (const b of BUSINESSES) {
    const st = s.businesses[b.id];
    if (st.owned <= 0) continue;
    if (st.manager) st.running = true;
    if (!st.running) continue;
    if (offline && !st.manager) continue;

    const ct = cycleTime(b, st);
    const total = st.progress + dt;
    const cycles = Math.floor(total / ct);

    if (cycles <= 0) { st.progress = total; continue; }

    if (st.manager) {
      earned += cycles * revenue(b, st, s);
      st.progress = total % ct;
    } else {
      // sans manager : un seul encaissement puis arrêt
      earned += revenue(b, st, s);
      st.progress = 0;
      st.running = false;
    }
  }
  if (earned > 0) {
    s.cash += earned;
    s.totalEarned += earned;
    s.stats.collected += earned;
  }
  return earned;
}

/* ---------------- Immobilier ---------------- */

/** Revenu immobilier total, par seconde. */
export function estatePerSec(s) {
  let perHour = 0;
  for (const p of PROPERTIES) {
    const st = s.properties[p.id];
    if (st.owned) perHour += propIncome(p, st.level);
  }
  return (perHour * angelMult(s)) / 3600;
}

export function tickEstate(s, dt) {
  const gain = estatePerSec(s) * dt;
  if (gain > 0) {
    s.cash += gain;
    s.totalEarned += gain;
  }
  return gain;
}

export function buyProperty(s, id) {
  const p = PROPERTIES.find((x) => x.id === id);
  const st = s.properties[id];
  if (st.owned || s.cash < p.price) return false;
  s.cash -= p.price;
  st.owned = true;
  return true;
}

export function upgradeProperty(s, id) {
  const p = PROPERTIES.find((x) => x.id === id);
  const st = s.properties[id];
  if (!st.owned || st.level >= UPGRADE_MAX) return false;
  const cost = upgradeCost(p, st.level);
  if (s.cash < cost) return false;
  s.cash -= cost;
  st.level += 1;
  return true;
}

/* ---------------- Marché : achat / vente ---------------- */

export function buyAsset(s, id, amountCash) {
  const a = ASSET_BY_ID[id];
  const st = s.assets[id];
  const spend = Math.min(amountCash, s.cash);
  if (!(spend > 0)) return null;
  const fee = spend * a.fee;
  const units = (spend - fee) / st.p;
  if (!(units > 0)) return null;
  s.cash -= spend;
  st.avg = (st.avg * st.q + (spend - fee)) / (st.q + units);
  st.q += units;
  s.stats.trades += 1;
  return { units, spend, fee };
}

export function sellAsset(s, id, units) {
  const a = ASSET_BY_ID[id];
  const st = s.assets[id];
  const u = Math.min(units, st.q);
  if (!(u > 0)) return null;
  const gross = u * st.p;
  const fee = gross * a.fee;
  const net = gross - fee;
  const pnl = net - u * st.avg;
  s.cash += net;
  st.q -= u;
  if (st.q < 1e-9) { st.q = 0; st.avg = 0; }
  s.stats.trades += 1;
  if (pnl > 0) {
    s.totalEarned += pnl;
    s.stats.bestGain = Math.max(s.stats.bestGain, pnl);
  }
  return { units: u, net, fee, pnl };
}

/* ---------------- Valorisation ---------------- */

export function portfolioValue(s) {
  let v = 0;
  for (const a of ASSETS) v += s.assets[a.id].q * s.assets[a.id].p;
  return v;
}

export function businessValue(s) {
  let v = 0;
  for (const b of BUSINESSES) {
    const owned = s.businesses[b.id].owned;
    if (owned > 0) v += b.baseCost * (Math.pow(b.costMult, owned) - 1) / (b.costMult - 1);
  }
  return v;
}

export function estateValue(s) {
  let v = 0;
  for (const p of PROPERTIES) {
    const st = s.properties[p.id];
    if (st.owned) v += p.price * (1 + st.level * 0.5);
  }
  return v;
}

export const netWorth = (s) => s.cash + portfolioValue(s) + businessValue(s) + estateValue(s);

/** Revenu passif estimé (entreprises managées + immobilier), par seconde. */
export function incomePerSec(s) {
  let v = estatePerSec(s);
  for (const b of BUSINESSES) {
    const st = s.businesses[b.id];
    if (st.owned > 0 && st.manager) v += revenue(b, st, s) / cycleTime(b, st);
  }
  return v;
}

/* ---------------- Déblocages ---------------- */

export const isUnlocked = (s, tab) => !UNLOCKS[tab] || s.totalEarned >= UNLOCKS[tab];

/* ---------------- Prestige (actionnaires) ---------------- */

/** Actionnaires totaux mérités selon le total gagné. */
export const angelsEarned = (s) => Math.floor(150 * Math.sqrt(s.totalEarned / 1e15));

/** Actionnaires gagnés en cas de revente maintenant. */
export const pendingAngels = (s) => Math.max(0, angelsEarned(s) - s.angels);

/* ---------------- Gains hors-ligne ---------------- */

/**
 * Applique le temps écoulé depuis la dernière session.
 * @returns {{seconds:number, capped:boolean, earned:number}|null}
 */
export function applyOffline(s, now = Date.now()) {
  const elapsed = Math.max(0, (now - (s.lastSeen || now)) / 1000);
  if (elapsed < 30) return null;
  const seconds = Math.min(elapsed, OFFLINE_CAP);
  const earned = tickBusinesses(s, seconds, true) + tickEstate(s, seconds);
  return { seconds, capped: elapsed > OFFLINE_CAP, earned };
}
