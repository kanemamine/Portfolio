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
    slug: 'orb-merge',
    title: 'Orb Merge',
    hook: 'Deux pareilles fusionnent',
    tagline: 'Une chaîne bien placée et tout le bocal s’allume.',
    tags: ['merge', 'physique', 'chaîne'],
    accent: '#b06bff',
    status: 'mvp',
  },
  /* NEW_GAME_ANCHOR — tools/new-game.mjs insère ici. Ne pas retirer. */
];

export const byStatus = (status) => GAMES.filter((g) => g.status === status);
export const find = (slug) => GAMES.find((g) => g.slug === slug);
