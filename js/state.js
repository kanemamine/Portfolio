/* État de la partie : création, sauvegarde, chargement, migration. */

import { BUSINESSES, ASSETS, PROPERTIES } from './data.js';

export const SAVE_KEY = 'richlife.save.v1';
export const SAVE_VERSION = 1;
export const HISTORY_LEN = 90;   // points conservés par actif
export const OFFLINE_CAP = 8 * 3600; // 8 h de gains hors-ligne

/** Crée un état neuf. `keep` permet de conserver les actionnaires lors d'un reset. */
export function createState(keep = {}) {
  const now = Date.now();
  const s = {
    v: SAVE_VERSION,
    createdAt: keep.createdAt || now,
    lastSeen: now,
    cash: 0,
    totalEarned: 0,
    angels: keep.angels || 0,
    runs: keep.runs || 0,
    tab: 'business',
    buyMode: 1,
    businesses: {},
    assets: {},
    properties: {},
    achievements: keep.achievements || {},
    stats: { trades: 0, bestGain: 0, bestNetWorth: 0, collected: 0, playTime: 0 },
  };

  for (const b of BUSINESSES) {
    s.businesses[b.id] = { owned: b.id === 'truck' ? 1 : 0, progress: 0, running: false, manager: false };
  }
  for (const a of ASSETS) {
    s.assets[a.id] = { p: a.start, hist: [a.start], q: 0, avg: 0, shock: 0 };
  }
  for (const p of PROPERTIES) {
    s.properties[p.id] = { owned: false, level: 0 };
  }
  return s;
}

/** Sauvegarde dans le localStorage (silencieuse en cas de quota dépassé). */
export function save(state) {
  try {
    state.lastSeen = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('Sauvegarde impossible', e);
    return false;
  }
}

/** Charge la partie, ou en crée une nouvelle. Complète les clés manquantes. */
export function load() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* stockage bloqué */ }
  if (!raw) return createState();
  try {
    return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('Sauvegarde corrompue, nouvelle partie', e);
    return createState();
  }
}

/** Fusionne une sauvegarde ancienne avec la structure courante. */
function migrate(old) {
  const fresh = createState();
  const s = { ...fresh, ...old, v: SAVE_VERSION };
  s.stats = { ...fresh.stats, ...(old.stats || {}) };
  s.achievements = old.achievements || {};

  s.businesses = {};
  for (const b of BUSINESSES) {
    s.businesses[b.id] = { ...fresh.businesses[b.id], ...((old.businesses || {})[b.id] || {}) };
  }
  s.assets = {};
  for (const a of ASSETS) {
    const o = (old.assets || {})[a.id] || {};
    const st = { ...fresh.assets[a.id], ...o };
    if (!Array.isArray(st.hist) || !st.hist.length) st.hist = [st.p];
    st.hist = st.hist.slice(-HISTORY_LEN);
    s.assets[a.id] = st;
  }
  s.properties = {};
  for (const p of PROPERTIES) {
    s.properties[p.id] = { ...fresh.properties[p.id], ...((old.properties || {})[p.id] || {}) };
  }
  return s;
}

export function wipe() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
