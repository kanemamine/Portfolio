/* Chargement déclaratif des sprites.

   Un prototype déclare ses images dans `meta.sprites` et ne s'occupe de rien
   d'autre :

     sprites: { cochon: 'animals/pig.png', panda: 'animals/panda.png' }

   LittleJS empaquette tout dans des planches de texture au fur et à mesure du
   décodage (`loadSprite`), donc aucun atlas à préparer à la main. Le jour où de
   vrais atlas arrivent, `L.loadAtlas()` lit le format TexturePacker et Aseprite
   sans rien changer ici.

   Point délicat : `loadSprite` rend un `TileInfo` immédiatement, mais vide — sa
   taille reste nulle jusqu'à ce que l'image soit décodée. C'est ce qui sert de
   signal de disponibilité. Il est indispensable : la capture vidéo fige
   l'horloge du navigateur alors que les images se décodent sur des timers
   réels, donc sans attente les premières frames du clip sortiraient vides. */

import * as L from '../vendor/littlejs.esm.min.js';

const BASE = 'art/';

export function loadSprites(map) {
  const tiles = {};
  for (const [name, path] of Object.entries(map || {})) {
    tiles[name] = L.loadSprite(BASE + path);
  }
  const names = Object.keys(tiles);

  return {
    tiles,

    /** Vrai quand toutes les images sont décodées et empaquetées. */
    ready() {
      /* Sans rendu, aucune image n'est chargée et aucune ne le sera : le
         repérage de graines ne doit pas attendre indéfiniment. */
      if (L.headlessMode) return true;
      return names.every((n) => tiles[n].size.x > 0);
    },

    /** Liste des images qui manquent encore, pour diagnostiquer un chemin faux. */
    missing() {
      if (L.headlessMode) return [];
      return names.filter((n) => tiles[n].size.x <= 0);
    },

    get(name) {
      const t = tiles[name];
      if (!t) throw new Error(`sprite inconnu : « ${name} » (déclare-le dans meta.sprites)`);
      return t;
    },
  };
}
