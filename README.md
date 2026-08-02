# Business Insider — Investor Tycoon

Simulateur d'investissement web **mobile-first**, reconstruit d'après la structure réelle du jeu
mobile *RichLife: Investor tycoon game* (v1.9.9). Écrit en **HTML / CSS / JavaScript vanilla
(modules ES)**, sans dépendance ni build.

🎮 **Jouer : [kanemamine.github.io/Portfolio](https://kanemamine.github.io/Portfolio/)**

> Projet indépendant, sans lien avec le média *Business Insider*.

## Les cinq onglets

| Onglet | Contenu |
|---|---|
| 💰 **Gains** | Clicker : gain par tap, 15 niveaux de revenu (×1,5 par palier), revenu passif = 6 × le gain par tap, boost ×5 (30 s), auto-clic (60 s), récompense quotidienne |
| 🏢 **Business** | 16 secteurs fondables dans des **emplacements limités**, société **nommée librement**, capitalisation, 35 niveaux, **projets à étapes** (coût + durée réelle, accélérateur), **fusion** de sociétés, fermeture contre 30 % de la capitalisation, spécialisation du garage |
| 📈 **Investir** | **Actions** : 15 sociétés, **dividendes toutes les 3 h** au taux propre à chacune, part du capital détenue · **Crypto** : 10 actifs, capitalisation et offre en circulation, frais 0,5 % · **Immobilier** : 20 biens dans le monde, **loyer = 1,61 %/h du prix**, 5 améliorations, taxe de revente 12 % |
| 💎 **Luxe** | Voitures, aéronefs et yachts **configurables** (finition × motorisation), flotte revendable · 9 collections thématiques · 10 îles privées (commission de vente 8 %) |
| 👤 **Compte** | **Classement mondial** face à 100 concurrents en 5 paliers, répartition du patrimoine, gains par source, 32 trophées, statistiques, export/import |

Le jeu tourne hors ligne (production plafonnée à 8 h) et s'installe en PWA.

## Origine de l'équilibrage

Les ordres de grandeur proviennent de l'analyse des `ScriptableObject` du jeu de référence
(Unity IL2CPP, décodage binaire des assets sérialisés) : progression du clicker, rendement locatif,
taux de dividende, capitalisations, coûts de fondation par secteur. Les textes, visuels et noms
d'objets de l'original ne sont pas repris — contenu et habillage sont propres à ce projet.

## Lancer en local

```bash
python3 -m http.server 8080
# puis http://localhost:8080 (mode mobile dans les devtools)
```

En local, `window.RL` expose l'état (`RL.s`), le moteur (`RL.E`) et les données (`RL.D`).

## Structure

```
index.html       coquille : HUD, vue, barre d'onglets
css/game.css     thème sombre mobile-first, safe-areas iOS
js/data.js       toutes les données et constantes d'équilibrage
js/state.js      création / sauvegarde / migration (localStorage)
js/engine.js     économie : clic, sociétés, marchés, immobilier, luxe, classement, trophées
js/views.js      rendu des cinq onglets et des feuilles modales
js/ui.js         toasts, feuille modale, graphiques canvas
js/main.js       boucle de jeu, actions, cycle de vie
sw.js            cache hors-ligne
```

## Déploiement

GitHub Pages sert la branche `main` à la racine : tout commit sur `main` met le jeu en ligne.
`.nojekyll` désactive le traitement Jekyll.

## Pistes d'amélioration

- Mini-jeux par secteur (combats MMA, atelier du garage, lancements spatiaux)
- Ordres à cours limité, effet de levier, actualités de marché
- Carte du monde interactive pour l'immobilier
- Objectifs quotidiens et saisons
- Classement en ligne entre joueurs
