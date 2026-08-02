/* Point d'entrée : boucle de jeu, actions, cycle de vie. */

import * as D from './data.js';
import * as E from './engine.js';
import * as V from './views.js';
import { createState, load, save, wipe, SAVE_KEY, OFFLINE_CAP } from './state.js';
import { toast, floatGain, vibrate, openSheet, closeSheet, sheetOpen } from './ui.js';
import { openPano } from './pano.js';
import { $, $$, money, fmt, dur, esc } from './util.js';

const s = load();
V.init(() => V.render(s));

const el = {
  cash: $('#hud-cash'), net: $('#hud-net'), rank: $('#hud-rank'),
  hr: $('#hud-hr'), tickets: $('#hud-tickets'),
};

/* ---------------- Démarrage ---------------- */
function boot() {
  const off = E.applyOffline(s);
  setTab(s.tab || 'earnings', true);
  updateHUD();
  window.__BOOTED = true;          // désarme le filet de sécurité de index.html
  setTimeout(() => $('#splash').classList.add('hide'), 400);

  if (off && off.earned + off.dividends > 1) {
    setTimeout(() => openSheet(`
      <h3>Pendant votre absence 💼</h3>
      <p class="small muted" style="margin:6px 0 14px">
        Vos sociétés et vos biens ont tourné ${dur(off.seconds)}${off.capped ? ` (plafond de ${dur(OFFLINE_CAP)})` : ''}.
      </p>
      <div class="card" style="text-align:center;margin:0">
        <div class="tiny">Revenus</div><b style="font-size:24px;color:var(--gold)">${money(off.earned)}</b>
        ${off.dividends > 0 ? `<div class="tiny" style="margin-top:8px">Dividendes</div><b class="up">${money(off.dividends)}</b>` : ''}
      </div>
      <button class="btn btn-gold btn-block" data-close="1" style="margin-top:14px">Encaisser</button>`), 650);
  } else if (!s.tutorial) {
    setTimeout(() => {
      openSheet(`
        <h3>Bienvenue, patron 💼</h3>
        <p class="small muted" style="margin:8px 0 6px">« Je vois du potentiel. On va vous rendre indécemment riche. »</p>
        <p class="small muted" style="margin:0 0 14px">
          Commencez par <b>toucher l’écran</b> pour gagner vos premiers dollars, améliorez votre gain par tap,
          puis <b>fondez votre première société</b> pour lancer un revenu passif.
        </p>
        <button class="btn btn-gold btn-block" data-close="1">C’est parti</button>`);
      s.tutorial = 1;
    }, 600);
  }
}

/* ---------------- Boucle ---------------- */
let last = performance.now();
let mAcc = 0, uiAcc = 0, saveAcc = 0, autoAcc = 0, trophyAcc = 0;

function frame(now) {
  // Toute exception ici tuerait la boucle et figerait le jeu jusqu'au
  // rechargement : on l'isole et on continue.
  try {
    step(now);
  } catch (err) {
    console.error('boucle de jeu', err);
  }
  requestAnimationFrame(frame);
}

function step(now) {
  const dt = Math.min((now - last) / 1000, 2);
  last = now;

  E.tick(s, dt);

  mAcc += dt;
  while (mAcc >= D.MARKET_STEP) { E.stepMarkets(s); mAcc -= D.MARKET_STEP; }

  if (Date.now() >= s.dividendAt) {
    const paid = E.payDividends(s);
    s.dividendAt = Date.now() + D.DIVIDEND_PERIOD * 1000;
    if (paid > 0) toast(`💵 Dividendes encaissés : ${money(paid)}`, 'gold');
  }

  if (E.autoclickActive(s)) {
    autoAcc += dt * D.AUTOCLICK_RATE;
    while (autoAcc >= 1) { E.tap(s); autoAcc -= 1; }
  }

  trophyAcc += dt;
  if (trophyAcc >= 1) {
    trophyAcc = 0;
    const r = E.ranking(s);
    if (r.rank < s.rankBest) s.rankBest = r.rank;
    for (const t of E.checkTrophies(s)) toast(`${t.icon} Trophée : ${t.name}`, 'gold');
  }

  uiAcc += dt;
  if (uiAcc >= 0.25) { uiAcc = 0; updateHUD(); if (!sheetOpen()) V.update(s); }

  saveAcc += dt;
  if (saveAcc >= 15) { saveAcc = 0; persist(); }
}

/* ---------------- HUD ---------------- */
function updateHUD() {
  el.cash.textContent = money(s.cash);
  el.net.textContent = money(E.netWorth(s));
  el.hr.textContent = money(E.incomePerHour(s));
  el.rank.textContent = '#' + E.ranking(s).rank;
  el.tickets.textContent = s.tickets;
}

function setTab(tab, silent = false) {
  s.tab = tab;
  for (const b of $$('.nav-btn')) b.classList.toggle('is-active', b.dataset.tab === tab);
  V.render(s);
  if (!silent) vibrate(5);
}

/* Un import ou une remise à zéro écrit directement dans le stockage puis
   recharge. Il faut alors empêcher la sauvegarde de sortie d'écraser ce qu'on
   vient d'écrire avec la partie encore en mémoire. */
let persistEnabled = true;
const persist = () => { if (persistEnabled) save(s); };

const need = () => toast('Fonds insuffisants', 'bad');
const numField = (sel) => parseFloat(($(sel) || {}).value);

/* ---------------- Actions ---------------- */
const A = {
  /* --- clicker --- */
  tap: (d, e) => {
    const g = E.tap(s);
    if (e && e.clientX) floatGain(e.clientX, e.clientY, '+' + money(g));
    el.cash.textContent = money(s.cash);
    vibrate(4);
  },
  levelup: () => { if (E.levelUpClick(s)) { toast('Niveau de revenu amélioré', 'good'); vibrate(12); } else need(); },
  boost: () => {
    s.boostUntil = Date.now() + D.BOOST_SECONDS * 1000;
    toast(`🔥 Gain par tap ×${D.BOOST_MULT} pendant ${D.BOOST_SECONDS} s`, 'gold');
  },
  autoclick: () => {
    s.autoclickUntil = Date.now() + D.AUTOCLICK_SECONDS * 1000;
    toast('🤖 Auto-clic activé', 'good');
  },
  daily: () => {
    if (!V.canClaimDaily(s)) return;
    const r = D.DAILY_REWARDS[s.daily.index % D.DAILY_REWARDS.length];
    if (r.kind === 'cash') s.cash += r.value;
    else if (r.kind === 'pctCash') s.cash += E.netWorth(s) * r.value;
    else if (r.kind === 'ticket') s.tickets += r.value;
    else if (r.kind === 'autoclick') s.autoclickUntil = Date.now() + r.value * 1000;
    else if (r.kind === 'item') {
      const col = D.COLLECTIONS[Math.floor(Math.random() * D.COLLECTIONS.length)];
      const free = E.collectionItems(col).filter((i) => !s.items[i.key]);
      if (free.length) { s.items[free[0].key] = free[0].price; toast(`🎁 Offert : ${free[0].name}`, 'gold'); }
      else s.cash += 100e3;
    }
    s.daily.day = Math.floor(Date.now() / 864e5);
    s.daily.index += 1;
    toast(`🎁 ${r.name}`, 'gold');
  },

  /* --- entreprises --- */
  found: () => V.sheetFound(s),
  'found-go': (d) => {
    const name = ($('#biz-name') || {}).value || '';
    const b = E.foundBusiness(s, d.id, name.trim());
    if (!b) return need();
    closeSheet();
    toast(`🏢 ${b.name} est lancée`, 'good');
    vibrate(14);
  },
  buyslot: () => { if (E.buySlot(s)) toast('Emplacement supplémentaire acquis', 'good'); else need(); },
  lvlup: (d) => { if (E.upgradeBusiness(s, +d.uid)) vibrate(8); else need(); },
  project: (d) => { if (E.startProject(s, +d.uid)) toast('🔨 Chantier lancé', 'good'); else need(); },
  rush: (d) => {
    if (E.rushProject(s, +d.uid)) toast('Chantier terminé', 'good');
    else toast('Aucun accélérateur disponible', 'bad');
  },
  bizmenu: (d) => V.sheetBizMenu(s, +d.uid),
  spec: (d) => V.sheetSpec(s, +d.uid),
  'spec-go': (d) => { if (E.setSpec(s, +d.uid, d.spec)) { closeSheet(); toast('Spécialisation modifiée', 'good'); } else need(); },
  'merge-go': (d) => {
    const b = E.mergeBusinesses(s, +d.a, +d.b);
    if (b) { closeSheet(); toast(`🤝 Fusion : ${b.name}`, 'gold'); }
  },
  'close-go': (d) => {
    const r = E.closeBusiness(s, +d.uid);
    closeSheet();
    toast(`Société fermée, ${money(r)} récupérés`);
  },

  /* --- navigation secondaire --- */
  sub: (d) => { s.sub[d.tab] = d.sub; V.render(s); },

  /* --- actions --- */
  stock: (d) => V.sheetStock(s, d.id),
  'stock-q': (d) => {
    const a = D.STOCKS.find((x) => x.id === d.id);
    const max = s.cash / E.stockPrice(s, a);
    const f = $('#s-qty');
    if (f) f.value = Math.floor(max * (+d.p / 100) * 1e4) / 1e4;
  },
  'stock-buy': (d) => {
    const q = numField('#s-qty');
    if (!(q > 0)) return toast('Saisissez une quantité', 'bad');
    const r = E.buyStock(s, d.id, q);
    if (!r) return need();
    toast(`Acheté ${fmt(r.qty)} ${d.id} pour ${money(r.total)}`, 'good');
    V.sheetStock(s, d.id);
  },
  'stock-sell': (d) => {
    const st = s.stocks[d.id];
    const r = E.sellStock(s, d.id, st.qty * (+d.p / 100));
    if (!r) return toast('Aucune position', 'bad');
    toast(`Vendu ${money(r.total)} · ${r.pnl >= 0 ? '+' : ''}${money(r.pnl)}`, r.pnl >= 0 ? 'good' : 'bad');
    V.sheetStock(s, d.id);
  },

  /* --- crypto --- */
  crypto: (d) => V.sheetCrypto(s, d.id),
  'crypto-q': (d) => { const f = $('#c-amt'); if (f) f.value = Math.floor(s.cash * (+d.p / 100)); },
  'crypto-buy': (d) => {
    const amt = numField('#c-amt');
    if (!(amt > 0)) return toast('Saisissez un montant', 'bad');
    const r = E.buyCrypto(s, d.id, amt);
    if (!r) return need();
    toast(`Acheté ${fmt(r.qty)} ${d.id}`, 'good');
    V.sheetCrypto(s, d.id);
  },
  'crypto-sell': (d) => {
    const st = s.cryptos[d.id];
    const r = E.sellCrypto(s, d.id, st.qty * (+d.p / 100));
    if (!r) return toast('Aucune position', 'bad');
    toast(`Vendu ${money(r.net)} · ${r.pnl >= 0 ? '+' : ''}${money(r.pnl)}`, r.pnl >= 0 ? 'good' : 'bad');
    V.sheetCrypto(s, d.id);
  },

  /* --- immobilier --- */
  buyestate: (d) => { if (E.buyEstate(s, d.id)) { toast('🔑 Bien acquis', 'good'); vibrate(12); } else need(); },
  sellestate: (d) => {
    const net = E.sellEstate(s, d.id);
    toast(`Vendu ${money(net)} (taxe ${(D.ESTATE_TAX * 100).toFixed(0)} %)`);
  },
  upgrades: (d) => V.sheetUpgrades(s, d.id),
  tour: (d) => {
    const b = D.BUILDINGS.find((x) => x.id === d.id);
    if (!b || !b.tour) return;
    openPano(Array.from({ length: b.tour }, (_, i) => ({
      src: `img/pano/${b.id}-${i}.webp`, label: D.TOUR_NODES[i] || `Vue ${i + 1}`,
    })), `${b.city} — ${b.country}`);
  },
  'upgrade-go': (d) => {
    if (E.upgradeEstate(s, d.id, d.up)) { toast('🛠️ Amélioration effectuée', 'good'); V.sheetUpgrades(s, d.id); }
    else need();
  },

  /* --- luxe --- */
  vehicle: (d) => { cfg = { trim: 'basic', engine: 'std', id: d.id }; V.sheetVehicle(s, d.id); },
  cfg: (d, e) => {
    cfg[d.k] = d.v;
    const box = e.target.closest('.seg');
    for (const b of box.querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === d.v);
    const v = D.VEHICLES.find((x) => x.id === cfg.id);
    const t = $('#v-total');
    if (t) t.textContent = money(E.vehiclePrice(v, cfg.trim, cfg.engine));
  },
  'vehicle-buy': (d) => {
    const o = E.buyVehicle(s, d.id, cfg.trim, cfg.engine);
    if (!o) return need();
    closeSheet();
    toast('🔑 Livré dans votre flotte', 'good');
    vibrate(14);
  },
  sellvehicle: (d) => { const n = E.sellVehicle(s, +d.uid); toast(`Revendu ${money(n)}`); },
  buyitem: (d) => { if (E.buyItem(s, d.key, +d.price)) { toast('🖼️ Pièce acquise', 'good'); vibrate(10); } else need(); },
  buyisland: (d) => { if (E.buyIsland(s, d.id)) { toast('🏝 Île acquise', 'gold'); vibrate(16); } else need(); },
  sellisland: (d) => { const n = E.sellIsland(s, d.id); toast(`Île vendue ${money(n)}`); },

  /* --- sauvegarde --- */
  export: () => {
    const data = btoa(unescape(encodeURIComponent(JSON.stringify(s))));
    openSheet(`<h3>Exporter la sauvegarde</h3>
      <p class="small muted" style="margin:6px 0 10px">Conservez ce code pour restaurer la partie ailleurs.</p>
      <textarea id="exp" class="field" readonly style="height:120px">${esc(data)}</textarea>
      <button class="btn btn-gold btn-block" data-act="copy" style="margin-top:10px">Copier</button>
      <button class="btn btn-block btn-ghost" data-close="1" style="margin-top:8px">Fermer</button>`);
  },
  copy: () => {
    const ta = $('#exp');
    ta.select();
    const ok = () => toast('Copié', 'good');
    if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(ok, () => toast('Copie manuelle requise', 'bad'));
    else { document.execCommand('copy'); ok(); }
  },
  import: () => {
    openSheet(`<h3>Importer une sauvegarde</h3>
      <p class="small muted" style="margin:6px 0 10px">La partie en cours sera remplacée.</p>
      <textarea id="imp" class="field" style="height:120px"></textarea>
      <button class="btn btn-green btn-block" data-act="import-go" style="margin-top:10px">Importer</button>
      <button class="btn btn-block btn-ghost" data-close="1" style="margin-top:8px">Annuler</button>`);
  },
  'import-go': () => {
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob($('#imp').value.trim()))));
      if (!data || typeof data !== 'object' || !('cash' in data)) throw new Error('format');
      persistEnabled = false;
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      closeSheet();
      toast('Sauvegarde importée, rechargement…', 'good');
      setTimeout(() => location.reload(), 600);
    } catch (e) { toast('Code invalide', 'bad'); }
  },
  reset: () => {
    openSheet(`<h3>Tout réinitialiser ?</h3>
      <p class="small muted" style="margin:6px 0 14px">Progression, trophées et patrimoine seront effacés.</p>
      <button class="btn btn-red btn-block" data-act="reset-go">Effacer ma partie</button>
      <button class="btn btn-block btn-ghost" data-close="1" style="margin-top:8px">Annuler</button>`);
  },
  'reset-go': () => { persistEnabled = false; wipe(); location.reload(); },
};

let cfg = { trim: 'basic', engine: 'std', id: null };

/* ---------------- Délégation ---------------- */
document.addEventListener('click', (e) => {
  const nav = e.target.closest('.nav-btn');
  if (nav) return setTab(nav.dataset.tab);

  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const fn = A[t.dataset.act];
  if (!fn) return;
  fn(t.dataset, e);
  updateHUD();
  // le tap et la configuration ne doivent pas reconstruire la vue
  if (!['tap', 'cfg', 'stock-q', 'crypto-q', 'copy'].includes(t.dataset.act) && !sheetOpen()) V.render(s);
});

/* ---------------- Cycle de vie ---------------- */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { persist(); return; }
  const off = E.applyOffline(s);
  if (off && off.earned > 1) toast(`+${money(off.earned)} pendant votre absence`, 'gold');
  last = performance.now();
  V.render(s);
  updateHUD();
});
window.addEventListener('pagehide', persist);
window.addEventListener('beforeunload', persist);
document.addEventListener('dblclick', (e) => { if (e.target.closest('[data-act]')) e.preventDefault(); });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      if (reg.waiting) reg.waiting.postMessage('skip-waiting');
    }).catch(() => {});
  });
}

if (['localhost', '127.0.0.1', ''].includes(location.hostname)) {
  window.RL = { s, save: () => save(s), render: () => V.render(s), E, D };
}

boot();
requestAnimationFrame(frame);
