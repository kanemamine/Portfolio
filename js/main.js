/* Point d'entrée : boucle de jeu, entrées utilisateur, sauvegarde. */

import { BUSINESSES, PROPERTIES, ACHIEVEMENTS, UNLOCKS, levelInfo } from './data.js';
import { createState, load, save, wipe, OFFLINE_CAP, SAVE_KEY } from './state.js';
import * as G from './game.js';
import * as M from './market.js';
import * as V from './views.js';
import { toast, floatGain, vibrate, openSheet, closeSheet, sheetOpen } from './ui.js';
import { $, $$, money, fmt, dur, esc, clamp, rand } from './util.js';

const s = load();
V.init(() => V.render(s));

/* ---------------- Références HUD ---------------- */
const el = {
  cash: $('#hud-cash'), net: $('#hud-net'), level: $('#hud-level'),
  xp: $('#hud-xp'), title: $('#hud-title'), angels: $('#hud-angels-val'),
  news: $('#news'), newsText: $('#news-text'), nav: $('#nav'),
};

/* ---------------- Démarrage ---------------- */

function boot() {
  const off = G.applyOffline(s);
  if (off) M.fastForward(s, off.seconds);

  setTab(s.tab || 'business', true);
  updateHUD();
  refreshNav();

  setTimeout(() => $('#splash').classList.add('hide'), 450);

  if (off && off.earned > 1) {
    setTimeout(() => openSheet(`
      <h3>Pendant votre absence 💼</h3>
      <p class="small muted" style="margin:6px 0 14px">
        Vos managers et vos biens ont travaillé ${dur(off.seconds)}${off.capped ? ` (plafond de ${dur(OFFLINE_CAP)})` : ''}.
      </p>
      <div class="card" style="text-align:center;margin:0">
        <div class="tiny">Revenus hors-ligne</div>
        <b style="font-size:26px;color:var(--gold)">${money(off.earned)}</b>
      </div>
      <button class="btn btn-gold btn-block" data-close="1" style="margin-top:14px">Encaisser</button>
    `), 700);
  }
}

/* ---------------- Boucle principale ---------------- */

let last = performance.now();
let marketAcc = 0, uiAcc = 0, saveAcc = 0, achAcc = 0;
let newsIn = rand(20, 45);

function frame(now) {
  const dt = Math.min((now - last) / 1000, 2); // rAF gelé en arrière-plan : cf. visibilitychange
  last = now;

  G.tickBusinesses(s, dt);
  G.tickEstate(s, dt);
  s.stats.playTime += dt;

  marketAcc += dt * 1000;
  while (marketAcc >= M.STEP_MS) { M.stepMarket(s); marketAcc -= M.STEP_MS; }

  newsIn -= dt;
  if (newsIn <= 0) { showNews(M.fireNews(s)); newsIn = rand(35, 75); }

  achAcc += dt;
  if (achAcc >= 1) { achAcc = 0; checkAchievements(); trackRecords(); refreshNav(); }

  uiAcc += dt;
  const uiStep = s.tab === 'business' ? 0 : 0.25;
  if (uiAcc >= uiStep) { uiAcc = 0; updateHUD(); V.update(s); }

  saveAcc += dt;
  if (saveAcc >= 15) { saveAcc = 0; save(s); }

  requestAnimationFrame(frame);
}

/* ---------------- HUD & navigation ---------------- */

function updateHUD() {
  const nw = G.netWorth(s);
  const lv = levelInfo(nw);
  el.cash.textContent = money(s.cash);
  el.net.textContent = money(nw);
  el.level.textContent = lv.level;
  el.xp.style.width = (lv.progress * 100).toFixed(1) + '%';
  el.title.textContent = lv.title;
  el.angels.textContent = '+' + (s.angels * 2).toFixed(0) + '%';
}

function trackRecords() {
  const nw = G.netWorth(s);
  if (nw > s.stats.bestNetWorth) s.stats.bestNetWorth = nw;
}

function refreshNav() {
  for (const btn of $$('.nav-btn')) {
    const tab = btn.dataset.tab;
    const locked = !G.isUnlocked(s, tab);
    btn.classList.toggle('locked', locked);
    btn.classList.toggle('is-active', tab === s.tab);
  }
}

function setTab(tab, silent = false) {
  s.tab = tab;
  refreshNav();
  V.render(s);
  if (!silent) vibrate(5);
}

function showNews(text) {
  el.newsText.textContent = text;
  el.news.classList.add('flash');
  setTimeout(() => el.news.classList.remove('flash'), 4000);
}

/* ---------------- Succès ---------------- */

function checkAchievements() {
  const ctx = { netWorth: G.netWorth(s) };
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.id]) continue;
    let ok = false;
    try { ok = a.test(s, ctx); } catch (e) { ok = false; }
    if (ok) {
      s.achievements[a.id] = true;
      toast(`${a.icon} Succès débloqué : ${a.name}`, 'gold');
      vibrate(15);
    }
  }
}

/* ---------------- Actions ---------------- */

const ACTIONS = {
  goto: (d) => setTab(d.tab),

  mode: (d) => {
    s.buyMode = d.mode === 'max' ? 'max' : parseInt(d.mode, 10);
    V.render(s);
  },

  run: (d, e) => {
    const st = s.businesses[d.id];
    if (st.owned <= 0) { toast('Achetez d’abord une unité.', 'bad'); return; }
    if (st.manager) { toast('Un manager s’en occupe déjà ✓'); return; }
    if (G.startCycle(s, d.id)) vibrate(6);
  },

  runall: () => {
    let n = 0;
    for (const b of BUSINESSES) if (G.startCycle(s, b.id)) n++;
    toast(n ? `${n} production${n > 1 ? 's' : ''} lancée${n > 1 ? 's' : ''}` : 'Rien à lancer');
  },

  buy: (d, e) => {
    const res = G.buyBusiness(s, d.id);
    if (!res) { toast('Fonds insuffisants', 'bad'); return; }
    vibrate(8);
    floatGain(e.clientX, e.clientY, '+' + res.count);
    V.update(s);
  },

  mgr: (d) => {
    const b = BUSINESSES.find((x) => x.id === d.id);
    if (G.hireManager(s, d.id)) {
      toast(`🧑‍💼 Manager engagé : ${b.name} tourne en continu`, 'good');
      vibrate(12);
    } else toast('Fonds insuffisants', 'bad');
  },

  asset: (d) => V.openAssetSheet(s, d.id),

  'q-buy': (d) => {
    const input = $('#s-amt');
    if (input) input.value = Math.floor(s.cash * (parseInt(d.p, 10) / 100));
  },

  'buy-asset': (d) => {
    const input = $('#s-amt');
    const amount = parseFloat(input && input.value);
    if (!(amount > 0)) { toast('Saisissez un montant', 'bad'); return; }
    const res = G.buyAsset(s, d.id, amount);
    if (!res) { toast('Fonds insuffisants', 'bad'); return; }
    input.value = '';
    toast(`Acheté ${res.units.toFixed(4)} ${d.id} · frais ${money(res.fee)}`, 'good');
    vibrate(8);
    V.update(s);
  },

  'q-sell': (d) => {
    const st = s.assets[d.id];
    if (!(st.q > 0)) { toast('Aucune position', 'bad'); return; }
    const res = G.sellAsset(s, d.id, st.q * (parseInt(d.p, 10) / 100));
    if (!res) return;
    toast(`Vendu ${money(res.net)} · ${res.pnl >= 0 ? '+' : ''}${money(res.pnl)}`, res.pnl >= 0 ? 'good' : 'bad');
    vibrate(8);
    V.update(s);
  },

  buyprop: (d) => {
    const p = PROPERTIES.find((x) => x.id === d.id);
    if (G.buyProperty(s, d.id)) { toast(`🔑 ${p.name} acquis à ${p.city}`, 'good'); vibrate(12); }
    else toast('Fonds insuffisants', 'bad');
  },

  upgrade: (d) => {
    if (G.upgradeProperty(s, d.id)) { toast('🔨 Bien amélioré', 'good'); vibrate(8); }
    else toast('Fonds insuffisants', 'bad');
  },

  prestige: () => {
    const gain = G.pendingAngels(s);
    if (gain <= 0) return;
    openSheet(`
      <h3>Revendre l'empire ?</h3>
      <p class="small muted" style="margin:6px 0 14px">
        Vous perdez vos liquidités, entreprises, positions et biens.
        Vous conservez vos succès et gagnez <b class="up">◆ ${fmt(gain)}</b> actionnaires,
        soit <b>+${((s.angels + gain) * 2).toFixed(0)} %</b> de revenus permanents.
      </p>
      <button class="btn btn-gold btn-block" data-act="prestige-go">Confirmer la revente</button>
      <button class="btn btn-block btn-ghost" data-close="1" style="margin-top:8px">Annuler</button>
    `);
  },

  'prestige-go': () => {
    const gain = G.pendingAngels(s);
    const keep = {
      angels: s.angels + gain,
      achievements: s.achievements,
      createdAt: s.createdAt,
      runs: (s.runs || 0) + 1,
    };
    const fresh = createState(keep);
    fresh.stats.playTime = s.stats.playTime;
    fresh.stats.trades = s.stats.trades;
    fresh.stats.bestGain = s.stats.bestGain;
    fresh.stats.bestNetWorth = s.stats.bestNetWorth;
    Object.assign(s, fresh);
    save(s);
    closeSheet();
    setTab('business');
    toast(`◆ +${fmt(gain)} actionnaires — nouveau départ !`, 'gold');
  },

  export: () => {
    const data = btoa(unescape(encodeURIComponent(JSON.stringify(s))));
    openSheet(`
      <h3>Exporter la sauvegarde</h3>
      <p class="small muted" style="margin:6px 0 10px">Copiez ce code pour restaurer votre partie ailleurs.</p>
      <textarea id="exp" readonly style="width:100%;height:120px;border-radius:12px;background:rgba(0,0,0,.3);
        color:var(--txt);border:1px solid var(--line);padding:10px;font-size:11px">${esc(data)}</textarea>
      <button class="btn btn-gold btn-block" data-act="copy" style="margin-top:10px">Copier</button>
      <button class="btn btn-block btn-ghost" data-close="1" style="margin-top:8px">Fermer</button>
    `);
  },

  copy: () => {
    const ta = $('#exp');
    ta.select();
    const done = () => toast('Copié dans le presse-papiers', 'good');
    if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done, () => toast('Copie manuelle requise', 'bad'));
    else { document.execCommand('copy'); done(); }
  },

  import: () => {
    openSheet(`
      <h3>Importer une sauvegarde</h3>
      <p class="small muted" style="margin:6px 0 10px">Collez un code d'export. La partie en cours sera remplacée.</p>
      <textarea id="imp" style="width:100%;height:120px;border-radius:12px;background:rgba(0,0,0,.3);
        color:var(--txt);border:1px solid var(--line);padding:10px;font-size:11px"></textarea>
      <button class="btn btn-green btn-block" data-act="import-go" style="margin-top:10px">Importer</button>
      <button class="btn btn-block btn-ghost" data-close="1" style="margin-top:8px">Annuler</button>
    `);
  },

  'import-go': () => {
    try {
      const raw = decodeURIComponent(escape(atob($('#imp').value.trim())));
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || !data.businesses) throw new Error('format');
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      closeSheet();
      toast('Sauvegarde importée, rechargement…', 'good');
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      toast('Code invalide', 'bad');
    }
  },

  reset: () => {
    openSheet(`
      <h3>Tout réinitialiser ?</h3>
      <p class="small muted" style="margin:6px 0 14px">
        Progression, actionnaires et succès seront définitivement effacés.
      </p>
      <button class="btn btn-red btn-block" data-act="reset-go">Effacer ma partie</button>
      <button class="btn btn-block btn-ghost" data-close="1" style="margin-top:8px">Annuler</button>
    `);
  },

  'reset-go': () => {
    wipe();
    location.reload();
  },
};

/* ---------------- Délégation d'événements ---------------- */

document.addEventListener('click', (e) => {
  const nav = e.target.closest('.nav-btn');
  if (nav) { setTab(nav.dataset.tab); return; }

  const t = e.target.closest('[data-act]');
  if (!t || !t.dataset.act) return;
  const fn = ACTIONS[t.dataset.act];
  if (!fn) return;
  fn(t.dataset, e);
  updateHUD();
  if (!sheetOpen()) V.update(s);
});

/* Bonus actionnaires : raccourci vers le profil. */
$('#hud-angels').addEventListener('click', () => setTab('profile'));

/* ---------------- Cycle de vie ---------------- */

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    save(s);
  } else {
    // rAF est gelé en arrière-plan : on rattrape le temps écoulé.
    const off = G.applyOffline(s);
    if (off) {
      M.fastForward(s, off.seconds);
      if (off.earned > 1) toast(`+${money(off.earned)} pendant votre absence`, 'gold');
    }
    last = performance.now();
    V.render(s);
    updateHUD();
  }
});

window.addEventListener('pagehide', () => save(s));
window.addEventListener('beforeunload', () => save(s));

/* Empêche le zoom par double-tap sur les boutons de jeu. */
document.addEventListener('dblclick', (e) => { if (e.target.closest('[data-act]')) e.preventDefault(); });

/* ---------------- Service worker ---------------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* hors-ligne non critique */ });
  });
}

/* Console de développement (uniquement en local) : window.RL.s, RL.save(), RL.G… */
if (['localhost', '127.0.0.1', ''].includes(location.hostname)) {
  window.RL = { s, save: () => save(s), render: () => V.render(s), G, M, V };
}

boot();
requestAnimationFrame(frame);
