/* Données du jeu : types d'entreprises, marchés, immobilier, luxe, méta.
   Les ordres de grandeur suivent la spec de référence ; tout est ajustable ici. */

/* =================================================================
   1. EARNINGS — clicker
   15 niveaux : gain par tap ×1,5 (puis ×1,45 → ×1,40),
   revenu passif horaire = 6 × gain par tap.
================================================================= */
export const CLICK_LEVELS = (() => {
  const out = [];
  let tap = 4, cost = 1000;
  for (let i = 0; i < 15; i++) {
    out.push({ tap: Math.round(tap * 100) / 100, cost: Math.round(cost), idle: Math.round(tap * 6 * 100) / 100 });
    tap *= i < 8 ? 1.5 : i < 11 ? 1.45 : 1.4;
    cost *= 1.8 + i * 0.045;
  }
  return out;
})();

export const BOOST_SECONDS = 30;        // boost de tap
export const BOOST_MULT = 5;
export const AUTOCLICK_SECONDS = 60;    // auto-clic offert
export const AUTOCLICK_RATE = 7;        // taps par seconde

/* =================================================================
   2. BUSINESS — 16 types fondables dans des slots
   Revenu horaire = 5 % de la capitalisation.
   Les projets sont des chantiers réels : coût + durée, bonus définitif.
================================================================= */
export const INCOME_RATE = 0.05;        // revenu/h en part de capitalisation
export const LEVEL_MAX = 35;
export const CLOSE_REFUND = 0.30;       // remboursement à la fermeture
export const MERGE_BONUS = 1.15;        // prime de capitalisation à la fusion

const stages = (...list) => list.map(([name, costMult, sec]) => ({ name, costMult, sec }));

export const BUSINESS_TYPES = [
  { id: 'store', name: 'Supérette', icon: '🏪', cost: 8e3, stages: stages(
    ['Aménagement du local', 0.4, 120], ['Premier réassort', 0.7, 300], ['Carte de fidélité', 1.2, 600],
    ['Deuxième point de vente', 2.5, 1200]) },
  { id: 'beauty', name: 'Salon de beauté', icon: '💅', cost: 15e3, stages: stages(
    ['Recrutement', 0.4, 180], ['Marques partenaires', 0.8, 420], ['Cabine VIP', 1.5, 900],
    ['Franchise', 3, 1800]) },
  { id: 'taxi', name: 'Compagnie de taxi', icon: '🚕', cost: 25e3, stages: stages(
    ['Première flotte', 0.5, 240], ['Licences', 0.9, 480], ['Application de réservation', 1.8, 960],
    ['Flotte électrique', 3.5, 2100]) },
  { id: 'delivery', name: 'Société de livraison', icon: '📦', cost: 40e3, stages: stages(
    ['Entrepôt', 0.5, 240], ['Utilitaires', 1, 540], ['Optimisation des tournées', 2, 1080],
    ['Hub régional', 4, 2400]) },
  { id: 'construction', name: 'Entreprise de BTP', icon: '🏗️', cost: 50e3, stages: stages(
    ['Achat du matériel', 0.6, 300], ['Premier chantier', 1.1, 360], ['Certification', 1.6, 540],
    ['Grands travaux', 3.2, 900]) },
  { id: 'autorepair', name: 'Garage automobile', icon: '🔧', cost: 55e3, spec: true, stages: stages(
    ['Pont élévateur', 0.5, 240], ['Atelier peinture', 1, 600], ['Showroom occasion', 2.2, 1200],
    ['Agrément constructeur', 4, 2400]) },
  { id: 'vet', name: 'Clinique vétérinaire', icon: '🐕', cost: 90e3, stages: stages(
    ['Cabinet', 0.5, 300], ['Bloc chirurgical', 1.2, 720], ['Imagerie', 2.4, 1500],
    ['Clinique 24/7', 4.5, 3000]) },
  { id: 'insurance', name: 'Compagnie d’assurance', icon: '🛡️', cost: 180e3, stages: stages(
    ['Agrément', 0.6, 360], ['Réseau de courtiers', 1.3, 900], ['Réassurance', 2.6, 1800],
    ['Offre entreprise', 5, 3600]) },
  { id: 'tech', name: 'Société informatique', icon: '💻', cost: 355e3, stages: stages(
    ['Prototype', 0.34, 240], ['Version 1.0', 2.7, 720], ['Levée de fonds', 24, 960],
    ['Expansion internationale', 42, 1500]) },
  { id: 'fashion', name: 'Maison de mode', icon: '👗', cost: 600e3, stages: stages(
    ['Bureau de style', 0.5, 360], ['Première collection', 1.2, 900], ['Campagne d’image', 2.5, 1500],
    ['Défilé & boutique phare', 5, 2700], ['Succès immédiat', 9, 3600]) },
  { id: 'clinic', name: 'Clinique privée', icon: '🏥', cost: 1.2e6, stages: stages(
    ['Plateau technique', 0.6, 420], ['Recrutement médical', 1.4, 1080], ['Urgences', 3, 2100],
    ['Pôle recherche', 6, 4200]) },
  { id: 'plastic', name: 'Chirurgie esthétique', icon: '💉', cost: 3e6, stages: stages(
    ['Bloc opératoire', 0.6, 480], ['Chirurgien renommé', 1.5, 1200], ['Clientèle internationale', 3.2, 2400],
    ['Clinique de prestige', 6.5, 4800]) },
  { id: 'bank', name: 'Banque d’affaires', icon: '🏦', cost: 9.5e6, stages: stages(
    ['Licence bancaire', 0.7, 600], ['Salle des marchés', 1.6, 1500], ['Gestion de fortune', 3.4, 3000],
    ['Banque d’investissement', 7, 6000]) },
  { id: 'mma', name: 'Organisation MMA', icon: '🥊', cost: 25e6, fights: true, stages: stages(
    ['Salle d’entraînement', 0.5, 540], ['Écurie de combattants', 1.4, 1350], ['Diffusion TV', 3, 2700],
    ['Événement mondial', 6, 5400]) },
  { id: 'energy', name: 'Groupe énergétique', icon: '⚡', cost: 80e6, stages: stages(
    ['Concession', 0.8, 900], ['Centrale', 2, 2400], ['Réseau de distribution', 4, 4800],
    ['Renouvelables', 8, 9000]) },
  { id: 'space', name: 'Agence spatiale', icon: '🚀', cost: 450e6, stages: stages(
    ['Recherche', 0.094, 1110], ['Licences et certification', 0.05, 660], ['Équipement', 0.167, 570],
    ['Développement de la fusée', 1.91, 1980], ['Campagne marketing', 0.098, 330],
    ['Lancement', 1.04, 1140], ['Lancement réussi', 0.068, 1140]) },
];

export const BUSINESS_BY_ID = Object.fromEntries(BUSINESS_TYPES.map((b) => [b.id, b]));

/** Spécialisations du garage (revenu et prix des véhicules traités). */
export const REPAIR_SPECS = [
  { id: 'ordinary', name: 'Véhicules ordinaires', mult: 1, cost: 0 },
  { id: 'luxury', name: 'Luxe et sportives', mult: 1.8, cost: 250e3 },
  { id: 'premium', name: 'Premium', mult: 3, cost: 1.5e6 },
];

/* Slots d'entreprise : 2 offerts, puis coût croissant. */
export const SLOT_START = 2;
export const slotCost = (owned) => 500e3 * Math.pow(3.2, owned - SLOT_START);

/* =================================================================
   3. INVESTMENTS
================================================================= */
export const DIVIDEND_PERIOD = 3 * 3600;   // versement toutes les 3 h
export const MARKET_STEP = 120;            // un point de cotation toutes les 120 s
export const STOCK_FEE = 0.0;              // pas de frais : le rendement vient du dividende
export const CRYPTO_FEE = 0.005;
export const ESTATE_TAX = 0.12;            // taxe à la revente d'un bien
export const ISLAND_FEE = 0.08;            // commission sur la vente d'une île

/** 15 actions : capitalisation, actions en circulation, dividende annuel en %. */
export const STOCKS = [
  { id: 'AMZ', name: 'Amazona',        sector: 'E-commerce', cap: 102.6e9, shares: 750e6,  div: 1.20, vol: 0.10 },
  { id: 'APL', name: 'Applon',         sector: 'Tech',       cap: 29.0e9,  shares: 210e6,  div: 0.60, vol: 0.10 },
  { id: 'CSC', name: 'Cicsso Systems', sector: 'Réseaux',    cap: 15.5e9,  shares: 284.7e6,div: 1.42, vol: 0.10 },
  { id: 'COC', name: 'Cocavia',        sector: 'Boissons',   cap: 279.8e9, shares: 2.05e9, div: 3.21, vol: 0.07 },
  { id: 'FRT', name: 'Fortis Motors',  sector: 'Automobile', cap: 585.0e9, shares: 2.12e9, div: 0.10, vol: 0.10 },
  { id: 'HND', name: 'Hendaia',        sector: 'Automobile', cap: 34.4e9,  shares: 180e6,  div: 1.70, vol: 0.10 },
  { id: 'MKS', name: 'Mikrosolt',      sector: 'Logiciel',   cap: 1.41e12, shares: 7.4e9,  div: 0.82, vol: 0.08 },
  { id: 'MSC', name: 'Moestrocard',    sector: 'Paiement',   cap: 389.9e9, shares: 940e6,  div: 0.09, vol: 0.09 },
  { id: 'NVD', name: 'Nvida',          sector: 'Semi',       cap: 1.40e12, shares: 2.46e9, div: 0.08, vol: 0.14 },
  { id: 'NFX', name: 'Neflix',         sector: 'Streaming',  cap: 167.5e9, shares: 405.2e6,div: 0.96, vol: 0.12 },
  { id: 'NIK', name: 'Niiki',          sector: 'Sport',      cap: 86.3e9,  shares: 830.7e6,div: 2.42, vol: 0.09 },
  { id: 'PEP', name: 'Pepsa.co',       sector: 'Boissons',   cap: 157.6e9, shares: 850.4e6,div: 0.50, vol: 0.07 },
  { id: 'TZL', name: 'Tezla',          sector: 'Automobile', cap: 247.2e9, shares: 3.2e9,  div: 1.20, vol: 0.16 },
  { id: 'TYD', name: 'Toyoda',         sector: 'Automobile', cap: 240.0e9, shares: 1.35e9, div: 2.40, vol: 0.08 },
  { id: 'VIZ', name: 'Viza',           sector: 'Paiement',   cap: 529.4e9, shares: 2.13e9, div: 0.50, vol: 0.08 },
];

/** 10 crypto-actifs : capitalisation, offre en circulation, volatilité. */
export const CRYPTOS = [
  { id: 'BTK', name: 'Bitkoin',      cap: 1.00e12,  supply: 19.767e6, vol: 0.07 },
  { id: 'ATH', name: 'Athereum',     cap: 484.9e9,  supply: 130e6,    vol: 0.10 },
  { id: 'BNZ', name: 'Binanze Coin', cap: 77.1e9,   supply: 100e6,    vol: 0.10 },
  { id: 'SLR', name: 'Solaris',      cap: 68.0e9,   supply: 470e6,    vol: 0.14 },
  { id: 'XRB', name: 'Ripplon',      cap: 33.0e9,   supply: 55e9,     vol: 0.11 },
  { id: 'KRD', name: 'Kardana',      cap: 15.5e9,   supply: 35e9,     vol: 0.12 },
  { id: 'DGX', name: 'Dogex',        cap: 12.0e9,   supply: 145e9,    vol: 0.20 },
  { id: 'AVL', name: 'Avalon',       cap: 9.8e9,    supply: 400e6,    vol: 0.15 },
  { id: 'PLK', name: 'Polkadont',    cap: 6.5e9,    supply: 1.4e9,    vol: 0.13 },
  { id: 'USX', name: 'Stablex',      cap: 90.0e9,   supply: 90e9,     vol: 0.002 },
];

/** 20 biens : le loyer horaire vaut 1,61 % du prix. */
export const RENT_RATE = 0.0161;
export const BUILDINGS = [
  { id: 'b1',  city: 'Stavropol',      country: 'Russie',      price: 35e3,   year: 1437, icon: '🏚️' },
  { id: 'b2',  city: 'Fès',            country: 'Maroc',       price: 43e3,   year: 1580, icon: '🏠' },
  { id: 'b3',  city: 'Katmandou',      country: 'Népal',       price: 55e3,   year: 1596, icon: '🏠' },
  { id: 'b4',  city: 'Iquitos',        country: 'Pérou',       price: 62e3,   year: 2036, icon: '🏡' },
  { id: 'b5',  city: 'Tioumen',        country: 'Russie',      price: 69e3,   year: 1692, icon: '🏡' },
  { id: 'b6',  city: 'Sydney',         country: 'Australie',   price: 120e3,  year: 1668, icon: '🏡' },
  { id: 'b7',  city: 'Mexico',         country: 'Mexique',     price: 140e3,  year: 1912, icon: '🏘️' },
  { id: 'b8',  city: 'Zagreb',         country: 'Croatie',     price: 210e3,  year: 1265, icon: '🏘️' },
  { id: 'b9',  city: 'Belgrade',       country: 'Serbie',      price: 450e3,  year: 1363, icon: '🏘️' },
  { id: 'b10', city: 'Le Cap',         country: 'Afrique du Sud', price: 1e6, year: 1618, icon: '🏢' },
  { id: 'b11', city: 'New York',       country: 'États-Unis',  price: 17.5e6, year: 1288, icon: '🏙️' },
  { id: 'b12', city: 'Monaco',         country: 'Monaco',      price: 30e6,   year: 1979, icon: '🌇' },
  { id: 'b13', city: 'Beverly Hills',  country: 'États-Unis',  price: 55e6,   year: 1279, icon: '🏖️' },
  { id: 'b14', city: 'Canberra',       country: 'Australie',   price: 90e6,   year: 1434, icon: '🏛️' },
  { id: 'b15', city: 'Tokyo',          country: 'Japon',       price: 150e6,  year: 1616, icon: '🌆' },
  { id: 'b16', city: 'Washington',     country: 'États-Unis',  price: 766e6,  year: 1592, icon: '🏛️' },
  { id: 'b17', city: 'Silicon Valley', country: 'États-Unis',  price: 1.5e9,  year: 1959, icon: '🏢' },
  { id: 'b18', city: 'Neuschwanstein', country: 'Allemagne',   price: 2.3e9,  year: 1809, icon: '🏰' },
  { id: 'b19', city: 'Dubaï',          country: 'Émirats',     price: 2.7e9,  year: 1509, icon: '🌃' },
  { id: 'b20', city: 'Zermatt',        country: 'Suisse',      price: 3.8e9,  year: 1898, icon: '🏔️' },
];

/** 5 améliorations : coût en part du prix du bien, bonus de loyer. */
export const UPGRADES = [
  { id: 'internet',  name: 'Fibre très haut débit', costRate: 0.03, bonus: 0.06 },
  { id: 'furniture', name: 'Mobilier neuf',          costRate: 0.06, bonus: 0.10 },
  { id: 'parking',   name: 'Places de parking',      costRate: 0.09, bonus: 0.14 },
  { id: 'repair',    name: 'Rénovation complète',    costRate: 0.14, bonus: 0.20 },
  { id: 'appliance', name: 'Électroménager haut de gamme', costRate: 0.20, bonus: 0.25 },
];

/* =================================================================
   4. LUXE — véhicules, collections, îles
================================================================= */
export const TRIMS = [
  { id: 'basic', name: 'Basique', mult: 1 },
  { id: 'avg', name: 'Intermédiaire', mult: 1.35 },
  { id: 'max', name: 'Maximale', mult: 1.9 },
];
export const ENGINES = [
  { id: 'std', name: 'Standard', mult: 1 },
  { id: 'prem', name: 'Premium', mult: 1.45 },
];
export const RESALE = 0.7;   // décote à la revente d'un véhicule

export const VEHICLES = [
  // Voitures
  { id: 'c1', kind: 'car', name: 'Coupé urbain',        price: 42e3,   icon: '🚗' },
  { id: 'c2', kind: 'car', name: 'Berline exécutive',   price: 145e3,  icon: '🚙' },
  { id: 'c3', kind: 'car', name: 'Sportive allemande',  price: 480e3,  icon: '🏎️' },
  { id: 'c4', kind: 'car', name: 'Grand tourisme',      price: 1.6e6,  icon: '🏎️' },
  { id: 'c5', kind: 'car', name: 'Hypercar',            price: 12e6,   icon: '🏎️' },
  { id: 'c6', kind: 'car', name: 'Série limitée',       price: 48e6,   icon: '🏎️' },
  // Avions
  { id: 'a1', kind: 'aircraft', name: 'Turbopropulseur',   price: 2.4e6,  icon: '🛩️' },
  { id: 'a2', kind: 'aircraft', name: 'Jet léger',          price: 9.5e6,  icon: '✈️' },
  { id: 'a3', kind: 'aircraft', name: 'Jet intercontinental', price: 62e6, icon: '✈️' },
  { id: 'a4', kind: 'aircraft', name: 'Airbus privé',       price: 320e6,  icon: '🛫' },
  { id: 'a5', kind: 'aircraft', name: 'Hélicoptère VIP',    price: 14e6,   icon: '🚁' },
  { id: 'a6', kind: 'aircraft', name: 'Supersonique',       price: 1.1e9,  icon: '🛸' },
  // Yachts
  { id: 'y1', kind: 'yacht', name: 'Vedette de croisière', price: 850e3,  icon: '🛥️' },
  { id: 'y2', kind: 'yacht', name: 'Yacht de 30 m',        price: 8.5e6,  icon: '🛥️' },
  { id: 'y3', kind: 'yacht', name: 'Yacht de 60 m',        price: 74e6,   icon: '🛳️' },
  { id: 'y4', kind: 'yacht', name: 'Méga-yacht',           price: 410e6,  icon: '🛳️' },
  { id: 'y5', kind: 'yacht', name: 'Yacht explorateur',    price: 1.3e9,  icon: '⛴️' },
  { id: 'y6', kind: 'yacht', name: 'Yacht à voiles géant', price: 3.4e9,  icon: '⛵' },
];

export const VEHICLE_KINDS = [
  { id: 'car', name: 'Voitures', shop: 'Concession', mine: 'Garage', icon: '🚗' },
  { id: 'aircraft', name: 'Aéronefs', shop: 'Hangar d’exposition', mine: 'Hangar', icon: '✈️' },
  { id: 'yacht', name: 'Yachts', shop: 'Chantier naval', mine: 'Port', icon: '🛥️' },
];

/** Collections : 10 catégories. Les objets sont générés à partir de thèmes. */
export const COLLECTIONS = [
  { id: 'jewels', name: 'Joyaux', icon: '💎', base: 120e3, count: 12,
    themes: ['Diamant bleu', 'Rubis impérial', 'Émeraude royale', 'Saphir étoilé', 'Perle noire',
             'Opale de feu', 'Jade céleste', 'Améthyste ancienne', 'Topaze solaire', 'Diadème ducal',
             'Collier de cour', 'Bague du doge'] },
  { id: 'art', name: 'Tableaux', icon: '🖼️', base: 450e3, count: 12,
    themes: ['Nature morte au citron', 'Port au crépuscule', 'Portrait de l’inconnue', 'Champ de coquelicots',
             'Étude de mains', 'Rue sous la pluie', 'Falaise au nord', 'Le violoniste',
             'Intérieur bleu', 'Marché du matin', 'Vue de la lagune', 'Autoportrait au miroir'] },
  { id: 'weapons', name: 'Armes & armures', icon: '⚔️', base: 90e3, count: 12,
    themes: ['Sabre de cavalerie', 'Armure de tournoi', 'Épée cérémonielle', 'Casque à visière',
             'Arc composite', 'Hallebarde de garde', 'Bouclier gravé', 'Dague de cour',
             'Cotte de mailles', 'Rapière de duel', 'Masse d’armes', 'Gantelets ouvragés'] },
  { id: 'bikes', name: 'Motos rares', icon: '🏍️', base: 65e3, count: 10,
    themes: ['Bicylindre de 1938', 'Café racer', 'Prototype de course', 'Side-car militaire',
             'Trois-cylindres britannique', 'Boxer de collection', 'Deux-temps de rallye',
             'Custom sur mesure', 'Électrique de série zéro', 'Record de vitesse'] },
  { id: 'air', name: 'Flacons d’air', icon: '🫧', base: 35e3, count: 10,
    themes: ['Air des Alpes', 'Air de la mousson', 'Air du désert blanc', 'Air d’un volcan endormi',
             'Air de la banquise', 'Air d’une forêt primaire', 'Air d’un phare atlantique',
             'Air d’une cathédrale', 'Air d’un souk', 'Air de la stratosphère'] },
  { id: 'stamps', name: 'Timbres', icon: '📮', base: 28e3, count: 10,
    themes: ['Erreur d’impression', 'Premier vol postal', 'Colonie éphémère', 'Surcharge de guerre',
             'Tirage non émis', 'Bloc de quatre', 'Épreuve d’artiste', 'Filigrane inversé',
             'Oblitération rare', 'Feuille complète'] },
  { id: 'science', name: 'Artefacts scientifiques', icon: '🔬', base: 210e3, count: 8,
    themes: ['Astrolabe', 'Microscope de laiton', 'Machine à calculer', 'Globe céleste',
             'Chronomètre de marine', 'Balance de précision', 'Télescope de réfraction', 'Prototype de radio'] },
  { id: 'coins', name: 'Monnaies anciennes', icon: '🪙', base: 55e3, count: 8,
    themes: ['Aureus romain', 'Dinar omeyyade', 'Ducat vénitien', 'Doublon espagnol',
             'Sapèque impériale', 'Statère de Lydie', 'Écu de six livres', 'Souverain d’or'] },
  { id: 'unique', name: 'Pièces uniques', icon: '🗿', base: 1.4e6, count: 8,
    themes: ['Météorite taillée', 'Manuscrit enluminé', 'Squelette de dinosaure', 'Carte marine originale',
             'Trône cérémoniel', 'Automate du XVIIIᵉ', 'Fragment de fusée', 'Partition autographe'] },
];

/** 10 îles privées. */
export const ISLANDS = [
  { id: 'i1',  name: 'Îlot des Sternes',   sea: 'Baltique',    price: 12e6,   icon: '🏝' },
  { id: 'i2',  name: 'Cayo Verde',         sea: 'Caraïbes',    price: 48e6,   icon: '🏝' },
  { id: 'i3',  name: 'Motu Ana',           sea: 'Polynésie',   price: 130e6,  icon: '🏝' },
  { id: 'i4',  name: 'Isola Rossa',        sea: 'Tyrrhénienne',price: 260e6,  icon: '🏝' },
  { id: 'i5',  name: 'Atoll de Perles',    sea: 'Océan Indien',price: 540e6,  icon: '🏝' },
  { id: 'i6',  name: 'Skerry Hall',        sea: 'Mer du Nord', price: 900e6,  icon: '🏝' },
  { id: 'i7',  name: 'Isla Solitaria',     sea: 'Pacifique',   price: 1.6e9,  icon: '🏝' },
  { id: 'i8',  name: 'Blue Lagoon Cay',    sea: 'Bahamas',     price: 3.1e9,  icon: '🏝' },
  { id: 'i9',  name: 'Archipel du Sud',    sea: 'Mer de Corail', price: 7.5e9, icon: '🏝' },
  { id: 'i10', name: 'Terre de Nulle Part',sea: 'Antarctique', price: 18e9,   icon: '🏝' },
];

/* =================================================================
   5. ACCOUNT — classement, trophées
================================================================= */
export const RANK_TIERS = [
  { name: 'Entrepreneurs débutants', min: 0 },
  { name: 'Chefs d’entreprise établis', min: 1e6 },
  { name: 'Millionnaires, magnats régionaux', min: 5e7 },
  { name: 'Oligarques, milliardaires', min: 1e9 },
  { name: 'Multimilliardaires mondiaux', min: 5e10 },
];

/** 100 concurrents fictifs, générés pour couvrir toute l'échelle de richesse. */
export const RIVALS = (() => {
  const first = ['Ethan', 'Sophia', 'Liam', 'Olivia', 'Noah', 'Ava', 'Mason', 'Isabella', 'Lucas', 'Mia',
    'Hugo', 'Camille', 'Yuki', 'Ingrid', 'Omar', 'Nadia', 'Diego', 'Lena', 'Viktor', 'Amara'];
  const last = ['Moore', 'Chen', 'Patel', 'Brooks', 'Kim', 'Rivera', 'Hughes', 'Wong', 'Grant', 'Silva',
    'Dubois', 'Novak', 'Haddad', 'Okafor', 'Rossi', 'Lindqvist', 'Sato', 'Marchand', 'Ferreira', 'Bauer'];
  const sphere = ['boulangerie de quartier', 'design graphique', 'boutique en ligne', 'conseil en réseaux sociaux',
    'bijoux artisanaux', 'toilettage animalier', 'nettoyage automobile', 'création vidéo', 'coaching sportif',
    'agence immobilière', 'logistique portuaire', 'cabinet d’avocats', 'chaîne d’hôtels', 'énergie solaire',
    'semi-conducteurs', 'transport maritime', 'biotechnologies', 'presse et médias', 'fonds spéculatif',
    'télécommunications', 'exploitation minière', 'aéronautique', 'plateforme de paiement', 'chimie industrielle'];
  const out = [];
  for (let i = 0; i < 100; i++) {
    // richesse répartie sur 6 décades, du plus pauvre au plus riche
    const wealth = 25e3 * Math.pow(10, (i / 99) * 6.3) * (0.85 + ((i * 37) % 30) / 100);
    out.push({
      id: 'r' + i,
      name: `${first[(i * 7) % first.length]} ${last[(i * 13) % last.length]}`,
      sphere: sphere[(i * 11) % sphere.length],
      wealth,
    });
  }
  return out.sort((a, b) => b.wealth - a.wealth);
})();

export const TROPHIES = [
  { id: 't_tap100', name: 'Cent tapes', icon: '👆', desc: '100 taps', goal: 100, stat: 'taps' },
  { id: 't_tap5k', name: 'Doigts d’acier', icon: '✋', desc: '5 000 taps', goal: 5000, stat: 'taps' },
  { id: 't_lvl5', name: 'Main lucrative', icon: '🖐️', desc: 'Tap niveau 5', goal: 5, stat: 'clickLevel' },
  { id: 't_lvl15', name: 'Toucher d’or', icon: '🤲', desc: 'Tap niveau 15', goal: 15, stat: 'clickLevel' },
  { id: 't_biz1', name: 'Premier pas', icon: '🏢', desc: 'Fonder une entreprise', goal: 1, stat: 'bizFounded' },
  { id: 't_biz5', name: 'Conglomérat', icon: '🏙️', desc: '5 entreprises actives', goal: 5, stat: 'bizActive' },
  { id: 't_biz10', name: 'Empire', icon: '🌐', desc: '10 entreprises actives', goal: 10, stat: 'bizActive' },
  { id: 't_merge', name: 'Fusion-acquisition', icon: '🤝', desc: 'Fusionner deux sociétés', goal: 1, stat: 'merges' },
  { id: 't_proj10', name: 'Bâtisseur', icon: '🔨', desc: '10 projets achevés', goal: 10, stat: 'projects' },
  { id: 't_stock1', name: 'Premier ordre', icon: '📈', desc: 'Acheter une action', goal: 1, stat: 'stockBuys' },
  { id: 't_div', name: 'Rentier', icon: '💵', desc: '1 M$ de dividendes', goal: 1e6, stat: 'earnDividends' },
  { id: 't_div100', name: 'Coupon royal', icon: '👑', desc: '100 M$ de dividendes', goal: 1e8, stat: 'earnDividends' },
  { id: 't_crypto', name: 'Portefeuille froid', icon: '🪙', desc: 'Détenir 5 cryptos', goal: 5, stat: 'cryptoKinds' },
  { id: 't_cryptoW', name: 'Bull run', icon: '🚀', desc: '10 M$ gagnés en crypto', goal: 1e7, stat: 'earnCrypto' },
  { id: 't_rent1', name: 'Propriétaire', icon: '🔑', desc: 'Acheter un bien', goal: 1, stat: 'estates' },
  { id: 't_rent5', name: 'Bailleur', icon: '🏘️', desc: '5 biens en location', goal: 5, stat: 'estates' },
  { id: 't_rent20', name: 'Foncier mondial', icon: '🗺️', desc: 'Les 20 biens', goal: 20, stat: 'estates' },
  { id: 't_upg', name: 'Rénovateur', icon: '🛠️', desc: '10 améliorations', goal: 10, stat: 'upgrades' },
  { id: 't_car', name: 'Première voiture', icon: '🚗', desc: 'Acheter une voiture', goal: 1, stat: 'cars' },
  { id: 't_jet', name: 'Décollage', icon: '✈️', desc: 'Acheter un aéronef', goal: 1, stat: 'aircrafts' },
  { id: 't_yacht', name: 'Larguez les amarres', icon: '🛥️', desc: 'Acheter un yacht', goal: 1, stat: 'yachts' },
  { id: 't_garage', name: 'Collectionneur auto', icon: '🅿️', desc: '5 voitures', goal: 5, stat: 'cars' },
  { id: 't_coll10', name: 'Amateur d’art', icon: '🖼️', desc: '10 objets de collection', goal: 10, stat: 'items' },
  { id: 't_coll50', name: 'Conservateur', icon: '🏛️', desc: '50 objets de collection', goal: 50, stat: 'items' },
  { id: 't_island', name: 'Robinson', icon: '🏝', desc: 'Acheter une île', goal: 1, stat: 'islands' },
  { id: 't_island5', name: 'Archipel privé', icon: '🌊', desc: '5 îles', goal: 5, stat: 'islands' },
  { id: 't_nw1m', name: 'Millionnaire', icon: '💰', desc: '1 M$ de patrimoine', goal: 1e6, stat: 'netWorth' },
  { id: 't_nw100m', name: 'Centimillionnaire', icon: '💼', desc: '100 M$', goal: 1e8, stat: 'netWorth' },
  { id: 't_nw1b', name: 'Milliardaire', icon: '👑', desc: '1 Md$', goal: 1e9, stat: 'netWorth' },
  { id: 't_nw100b', name: 'Titan', icon: '🏆', desc: '100 Md$', goal: 1e11, stat: 'netWorth' },
  { id: 't_rank50', name: 'Dans le top 50', icon: '📊', desc: 'Entrer dans le top 50', goal: 50, stat: 'rankBest' },
  { id: 't_rank1', name: 'Numéro un mondial', icon: '🥇', desc: 'Première place', goal: 1, stat: 'rankBest' },
];

/* Récompenses quotidiennes, dans l'ordre du cycle. */
export const DAILY_REWARDS = [
  { name: '3 accélérateurs', desc: 'Termine instantanément un projet', kind: 'ticket', value: 3 },
  { name: '50 000 $', desc: 'Un coup de pouce en liquidités', kind: 'cash', value: 50e3 },
  { name: 'Auto-clic 10 min', desc: 'Laisse le clic travailler pour toi', kind: 'autoclick', value: 600 },
  { name: 'Objet de luxe', desc: 'Une pièce offerte pour ta collection', kind: 'item', value: 1 },
  { name: '2 % du patrimoine', desc: 'Prime de fidélité', kind: 'pctCash', value: 0.02 },
];
