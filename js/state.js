/* État de la partie : création, sauvegarde, chargement, migration. */

import { STOCKS, CRYPTOS, BUILDINGS, SLOT_START } from './data.js';

export const SAVE_KEY = 'businessinsider.save.v2';
export const SAVE_VERSION = 2;
export const HIST_LEN = 60;
export const OFFLINE_CAP = 8 * 3600;

export function createState() {
  const now = Date.now();
  const s = {
    v: SAVE_VERSION,
    createdAt: now,
    lastSeen: now,
    tab: 'earnings',
    sub: { investments: 'stocks', luxe: 'vehicles' },
    cash: 0,
    tickets: 3,
    clickLevel: 1,
    boostUntil: 0,
    autoclickUntil: 0,
    slots: SLOT_START,
    seq: 1,
    businesses: [],
    stocks: {},
    cryptos: {},
    estates: {},
    vehicles: [],
    items: {},
    islands: {},
    dividendAt: now + 3 * 3600 * 1000,
    daily: { day: 0, index: 0 },
    trophies: {},
    rankBest: 101,
    tutorial: 0,
    stats: {
      taps: 0, bizFounded: 0, bizClosed: 0, merges: 0, projects: 0,
      stockBuys: 0, upgrades: 0, playTime: 0,
      earn: { tap: 0, business: 0, rent: 0, dividends: 0, trading: 0, crypto: 0 },
    },
  };
  for (const a of STOCKS) s.stocks[a.id] = { cap: a.cap, hist: [a.cap / a.shares], qty: 0, avg: 0 };
  for (const c of CRYPTOS) s.cryptos[c.id] = { cap: c.cap, hist: [c.cap / c.supply], qty: 0, avg: 0 };
  for (const b of BUILDINGS) s.estates[b.id] = { owned: false, up: {} };
  return s;
}

export function save(s) {
  try {
    s.lastSeen = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch (e) {
    console.warn('Sauvegarde impossible', e);
    return false;
  }
}

export function load() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* stockage bloqué */ }
  if (!raw) return createState();
  try { return migrate(JSON.parse(raw)); } catch (e) {
    console.warn('Sauvegarde illisible, nouvelle partie', e);
    return createState();
  }
}

/** Complète une sauvegarde ancienne avec les clés manquantes. */
function migrate(old) {
  const fresh = createState();
  const s = { ...fresh, ...old, v: SAVE_VERSION };
  s.stats = { ...fresh.stats, ...(old.stats || {}) };
  s.stats.earn = { ...fresh.stats.earn, ...((old.stats || {}).earn || {}) };
  s.daily = { ...fresh.daily, ...(old.daily || {}) };
  s.sub = { ...fresh.sub, ...(old.sub || {}) };
  s.businesses = Array.isArray(old.businesses) ? old.businesses : [];
  s.vehicles = Array.isArray(old.vehicles) ? old.vehicles : [];

  s.stocks = {};
  for (const a of STOCKS) {
    const o = (old.stocks || {})[a.id] || {};
    s.stocks[a.id] = { ...fresh.stocks[a.id], ...o };
    if (!Array.isArray(s.stocks[a.id].hist) || !s.stocks[a.id].hist.length) {
      s.stocks[a.id].hist = [s.stocks[a.id].cap / a.shares];
    }
  }
  s.cryptos = {};
  for (const c of CRYPTOS) {
    const o = (old.cryptos || {})[c.id] || {};
    s.cryptos[c.id] = { ...fresh.cryptos[c.id], ...o };
    if (!Array.isArray(s.cryptos[c.id].hist) || !s.cryptos[c.id].hist.length) {
      s.cryptos[c.id].hist = [s.cryptos[c.id].cap / c.supply];
    }
  }
  s.estates = {};
  for (const b of BUILDINGS) {
    const o = (old.estates || {})[b.id] || {};
    s.estates[b.id] = { owned: !!o.owned, up: o.up || {} };
  }
  return s;
}

export function wipe() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
