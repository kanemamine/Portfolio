/* Générateur de scènes immobilières en SVG.
   Chaque bien est dessiné à partir de paramètres (style, climat, palette) et
   les améliorations s'ajoutent en calques par-dessus la même scène. */

/* Bruit déterministe : un même bien produit toujours la même scène. */
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return ((h >>> 0) % 1000) / 1000; };
}

/* ---------------- Palettes ---------------- */
const CLIMATES = {
  cold:      { sky: ['#8fa8c8', '#d9e4f0'], ground: '#c9d6e0', veg: '#4a6b52', haze: '#eaf1f8' },
  temperate: { sky: ['#6fa8dc', '#cfe4f5'], ground: '#8fae6b', veg: '#3f6b3a', haze: '#dcebf7' },
  warm:      { sky: ['#5aa9e6', '#ffd9a0'], ground: '#c2a668', veg: '#5c7a3a', haze: '#ffe9c8' },
  coastal:   { sky: ['#3f9fd4', '#bfe9f7'], ground: '#e2d3a8', veg: '#4d7c4a', haze: '#d7f0fa' },
  tropical:  { sky: ['#49b3c9', '#d9f2dd'], ground: '#7fa25a', veg: '#2f6b39', haze: '#dff5e4' },
  desert:    { sky: ['#f0a65a', '#ffe0b0'], ground: '#d9b273', veg: '#6f7a45', haze: '#ffeacb' },
  mountain:  { sky: ['#7d9fc4', '#e8f0f8'], ground: '#dfe7ec', veg: '#37543f', haze: '#f2f7fb' },
  urban:     { sky: ['#48628f', '#a9bdd8'], ground: '#7d8798', veg: '#40604a', haze: '#c3d2e6' },
};

/* ---------------- Styles de bâtiment ---------------- */
const STYLES = {
  cottage:   { w: 120, h: 62,  roof: 'gable', cols: 2, rows: 1, wall: '#e6d9c3', trim: '#b09472', roofC: '#8d5b4c' },
  house:     { w: 150, h: 74,  roof: 'gable', cols: 3, rows: 1, wall: '#f0e6d6', trim: '#c2a887', roofC: '#7c4f45' },
  townhouse: { w: 132, h: 118, roof: 'gable', cols: 3, rows: 3, wall: '#e8d7c0', trim: '#a9825f', roofC: '#6f4239' },
  villa:     { w: 210, h: 84,  roof: 'flat',  cols: 5, rows: 2, wall: '#f7f2e8', trim: '#d8c9ae', roofC: '#cbbda3' },
  chalet:    { w: 150, h: 78,  roof: 'steep', cols: 3, rows: 2, wall: '#c69a6a', trim: '#8a6440', roofC: '#5a3f31' },
  palace:    { w: 240, h: 104, roof: 'dome',  cols: 7, rows: 2, wall: '#f3ece0', trim: '#d5c39c', roofC: '#9fae b8'.replace(' ', '') },
  castle:    { w: 190, h: 120, roof: 'towers', cols: 4, rows: 3, wall: '#dfd8cd', trim: '#a89b88', roofC: '#4f5f7a' },
  tower:     { w: 128, h: 190, roof: 'flat',  cols: 4, rows: 8, wall: '#8fb3d9', trim: '#6d8db3', roofC: '#5b7characters'.slice(0, 7), glass: true },
};
STYLES.tower.roofC = '#5b7392';

const W = 400, H = 230, GROUND = 186;

/* ---------------- Primitives ---------------- */

function windows(x, y, w, h, cols, rows, glass, rnd) {
  const pad = 10, gx = (w - pad * 2) / cols, gy = (h - pad * 2) / rows;
  let out = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rnd() > 0.55;
      const wx = x + pad + c * gx + gx * 0.18;
      const wy = y + pad + r * gy + gy * 0.15;
      const ww = gx * 0.64, wh = gy * 0.6;
      out += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${ww.toFixed(1)}" height="${wh.toFixed(1)}"
        rx="1.5" fill="${glass ? '#bfe0f5' : lit ? '#ffe6a8' : '#4d6580'}" opacity="${glass ? 0.85 : 1}"/>`;
      if (!glass) out += `<rect x="${(wx + ww / 2 - 0.4).toFixed(1)}" y="${wy.toFixed(1)}" width="0.8" height="${wh.toFixed(1)}" fill="#00000033"/>`;
    }
  }
  return out;
}

function roof(st, x, y, w) {
  const c = st.roofC;
  if (st.roof === 'flat') return `<rect x="${x - 4}" y="${y - 7}" width="${w + 8}" height="7" rx="2" fill="${c}"/>`;
  if (st.roof === 'gable') return `<polygon points="${x - 9},${y} ${x + w / 2},${y - 34} ${x + w + 9},${y}" fill="${c}"/>
      <polygon points="${x - 9},${y} ${x + w / 2},${y - 34} ${x + w / 2},${y}" fill="#00000022"/>`;
  if (st.roof === 'steep') return `<polygon points="${x - 12},${y} ${x + w / 2},${y - 58} ${x + w + 12},${y}" fill="${c}"/>
      <polygon points="${x - 12},${y} ${x + w / 2},${y - 58} ${x + w / 2},${y}" fill="#00000022"/>`;
  if (st.roof === 'dome') return `<rect x="${x - 4}" y="${y - 6}" width="${w + 8}" height="6" fill="${c}"/>
      <path d="M${x + w / 2 - 26},${y - 6} a26,30 0 0 1 52,0 z" fill="#b9c6d6"/>
      <rect x="${x + w / 2 - 2}" y="${y - 46}" width="4" height="10" fill="#d9c37a"/>`;
  // towers : donjon crénelé
  let t = `<rect x="${x - 4}" y="${y - 6}" width="${w + 8}" height="6" fill="${c}"/>`;
  for (const tx of [x - 6, x + w - 20]) {
    t += `<rect x="${tx}" y="${y - 54}" width="26" height="54" fill="${st.wall}"/>
          <polygon points="${tx - 3},${y - 54} ${tx + 13},${y - 82} ${tx + 29},${y - 54}" fill="${c}"/>`;
  }
  return t;
}

/* ---------------- Calques d'amélioration ---------------- */
const LAYERS = {
  /* Jardin paysager : haies et arbres */
  garden: (p, rnd) => {
    let o = '';
    for (let i = 0; i < 5; i++) {
      const x = 18 + i * 14 + rnd() * 6, s = 9 + rnd() * 5;
      o += `<ellipse cx="${x.toFixed(1)}" cy="${GROUND - 4}" rx="${s.toFixed(1)}" ry="${(s * 0.6).toFixed(1)}" fill="${p.veg}"/>`;
    }
    for (const tx of [W - 42, W - 22]) {
      const th = 30 + rnd() * 16;
      o += `<rect x="${tx - 2}" y="${GROUND - th}" width="4" height="${th}" fill="#6b4b32"/>
            <circle cx="${tx}" cy="${GROUND - th - 6}" r="15" fill="${p.veg}"/>
            <circle cx="${tx - 8}" cy="${GROUND - th + 2}" r="10" fill="${p.veg}" opacity=".85"/>`;
    }
    return o;
  },

  /* Piscine : bassin en perspective avec reflets */
  pool: () => `
    <g>
      <ellipse cx="${W / 2 + 8}" cy="${GROUND + 16}" rx="76" ry="19" fill="#00000018"/>
      <ellipse cx="${W / 2 + 8}" cy="${GROUND + 14}" rx="72" ry="17" fill="#e9eef2"/>
      <ellipse cx="${W / 2 + 8}" cy="${GROUND + 14}" rx="64" ry="13" fill="url(#water)"/>
      <path d="M${W / 2 - 44},${GROUND + 12} q22,-5 44,0 q-22,6 -44,0z" fill="#ffffff55"/>
      <path d="M${W / 2 + 22},${GROUND + 18} q16,-4 32,0 q-16,5 -32,0z" fill="#ffffff40"/>
      <rect x="${W / 2 + 66}" y="${GROUND + 2}" width="3" height="14" rx="1.5" fill="#cfd8de"/>
    </g>`,

  /* Panneaux solaires : posés sur la toiture */
  solar: (p, rnd, st, bx, by) => {
    const slope = st.roof === 'gable' || st.roof === 'steep';
    let o = '';
    for (let i = 0; i < 4; i++) {
      const x = bx + 14 + i * 22;
      const y = slope ? by - 12 - i * 2 : by - 12;
      o += `<g transform="translate(${x},${y}) skewX(${slope ? -18 : 0})">
        <rect width="18" height="10" rx="1" fill="#1d3a5c" stroke="#8fb3d9" stroke-width=".6"/>
        <path d="M0,3.3 H18 M0,6.6 H18 M6,0 V10 M12,0 V10" stroke="#3c6ea5" stroke-width=".5"/></g>`;
    }
    return o;
  },

  /* Garage : dépendance accolée */
  garage: (p, rnd, st, bx, by, bw) => {
    const gx = bx + bw + 6, gw = 54, gh = 40;
    return `<g>
      <rect x="${gx}" y="${GROUND - gh}" width="${gw}" height="${gh}" fill="${st.wall}" stroke="#00000018"/>
      <polygon points="${gx - 5},${GROUND - gh} ${gx + gw / 2},${GROUND - gh - 16} ${gx + gw + 5},${GROUND - gh}" fill="${st.roofC}"/>
      <rect x="${gx + 8}" y="${GROUND - gh + 12}" width="${gw - 16}" height="${gh - 12}" rx="2" fill="#5c6b7a"/>
      <path d="M${gx + 8},${GROUND - gh + 19} H${gx + gw - 8} M${gx + 8},${GROUND - gh + 26} H${gx + gw - 8}" stroke="#00000030"/>
    </g>`;
  },

  /* Extension et terrasse : aile supplémentaire */
  wing: (p, rnd, st, bx, by, bw, bh) => {
    const ex = bx - 62, ew = 58, eh = Math.min(bh * 0.7, 58);
    return `<g>
      <rect x="${ex}" y="${GROUND - eh}" width="${ew}" height="${eh}" fill="${st.wall}" stroke="#00000018"/>
      <rect x="${ex - 4}" y="${GROUND - eh - 6}" width="${ew + 8}" height="6" rx="2" fill="${st.roofC}"/>
      <rect x="${ex + 10}" y="${GROUND - eh + 12}" width="${ew - 20}" height="${eh - 22}" rx="2" fill="#bfe0f5" opacity=".9"/>
      <rect x="${ex - 10}" y="${GROUND - 4}" width="${ew + 24}" height="8" rx="2" fill="#d9cbb4"/>
      <rect x="${ex - 10}" y="${GROUND - 4}" width="${ew + 24}" height="2" fill="#ffffff55"/>
    </g>`;
  },
};

/* Ordre d'empilement : ce qui est derrière d'abord. */
const ORDER = ['garden', 'wing', 'garage', 'solar', 'pool'];

/* ---------------- Scène complète ---------------- */

/**
 * Construit la scène SVG d'un bien.
 * @param {object} b bien (id, style, climate)
 * @param {object} ups améliorations actives, ex. { pool:true, solar:true }
 */
export function houseSVG(b, ups = {}) {
  const rnd = seeded(b.id);
  const p = CLIMATES[b.climate] || CLIMATES.temperate;
  const st = STYLES[b.style] || STYLES.house;
  const bw = st.w, bh = st.h;
  const bx = (W - bw) / 2, by = GROUND - bh;

  const back = ORDER.filter((k) => ups[k] && ['garden', 'wing', 'garage'].includes(k));
  const front = ORDER.filter((k) => ups[k] && ['solar', 'pool'].includes(k));

  return `
<svg viewBox="0 0 ${W} ${H}" class="house" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${b.city}">
  <defs>
    <linearGradient id="sky-${b.id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/>
    </linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4fc3f7"/><stop offset="1" stop-color="#0f7ab0"/>
    </linearGradient>
    <linearGradient id="wall-${b.id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".25"/>
      <stop offset="1" stop-color="#000000" stop-opacity=".18"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky-${b.id})"/>
  <circle cx="${(60 + rnd() * 260).toFixed(0)}" cy="42" r="16" fill="#fff" opacity=".55"/>
  <ellipse cx="${W / 2}" cy="${GROUND + 6}" rx="${W}" ry="46" fill="${p.haze}" opacity=".5"/>

  <!-- relief lointain -->
  <path d="M0,${GROUND} L70,${GROUND - 46} L130,${GROUND} Z" fill="${p.veg}" opacity=".28"/>
  <path d="M240,${GROUND} L320,${GROUND - 58} L400,${GROUND} Z" fill="${p.veg}" opacity=".22"/>

  <rect y="${GROUND}" width="${W}" height="${H - GROUND}" fill="${p.ground}"/>
  <rect y="${GROUND}" width="${W}" height="3" fill="#00000012"/>

  ${back.map((k) => LAYERS[k](p, rnd, st, bx, by, bw, bh)).join('')}

  <!-- bâtiment -->
  <ellipse cx="${W / 2}" cy="${GROUND + 3}" rx="${bw * 0.62}" ry="8" fill="#00000022"/>
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${st.wall}"/>
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="url(#wall-${b.id})"/>
  ${roof(st, bx, by, bw)}
  ${windows(bx, by, bw, bh, st.cols, st.rows, st.glass, rnd)}
  <rect x="${W / 2 - 9}" y="${GROUND - 26}" width="18" height="26" rx="2" fill="${st.trim}"/>
  <circle cx="${W / 2 + 4}" cy="${GROUND - 13}" r="1.4" fill="#f5d98a"/>

  ${front.map((k) => LAYERS[k](p, rnd, st, bx, by, bw, bh)).join('')}
</svg>`;
}

/** Vignette compacte pour les listes. */
export const houseThumb = (b, ups) => `<div class="house-thumb">${houseSVG(b, ups)}</div>`;
