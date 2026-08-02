/* Données statiques du jeu : entreprises, actifs, biens immobiliers, succès, niveaux. */

/* ------------------------------------------------------------------
   ENTREPRISES
   cost(n)    = baseCost * costMult^n
   revenu/cycle = baseRevenue * owned * multiplicateurs
   Les paliers doublent le revenu ; 25/50/100 divisent aussi le temps.
------------------------------------------------------------------ */
export const MILESTONES = [25, 50, 100, 200, 300, 400, 500, 750, 1000];
export const SPEED_MILESTONES = [25, 50, 100];

export const BUSINESSES = [
  { id: 'truck',  name: 'Food Truck',        icon: '🚚', baseCost: 4,           costMult: 1.07, baseRevenue: 1,           time: 1,     manager: 1e3,    desc: 'Le premier dollar est le plus dur.' },
  { id: 'coffee', name: 'Coffee Shop',       icon: '☕', baseCost: 60,          costMult: 1.15, baseRevenue: 60,          time: 3,     manager: 15e3,   desc: 'Marges confortables, clients fidèles.' },
  { id: 'retail', name: 'Boutique Retail',   icon: '🛍️', baseCost: 720,         costMult: 1.14, baseRevenue: 540,         time: 6,     manager: 100e3,  desc: 'Le commerce de détail, valeur sûre.' },
  { id: 'logi',   name: 'Hub Logistique',    icon: '📦', baseCost: 8640,        costMult: 1.13, baseRevenue: 4320,        time: 12,    manager: 500e3,  desc: 'Qui contrôle la chaîne contrôle le marché.' },
  { id: 'build',  name: 'BTP & Construction',icon: '🏗️', baseCost: 103680,      costMult: 1.12, baseRevenue: 51840,       time: 24,    manager: 1.2e6,  desc: 'Bâtir la ville, encaisser les loyers.' },
  { id: 'hotel',  name: 'Chaîne Hôtelière',  icon: '🏨', baseCost: 1244160,     costMult: 1.11, baseRevenue: 622080,      time: 96,    manager: 10e6,   desc: 'Cinq étoiles, cash-flow permanent.' },
  { id: 'bank',   name: 'Banque d’affaires', icon: '🏦', baseCost: 14929920,    costMult: 1.10, baseRevenue: 7464360,     time: 384,   manager: 111e6,  desc: 'L’argent des autres travaille pour vous.' },
  { id: 'oil',    name: 'Groupe Pétrolier',  icon: '🛢️', baseCost: 179159040,   costMult: 1.09, baseRevenue: 89579520,    time: 1536,  manager: 555e6,  desc: 'Or noir, marges XXL.' },
  { id: 'telco',  name: 'Opérateur Telecom', icon: '📡', baseCost: 2149908480,  costMult: 1.08, baseRevenue: 1074954240,  time: 6144,  manager: 10e9,   desc: 'Abonnements récurrents à l’échelle mondiale.' },
  { id: 'ai',     name: 'Datacenter IA',     icon: '🤖', baseCost: 25798901760, costMult: 1.07, baseRevenue: 29668884480, time: 36864, manager: 100e9,  desc: 'Le pétrole du XXIᵉ siècle : le calcul.' },
];

/* ------------------------------------------------------------------
   ACTIFS FINANCIERS (bourse + crypto)
   vol   : écart-type du rendement par tick
   drift : dérive moyenne par tick
------------------------------------------------------------------ */
export const ASSETS = [
  // --- Actions ---
  { id: 'APLX', kind: 'stock', name: 'Aplex Corp',        sector: 'Tech',        start: 178,   vol: 0.018, drift: 0.0006, fee: 0.0025 },
  { id: 'NVDX', kind: 'stock', name: 'Nividex Semi',      sector: 'Semi',        start: 465,   vol: 0.030, drift: 0.0010, fee: 0.0025 },
  { id: 'BNKO', kind: 'stock', name: 'Bankor Group',      sector: 'Finance',     start: 92,    vol: 0.012, drift: 0.0003, fee: 0.0025 },
  { id: 'OILT', kind: 'stock', name: 'Oiltek Energy',     sector: 'Énergie',     start: 58,    vol: 0.022, drift: 0.0002, fee: 0.0025 },
  { id: 'MEDC', kind: 'stock', name: 'Medicore Health',   sector: 'Santé',       start: 134,   vol: 0.011, drift: 0.0004, fee: 0.0025 },
  { id: 'RTLZ', kind: 'stock', name: 'Retailz Inc',       sector: 'Retail',      start: 41,    vol: 0.016, drift: 0.0002, fee: 0.0025 },
  { id: 'AERO', kind: 'stock', name: 'Aerostar Ltd',      sector: 'Aéronautique',start: 210,   vol: 0.024, drift: 0.0005, fee: 0.0025 },
  { id: 'TELM', kind: 'stock', name: 'Telemax SA',        sector: 'Telecom',     start: 76,    vol: 0.009, drift: 0.0002, fee: 0.0025 },
  // --- Crypto ---
  { id: 'BTX',  kind: 'crypto', name: 'Bitrax',           sector: 'Layer 1',     start: 61000, vol: 0.048, drift: 0.0012, fee: 0.005 },
  { id: 'ETX',  kind: 'crypto', name: 'Etherex',          sector: 'Smart chain', start: 3200,  vol: 0.056, drift: 0.0011, fee: 0.005 },
  { id: 'SOLX', kind: 'crypto', name: 'Solarix',          sector: 'Layer 1',     start: 145,   vol: 0.075, drift: 0.0013, fee: 0.005 },
  { id: 'DOGX', kind: 'crypto', name: 'Dogex',            sector: 'Memecoin',    start: 0.14,  vol: 0.120, drift: 0.0005, fee: 0.005 },
  { id: 'STBX', kind: 'crypto', name: 'Stablex',          sector: 'Stablecoin',  start: 1.0,   vol: 0.002, drift: 0.0000, fee: 0.005 },
];

export const ASSET_BY_ID = Object.fromEntries(ASSETS.map((a) => [a.id, a]));

/* ------------------------------------------------------------------
   IMMOBILIER — revenu passif horaire, améliorable 10 niveaux.
------------------------------------------------------------------ */
export const UPGRADE_MAX = 10;
export const PROPERTIES = [
  { id: 'studio',  name: 'Studio',              city: 'Lyon',        icon: '🏠', price: 45e3,  income: 3.2e3 },
  { id: 'duplex',  name: 'Duplex rénové',       city: 'Marseille',   icon: '🏡', price: 260e3, income: 19e3 },
  { id: 'immeub',  name: 'Petit immeuble',      city: 'Paris',       icon: '🏢', price: 1.4e6, income: 105e3 },
  { id: 'loft',    name: 'Loft Soho',           city: 'New York',    icon: '🌆', price: 9.5e6, income: 720e3 },
  { id: 'villa',   name: 'Villa vue mer',       city: 'Monaco',      icon: '🏖️', price: 62e6,  income: 4.8e6 },
  { id: 'tower',   name: 'Tour de bureaux',     city: 'Dubaï',       icon: '🏙️', price: 410e6, income: 32e6 },
  { id: 'resort',  name: 'Resort privé',        city: 'Maldives',    icon: '🏝️', price: 2.9e9, income: 230e6 },
  { id: 'mall',    name: 'Centre commercial',   city: 'Tokyo',       icon: '🛒', price: 21e9,  income: 1.7e9 },
  { id: 'skyline', name: 'Gratte-ciel signature',city:'Singapour',   icon: '🌃', price: 155e9, income: 12.5e9 },
  { id: 'island',  name: 'Île privée',          city: 'Pacifique',   icon: '🏝', price: 1.2e12, income: 100e9 },
];

/* Coût d'amélioration et rendement par niveau. */
export const upgradeCost = (p, level) => p.price * 0.6 * Math.pow(1.7, level);
export const propIncome = (p, level) => p.income * Math.pow(1.45, level);

/* ------------------------------------------------------------------
   DÉBLOCAGES — seuils sur le total gagné.
------------------------------------------------------------------ */
export const UNLOCKS = {
  stocks: 25e3,
  estate: 250e3,
  crypto: 2.5e6,
};

/* ------------------------------------------------------------------
   NIVEAUX — titres de carrière selon le patrimoine.
------------------------------------------------------------------ */
export const TITLES = [
  'Stagiaire', 'Employé', 'Épargnant', 'Petit porteur', 'Investisseur',
  'Trader', 'Gestionnaire', 'Business Angel', 'Magnat', 'Milliardaire',
  'Oligarque', 'Légende de la finance',
];

/** Niveau = patrimoine sur une échelle logarithmique (2 niveaux par décade). */
export function levelInfo(netWorth) {
  const base = Math.max(0, Math.log10(Math.max(1, netWorth)) - 1) * 2;
  const level = Math.max(1, Math.floor(base) + 1);
  const progress = base - Math.floor(base);
  return { level, progress, title: TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 2))] };
}

/* ------------------------------------------------------------------
   SUCCÈS
------------------------------------------------------------------ */
export const ACHIEVEMENTS = [
  { id: 'first',    icon: '💵', name: 'Premier dollar',  test: (s, g) => s.totalEarned >= 1 },
  { id: 'k10',      icon: '💰', name: '10 000 $',        test: (s, g) => s.totalEarned >= 1e4 },
  { id: 'm1',       icon: '🤑', name: 'Millionnaire',    test: (s, g) => g.netWorth >= 1e6 },
  { id: 'b1',       icon: '👑', name: 'Milliardaire',    test: (s, g) => g.netWorth >= 1e9 },
  { id: 'mgr1',     icon: '🧑‍💼', name: 'Premier manager', test: (s) => Object.values(s.businesses).some((b) => b.manager) },
  { id: 'mgrAll',   icon: '🏛️', name: 'Tous managés',    test: (s) => Object.values(s.businesses).every((b) => b.manager) },
  { id: 'own100',   icon: '📊', name: '100 unités',      test: (s) => Object.values(s.businesses).some((b) => b.owned >= 100) },
  { id: 'trader',   icon: '📈', name: '25 trades',       test: (s) => s.stats.trades >= 25 },
  { id: 'bagholder',icon: '💎', name: 'Diamond hands',   test: (s) => s.stats.bestGain >= 1e6 },
  { id: 'landlord', icon: '🏘️', name: '3 biens',         test: (s) => Object.values(s.properties).filter((p) => p.owned).length >= 3 },
  { id: 'maxprop',  icon: '🏆', name: 'Bien niveau max', test: (s) => Object.values(s.properties).some((p) => p.level >= UPGRADE_MAX) },
  { id: 'angel',    icon: '👼', name: 'Première sortie', test: (s) => s.angels > 0 },
];

/* ------------------------------------------------------------------
   ÉVÉNEMENTS DE MARCHÉ — chocs temporaires sur les prix.
------------------------------------------------------------------ */
export const NEWS = [
  { text: '📰 Résultats trimestriels record dans la tech.',        kind: 'stock',  sector: 'Tech',  shock: 0.08 },
  { text: '📰 Pénurie de puces : les semi s’envolent.',            kind: 'stock',  sector: 'Semi',  shock: 0.12 },
  { text: '📰 La banque centrale relève ses taux.',                kind: 'stock',  sector: null,    shock: -0.05 },
  { text: '📰 Baisse surprise des taux directeurs.',               kind: 'stock',  sector: null,    shock: 0.05 },
  { text: '📰 Tensions géopolitiques : le pétrole grimpe.',        kind: 'stock',  sector: 'Énergie', shock: 0.15 },
  { text: '📰 Scandale comptable dans la finance.',                kind: 'stock',  sector: 'Finance', shock: -0.11 },
  { text: '📰 Nouveau vaccin : la santé progresse.',               kind: 'stock',  sector: 'Santé', shock: 0.07 },
  { text: '📰 Consommation en berne, le retail souffre.',          kind: 'stock',  sector: 'Retail', shock: -0.08 },
  { text: '🪙 Un ETF crypto approuvé : le marché s’emballe.',      kind: 'crypto', sector: null,    shock: 0.18 },
  { text: '🪙 Régulation renforcée : les cryptos décrochent.',     kind: 'crypto', sector: null,    shock: -0.16 },
  { text: '🪙 Un influenceur relance les memecoins.',              kind: 'crypto', sector: 'Memecoin', shock: 0.35 },
  { text: '🪙 Hack d’une plateforme d’échange majeure.',           kind: 'crypto', sector: null,    shock: -0.22 },
];
