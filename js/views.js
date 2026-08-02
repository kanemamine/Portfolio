/* Rendu des onglets : entreprises, marchés, immobilier, profil. */

import {
  BUSINESSES, PROPERTIES, ACHIEVEMENTS, UNLOCKS, UPGRADE_MAX,
  upgradeCost, propIncome, levelInfo, ASSET_BY_ID,
} from './data.js';
import * as G from './game.js';
import * as M from './market.js';
import { fmt, money, price, qty, pct, dur, cyc, esc, $, $$, clamp } from './util.js';
import { sparkline, chart, openSheet, closeSheet, sheetOpen, sheetEl, toast } from './ui.js';

const view = $('#view');
let refs = { tab: null };
let refresh = () => {};

/** Injecté par main.js pour demander un nouveau rendu complet. */
export function init(fn) { refresh = fn; }

/* =================================================================
   ENTREPRISES
================================================================= */

/** Entreprises visibles : la suivante se dévoile quand la précédente est possédée. */
function visibleBusinesses(s) {
  const out = [];
  for (let i = 0; i < BUSINESSES.length; i++) {
    const b = BUSINESSES[i];
    const st = s.businesses[b.id];
    const prevOwned = i === 0 || s.businesses[BUSINESSES[i - 1].id].owned > 0;
    if (st.owned > 0 || (prevOwned && s.totalEarned >= b.baseCost * 0.35)) out.push(b);
    else if (prevOwned) { out.push(b); break; }
  }
  return out;
}

function renderBusiness(s) {
  const list = visibleBusinesses(s);
  const modes = [1, 10, 100, 'max'];

  view.innerHTML = `
    <div class="sec-title"><b>Mon empire</b><span>Revenu passif <em id="f-ips" class="up">$0</em>/s</span></div>
    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <div class="seg" id="buymode">
        ${modes.map((m) => `<button data-act="mode" data-mode="${m}" class="${s.buyMode === m ? 'on' : ''}">${m === 'max' ? 'MAX' : 'x' + m}</button>`).join('')}
      </div>
      <button class="btn btn-sm" data-act="runall">▶ Tout lancer</button>
    </div>
    ${list.map((b) => businessCard(s, b)).join('')}
    ${list.length < BUSINESSES.length ? '<div class="card locked small muted" style="text-align:center">🔒 Développez votre empire pour débloquer de nouveaux secteurs…</div>' : ''}
  `;

  refs = { tab: 'business', ids: list.map((b) => b.id), cards: {}, count: list.length };
  for (const b of list) {
    const card = view.querySelector(`[data-biz="${b.id}"]`);
    refs.cards[b.id] = {
      card,
      count: card.querySelector('[data-f=count]'),
      ico: card.querySelector('.biz-ico'),
      rev: card.querySelector('[data-f=rev]'),
      bar: card.querySelector('.prog i'),
      time: card.querySelector('.prog span'),
      buy: card.querySelector('[data-act=buy]'),
      buyCost: card.querySelector('[data-f=cost]'),
      buyQty: card.querySelector('[data-f=qty]'),
      ms: card.querySelector('[data-f=ms]'),
      mgr: card.querySelector('[data-act=mgr]'),
    };
  }
  refs.ips = $('#f-ips');
}

function businessCard(s, b) {
  const st = s.businesses[b.id];
  return `
  <div class="card" data-biz="${b.id}">
    <div class="biz">
      <button class="biz-ico" data-act="run" data-id="${b.id}" aria-label="Lancer ${esc(b.name)}">
        ${b.icon}<span class="count" data-f="count">${st.owned}</span>
      </button>
      <div class="grow">
        <div class="row">
          <div class="biz-name grow ell">${esc(b.name)}</div>
          <div class="small muted" data-f="rev">—</div>
        </div>
        <div class="prog"><i></i><span></span></div>
      </div>
      <button class="biz-buy" data-act="buy" data-id="${b.id}">
        <small data-f="qty">ACHETER</small><span data-f="cost">—</span>
      </button>
    </div>
    <div class="biz-foot">
      <span class="small muted ell" data-f="ms"></span>
      <button class="btn btn-sm" data-act="mgr" data-id="${b.id}"></button>
    </div>
  </div>`;
}

function updateBusiness(s) {
  if (visibleBusinesses(s).length !== refs.count) { refresh(); return; }
  refs.ips.textContent = money(G.incomePerSec(s));

  for (const id of refs.ids) {
    const b = BUSINESSES.find((x) => x.id === id);
    const st = s.businesses[id];
    const r = refs.cards[id];
    const ct = G.cycleTime(b, st);

    r.count.textContent = st.owned;
    r.rev.textContent = st.owned ? money(G.revenue(b, st, s)) + ' / cycle' : 'aucune unité';
    r.ico.classList.toggle('can-run', st.owned > 0 && !st.running && !st.manager);

    const p = st.owned > 0 && st.running ? clamp(st.progress / ct, 0, 1) : 0;
    r.bar.style.width = (p * 100).toFixed(1) + '%';
    r.time.textContent = st.owned === 0 ? '—'
      : st.running ? cyc(Math.max(0, ct - st.progress))
      : st.manager ? cyc(ct) : 'Appuyez pour produire';

    // bouton d'achat
    let count = G.resolveCount(s, b, st);
    if (s.buyMode === 'max') count = Math.max(1, G.maxAffordable(b, st.owned, s.cash));
    const cost = G.costOf(b, st.owned, count);
    r.buyQty.textContent = 'ACHETER x' + count;
    r.buyCost.textContent = money(cost);
    r.buy.disabled = s.cash < cost;

    // palier suivant
    const nm = G.nextMilestone(st.owned);
    r.ms.textContent = nm ? `Palier ${nm} → revenu x2 (${nm - st.owned} restantes)` : 'Tous les paliers atteints ✦';

    // manager
    if (st.manager) {
      r.mgr.textContent = '✓ Manager actif';
      r.mgr.disabled = true;
      r.mgr.className = 'btn btn-sm btn-ghost';
    } else {
      r.mgr.textContent = 'Manager ' + money(b.manager);
      r.mgr.disabled = s.cash < b.manager;
      r.mgr.className = 'btn btn-sm' + (s.cash >= b.manager ? ' btn-gold' : '');
    }
  }
}

/* =================================================================
   MARCHÉS (bourse & crypto)
================================================================= */

function renderMarket(s, kind) {
  const tab = kind === 'stock' ? 'stocks' : 'crypto';
  if (!G.isUnlocked(s, tab)) { renderLocked(s, tab); return; }

  const list = M.assetsOf(kind);
  const label = kind === 'stock' ? 'Bourse' : 'Crypto';

  view.innerHTML = `
    <div class="sec-title"><b>${label}</b><span>Positions <em id="f-pv">$0</em></span></div>
    <div class="card" id="market-list">
      ${list.map((a) => assetRow(s, a)).join('')}
    </div>
    <div class="card small muted">
      Frais de transaction : ${(list[0].fee * 100).toFixed(2)} %. Les cours évoluent en continu,
      même hors de cet onglet — surveillez les actualités.
    </div>`;

  refs = { tab, kind, ids: list.map((a) => a.id), rows: {} };
  for (const a of list) {
    const row = view.querySelector(`[data-asset="${a.id}"]`);
    refs.rows[a.id] = {
      row,
      p: row.querySelector('[data-f=p]'),
      c: row.querySelector('[data-f=c]'),
      pos: row.querySelector('[data-f=pos]'),
      cv: row.querySelector('canvas'),
    };
  }
  refs.pv = $('#f-pv');
}

function assetRow(s, a) {
  return `
  <div class="asset" data-asset="${a.id}" data-act="asset" data-id="${a.id}">
    <div class="asset-tick">${a.id}</div>
    <div class="grow">
      <div class="asset-name ell">${esc(a.name)}</div>
      <div class="small muted ell"><span class="pill">${esc(a.sector)}</span> <span data-f="pos"></span></div>
    </div>
    <canvas class="spark"></canvas>
    <div class="asset-price">
      <b data-f="p">—</b><span class="chg" data-f="c">—</span>
    </div>
  </div>`;
}

function updateMarket(s) {
  let pv = 0;
  for (const id of refs.ids) {
    const st = s.assets[id];
    const r = refs.rows[id];
    const ch = M.change(st);
    const up = ch >= 0;
    r.p.textContent = price(st.p);
    r.c.textContent = pct(ch);
    r.c.className = 'chg ' + (up ? 'up' : 'down');
    if (st.q > 0) {
      const u = M.unrealized(id, st);
      pv += u.value;
      r.pos.innerHTML = `<span class="pos-badge">${qty(st.q)} · ${money(u.value)}</span>
        <span class="${u.pnl >= 0 ? 'up' : 'down'}">${u.pnl >= 0 ? '+' : ''}${money(u.pnl)}</span>`;
    } else {
      r.pos.textContent = '';
    }
    sparkline(r.cv, st.hist, up);
  }
  refs.pv.textContent = money(pv);
  if (sheetOpen() && refs.sheetId) updateAssetSheet(s);
}

/* ---- Feuille de trading ---- */

export function openAssetSheet(s, id) {
  const a = ASSET_BY_ID[id];
  const st = s.assets[id];
  openSheet(`
    <div class="row">
      <div class="asset-tick" style="width:46px;height:46px">${a.id}</div>
      <div class="grow">
        <h3>${esc(a.name)}</h3>
        <div class="small muted"><span class="pill">${esc(a.sector)}</span> ${a.kind === 'stock' ? 'Action' : 'Crypto-actif'}</div>
      </div>
      <div class="right">
        <b id="s-p" style="font-size:18px">${price(st.p)}</b>
        <div class="chg" id="s-c"></div>
      </div>
    </div>
    <canvas class="chart" id="s-chart" style="margin-top:12px"></canvas>
    <div class="stat-grid">
      <div class="stat"><span class="tiny">Position</span><b id="s-q">—</b></div>
      <div class="stat"><span class="tiny">Prix de revient</span><b id="s-avg">—</b></div>
      <div class="stat"><span class="tiny">Plus-value</span><b id="s-pnl">—</b></div>
    </div>
    <div class="tiny">Montant à investir</div>
    <div class="trade">
      <input id="s-amt" type="number" inputmode="decimal" min="0" placeholder="0" />
      <button class="btn btn-green" data-act="buy-asset" data-id="${id}">Acheter</button>
    </div>
    <div class="quick">
      ${[10, 25, 50, 100].map((p) => `<button class="btn btn-sm" data-act="q-buy" data-p="${p}">${p === 100 ? 'MAX' : p + '% cash'}</button>`).join('')}
    </div>
    <div class="tiny" style="margin-top:16px">Vendre ma position</div>
    <div class="quick">
      ${[25, 50, 100].map((p) => `<button class="btn btn-sm btn-red" data-act="q-sell" data-id="${id}" data-p="${p}">${p}%</button>`).join('')}
    </div>
    <button class="btn btn-block btn-ghost" data-close="1" style="margin-top:16px">Fermer</button>
  `, () => { refs.sheetId = null; });

  refs.sheetId = id;
  updateAssetSheet(s);
}

function updateAssetSheet(s) {
  const id = refs.sheetId;
  const st = s.assets[id];
  const sh = sheetEl();
  const q = (sel) => sh.querySelector(sel);
  const ch = M.change(st);
  const up = ch >= 0;
  const u = M.unrealized(id, st);

  q('#s-p').textContent = price(st.p);
  const c = q('#s-c');
  c.textContent = pct(ch);
  c.className = 'chg ' + (up ? 'up' : 'down');
  q('#s-q').textContent = st.q > 0 ? qty(st.q) : '—';
  q('#s-avg').textContent = st.avg > 0 ? price(st.avg) : '—';
  const pnl = q('#s-pnl');
  pnl.textContent = st.q > 0 ? (u.pnl >= 0 ? '+' : '') + money(u.pnl) : '—';
  pnl.className = st.q > 0 ? (u.pnl >= 0 ? 'up' : 'down') : '';
  chart(q('#s-chart'), st.hist, up, st.avg);
}

/* =================================================================
   IMMOBILIER
================================================================= */

function renderEstate(s) {
  if (!G.isUnlocked(s, 'estate')) { renderLocked(s, 'estate'); return; }

  view.innerHTML = `
    <div class="sec-title"><b>Immobilier</b><span>Revenu <em id="f-eps" class="up">$0</em>/s</span></div>
    ${PROPERTIES.map((p) => propCard(s, p)).join('')}`;

  refs = { tab: 'estate', cards: {} };
  for (const p of PROPERTIES) {
    const card = view.querySelector(`[data-prop="${p.id}"]`);
    refs.cards[p.id] = {
      card,
      inc: card.querySelector('[data-f=inc]'),
      dots: card.querySelector('.lv-dots'),
      btn: card.querySelector('[data-act]'),
    };
  }
  refs.eps = $('#f-eps');
}

function propCard(s, p) {
  const st = s.properties[p.id];
  return `
  <div class="card" data-prop="${p.id}">
    <div class="prop">
      <div class="prop-ico">${p.icon}</div>
      <div class="grow">
        <div class="row"><div class="biz-name grow ell">${esc(p.name)}</div></div>
        <div class="small muted">${esc(p.city)} · <span data-f="inc"></span></div>
        <div class="lv-dots">${Array.from({ length: UPGRADE_MAX }, (_, i) => `<i class="${i < st.level ? 'on' : ''}"></i>`).join('')}</div>
      </div>
      <button class="btn btn-sm" data-act="${st.owned ? 'upgrade' : 'buyprop'}" data-id="${p.id}"></button>
    </div>
  </div>`;
}

function updateEstate(s) {
  refs.eps.textContent = money(G.estatePerSec(s));
  for (const p of PROPERTIES) {
    const st = s.properties[p.id];
    const r = refs.cards[p.id];
    r.card.classList.toggle('locked', !st.owned && s.cash < p.price);
    r.inc.textContent = st.owned
      ? money(propIncome(p, st.level) * G.angelMult(s)) + ' / h'
      : money(p.income) + ' / h';

    // les pastilles de niveau ne changent qu'à l'amélioration
    const dots = r.dots.children;
    for (let i = 0; i < dots.length; i++) dots[i].className = i < st.level ? 'on' : '';

    if (!st.owned) {
      r.btn.dataset.act = 'buyprop';
      r.btn.textContent = money(p.price);
      r.btn.className = 'btn btn-sm' + (s.cash >= p.price ? ' btn-gold' : '');
      r.btn.disabled = s.cash < p.price;
    } else if (st.level >= UPGRADE_MAX) {
      r.btn.dataset.act = '';
      r.btn.textContent = 'NIVEAU MAX';
      r.btn.className = 'btn btn-sm btn-ghost';
      r.btn.disabled = true;
    } else {
      const cost = upgradeCost(p, st.level);
      r.btn.dataset.act = 'upgrade';
      r.btn.textContent = 'Améliorer ' + money(cost);
      r.btn.className = 'btn btn-sm' + (s.cash >= cost ? ' btn-green' : '');
      r.btn.disabled = s.cash < cost;
    }
  }
}

/* =================================================================
   PROFIL
================================================================= */

function renderProfile(s) {
  const nw = G.netWorth(s);
  const lv = levelInfo(nw);
  const pend = G.pendingAngels(s);

  view.innerHTML = `
    <div class="card">
      <div class="row">
        <div class="biz-ico" style="font-size:26px">${lv.level >= 18 ? '👑' : lv.level >= 12 ? '🤵' : '🧑‍💼'}</div>
        <div class="grow">
          <h3>${esc(lv.title)}</h3>
          <div class="small muted">Niveau ${lv.level} · ${s.runs} revente${s.runs > 1 ? 's' : ''} d'empire</div>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat"><span class="tiny">Patrimoine</span><b id="f-nw">—</b></div>
        <div class="stat"><span class="tiny">Revenu/s</span><b id="f-inc" class="up">—</b></div>
        <div class="stat"><span class="tiny">Total gagné</span><b id="f-te">—</b></div>
      </div>
    </div>

    <div class="sec-title"><b>Répartition du patrimoine</b></div>
    <div class="card">
      <div class="kv"><span>💵 Liquidités</span><b id="f-b-cash">—</b></div>
      <div class="kv"><span>🏢 Entreprises</span><b id="f-b-biz">—</b></div>
      <div class="kv"><span>📈 Portefeuille</span><b id="f-b-pf">—</b></div>
      <div class="kv"><span>🏙️ Immobilier</span><b id="f-b-es">—</b></div>
    </div>

    <div class="sec-title"><b>Revendre l'empire</b><span>Prestige</span></div>
    <div class="card">
      <p class="small muted" style="margin:0 0 10px">
        Vendez tout et repartez de zéro : chaque <b class="pill">◆ actionnaire</b> obtenu ajoute
        <b>+2 %</b> de revenus permanents à toutes vos parties futures.
      </p>
      <div class="row" style="justify-content:space-between">
        <div>
          <div class="tiny">Actionnaires actuels</div>
          <b>◆ ${fmt(s.angels)} <span class="small muted">(+${(s.angels * 2).toFixed(0)} %)</span></b>
        </div>
        <div class="right">
          <div class="tiny">À la revente</div>
          <b class="${pend > 0 ? 'up' : 'muted'}">+${fmt(pend)}</b>
        </div>
      </div>
      <button class="btn btn-block ${pend > 0 ? 'btn-gold' : ''}" data-act="prestige" style="margin-top:12px" ${pend > 0 ? '' : 'disabled'}>
        ${pend > 0 ? 'Revendre et repartir' : 'Encore trop tôt'}
      </button>
    </div>

    <div class="sec-title"><b>Succès</b><span>${Object.keys(s.achievements).length}/${ACHIEVEMENTS.length}</span></div>
    <div class="card">
      <div class="ach">
        ${ACHIEVEMENTS.map((a) => `
          <div class="ach-i ${s.achievements[a.id] ? 'got' : ''}">
            <span>${s.achievements[a.id] ? a.icon : '🔒'}</span><em>${esc(a.name)}</em>
          </div>`).join('')}
      </div>
    </div>

    <div class="sec-title"><b>Statistiques</b></div>
    <div class="card">
      <div class="kv"><span>Temps de jeu</span><b id="f-pt">—</b></div>
      <div class="kv"><span>Transactions</span><b>${fmt(s.stats.trades)}</b></div>
      <div class="kv"><span>Meilleure plus-value</span><b>${money(s.stats.bestGain)}</b></div>
      <div class="kv"><span>Patrimoine record</span><b id="f-best">—</b></div>
    </div>

    <div class="sec-title"><b>Sauvegarde</b></div>
    <div class="card">
      <div class="row" style="gap:8px">
        <button class="btn btn-sm grow" data-act="export">Exporter</button>
        <button class="btn btn-sm grow" data-act="import">Importer</button>
        <button class="btn btn-sm btn-red grow" data-act="reset">Réinitialiser</button>
      </div>
      <p class="small muted" style="margin:10px 0 0">
        La partie est enregistrée dans ce navigateur et progresse hors-ligne (jusqu'à 8 h).
      </p>
    </div>`;

  refs = {
    tab: 'profile',
    nw: $('#f-nw'), inc: $('#f-inc'), te: $('#f-te'), pt: $('#f-pt'), best: $('#f-best'),
    bCash: $('#f-b-cash'), bBiz: $('#f-b-biz'), bPf: $('#f-b-pf'), bEs: $('#f-b-es'),
  };
}

function updateProfile(s) {
  const nw = G.netWorth(s);
  refs.nw.textContent = money(nw);
  refs.inc.textContent = money(G.incomePerSec(s));
  refs.te.textContent = money(s.totalEarned);
  refs.pt.textContent = dur(s.stats.playTime);
  refs.best.textContent = money(s.stats.bestNetWorth);
  refs.bCash.textContent = money(s.cash);
  refs.bBiz.textContent = money(G.businessValue(s));
  refs.bPf.textContent = money(G.portfolioValue(s));
  refs.bEs.textContent = money(G.estateValue(s));
}

/* =================================================================
   ONGLET VERROUILLÉ
================================================================= */

function renderLocked(s, tab) {
  const need = UNLOCKS[tab];
  const names = {
    stocks: 'La Bourse est verrouillée',
    crypto: 'Le marché crypto est verrouillé',
    estate: "L'immobilier est verrouillé",
  };
  view.innerHTML = `
    <div class="card" style="text-align:center;padding:36px 18px">
      <div style="font-size:44px">🔒</div>
      <h3 style="margin:10px 0 6px">${names[tab]}</h3>
      <p class="small muted" style="margin:0">
        Débloqué à <b class="up">${money(need)}</b> de gains cumulés.<br>
        Vous en êtes à <b>${money(s.totalEarned)}</b>.
      </p>
      <div class="prog" style="margin-top:16px"><i style="width:${clamp((s.totalEarned / need) * 100, 0, 100)}%"></i>
        <span>${clamp((s.totalEarned / need) * 100, 0, 100).toFixed(1)} %</span></div>
      <button class="btn btn-gold" data-act="goto" data-tab="business" style="margin-top:16px">Développer mon empire</button>
    </div>`;
  refs = { tab, locked: true, need };
}

function updateLocked(s) {
  const p = clamp((s.totalEarned / refs.need) * 100, 0, 100);
  const bar = view.querySelector('.prog i');
  const lbl = view.querySelector('.prog span');
  if (bar) bar.style.width = p + '%';
  if (lbl) lbl.textContent = p.toFixed(1) + ' %';
  if (p >= 100) refresh();
}

/* =================================================================
   POINT D'ENTRÉE DU RENDU
================================================================= */

export function render(s) {
  view.scrollTop = 0;
  switch (s.tab) {
    case 'business': renderBusiness(s); break;
    case 'stocks': renderMarket(s, 'stock'); break;
    case 'crypto': renderMarket(s, 'crypto'); break;
    case 'estate': renderEstate(s); break;
    case 'profile': renderProfile(s); break;
  }
  update(s);
}

export function update(s) {
  if (!refs || refs.tab !== s.tab) return;
  if (refs.locked) { updateLocked(s); return; }
  switch (s.tab) {
    case 'business': updateBusiness(s); break;
    case 'stocks': case 'crypto': updateMarket(s); break;
    case 'estate': updateEstate(s); break;
    case 'profile': updateProfile(s); break;
  }
}

export const currentSheetId = () => refs.sheetId;
export { refs };
