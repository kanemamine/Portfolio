# Lab — usine à prototypes

Le pari : **on ne sait pas à l'avance quel jeu prend.** Donc au lieu de miser des
mois sur une idée, on en sort beaucoup, on les filme, on les diffuse, et on laisse
le public désigner celle qui mérite un vrai développement.

Pour que ce pari tienne, une seule chose compte : **le coût d'un prototype
supplémentaire**. Ici il tombe à un fichier d'environ 150 lignes et une commande.
Tout le reste — format vertical, HUD, particules, post-traitement néon, pilote
automatique, capture vidéo, encodage — est mutualisé.

```
idée  →  MVP jouable  →  clip vertical  →  diffusion  →  chiffres  →  on tranche
        (~150 lignes)    (1 commande)                                 (§ Trancher)
```

## Démarrer

```bash
npm install                 # ffmpeg statique (H.264) — une seule fois
npm run serve               # http://localhost:8080/lab/

node tools/new-game.mjs gravity-well "Gravity Well" "Tape pour changer d'orbite"
node tools/capture.mjs gravity-well
```

Le clip sort dans `clips/`, en MP4 1080×1920, prêt à poster.

## Anatomie d'un prototype

`lab/games/<slug>/game.js` exporte un objet. C'est tout le contrat :

```js
export default {
  meta:   { slug, title, hook, tagline, tags, palette },
  reset(r) {},     // (re)démarrage — l'état vit dans r.data
  update(r) {},    // logique, pas de temps fixe r.dt
  draw(r) {},      // rendu monde : 20 unités de large, y vers le haut
  drawUI(r) {},    // facultatif, en pixels écran
  bot(r) {},       // pilote automatique — obligatoire
}
```

**Le bot n'est pas un bonus, c'est l'outil de production.** C'est lui qui joue
dans toutes les vidéos. Il doit bien jouer *et finir par perdre* : un bot parfait
donne un clip sans fin, donc sans chute, donc sans partage. La recette qui marche :
jouer juste, avec une erreur de visée qui croît avec la difficulté (voir
`stack-tower`, champ `bias`).

Deux règles non négociables :

- **Aucun `Math.random()`** — uniquement `r.rng`. Sans ça, rejouer une graine ne
  redonne pas la même partie et toute la chaîne vidéo s'effondre.
- **Aucune horloge réelle** — uniquement `r.dt` et `r.t`.

Et un piège d'API qui a déjà coûté deux prototypes : `rng.int(a, b)` de LittleJS
tire dans **`[b, a)`** — bornes inversées, supérieure exclue. `rng.int(0, 2)` ne
rend donc jamais `2`. Utilise la forme à un argument, `rng.int(n)` → `0…n-1`.

## Ce que le shell fournit

| | |
|---|---|
| Entrée | `r.down`, `r.pressed`, `r.released` — un seul bouton, tap ou clavier |
| Score | `r.addScore(n, pos)`, `r.combo`, record en `localStorage` |
| Juice | `r.impact(p)` (secousse + gel + aberration + bloom), `r.shake`, `r.hitstop`, `r.slowmo`, `r.flash` |
| Effets | `r.burst(pos, couleur, n)`, `r.popup(pos, texte)` |
| Fin | `r.gameOver()` — enchaîne sur le générique en mode capture |
| Rendu | post-traitement néon commun : bloom, aberration chromatique, vignette, scanlines |

Le post-traitement est un shader unique (`engine/shader.js`). LittleJS n'exposant
que trois uniformes, le shell lui transmet l'intensité des effets en peignant un
carré de contrôle de 8 px dans un coin, que le shader lit puis recouvre.

## La chaîne vidéo

`tools/capture.mjs` fait trois choses :

1. **Repérage.** Il rejoue des dizaines de graines *sans rendu* (`?headless=1`) —
   quelques secondes suffisent — et garde celle qui donne le meilleur run. Une
   vidéo ne vaut que si la partie montrée est bonne ; autant la choisir.
2. **Capture.** Il rejoue cette graine avec le rendu complet et le réalisateur.
   L'horloge du navigateur est verrouillée : le jeu croit tourner à 60 im/s même
   si chaque image demande une seconde de calcul. Résultat déterministe, fluide,
   quelle que soit la machine.
3. **Encodage.** Les images partent directement dans ffmpeg (aucun fichier
   intermédiaire) et ressortent en H.264 1080×1920, `+faststart`.

Le réalisateur (`engine/director.js`) monte le clip : **1,3 s d'accroche** (titre
+ hook), la partie, puis **2,4 s de générique** (score, titre, appel à l'action).

```bash
node tools/capture.mjs orb-merge                      # réglages par défaut
node tools/capture.mjs orb-merge --scale 1 --crf 18   # qualité maximale, plus lent
node tools/capture.mjs orb-merge --seed 8283          # rejouer une partie précise
node tools/capture-all.mjs --each 3                   # tout le catalogue, 3 variantes
```

| Option | Défaut | À savoir |
|---|---|---|
| `--scale` | `0.6` | Résolution de rendu ; ffmpeg ré-agrandit en 1080×1920. Le rendu headless étant logiciel, c'est le principal levier de vitesse. |
| `--seconds` | `20` | Durée max de gameplay **dans la vidéo**. Gels d'image et ralentis étirent le temps vu par rapport au temps de jeu : c'est bien la durée vue qui est bornée. |
| `--scout` | `32` | Graines évaluées. Plus haut = meilleur run montré. |
| `--offset` | `0` | Décale la fenêtre de graines : c'est ce qui rend les variantes réellement différentes. |
| `--warmup` | `meta.warmup` | Secondes de partie simulées avant l'image 1. Indispensable aux genres à montée lente : les 15 premières secondes d'un jeu de gestion sont vides, et c'est la première seconde qui décide du partage. |

Ordre de grandeur observé ici (rendu logiciel, sans GPU) : ~7 im/s à `--scale 0.5`,
soit environ 3 minutes pour un clip de 15 s. Sur une machine avec GPU, c'est
nettement plus rapide.

> La chaîne s'arrête au fichier MP4. La publication reste manuelle : elle demande
> des comptes et des identifiants que ce dépôt n'a pas — et n'a pas vocation à avoir.

## Ce que le format impose au genre

Tous les genres ne rentrent pas dans 20 secondes verticales, et c'est une
information, pas un échec. Le test de `shop-rush` l'a montré : la mécanique
marchait dès le premier jet, mais sa courbe — montée calme, agrandissements,
débordement — dure une trentaine de secondes. Filmée depuis le début, elle donnait
quinze secondes de boutique vide.

Deux leviers, dans cet ordre :

1. **`meta.warmup`** — on filme le milieu de partie au lieu du début. À préférer :
   ça ne touche pas à l'équilibrage du jeu jouable.
2. **Resserrer la courbe** — si même le milieu est mou, c'est le jeu qu'il faut
   densifier, pas le montage.

Et si le genre demande plusieurs décisions simultanées (prix, embauche,
agencement), le bouton unique du shell ne suffit plus : il faudra lui ajouter un
pointeur. Aucun prototype n'en a eu besoin jusqu'ici.

## Diffuser

- **Une variante = un post.** Trois clips du même jeu ne sont pas des doublons :
  graines différentes, parties différentes. C'est le volume qui fait le test.
- **L'accroche se joue dans la première seconde.** Le hook de `meta.hook` est ce
  qui s'affiche ; s'il ne donne pas envie, le clip ne partira pas. Réécris-le et
  refilme, ça coûte une commande.
- **Varie le hook, pas le jeu.** Même graine, hook différent : c'est un test A/B
  propre, qui isole ce que tu veux mesurer.
- **Poste le lien jouable**, pas une promesse. Le prototype tourne déjà sur
  GitHub Pages : `…/Portfolio/lab/play.html?g=<slug>`.

Ce qu'il faut regarder, dans l'ordre : **taux de rétention à 3 s** (le hook),
puis **taux de complétion** (le gameplay), puis **clics vers le lien** (l'envie de
jouer). Un clip très vu mais sans clic dit que la vidéo est bonne et que le jeu ne
l'est pas.

## Trancher

`status` dans `lab/games/registry.js` sert de tableau de bord :

| statut | ce que ça veut dire |
|---|---|
| `mvp` | jouable, prêt à filmer |
| `testing` | clips en ligne, on regarde les chiffres |
| `keeper` | a capté du public — candidat au développement réel |
| `parked` | n'a pas pris, gardé pour pièces |

Un prototype passe en `keeper` quand il tient les trois : la rétention se maintient
sur **plusieurs variantes** (pas un coup de chance de l'algorithme), les gens
**cliquent** vers le jeu, et ils **rejouent** une fois arrivés. Tant que les trois
ne sont pas réunis, on ne développe pas — on refilme, ou on passe au suivant.

## Fichiers

```
lab/
  index.html            hub : catalogue + aperçus qui se jouent tout seuls
  play.html             shell universel — ?g=<slug>&seed&bot&rec&scale&format
  engine/
    shell.js            cadre commun : caméra, états, HUD, juice, entrées, bot
    director.js         montage du clip : accroche, partie, générique
    shader.js           post-traitement néon (bloom, aberration, vignette)
    draw.js             texte et voiles
  games/
    registry.js         catalogue et statuts — source unique de vérité
    _template/game.js   gabarit utilisé par le scaffolder
    <slug>/game.js      un prototype
  vendor/               LittleJS 1.18 (MIT), figé
tools/
  new-game.mjs          crée un prototype et l'inscrit au registre
  capture.mjs           repérage → capture → MP4
  capture-all.mjs       tout le catalogue, en série
```

Moteur : [LittleJS](https://github.com/KilledByAPixel/LittleJS) (MIT) — WebGL2,
zéro dépendance, particules, ZzFX et post-traitement inclus. Vendorisé dans
`lab/vendor/` : pas de CDN, le lab tourne hors ligne et ne casse jamais tout seul.
