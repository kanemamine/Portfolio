/* Scènes immobilières : photo de façade + calques d'améliorations en SVG.

   La photo de chaque bien est figée (générée une fois, versionnée dans le dépôt)
   et cadrée pour laisser le tiers inférieur dégagé. Les améliorations achetées
   sont dessinées dans cette bande, en perspective, par-dessus la photo. */

const VB_W = 640, VB_H = 368;   // repère des calques, calé sur la photo
const HORIZON = 250;            // début de la bande de premier plan

/* Bruit déterministe : une même propriété a toujours la même végétation. */
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return ((h >>> 0) % 1000) / 1000; };
}

/* Teintes de végétation selon le climat, pour que les calques s'accordent. */
const VEG = {
  cold: ['#2f4a37', '#3d5c44'], mountain: ['#2b4433', '#3a5741'],
  desert: ['#5d6b3a', '#6f7d47'], tropical: ['#1f5c2e', '#2c7a3d'],
  coastal: ['#33613c', '#43784c'], warm: ['#3f6b39', '#527f49'],
  temperate: ['#345c33', '#456f43'], urban: ['#2f5237', '#3f6647'],
};

/* ---------------- Calques ---------------- */

/** Piscine : bassin trapézoïdal, margelle claire, reflets. */
function pool() {
  const outer = '150,356 490,356 436,278 204,278';
  const inner = '168,348 472,348 428,286 212,286';
  return `<g class="lay-pool">
    <polygon points="${outer}" fill="#e8e4dc"/>
    <polygon points="${outer}" fill="#00000018"/>
    <polygon points="${inner}" fill="url(#poolWater)"/>
    <path d="M215,340 q60,-8 120,0 q-60,9 -120,0z" fill="#ffffff45"/>
    <path d="M350,330 q45,-6 90,0 q-45,7 -90,0z" fill="#ffffff33"/>
    <path d="M212,286 L428,286 L424,292 L216,292z" fill="#ffffff30"/>
    <rect x="470" y="300" width="5" height="34" rx="2.5" fill="#cfd6da"/>
    <rect x="452" y="330" width="42" height="5" rx="2.5" fill="#cfd6da"/>
  </g>`;
}

/** Terrasse en bois avec garde-corps, à gauche. */
function terrace() {
  let planks = '';
  for (let i = 0; i < 7; i++) planks += `<path d="M${26 + i * 3},${356 - i * 8} H${186 - i * 4}" stroke="#00000022" stroke-width="1.5"/>`;
  let rail = '';
  for (let i = 0; i < 6; i++) rail += `<rect x="${30 + i * 28}" y="286" width="3.5" height="24" fill="#8a6a4a"/>`;
  return `<g class="lay-terrace">
    <polygon points="20,358 196,358 178,296 44,296" fill="#a67d54"/>
    <polygon points="20,358 196,358 178,296 44,296" fill="url(#deckShade)"/>
    ${planks}
    <rect x="26" y="282" width="150" height="5" rx="2" fill="#8a6a4a"/>
    ${rail}
  </g>`;
}

/** Garage individuel en perspective, à droite. */
function garage() {
  return `<g class="lay-garage">
    <polygon points="470,330 632,330 632,236 470,252" fill="#ded6c8"/>
    <polygon points="470,330 470,252 632,236 632,246 480,262 480,330" fill="#00000018"/>
    <polygon points="462,254 640,232 640,222 462,244" fill="#7d5a4c"/>
    <polygon points="492,326 620,326 620,262 492,272" fill="#5d6a75"/>
    <path d="M492,286 L620,277 M492,300 L620,292 M492,314 L620,307" stroke="#00000030" stroke-width="2"/>
    <ellipse cx="551" cy="333" rx="86" ry="6" fill="#00000022"/>
  </g>`;
}

/** Ombrière photovoltaïque : structure visible au premier plan. */
function solar() {
  let panels = '';
  for (let i = 0; i < 3; i++) {
    panels += `<polygon points="${34 + i * 52},262 ${84 + i * 52},256 ${90 + i * 52},276 ${40 + i * 52},282" fill="#16324f" stroke="#7ea6cf" stroke-width="1"/>
      <path d="M${46 + i * 52},260 L${52 + i * 52},280 M${60 + i * 52},258 L${66 + i * 52},278" stroke="#3a6fa5" stroke-width="1"/>`;
  }
  return `<g class="lay-solar">
    ${panels}
    <rect x="38" y="278" width="5" height="46" fill="#9aa3ad"/>
    <rect x="184" y="272" width="5" height="46" fill="#9aa3ad"/>
    <ellipse cx="112" cy="326" rx="80" ry="5" fill="#00000018"/>
  </g>`;
}

/** Jardin paysager : haies et arbres calés sur le climat. */
function garden(climate, rnd) {
  const [dark, light] = VEG[climate] || VEG.temperate;
  let o = '';
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 72 + rnd() * 14, r = 26 + rnd() * 10;
    o += `<ellipse cx="${x.toFixed(0)}" cy="272" rx="${r.toFixed(0)}" ry="${(r * 0.42).toFixed(0)}" fill="${dark}"/>
          <ellipse cx="${(x - r * 0.3).toFixed(0)}" cy="268" rx="${(r * 0.5).toFixed(0)}" ry="${(r * 0.3).toFixed(0)}" fill="${light}" opacity=".55"/>`;
  }
  return `<g class="lay-garden">${o}</g>`;
}

/* Ordre de profondeur : du plus lointain au plus proche. */
const STACK = [
  ['garden', (b, rnd) => garden(b.climate, rnd)],
  ['solar', () => solar()],
  ['garage', () => garage()],
  ['wing', () => terrace()],
  ['pool', () => pool()],
];

/* ---------------- Assemblage ---------------- */

/**
 * Rend la scène d'un bien : photo de façade + calques achetés.
 * @param {object} b bien (id, city, climate)
 * @param {object} ups améliorations actives, ex. { pool: true }
 * @param {boolean} big rendu agrandi (feuille de détail)
 */
export function houseScene(b, ups = {}, big = false) {
  const rnd = seeded(b.id);
  const layers = STACK.filter(([k]) => ups[k]).map(([, fn]) => fn(b, rnd)).join('');
  return `
<div class="house-thumb${big ? ' big' : ''}">
  <img class="house-photo" src="img/estate/${b.id}.webp" alt="${b.city}" loading="lazy" decoding="async"
       onerror="this.closest('.house-thumb').classList.add('no-photo')">
  ${layers ? `<svg class="house-layers" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="poolWater" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2f9fd0"/><stop offset="1" stop-color="#63d3e8"/>
      </linearGradient>
      <linearGradient id="deckShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000000" stop-opacity=".22"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity=".08"/>
      </linearGradient>
    </defs>
    ${layers}
  </svg>` : ''}
  <span class="house-city">${b.city}</span>
</div>`;
}

export { HORIZON };
