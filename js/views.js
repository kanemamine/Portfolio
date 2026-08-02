/* Rendu des cinq onglets : Earnings, Business, Investments, Luxe, Account. */

import * as D from './data.js';
import * as E from './engine.js';
import { fmt, money, price as fmtPrice, qty as fmtQty, pct, dur, esc, $, clamp } from './util.js';
import { sparkline, chart, openSheet } from './ui.js';
import { houseScene } from './art.js';

const view = $('#view');
let refresh = () => {};
export function init(fn) { refresh = fn; }

const byId = (arr, id) => arr.find((x) => x.id === id);
const bar = (p, label) => `<div class="prog"><i style="width:${clamp(p * 100, 0, 100)}%"></i><span>${label}</span></div>`;

/* =================================================================
   EARNINGS — le clicker
================================================================= */
function renderEarnings(s) {
  const tier = E.clickTier(s);
  const next = E.nextClickTier(s);
  const boost = E.boostActive(s);
  const auto = E.autoclickActive(s);

  view.innerHTML = `
    <div class="tapwrap">
      <div class="tap-head">
        <div><span class="tiny">Profit par tap</span><b id="f-tap" class="tap-val">${money(E.clickValue(s))}</b></div>
        <div class="right"><span class="tiny">Revenu horaire</span><b id="f-hr" class="up">${money(E.incomePerHour(s))}</b></div>
      </div>
      <button class="taparea ${boost ? 'boosted' : ''}" data-act="tap" aria-label="Gagner de l'argent">
        <span class="tap-ico">${boost ? '🔥' : '💰'}</span>
        <span class="tap-hint">${auto ? 'Auto-clic en cours…' : 'Touchez pour gagner de l’argent'}</span>
      </button>
      <div class="row" style="gap:8px;margin-top:12px">
        <button class="btn grow ${boost ? 'btn-gold' : ''}" data-act="boost" ${boost ? 'disabled' : ''}>
          ${boost ? `🔥 ×${D.BOOST_MULT} — ${Math.ceil((s.boostUntil - Date.now()) / 1000)}s` : `🔥 Boost ×${D.BOOST_MULT} (30 s)`}
        </button>
        <button class="btn grow ${auto ? 'btn-green' : ''}" data-act="autoclick" ${auto ? 'disabled' : ''}>
          ${auto ? `🤖 ${Math.ceil((s.autoclickUntil - Date.now()) / 1000)}s` : '🤖 Auto-clic (60 s)'}
        </button>
      </div>
    </div>

    <div class="sec-title"><b>Niveau de revenu</b><span>${s.clickLevel}/${D.CLICK_LEVELS.length}</span></div>
    <div class="card">
      <div class="kv"><span>Gain par tap</span><b>${money(tier.tap)}</b></div>
      <div class="kv"><span>Revenu passif</span><b class="up">${money(tier.idle)} / h</b></div>
      ${next ? `
        <div class="kv"><span>Niveau suivant</span><b>${money(next.tap)} / tap · ${money(next.idle)} / h</b></div>
        <button class="btn btn-block ${s.cash >= next.cost ? 'btn-gold' : ''}" data-act="levelup" ${s.cash >= next.cost ? '' : 'disabled'}>
          Améliorer — ${money(next.cost)}
        </button>`
        : '<p class="small muted" style="margin:8px 0 0">Niveau maximal atteint ✦</p>'}
    </div>

    <div class="sec-title"><b>Récompense du jour</b></div>
    <div class="card">
      <div class="row">
        <div class="biz-ico">🎁</div>
        <div class="grow">
          <b>${esc(D.DAILY_REWARDS[s.daily.index % D.DAILY_REWARDS.length].name)}</b>
          <div class="small muted">${esc(D.DAILY_REWARDS[s.daily.index % D.DAILY_REWARDS.length].desc)}</div>
        </div>
        <button class="btn btn-sm ${canClaimDaily(s) ? 'btn-gold' : ''}" data-act="daily" ${canClaimDaily(s) ? '' : 'disabled'}>
          ${canClaimDaily(s) ? 'Récupérer' : 'Demain'}
        </button>
      </div>
      <div class="kv" style="margin-top:8px"><span>🎫 Accélérateurs de chantier</span><b>${s.tickets}</b></div>
    </div>`;
}

export const canClaimDaily = (s) => Math.floor(Date.now() / 864e5) > s.daily.day;

function updateEarnings(s) {
  const t = $('#f-tap'), h = $('#f-hr');
  if (t) t.textContent = money(E.clickValue(s));
  if (h) h.textContent = money(E.incomePerHour(s));
}

/* =================================================================
   BUSINESS — entreprises fondées dans des slots
================================================================= */
function renderBusiness(s) {
  const used = s.businesses.length;
  view.innerHTML = `
    <div class="sec-title"><b>Mes entreprises</b><span>Revenu <em class="up">${money(s.businesses.reduce((n, b) => n + (b.stageEndsAt ? 0 : E.bizIncome(s, b)), 0))}</em>/h</span></div>
    <div class="card row" style="gap:10px">
      <div class="grow">
        <b>${used} / ${s.slots} emplacements</b>
        <div class="small muted">Chaque emplacement accueille une société.</div>
      </div>
      <button class="btn btn-sm" data-act="buyslot">+1 — ${money(D.slotCost(s.slots))}</button>
    </div>
    <button class="btn btn-gold btn-block" data-act="found" style="margin-bottom:12px" ${used >= s.slots ? 'disabled' : ''}>
      ${used >= s.slots ? 'Aucun emplacement libre' : '＋ Fonder une entreprise'}
    </button>
    ${used === 0 ? '<div class="card small muted" style="text-align:center">Aucune société. Fondez la première pour lancer un revenu passif.</div>' : ''}
    ${s.businesses.map((b) => bizCard(s, b)).join('')}`;
}

function bizCard(s, b) {
  const t = D.BUSINESS_BY_ID[b.type];
  const st = E.currentStage(b);
  const running = !!b.stageEndsAt;
  const left = running ? (b.stageEndsAt - Date.now()) / 1000 : 0;
  const total = running && st ? st.sec : 1;
  return `
  <div class="card" data-biz="${b.uid}">
    <div class="row">
      <div class="biz-ico">${t.icon}</div>
      <div class="grow">
        <div class="biz-name ell">${esc(b.name)}</div>
        <div class="small muted ell">${esc(t.name)} · niveau ${b.level}</div>
      </div>
      <div class="right">
        <b class="up">${money(running ? 0 : E.bizIncome(s, b))}</b>
        <div class="tiny">par heure</div>
      </div>
    </div>
    <div class="kv"><span>Capitalisation</span><b>${money(b.cap)}</b></div>
    ${running
      ? `<div data-prog="${b.uid}" data-total="${total}">${bar(1 - left / total, `${esc(st ? st.name : '')} · ${dur(left)}`)}</div>
         <button class="btn btn-sm btn-block" data-act="rush" data-uid="${b.uid}" style="margin-top:8px">
           🎫 Terminer maintenant (${s.tickets})</button>`
      : st
        ? `<div class="row" style="gap:8px;margin-top:8px">
             <button class="btn btn-sm grow" data-act="project" data-uid="${b.uid}">
               🔨 ${esc(st.name)} — ${money(E.stageCost(b))}</button>
           </div>`
        : '<div class="small muted" style="margin-top:8px">Tous les projets sont achevés ✦</div>'}
    <div class="row" style="gap:6px;margin-top:8px">
      <button class="btn btn-sm grow" data-act="lvlup" data-uid="${b.uid}">↑ Niveau — ${money(E.bizLevelCost(b))}</button>
      ${t.spec ? `<button class="btn btn-sm" data-act="spec" data-uid="${b.uid}">⚙️</button>` : ''}
      <button class="btn btn-sm" data-act="bizmenu" data-uid="${b.uid}">⋯</button>
    </div>
  </div>`;
}

function updateBusiness(s) {
  for (const b of s.businesses) {
    if (!b.stageEndsAt) continue;
    const box = view.querySelector(`[data-prog="${b.uid}"]`);
    if (!box) continue;
    const total = parseFloat(box.dataset.total) || 1;
    const left = Math.max(0, (b.stageEndsAt - Date.now()) / 1000);
    const st = E.currentStage(b);
    box.querySelector('i').style.width = clamp((1 - left / total) * 100, 0, 100) + '%';
    box.querySelector('span').textContent = `${st ? st.name : ''} · ${dur(left)}`;
    if (left <= 0) refresh();
  }
}

/* =================================================================
   INVESTMENTS — actions, crypto, immobilier
================================================================= */
const SUBS = {
  investments: [['stocks', 'Actions'], ['crypto', 'Crypto'], ['estate', 'Immobilier']],
  luxe: [['vehicles', 'Véhicules'], ['collections', 'Collections'], ['islands', 'Îles']],
};

function subBar(s, tab) {
  const cur = s.sub[tab];
  return `<div class="seg seg-wide">${SUBS[tab].map(([id, label]) =>
    `<button data-act="sub" data-tab="${tab}" data-sub="${id}" class="${cur === id ? 'on' : ''}">${label}</button>`).join('')}</div>`;
}

function renderInvestments(s) {
  const sub = s.sub.investments;
  let body = '';
  if (sub === 'stocks') {
    const val = E.stocksValue(s);
    const nextDiv = Math.max(0, (s.dividendAt - Date.now()) / 1000);
    body = `
      <div class="card">
        <div class="row"><div class="grow"><span class="tiny">Valeur du portefeuille</span><b style="font-size:20px">${money(val)}</b></div>
        <div class="right"><span class="tiny">Prochain dividende</span><b id="f-div">${dur(nextDiv)}</b></div></div>
      </div>
      <div class="card">${D.STOCKS.map((a) => stockRow(s, a)).join('')}</div>
      <div class="card small muted">Les dividendes tombent toutes les 3 heures, au taux propre à chaque société.</div>`;
  } else if (sub === 'crypto') {
    body = `
      <div class="card"><div class="row"><div class="grow"><span class="tiny">Valeur du portefeuille</span>
        <b style="font-size:20px">${money(E.cryptoValue(s))}</b></div>
        <div class="right small muted">Frais ${(D.CRYPTO_FEE * 100).toFixed(1)} %</div></div></div>
      <div class="card">${D.CRYPTOS.map((c) => cryptoRow(s, c)).join('')}</div>`;
  } else {
    const owned = D.BUILDINGS.filter((b) => s.estates[b.id].owned);
    body = `
      <div class="card"><div class="row"><div class="grow"><span class="tiny">Loyers</span>
        <b class="up" style="font-size:20px">${money(owned.reduce((n, b) => n + E.rentOf(s, b), 0))} / h</b></div>
        <div class="right"><span class="tiny">Biens</span><b>${owned.length}/${D.BUILDINGS.length}</b></div></div></div>
      ${D.BUILDINGS.map((b) => estateCard(s, b)).join('')}`;
  }
  view.innerHTML = `<div class="sec-title"><b>Investissements</b></div>${subBar(s, 'investments')}${body}`;
  drawSparks(s);
}

function stockRow(s, a) {
  const st = s.stocks[a.id];
  const p = E.stockPrice(s, a);
  const ch = E.change(st);
  return `
  <div class="asset" data-act="stock" data-id="${a.id}">
    <div class="asset-tick">${a.id}</div>
    <div class="grow">
      <div class="asset-name ell">${esc(a.name)}</div>
      <div class="small muted ell"><span class="pill">${esc(a.sector)}</span>
        <span class="gold">div ${a.div.toFixed(2)} %</span>
        ${st.qty > 0 ? ` · ${fmtQty(st.qty)} titres` : ''}</div>
    </div>
    <canvas class="spark" data-spark="s${a.id}"></canvas>
    <div class="asset-price"><b>${fmtPrice(p)}</b><span class="chg ${ch >= 0 ? 'up' : 'down'}">${pct(ch)}</span></div>
  </div>`;
}

function cryptoRow(s, c) {
  const st = s.cryptos[c.id];
  const p = E.cryptoPrice(s, c);
  const ch = E.change(st);
  return `
  <div class="asset" data-act="crypto" data-id="${c.id}">
    <div class="asset-tick">${c.id}</div>
    <div class="grow">
      <div class="asset-name ell">${esc(c.name)}</div>
      <div class="small muted ell">Cap. ${money(st.cap)}${st.qty > 0 ? ` · ${fmtQty(st.qty)}` : ''}</div>
    </div>
    <canvas class="spark" data-spark="c${c.id}"></canvas>
    <div class="asset-price"><b>${fmtPrice(p)}</b><span class="chg ${ch >= 0 ? 'up' : 'down'}">${pct(ch)}</span></div>
  </div>`;
}

function estateCard(s, b) {
  const st = s.estates[b.id];
  const done = D.UPGRADES.filter((u) => st.up[u.id]).length;
  return `
  <div class="card estate ${!st.owned && s.cash < b.price ? 'locked' : ''}">
    <div class="estate-media">
      ${houseScene(b, st.owned ? st.up : {})}
      <span class="house-tag ${st.owned ? '' : 'muted-tag'}">${st.owned ? `${done}/5 améliorations` : 'À vendre'}</span>
    </div>
    <div class="row" style="margin-top:10px">
      <div class="grow">
        <div class="biz-name ell">${esc(b.city)}</div>
        <div class="small muted ell">${esc(b.country)} · bâti en ${b.year}</div>
      </div>
      <div class="right">
        <b class="up">${money(E.rentOf(s, b))}</b><div class="tiny">par heure</div>
      </div>
    </div>
    ${st.owned
      ? `<div class="row" style="gap:6px;margin-top:8px">
           <button class="btn btn-sm grow" data-act="upgrades" data-id="${b.id}">🛠️ Améliorations ${done}/5</button>
           <button class="btn btn-sm" data-act="sellestate" data-id="${b.id}">Vendre</button>
         </div>`
      : `<button class="btn btn-sm btn-block ${s.cash >= b.price ? 'btn-gold' : ''}" data-act="buyestate" data-id="${b.id}"
           style="margin-top:8px" ${s.cash >= b.price ? '' : 'disabled'}>Acheter — ${money(b.price)}</button>`}
  </div>`;
}

/* =================================================================
   LUXE — véhicules, collections, îles
================================================================= */
function renderLuxe(s) {
  const sub = s.sub.luxe;
  let body = '';
  if (sub === 'vehicles') {
    body = D.VEHICLE_KINDS.map((k) => `
      <div class="sec-title"><b>${k.icon} ${k.name}</b><span>${s.vehicles.filter((v) => byId(D.VEHICLES, v.vid).kind === k.id).length} en ${esc(k.mine.toLowerCase())}</span></div>
      <div class="card">
        ${D.VEHICLES.filter((v) => v.kind === k.id).map((v) => `
          <div class="asset" data-act="vehicle" data-id="${v.id}">
            <div class="asset-tick" style="font-size:19px">${v.icon}</div>
            <div class="grow"><div class="asset-name ell">${esc(v.name)}</div>
              <div class="small muted">à partir de ${money(v.price)}</div></div>
            <span class="btn btn-sm ${s.cash >= v.price ? 'btn-gold' : ''}">Configurer</span>
          </div>`).join('')}
      </div>`).join('')
      + (s.vehicles.length ? `
        <div class="sec-title"><b>Ma flotte</b></div>
        <div class="card">${s.vehicles.map((o) => {
          const v = byId(D.VEHICLES, o.vid);
          return `<div class="asset">
            <div class="asset-tick" style="font-size:19px">${v.icon}</div>
            <div class="grow"><div class="asset-name ell">${esc(v.name)}</div>
              <div class="small muted">${esc(byId(D.TRIMS, o.trim).name)} · ${esc(byId(D.ENGINES, o.engine).name)} · payé ${money(o.paid)}</div></div>
            <button class="btn btn-sm" data-act="sellvehicle" data-uid="${o.uid}">Vendre ${money(o.paid * D.RESALE)}</button>
          </div>`;
        }).join('')}</div>` : '');
  } else if (sub === 'collections') {
    body = D.COLLECTIONS.map((col) => {
      const items = E.collectionItems(col);
      const owned = items.filter((i) => s.items[i.key]).length;
      return `
      <div class="sec-title"><b>${col.icon} ${esc(col.name)}</b><span>${owned}/${items.length}</span></div>
      <div class="card">${items.map((i) => `
        <div class="asset">
          <div class="asset-tick" style="font-size:18px">${s.items[i.key] ? col.icon : '🔒'}</div>
          <div class="grow"><div class="asset-name ell">${esc(i.name)}</div>
            <div class="small muted">${money(i.price)}</div></div>
          ${s.items[i.key]
            ? '<span class="pos-badge">acquis ✦</span>'
            : `<button class="btn btn-sm ${s.cash >= i.price ? 'btn-gold' : ''}" data-act="buyitem"
                 data-key="${i.key}" data-price="${i.price}" ${s.cash >= i.price ? '' : 'disabled'}>Acheter</button>`}
        </div>`).join('')}</div>`;
    }).join('');
  } else {
    body = `<div class="card small muted">Commission de ${(D.ISLAND_FEE * 100).toFixed(0)} % à la revente d’une île.</div>`
      + D.ISLANDS.map((i) => `
      <div class="card ${!s.islands[i.id] && s.cash < i.price ? 'locked' : ''}">
        <div class="row">
          <div class="biz-ico">${i.icon}</div>
          <div class="grow"><div class="biz-name ell">${esc(i.name)}</div>
            <div class="small muted">${esc(i.sea)}</div></div>
          ${s.islands[i.id]
            ? `<button class="btn btn-sm" data-act="sellisland" data-id="${i.id}">Vendre ${money(i.price * (1 - D.ISLAND_FEE))}</button>`
            : `<button class="btn btn-sm ${s.cash >= i.price ? 'btn-gold' : ''}" data-act="buyisland" data-id="${i.id}"
                 ${s.cash >= i.price ? '' : 'disabled'}>${money(i.price)}</button>`}
        </div>
      </div>`).join('');
  }
  view.innerHTML = `<div class="sec-title"><b>Luxe</b></div>${subBar(s, 'luxe')}${body}`;
}

/* =================================================================
   ACCOUNT — classement, patrimoine, trophées, statistiques
================================================================= */
function renderAccount(s) {
  const r = E.ranking(s);
  const near = E.rankNeighbours(s, 3);
  const parts = E.breakdown(s).filter((p) => p.value > 0);
  const total = parts.reduce((n, p) => n + p.value, 0) || 1;
  const earn = s.stats.earn;
  const earnRows = [
    ['Tapping', earn.tap, '👆'], ['Entreprises', earn.business, '🏢'], ['Loyers', earn.rent, '🏙️'],
    ['Dividendes', earn.dividends, '💵'], ['Trading actions', earn.trading, '📈'], ['Trading crypto', earn.crypto, '🪙'],
  ];
  const got = Object.keys(s.trophies).length;

  view.innerHTML = `
    <div class="card rank-card">
      <span class="tiny">Classement mondial de la richesse</span>
      <div class="row" style="align-items:flex-end;gap:10px">
        <b class="rank-n">#${r.rank}</b>
        <div class="grow"><b>${esc(r.tier.name)}</b>
          <div class="small muted">${money(r.nw)} de patrimoine</div></div>
      </div>
      <div class="rank-list">
        ${near.map((p) => `
          <div class="rank-row ${p.you ? 'you' : ''}">
            <span class="rank-i">${p.rank}</span>
            <span class="grow ell">${esc(p.name)}<em class="small muted"> · ${esc(p.sphere)}</em></span>
            <b>${money(p.wealth)}</b>
          </div>`).join('')}
      </div>
    </div>

    <div class="sec-title"><b>Répartition du patrimoine</b></div>
    <div class="card">
      <div class="stack">${parts.map((p) => `<i class="seg-${p.key}" style="width:${(p.value / total) * 100}%"></i>`).join('')}</div>
      ${parts.map((p) => `<div class="kv"><span>${p.icon} ${p.name}</span><b>${money(p.value)}</b></div>`).join('')}
      <div class="kv"><span><b>Total</b></span><b class="gold">${money(total)}</b></div>
    </div>

    <div class="sec-title"><b>Gains par source</b></div>
    <div class="card">
      ${earnRows.map(([n, v, i]) => `<div class="kv"><span>${i} ${n}</span><b>${money(v)}</b></div>`).join('')}
    </div>

    <div class="sec-title"><b>Trophées</b><span>${got}/${D.TROPHIES.length}</span></div>
    <div class="card"><div class="ach">
      ${D.TROPHIES.map((t) => `
        <div class="ach-i ${s.trophies[t.id] ? 'got' : ''}" title="${esc(t.desc)}">
          <span>${s.trophies[t.id] ? t.icon : '🔒'}</span><em>${esc(t.name)}</em>
        </div>`).join('')}
    </div></div>

    <div class="sec-title"><b>Statistiques</b></div>
    <div class="card">
      <div class="kv"><span>Temps de jeu</span><b>${dur(s.stats.playTime)}</b></div>
      <div class="kv"><span>Taps</span><b>${fmt(s.stats.taps)}</b></div>
      <div class="kv"><span>Sociétés fondées</span><b>${s.stats.bizFounded}</b></div>
      <div class="kv"><span>Projets achevés</span><b>${s.stats.projects}</b></div>
      <div class="kv"><span>Fusions</span><b>${s.stats.merges}</b></div>
      <div class="kv"><span>Améliorations immobilières</span><b>${s.stats.upgrades}</b></div>
    </div>

    <div class="sec-title"><b>Sauvegarde</b></div>
    <div class="card"><div class="row" style="gap:8px">
      <button class="btn btn-sm grow" data-act="export">Exporter</button>
      <button class="btn btn-sm grow" data-act="import">Importer</button>
      <button class="btn btn-sm btn-red grow" data-act="reset">Réinitialiser</button>
    </div></div>`;
}

/* =================================================================
   Sparklines
================================================================= */
function drawSparks(s) {
  for (const a of D.STOCKS) {
    const c = view.querySelector(`[data-spark="s${a.id}"]`);
    if (c) sparkline(c, s.stocks[a.id].hist, E.change(s.stocks[a.id]) >= 0);
  }
  for (const cr of D.CRYPTOS) {
    const c = view.querySelector(`[data-spark="c${cr.id}"]`);
    if (c) sparkline(c, s.cryptos[cr.id].hist, E.change(s.cryptos[cr.id]) >= 0);
  }
}

/* =================================================================
   Feuilles modales
================================================================= */
export function sheetFound(s) {
  openSheet(`
    <h3>Fonder une entreprise</h3>
    <p class="small muted" style="margin:4px 0 12px">Choisissez un secteur, puis donnez-lui un nom.</p>
    <input id="biz-name" class="field" maxlength="24" placeholder="Nom de votre société">
    <div class="type-list">
      ${D.BUSINESS_TYPES.map((t) => `
        <button class="type ${s.cash >= t.cost ? '' : 'locked'}" data-act="found-go" data-id="${t.id}" ${s.cash >= t.cost ? '' : 'disabled'}>
          <span class="type-ico">${t.icon}</span>
          <span class="grow"><b>${esc(t.name)}</b><em class="small muted">${t.stages.length} projets · ${money(t.cost * D.INCOME_RATE)}/h au départ</em></span>
          <b class="${s.cash >= t.cost ? 'gold' : 'muted'}">${money(t.cost)}</b>
        </button>`).join('')}
    </div>
    <button class="btn btn-block btn-ghost" data-close="1" style="margin-top:12px">Annuler</button>`);
}

export function sheetBizMenu(s, uid) {
  const b = s.businesses.find((x) => x.uid === uid);
  if (!b) return;
  const same = s.businesses.filter((x) => x.type === b.type && x.uid !== b.uid);
  openSheet(`
    <h3>${esc(b.name)}</h3>
    <div class="kv"><span>Capitalisation</span><b>${money(b.cap)}</b></div>
    <div class="kv"><span>Revenu horaire</span><b class="up">${money(E.bizIncome(s, b))}</b></div>
    <div class="kv"><span>Gains cumulés</span><b>${money(b.earned || 0)}</b></div>
    <div class="kv"><span>Projets achevés</span><b>${b.stage}/${D.BUSINESS_BY_ID[b.type].stages.length}</b></div>
    ${same.length ? `
      <div class="tiny" style="margin-top:14px">Fusionner avec</div>
      ${same.map((o) => `<button class="btn btn-block" data-act="merge-go" data-a="${b.uid}" data-b="${o.uid}"
        style="margin-top:6px">🤝 ${esc(o.name)} — ${money(o.cap)}</button>`).join('')}
      <p class="small muted" style="margin:8px 0 0">La fusion cumule les capitalisations et ajoute ${((D.MERGE_BONUS - 1) * 100).toFixed(0)} %.</p>`
    : '<p class="small muted" style="margin-top:12px">Fondez une seconde société du même secteur pour pouvoir fusionner.</p>'}
    <button class="btn btn-red btn-block" data-act="close-go" data-uid="${b.uid}" style="margin-top:14px">
      Fermer la société (+${money(b.cap * D.CLOSE_REFUND)})</button>
    <button class="btn btn-block btn-ghost" data-close="1" style="margin-top:8px">Retour</button>`);
}

export function sheetSpec(s, uid) {
  const b = s.businesses.find((x) => x.uid === uid);
  if (!b) return;
  openSheet(`
    <h3>Spécialisation du garage</h3>
    <p class="small muted" style="margin:4px 0 12px">Changer de spécialisation donne accès à des véhicules plus rentables.</p>
    ${D.REPAIR_SPECS.map((sp) => `
      <button class="btn btn-block ${b.spec === sp.id ? 'btn-gold' : ''}" data-act="spec-go" data-uid="${b.uid}" data-spec="${sp.id}"
        style="margin-bottom:8px">${esc(sp.name)} — revenu ×${sp.mult}${sp.cost ? ` · ${money(sp.cost)}` : ''}</button>`).join('')}
    <button class="btn btn-block btn-ghost" data-close="1">Fermer</button>`);
}

export function sheetStock(s, id) {
  const a = byId(D.STOCKS, id);
  const st = s.stocks[id];
  const p = E.stockPrice(s, a);
  const val = st.qty * p;
  const pnl = val - st.qty * st.avg;
  openSheet(`
    <div class="row">
      <div class="asset-tick" style="width:46px;height:46px">${a.id}</div>
      <div class="grow"><h3>${esc(a.name)}</h3>
        <div class="small muted"><span class="pill">${esc(a.sector)}</span> dividende ${a.div.toFixed(2)} % / 3 h</div></div>
      <div class="right"><b style="font-size:18px">${fmtPrice(p)}</b>
        <div class="chg ${E.change(st) >= 0 ? 'up' : 'down'}">${pct(E.change(st))}</div></div>
    </div>
    <canvas class="chart" id="s-chart" style="margin-top:12px"></canvas>
    <div class="stat-grid">
      <div class="stat"><span class="tiny">Titres</span><b>${st.qty ? fmtQty(st.qty) : '—'}</b></div>
      <div class="stat"><span class="tiny">Valeur</span><b>${money(val)}</b></div>
      <div class="stat"><span class="tiny">Plus-value</span><b class="${pnl >= 0 ? 'up' : 'down'}">${st.qty ? (pnl >= 0 ? '+' : '') + money(pnl) : '—'}</b></div>
    </div>
    <div class="kv"><span>Dividende estimé / 3 h</span><b class="gold">${money(val * a.div / 100)}</b></div>
    <div class="kv"><span>Part du capital</span><b>${((st.qty / a.shares) * 100).toFixed(4)} %</b></div>
    <div class="tiny" style="margin-top:12px">Nombre de titres</div>
    <div class="trade">
      <input id="s-qty" class="field" type="number" inputmode="decimal" min="0" placeholder="0">
      <button class="btn btn-green" data-act="stock-buy" data-id="${id}">Acheter</button>
    </div>
    <div class="quick">
      ${[10, 25, 50, 100].map((q) => `<button class="btn btn-sm" data-act="stock-q" data-id="${id}" data-p="${q}">${q === 100 ? 'MAX' : q + '%'}</button>`).join('')}
    </div>
    <div class="tiny" style="margin-top:14px">Vendre</div>
    <div class="quick">
      ${[25, 50, 100].map((q) => `<button class="btn btn-sm btn-red" data-act="stock-sell" data-id="${id}" data-p="${q}">${q} %</button>`).join('')}
    </div>
    <button class="btn btn-block btn-ghost" data-close="1" style="margin-top:14px">Fermer</button>`);
  chart($('#s-chart'), st.hist, E.change(st) >= 0, st.avg > 0 ? st.avg * a.shares : 0);
}

export function sheetCrypto(s, id) {
  const c = byId(D.CRYPTOS, id);
  const st = s.cryptos[id];
  const p = E.cryptoPrice(s, c);
  const val = st.qty * p;
  const pnl = val - st.qty * st.avg;
  openSheet(`
    <div class="row">
      <div class="asset-tick" style="width:46px;height:46px">${c.id}</div>
      <div class="grow"><h3>${esc(c.name)}</h3>
        <div class="small muted">Capitalisation ${money(st.cap)}</div></div>
      <div class="right"><b style="font-size:18px">${fmtPrice(p)}</b>
        <div class="chg ${E.change(st) >= 0 ? 'up' : 'down'}">${pct(E.change(st))}</div></div>
    </div>
    <canvas class="chart" id="c-chart" style="margin-top:12px"></canvas>
    <div class="stat-grid">
      <div class="stat"><span class="tiny">Quantité</span><b>${st.qty ? fmtQty(st.qty) : '—'}</b></div>
      <div class="stat"><span class="tiny">Valeur</span><b>${money(val)}</b></div>
      <div class="stat"><span class="tiny">Plus-value</span><b class="${pnl >= 0 ? 'up' : 'down'}">${st.qty ? (pnl >= 0 ? '+' : '') + money(pnl) : '—'}</b></div>
    </div>
    <div class="tiny" style="margin-top:12px">Montant à investir</div>
    <div class="trade">
      <input id="c-amt" class="field" type="number" inputmode="decimal" min="0" placeholder="0">
      <button class="btn btn-green" data-act="crypto-buy" data-id="${id}">Acheter</button>
    </div>
    <div class="quick">
      ${[10, 25, 50, 100].map((q) => `<button class="btn btn-sm" data-act="crypto-q" data-p="${q}">${q === 100 ? 'MAX' : q + '% cash'}</button>`).join('')}
    </div>
    <div class="tiny" style="margin-top:14px">Vendre</div>
    <div class="quick">
      ${[25, 50, 100].map((q) => `<button class="btn btn-sm btn-red" data-act="crypto-sell" data-id="${id}" data-p="${q}">${q} %</button>`).join('')}
    </div>
    <button class="btn btn-block btn-ghost" data-close="1" style="margin-top:14px">Fermer</button>`);
  chart($('#c-chart'), st.hist, E.change(st) >= 0, 0);
}

export function sheetUpgrades(s, id) {
  const b = byId(D.BUILDINGS, id);
  const st = s.estates[id];
  openSheet(`
    ${houseScene(b, st.up, true)}
    <h3 style="margin-top:12px">${esc(b.city)}</h3>
    <div class="kv"><span>Loyer actuel</span><b class="up">${money(E.rentOf(s, b))} / h</b></div>
    <div class="kv"><span>Valeur de marché</span><b>${money(b.price)}</b></div>
    ${b.tour ? `<button class="btn btn-block btn-gold" data-act="tour" data-id="${id}" style="margin-top:12px">
      🧭 Visiter en 360°</button>` : ''}
    <div class="tiny" style="margin:14px 0 6px">Améliorations — chacune apparaît sur la propriété</div>
    ${D.UPGRADES.map((u) => {
      const done = !!st.up[u.id];
      const cost = b.price * u.costRate;
      return `<button class="btn btn-block ${done ? 'btn-ghost' : s.cash >= cost ? 'btn-green' : ''}"
        data-act="upgrade-go" data-id="${id}" data-up="${u.id}" style="margin-bottom:8px" ${done || s.cash < cost ? 'disabled' : ''}>
        ${u.icon} ${done ? '✓ ' : ''}${esc(u.name)} · +${(u.bonus * 100).toFixed(0)} %${done ? '' : ' — ' + money(cost)}</button>`;
    }).join('')}
    <button class="btn btn-block btn-ghost" data-close="1">Fermer</button>`);
}

export function sheetVehicle(s, id) {
  const v = byId(D.VEHICLES, id);
  openSheet(`
    <h3>${v.icon} ${esc(v.name)}</h3>
    <p class="small muted" style="margin:4px 0 12px">Choisissez la finition et la motorisation.</p>
    <div class="tiny">Finition</div>
    <div class="seg seg-wide" id="trim">${D.TRIMS.map((t, i) =>
      `<button data-act="cfg" data-k="trim" data-v="${t.id}" class="${i === 0 ? 'on' : ''}">${t.name}</button>`).join('')}</div>
    <div class="tiny" style="margin-top:10px">Moteur</div>
    <div class="seg seg-wide" id="engine">${D.ENGINES.map((e, i) =>
      `<button data-act="cfg" data-k="engine" data-v="${e.id}" class="${i === 0 ? 'on' : ''}">${e.name}</button>`).join('')}</div>
    <div class="kv" style="margin-top:14px"><span>Total</span><b class="gold" id="v-total">${money(v.price)}</b></div>
    <button class="btn btn-gold btn-block" data-act="vehicle-buy" data-id="${id}" style="margin-top:10px">Acheter</button>
    <button class="btn btn-block btn-ghost" data-close="1" style="margin-top:8px">Annuler</button>`);
}

/* =================================================================
   Point d'entrée
================================================================= */
export function render(s) {
  view.scrollTop = 0;
  ({
    earnings: renderEarnings, business: renderBusiness,
    investments: renderInvestments, luxe: renderLuxe, account: renderAccount,
  }[s.tab] || renderEarnings)(s);
}

export function update(s) {
  if (s.tab === 'earnings') updateEarnings(s);
  else if (s.tab === 'business') updateBusiness(s);
  else if (s.tab === 'investments' && s.sub.investments === 'stocks') {
    const d = $('#f-div');
    if (d) d.textContent = dur(Math.max(0, (s.dividendAt - Date.now()) / 1000));
  }
}
