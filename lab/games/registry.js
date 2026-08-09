/* Registre des prototypes — source unique de vérité.

   Lu par le hub (lab/index.html) et par les outils Node (capture en lot,
   scaffolder). Ne contient que des données : aucune API navigateur, pour rester
   importable des deux côtés.

   `status` sert au tri du portefeuille :
     'mvp'      jouable, prêt à filmer
     'testing'  clips en ligne, on regarde les chiffres
     'keeper'   a capté du public — candidat au vrai développement
     'parked'   n'a pas pris, gardé pour pièces */

export const GAMES = [
  {
    slug: 'neon-drift',
    title: 'Neon Drift',
    hook: 'Maintiens pour dériver',
    tagline: 'Un doigt. Une brèche. Zéro pardon.',
    tags: ['one-button', 'endless', 'réflexe'],
    accent: '#37c8ff',
    status: 'mvp',
  },
  {
    slug: 'stack-tower',
    title: 'Stack Tower',
    hook: 'Lâche au bon moment',
    tagline: 'Un pixel de trop et la tour rétrécit.',
    tags: ['timing', 'one-button', 'arcade'],
    accent: '#3df0c8',
    status: 'mvp',
  },
  {
    slug: 'animal-merge',
    title: 'Zoo Fusion',
    hook: 'Deux pareils, un plus gros',
    tagline: 'Du perroquet à l’éléphant. Une chaîne bien placée et la caisse explose.',
    tags: ['fusion', 'physique', 'animaux'],
    accent: '#ffab4d',
    status: 'mvp',
  },
  {
    slug: 'blade-parry',
    title: 'Blade Parry',
    hook: 'Pare au dernier instant',
    tagline: 'Un geste, une menace. Frappe dans le vide et tu es découvert.',
    tags: ['timing', 'one-button', 'défense'],
    accent: '#54d6ff',
    status: 'mvp',
  },
  {
    slug: 'wall-climb',
    title: 'Wall Climb',
    hook: 'Rebondis, ne retombe pas',
    tagline: 'Le vide monte plus vite que toi.',
    tags: ['plateforme', 'one-button', 'ascension'],
    accent: '#3df0a0',
    status: 'mvp',
  },
  {
    slug: 'beat-runner',
    title: 'Beat Runner',
    hook: 'Tape pile sur le temps',
    tagline: 'Trois vies. Le tempo, lui, n’attend pas.',
    tags: ['rythme', 'one-button', 'précision'],
    accent: '#a67bff',
    status: 'mvp',
  },
  {
    slug: 'knife-spin',
    title: 'Knife Spin',
    hook: 'Plante sans toucher',
    tagline: 'Chaque lame plantée rétrécit la fenêtre suivante.',
    tags: ['précision', 'one-button', 'timing'],
    accent: '#ff9d3d',
    status: 'mvp',
  },
  {
    slug: 'rift-climb',
    title: 'Rift Climb',
    hook: 'Maintiens pour monter',
    tagline: 'L’ouverture bouge. Le vide, lui, monte tout droit.',
    tags: ['pilotage', 'one-button', 'ascension'],
    accent: '#4ab8ff',
    status: 'mvp',
  },
  {
    slug: 'shop-rush',
    title: 'Boutique Rush',
    hook: 'Vendre, refuser, ou attendre',
    tagline: 'Le rayon est vide et la file s’allonge. Tu fais quoi ?',
    tags: ['gestion', 'one-button', 'rush'],
    accent: '#ffc247',
    status: 'mvp',
  },
  /* NEW_GAME_ANCHOR — tools/new-game.mjs insère ici. Ne pas retirer. */
];

export const byStatus = (status) => GAMES.filter((g) => g.status === status);
export const find = (slug) => GAMES.find((g) => g.slug === slug);
