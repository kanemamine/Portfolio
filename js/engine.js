/* Moteur économique : clicker, entreprises, marchés, immobilier, luxe, classement. */

import {
  CLICK_LEVELS, BOOST_MULT, AUTOCLICK_RATE,
  BUSINESS_BY_ID, BUSINESS_TYPES, INCOME_RATE, LEVEL_MAX, CLOSE_REFUND, MERGE_BONUS,
  REPAIR_SPECS, slotCost,
  STOCKS, CRYPTOS, DIVIDEND_PERIOD, MARKET_STEP, CRYPTO_FEE,
  BUILDINGS, RENT_RATE, UPGRADES, ESTATE_TAX,
  VEHICLES, TRIMS, ENGINES, RESALE, COLLECTIONS, ISLANDS, ISLAND_FEE,
  RIVALS, RANK_TIERS, TROPHIES,
} from './data.js';
import { HIST_LEN, OFFLINE_CAP } from './state.js';
import { gauss } from './util.js';

const byId = (arr, id) => arr.find((x) => x.id === id);

/* ---------------- Clicker ---------------- */

export const clickTier = (s) => CLICK_LEVELS[Math.min(s.clickLevel, CLICK_LEVELS.length) - 1];
export const boostActive = (s) => Date.now() < s.boostUntil;
export const autoclickActive = (s) => Date.now() < s.autoclickUntil;
export const clickValue = (s) => clickTier(s).tap * (boostActive(s) ? BOOST_MULT : 1);
export const nextClickTier = (s) => (s.clickLevel < CLICK_LEVELS.length ? CLICK_LEVELS[s.clickLevel] : null);

export function tap(s) {
  const gain = clickValue(s);
  s.cash += gain;
  s.stats.taps += 1;
  s.stats.earn.tap += gain;
  return gain;
}

export function levelUpClick(s) {
  const next = nextClickTier(s);
  if (!next || s.cash < next.cost) return false;
  s.cash -= next.cost;
  s.clickLevel += 1;
  return true;
}

/* ---------------- Entreprises ---------------- */

/** Bonus permanent apporté par les projets achevés (+25 % chacun). */
export const stageBonus = (b) => 1 + b.stage * 0.25;

export function bizIncome(s, b) {
  const t = BUSINESS_BY_ID[b.type];
  const spec = t.spec ? (byId(REPAIR_SPECS, b.spec || 'ordinary') || REPAIR_SPECS[0]).mult : 1;
  const boost = Date.now() < (b.boostUntil || 0) ? 2 : 1;
  return b.cap * INCOME_RATE * (1 + b.level * 0.25) * stageBonus(b) * spec * boost;
}

export const bizLevelCost = (b) => b.cap * 0.6 * Math.pow(1.35, b.level);

export function currentStage(b) {
  const t = BUSINESS_BY_ID[b.type];
  return b.stage < t.stages.length ? t.stages[b.stage] : null;
}
export const stageCost = (b) => {
  const st = currentStage(b);
  return st ? BUSINESS_BY_ID[b.type].cost * st.costMult : 0;
};

export function foundBusiness(s, typeId, name) {
  const t = BUSINESS_BY_ID[typeId];
  if (!t || s.businesses.length >= s.slots || s.cash < t.cost) return null;
  s.cash -= t.cost;
  const b = {
    uid: s.seq++, type: typeId, name: (name || t.name).slice(0, 24),
    cap: t.cost, level: 0, stage: 0, stageEndsAt: 0, spec: t.spec ? 'ordinary' : null,
    boostUntil: 0, earned: 0,
  };
  s.businesses.push(b);
  s.stats.bizFounded += 1;
  return b;
}

export function upgradeBusiness(s, uid) {
  const b = s.businesses.find((x) => x.uid === uid);
  if (!b || b.level >= LEVEL_MAX) return false;
  const cost = bizLevelCost(b);
  if (s.cash < cost) return false;
  s.cash -= cost;
  b.level += 1;
  b.cap += cost * 0.8;          // l'investissement gonfle la capitalisation
  return true;
}

export function startProject(s, uid) {
  const b = s.businesses.find((x) => x.uid === uid);
  if (!b || b.stageEndsAt || !currentStage(b)) return false;
  const cost = stageCost(b);
  if (s.cash < cost) return false;
  s.cash -= cost;
  b.cap += cost * 0.9;
  b.stageEndsAt = Date.now() + currentStage(b).sec * 1000;
  return true;
}

/** Termine immédiatement un chantier contre un accélérateur. */
export function rushProject(s, uid) {
  const b = s.businesses.find((x) => x.uid === uid);
  if (!b || !b.stageEndsAt || s.tickets < 1) return false;
  s.tickets -= 1;
  b.stageEndsAt = Date.now();
  return true;
}

export function setSpec(s, uid, specId) {
  const b = s.businesses.find((x) => x.uid === uid);
  const spec = byId(REPAIR_SPECS, specId);
  if (!b || !spec || s.cash < spec.cost) return false;
  s.cash -= spec.cost;
  b.spec = specId;
  return true;
}

export function closeBusiness(s, uid) {
  const i = s.businesses.findIndex((x) => x.uid === uid);
  if (i < 0) return 0;
  const refund = s.businesses[i].cap * CLOSE_REFUND;
  s.cash += refund;
  s.businesses.splice(i, 1);
  s.stats.bizClosed += 1;
  return refund;
}

/** Fusionne deux sociétés du même type : capitalisations cumulées + prime. */
export function mergeBusinesses(s, uidA, uidB) {
  const a = s.businesses.find((x) => x.uid === uidA);
  const b = s.businesses.find((x) => x.uid === uidB);
  if (!a || !b || a === b || a.type !== b.type) return null;
  a.cap = (a.cap + b.cap) * MERGE_BONUS;
  a.level = Math.max(a.level, b.level);
  a.stage = Math.max(a.stage, b.stage);
  a.name = a.name + ' Group';
  s.businesses = s.businesses.filter((x) => x !== b);
  s.stats.merges += 1;
  return a;
}

export function buySlot(s) {
  const cost = slotCost(s.slots);
  if (s.cash < cost) return false;
  s.cash -= cost;
  s.slots += 1;
  return true;
}

/* ---------------- Marchés ---------------- */

export const stockPrice = (s, a) => s.stocks[a.id].cap / a.shares;
export const cryptoPrice = (s, c) => s.cryptos[c.id].cap / c.supply;

/** Un pas de marché : marche aléatoire avec léger rappel vers l'ancrage. */
function stepAsset(st, ref, vol, record) {
  const pull = 0.02 * Math.log(ref / st.cap);
  st.cap = Math.max(ref * 0.05, st.cap * (1 + pull + (vol / 6) * gauss()));
  if (record) {
    st.hist.push(st.cap);
    if (st.hist.length > HIST_LEN) st.hist.shift();
  }
}

export function stepMarkets(s, record = true) {
  for (const a of STOCKS) stepAsset(s.stocks[a.id], a.cap, a.vol, record);
  for (const c of CRYPTOS) stepAsset(s.cryptos[c.id], c.cap, c.vol, record);
}

export function fastForwardMarkets(s, seconds) {
  const steps = Math.min(Math.floor(seconds / MARKET_STEP), 300);
  for (let i = 0; i < steps; i++) stepMarkets(s, i % 4 === 0);
}

/** Variation en % sur la fenêtre d'historique (les caps sont proportionnelles au prix). */
export function change(st) {
  const first = st.hist[0] || st.cap;
  return ((st.cap - first) / first) * 100;
}

export function buyStock(s, id, qty) {
  const a = byId(STOCKS, id);
  const st = s.stocks[id];
  const price = stockPrice(s, a);
  const total = price * qty;
  if (!(qty > 0) || s.cash < total) return null;
  s.cash -= total;
  st.avg = (st.avg * st.qty + total) / (st.qty + qty);
  st.qty += qty;
  s.stats.stockBuys += 1;
  return { qty, total, price };
}

export function sellStock(s, id, qty) {
  const a = byId(STOCKS, id);
  const st = s.stocks[id];
  const q = Math.min(qty, st.qty);
  if (!(q > 0)) return null;
  const price = stockPrice(s, a);
  const total = price * q;
  const pnl = total - q * st.avg;
  s.cash += total;
  st.qty -= q;
  if (st.qty < 1e-9) { st.qty = 0; st.avg = 0; }
  if (pnl > 0) s.stats.earn.trading += pnl;
  return { qty: q, total, pnl };
}

export function buyCrypto(s, id, cashAmount) {
  const c = byId(CRYPTOS, id);
  const st = s.cryptos[id];
  const spend = Math.min(cashAmount, s.cash);
  if (!(spend > 0)) return null;
  const fee = spend * CRYPTO_FEE;
  const price = cryptoPrice(s, c);
  const qty = (spend - fee) / price;
  s.cash -= spend;
  st.avg = (st.avg * st.qty + (spend - fee)) / (st.qty + qty);
  st.qty += qty;
  return { qty, spend, fee };
}

export function sellCrypto(s, id, qty) {
  const c = byId(CRYPTOS, id);
  const st = s.cryptos[id];
  const q = Math.min(qty, st.qty);
  if (!(q > 0)) return null;
  const gross = q * cryptoPrice(s, c);
  const fee = gross * CRYPTO_FEE;
  const pnl = gross - fee - q * st.avg;
  s.cash += gross - fee;
  st.qty -= q;
  if (st.qty < 1e-9) { st.qty = 0; st.avg = 0; }
  if (pnl > 0) s.stats.earn.crypto += pnl;
  return { qty: q, net: gross - fee, pnl };
}

/** Dividendes : chaque position verse son taux sur la période de 3 h. */
export function payDividends(s) {
  let total = 0;
  for (const a of STOCKS) {
    const st = s.stocks[a.id];
    if (st.qty > 0) total += st.qty * stockPrice(s, a) * (a.div / 100);
  }
  if (total > 0) {
    s.cash += total;
    s.stats.earn.dividends += total;
  }
  return total;
}

/* ---------------- Immobilier ---------------- */

export function rentOf(s, b) {
  const st = s.estates[b.id];
  let bonus = 1;
  for (const u of UPGRADES) if (st.up[u.id]) bonus += u.bonus;
  return b.price * RENT_RATE * bonus;
}

export function buyEstate(s, id) {
  const b = byId(BUILDINGS, id);
  if (s.estates[id].owned || s.cash < b.price) return false;
  s.cash -= b.price;
  s.estates[id].owned = true;
  return true;
}

export function sellEstate(s, id) {
  const b = byId(BUILDINGS, id);
  const st = s.estates[id];
  if (!st.owned) return 0;
  const net = b.price * (1 - ESTATE_TAX);
  s.cash += net;
  st.owned = false;
  st.up = {};
  return net;
}

export function upgradeEstate(s, id, upId) {
  const b = byId(BUILDINGS, id);
  const u = byId(UPGRADES, upId);
  const st = s.estates[id];
  if (!st.owned || st.up[upId]) return false;
  const cost = b.price * u.costRate;
  if (s.cash < cost) return false;
  s.cash -= cost;
  st.up[upId] = true;
  s.stats.upgrades += 1;
  return true;
}

/* ---------------- Luxe ---------------- */

export const vehiclePrice = (v, trim, engine) =>
  v.price * byId(TRIMS, trim).mult * byId(ENGINES, engine).mult;

export function buyVehicle(s, vid, trim, engine) {
  const v = byId(VEHICLES, vid);
  const price = vehiclePrice(v, trim, engine);
  if (s.cash < price) return null;
  s.cash -= price;
  const owned = { uid: s.seq++, vid, trim, engine, paid: price };
  s.vehicles.push(owned);
  return owned;
}

export function sellVehicle(s, uid) {
  const i = s.vehicles.findIndex((x) => x.uid === uid);
  if (i < 0) return 0;
  const net = s.vehicles[i].paid * RESALE;
  s.cash += net;
  s.vehicles.splice(i, 1);
  return net;
}

/** Objets d'une collection : le prix croît de 45 % à chaque rang. */
export function collectionItems(col) {
  return col.themes.slice(0, col.count).map((name, i) => ({
    key: `${col.id}.${i}`,
    name,
    price: col.base * Math.pow(1.45, i),
  }));
}

export function buyItem(s, key, price) {
  if (s.items[key] || s.cash < price) return false;
  s.cash -= price;
  s.items[key] = price;
  return true;
}

export function buyIsland(s, id) {
  const isl = byId(ISLANDS, id);
  if (s.islands[id] || s.cash < isl.price) return false;
  s.cash -= isl.price;
  s.islands[id] = true;
  return true;
}

export function sellIsland(s, id) {
  const isl = byId(ISLANDS, id);
  if (!s.islands[id]) return 0;
  const net = isl.price * (1 - ISLAND_FEE);
  s.cash += net;
  delete s.islands[id];
  return net;
}

/* ---------------- Agrégats ---------------- */

export const businessValue = (s) => s.businesses.reduce((n, b) => n + b.cap, 0);
export const stocksValue = (s) => STOCKS.reduce((n, a) => n + s.stocks[a.id].qty * stockPrice(s, a), 0);
export const cryptoValue = (s) => CRYPTOS.reduce((n, c) => n + s.cryptos[c.id].qty * cryptoPrice(s, c), 0);
export const estateValue = (s) => BUILDINGS.reduce((n, b) => n + (s.estates[b.id].owned ? b.price : 0), 0);
export const vehicleValue = (s) => s.vehicles.reduce((n, v) => n + v.paid * RESALE, 0);
export const itemsValue = (s) => Object.values(s.items).reduce((n, p) => n + p, 0);
export const islandValue = (s) => ISLANDS.reduce((n, i) => n + (s.islands[i.id] ? i.price : 0), 0);

export function netWorth(s) {
  return s.cash + businessValue(s) + stocksValue(s) + cryptoValue(s)
    + estateValue(s) + vehicleValue(s) + itemsValue(s) + islandValue(s);
}

export function breakdown(s) {
  return [
    { key: 'cash', name: 'Liquidités', icon: '💵', value: s.cash },
    { key: 'business', name: 'Entreprises', icon: '🏢', value: businessValue(s) },
    { key: 'stocks', name: 'Actions', icon: '📈', value: stocksValue(s) },
    { key: 'estate', name: 'Immobilier', icon: '🏙️', value: estateValue(s) },
    { key: 'vehicles', name: 'Véhicules', icon: '🚗', value: vehicleValue(s) },
    { key: 'items', name: 'Collections', icon: '🖼️', value: itemsValue(s) },
    { key: 'islands', name: 'Îles', icon: '🏝', value: islandValue(s) },
    { key: 'crypto', name: 'Cryptomonnaies', icon: '🪙', value: cryptoValue(s) },
  ];
}

/** Revenu horaire total (clic passif + entreprises + loyers). */
export function incomePerHour(s) {
  let v = clickTier(s).idle;
  for (const b of s.businesses) if (!b.stageEndsAt) v += bizIncome(s, b);
  for (const b of BUILDINGS) if (s.estates[b.id].owned) v += rentOf(s, b);
  return v;
}

/* ---------------- Boucle de production ---------------- */

/** Fait avancer la partie de `dt` secondes ; renvoie les gains encaissés. */
export function tick(s, dt) {
  let biz = 0, rent = 0;
  const now = Date.now();

  for (const b of s.businesses) {
    if (b.stageEndsAt) {
      if (now >= b.stageEndsAt) { b.stageEndsAt = 0; b.stage += 1; s.stats.projects += 1; }
      continue;                                  // un chantier suspend la production
    }
    const g = (bizIncome(s, b) / 3600) * dt;
    biz += g;
    b.earned = (b.earned || 0) + g;
  }
  for (const b of BUILDINGS) if (s.estates[b.id].owned) rent += (rentOf(s, b) / 3600) * dt;

  const idle = (clickTier(s).idle / 3600) * dt;
  s.cash += biz + rent + idle;
  s.stats.earn.business += biz;
  s.stats.earn.rent += rent;
  s.stats.earn.tap += idle;
  s.stats.playTime += dt;
  return biz + rent + idle;
}

/** Applique le temps écoulé hors ligne (plafonné). */
export function applyOffline(s, now = Date.now()) {
  const elapsed = Math.max(0, (now - (s.lastSeen || now)) / 1000);
  if (elapsed < 30) return null;
  const seconds = Math.min(elapsed, OFFLINE_CAP);
  const earned = tick(s, seconds);
  fastForwardMarkets(s, seconds);
  let dividends = 0;
  while (s.dividendAt <= now) {
    dividends += payDividends(s);
    s.dividendAt += DIVIDEND_PERIOD * 1000;
  }
  return { seconds, capped: elapsed > OFFLINE_CAP, earned, dividends };
}

/* ---------------- Classement & trophées ---------------- */

/** Position dans le classement mondial (1 = plus riche). */
export function ranking(s) {
  const nw = netWorth(s);
  const richer = RIVALS.filter((r) => r.wealth > nw).length;
  return { rank: richer + 1, nw, tier: [...RANK_TIERS].reverse().find((t) => nw >= t.min) };
}

/** Voisins de classement, joueur inclus. */
export function rankNeighbours(s, span = 4) {
  const nw = netWorth(s);
  const list = RIVALS.map((r) => ({ ...r, you: false }));
  list.push({ id: 'you', name: 'Vous', sphere: 'votre empire', wealth: nw, you: true });
  list.sort((a, b) => b.wealth - a.wealth);
  const i = list.findIndex((x) => x.you);
  return list.slice(Math.max(0, i - span), i + span + 1)
    .map((x) => ({ ...x, rank: list.indexOf(x) + 1 }));
}

/** Valeurs courantes des compteurs suivis par les trophées. */
export function statValues(s) {
  const cars = s.vehicles.filter((v) => byId(VEHICLES, v.vid).kind === 'car').length;
  return {
    taps: s.stats.taps,
    clickLevel: s.clickLevel,
    bizFounded: s.stats.bizFounded,
    bizActive: s.businesses.length,
    merges: s.stats.merges,
    projects: s.stats.projects,
    stockBuys: s.stats.stockBuys,
    earnDividends: s.stats.earn.dividends,
    earnCrypto: s.stats.earn.crypto,
    cryptoKinds: CRYPTOS.filter((c) => s.cryptos[c.id].qty > 0).length,
    estates: BUILDINGS.filter((b) => s.estates[b.id].owned).length,
    upgrades: s.stats.upgrades,
    cars,
    aircrafts: s.vehicles.filter((v) => byId(VEHICLES, v.vid).kind === 'aircraft').length,
    yachts: s.vehicles.filter((v) => byId(VEHICLES, v.vid).kind === 'yacht').length,
    items: Object.keys(s.items).length,
    islands: Object.keys(s.islands).length,
    netWorth: netWorth(s),
    rankBest: 101 - Math.min(100, s.rankBest === 101 ? 0 : 101 - s.rankBest),
  };
}

/** Renvoie les trophées nouvellement débloqués. */
export function checkTrophies(s) {
  const v = statValues(s);
  const got = [];
  for (const t of TROPHIES) {
    if (s.trophies[t.id]) continue;
    const cur = t.stat === 'rankBest' ? s.rankBest : v[t.stat] || 0;
    const ok = t.stat === 'rankBest' ? cur <= t.goal : cur >= t.goal;
    if (ok) { s.trophies[t.id] = true; got.push(t); }
  }
  return got;
}

export { BUSINESS_TYPES, VEHICLES, COLLECTIONS, ISLANDS, BUILDINGS, STOCKS, CRYPTOS, AUTOCLICK_RATE };
