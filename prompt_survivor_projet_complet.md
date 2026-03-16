# PROMPT — Créer un jeu Survivor 2D style Megabonk (Projet complet autonome)

---

## CONTEXTE GÉNÉRAL

Je veux que tu crées un **jeu de type "Survivor" (genre Vampire Survivors / Megabonk)** complet et jouable, sous forme d'un **projet web autonome** que je peux lancer sur mon PC.

Le projet doit :
- Être un **projet Vite + React** standard, initialisable avec `npm create vite@latest`
- Contenir un **README.md** avec les instructions claires pour lancer le jeu en 3 commandes max (`npm install`, `npm run dev`)
- Avoir une **architecture de fichiers propre et modulaire** (pas tout dans un seul fichier)
- Être **immédiatement jouable** dans le navigateur après `npm run dev`
- Pouvoir être **buildé** (`npm run build`) pour obtenir une version statique distribuable

---

## STACK TECHNIQUE

- **Vite** comme bundler/dev server
- **React 18** + **JavaScript** (pas TypeScript pour rester simple)
- **Canvas 2D** (`<canvas>`) pour le rendu du jeu (performances)
- **CSS Modules** ou **un fichier CSS simple** pour le HUD et les menus (pas de Tailwind, pas de dépendance CSS externe)
- **Aucune bibliothèque de jeu externe** (pas de Phaser, pas de PixiJS) — tout est codé from scratch avec Canvas API
- **Web Audio API** pour les sons procéduraux (bips, explosions)

---

## ARCHITECTURE DU PROJET

```
survivor-game/
├── README.md                     # Instructions d'installation et de lancement
├── package.json                  # Dépendances (juste React + Vite)
├── vite.config.js                # Config Vite standard
├── index.html                    # Point d'entrée HTML
├── public/
│   └── favicon.ico               # (optionnel)
└── src/
    ├── main.jsx                  # Point d'entrée React (ReactDOM.render)
    ├── App.jsx                   # Composant racine — gère les écrans (menu, jeu, game over, level-up)
    ├── App.css                   # Styles globaux
    │
    ├── game/
    │   ├── Game.js               # Classe principale — game loop, requestAnimationFrame, état global
    │   ├── Camera.js             # Système de caméra (suit le joueur avec lerp/smoothing)
    │   ├── InputManager.js       # Gestion des inputs clavier (ZQSD/WASD/flèches)
    │   └── CollisionSystem.js    # Détection de collisions (cercle↔cercle, rect↔rect, point↔cercle)
    │
    ├── entities/
    │   ├── Player.js             # Le joueur (position, stats, HP, inventaire d'armes)
    │   ├── Enemy.js              # Classe de base ennemi + sous-types (Goblin, Loup, Golem, Mage, Bombe)
    │   ├── EnemySpawner.js       # Système de spawn (gère les vagues, la composition, le scaling)
    │   ├── Boss.js               # Mini-boss et boss majeurs
    │   ├── XPGem.js              # Gemmes d'expérience droppées par les ennemis
    │   └── Projectile.js         # Projectiles (du joueur ET des ennemis)
    │
    ├── weapons/
    │   ├── WeaponBase.js         # Classe de base pour toutes les armes (cooldown, niveau, dégâts)
    │   ├── OrbWeapon.js          # Arme 1 — Orbe Tournoyant
    │   ├── DirectionalShot.js    # Arme 2 — Tir Directionnel
    │   ├── FlameZone.js          # Arme 3 — Zone de Flammes
    │   ├── LightningWeapon.js    # Arme 4 — Éclairs
    │   ├── BoomerangWeapon.js    # Arme 5 — Boomerang
    │   └── NovaExplosion.js      # Arme 6 — Nova Explosive
    │
    ├── systems/
    │   ├── XPSystem.js           # Gestion de l'XP, calcul des niveaux, table d'XP
    │   ├── UpgradeSystem.js      # Pool d'upgrades, génération des choix, application des upgrades
    │   ├── ParticleSystem.js     # Particules (mort d'ennemis, level-up, explosions)
    │   ├── DamageNumberSystem.js # Nombres de dégâts flottants (normaux + critiques)
    │   └── AudioSystem.js        # Sons procéduraux via Web Audio API
    │
    ├── ui/
    │   ├── HUD.jsx               # Interface en jeu (HP, XP, timer, kills, slots d'armes)
    │   ├── HUD.css               # Styles du HUD
    │   ├── TitleScreen.jsx       # Écran titre avec bouton JOUER
    │   ├── TitleScreen.css       # Styles de l'écran titre
    │   ├── GameOverScreen.jsx    # Écran de game over avec stats
    │   ├── GameOverScreen.css    # Styles du game over
    │   ├── LevelUpMenu.jsx       # Menu de choix d'upgrade (3 cartes)
    │   ├── LevelUpMenu.css       # Styles du menu level-up
    │   └── BossHealthBar.jsx     # Barre de vie des boss (en haut de l'écran)
    │
    ├── data/
    │   ├── constants.js          # TOUTES les constantes du jeu (stats, couleurs, tailles, timings, scaling)
    │   ├── enemyTypes.js         # Définitions des types d'ennemis (stats, couleurs, comportements)
    │   ├── weaponData.js         # Définitions des armes (stats de base, upgrades par niveau)
    │   └── upgradePool.js        # Pool complet des upgrades (avec raretés et effets)
    │
    └── utils/
        ├── math.js               # Fonctions utilitaires (distance, normalize, lerp, clamp, random range)
        └── drawing.js            # Fonctions de dessin Canvas réutilisables (drawCircle, drawRect, drawBar, drawText)
```

---

## GENRE & GAMEPLAY CORE

### Principe fondamental
Le joueur contrôle un personnage vu du dessus (top-down 2D). Les **armes attaquent automatiquement** — le joueur ne fait que **se déplacer** pour esquiver les ennemis et ramasser du loot. Des vagues d'ennemis de plus en plus nombreuses et puissantes arrivent au fil du temps. Le but : **survivre le plus longtemps possible** tout en devenant de plus en plus surpuissant grâce aux upgrades.

### Boucle de gameplay (game loop)
1. **Le joueur se déplace** sur la map avec ZQSD / WASD / flèches directionnelles
2. **Les armes tirent automatiquement** sur les ennemis les plus proches (ou dans des patterns spécifiques selon l'arme)
3. **Les ennemis arrivent en vagues** depuis les bords de l'écran, de plus en plus nombreux et résistants
4. **Les ennemis morts droppent des gemmes d'XP** (petits losanges colorés)
5. **Le joueur ramasse les gemmes** en passant dessus (avec un rayon de collecte qui augmente avec les upgrades)
6. **En montant de niveau**, un menu de choix d'upgrade apparaît (3 choix aléatoires)
7. **Toutes les 60 secondes**, un mini-boss apparaît (plus gros, plus de HP, plus de dégâts)
8. **Toutes les 5 minutes**, un boss majeur apparaît
9. **Le jeu continue indéfiniment** jusqu'à la mort du joueur
10. **Écran de Game Over** avec stats de la run (temps survécu, kills, niveau atteint, DPS max)

---

## PERSONNAGE JOUEUR

### Stats de base (dans `constants.js`)
- **HP** : 100 (affiché en barre de vie verte au-dessus du joueur + dans le HUD)
- **Vitesse de déplacement** : 3 px/frame (upgradeable)
- **Rayon de collecte XP** : 50px (upgradeable)
- **Armure** : 0 (réduit les dégâts reçus, upgradeable)
- **Régénération HP** : 0 HP/sec (upgradeable)
- **Chance de coup critique** : 5% (upgradeable)
- **Dégâts critiques** : x2 (upgradeable)
- **Nombre max d'armes** : 6 slots

### Représentation visuelle
- Le joueur est un **carré/rectangle coloré (bleu vif, ~24x24px)** avec un petit indicateur de direction (triangle ou ligne indiquant où il regarde)
- Une **barre de vie verte** au-dessus du personnage
- Un **cercle semi-transparent bleu clair** autour de lui pour visualiser le rayon de collecte d'XP
- **Effet de clignotement rouge** quand il prend des dégâts (invincibilité de 0.3s)

---

## SYSTÈME D'ARMES (6 armes, acquises via les level-ups)

Le joueur commence avec l'arme #1 et peut en obtenir d'autres via les upgrades de level-up. Chaque arme est une **classe séparée** héritant de `WeaponBase.js`.

### Arme 1 — "Orbe Tournoyant" (`OrbWeapon.js`) — arme de départ
- **Comportement** : 1 à 3 projectiles (petits cercles jaunes) qui orbitent autour du joueur en cercle
- **Dégâts** : 10 par hit
- **Vitesse de rotation** : 2 rad/sec
- **Rayon d'orbite** : 60px
- **Upgrades (niveaux 1→5)** : +1 projectile, +dégâts, +rayon d'orbite, +vitesse rotation

### Arme 2 — "Tir Directionnel" (`DirectionalShot.js`)
- **Comportement** : Tire un projectile (petit rectangle rouge) dans la direction du mouvement du joueur
- **Dégâts** : 20 par projectile
- **Cadence de tir** : 1 tir/sec
- **Portée** : traverse tout l'écran
- **Upgrades** : +projectiles simultanés (spread), +dégâts, +cadence, +taille projectile

### Arme 3 — "Zone de Flammes" (`FlameZone.js`)
- **Comportement** : Crée une zone de dégâts circulaire (cercle orange semi-transparent) à la position du joueur
- **Dégâts** : 5 par tick (toutes les 0.3s)
- **Rayon** : 80px
- **Durée** : permanent tant que le joueur est dans la zone
- **Upgrades** : +rayon, +dégâts/tick, +vitesse des ticks

### Arme 4 — "Éclairs" (`LightningWeapon.js`)
- **Comportement** : Frappe aléatoirement l'ennemi le plus proche avec un éclair (ligne blanche/jaune entre joueur et ennemi)
- **Dégâts** : 40
- **Cadence** : 1 frappe toutes les 2 secondes
- **Upgrades** : +cibles simultanées (chain lightning), +dégâts, +cadence

### Arme 5 — "Boomerang" (`BoomerangWeapon.js`)
- **Comportement** : Lance un projectile (petit triangle vert) qui va et revient vers le joueur
- **Dégâts** : 15 à l'aller, 15 au retour
- **Portée** : 200px avant de revenir
- **Cadence** : 1 toutes les 1.5s
- **Upgrades** : +nombre de boomerangs, +dégâts, +portée, +taille

### Arme 6 — "Nova Explosive" (`NovaExplosion.js`)
- **Comportement** : Explosion circulaire (cercle rouge qui expand) autour du joueur toutes les 5s
- **Dégâts** : 50 à tous les ennemis dans le rayon
- **Rayon** : 150px
- **Upgrades** : +dégâts, -cooldown, +rayon, +nombre d'explosions

---

## SYSTÈME D'ENNEMIS

### Types d'ennemis (définis dans `enemyTypes.js`, instanciés via `Enemy.js`)

#### Ennemi de base — "Goblin" (carré vert, 16x16px)
- **HP** : 20 | **Dégâts** : 10 | **Vitesse** : 1.5 px/frame
- **Comportement** : Se dirige en ligne droite vers le joueur
- **XP drop** : 1 gemme (valeur 10 XP)

#### Ennemi rapide — "Loup" (triangle rouge, 14x14px)
- **HP** : 10 | **Dégâts** : 8 | **Vitesse** : 3 px/frame
- **Comportement** : Fonce vers le joueur, plus rapide mais fragile
- **XP drop** : 1 gemme (valeur 5 XP)

#### Ennemi tank — "Golem" (grand carré gris, 28x28px)
- **HP** : 80 | **Dégâts** : 20 | **Vitesse** : 0.8 px/frame
- **Comportement** : Lent mais très résistant
- **XP drop** : 3 gemmes (valeur 15 XP chacune)

#### Ennemi tireur — "Mage" (losange violet, 16x16px)
- **HP** : 25 | **Dégâts projectile** : 15 | **Vitesse** : 1 px/frame
- **Comportement** : Reste à ~200px du joueur et tire des projectiles toutes les 2s
- **XP drop** : 2 gemmes (valeur 10 XP)

#### Ennemi explosif — "Bombe" (cercle orange, 12x12px)
- **HP** : 15 | **Dégâts explosion** : 30 | **Vitesse** : 2 px/frame
- **Comportement** : Fonce vers le joueur et explose à 30px (AoE 60px)
- **XP drop** : 2 gemmes (valeur 8 XP)

### Mini-boss (toutes les 60 secondes) — via `Boss.js`
- Version 3x plus grosse avec aura rouge pulsante
- **HP** : 500 × (minute actuelle) | **Dégâts** : 30 | **Vitesse** : 1.2
- Invoque 5 ennemis de base toutes les 10 secondes
- **Drop** : 1 coffre (choix d'upgrade bonus)

### Boss majeur (toutes les 5 minutes) — via `Boss.js`
- Grand carré rouge foncé (64x64px) avec bordure dorée animée
- **HP** : 5000 × (numéro du boss) | **Dégâts** : 50
- **Attaques** : charge en ligne droite toutes les 5s, spawn cercle de 8 ennemis toutes les 10s
- **Drop** : 1 coffre légendaire

### Scaling de difficulté (dans `EnemySpawner.js`)
- **Spawn rate** : 1/sec au départ, +0.5/sec par minute (cap 15/sec)
- **HP ennemis** : +10% par minute
- **Dégâts ennemis** : +5% par minute
- **Composition** :
  - Min 0-2 : Goblins uniquement
  - Min 2-4 : + Loups
  - Min 4-6 : + Golems
  - Min 6-8 : + Mages
  - Min 8+ : tous types, proportion de Bombes augmente

---

## SYSTÈME DE LEVEL-UP & UPGRADES

### Table d'XP (dans `XPSystem.js`)
- Niveau 1→2 : 100 XP
- Chaque niveau suivant : XP requise × 1.2 (arrondi)
- Niveau max : aucun (scaling infini)

### Menu de level-up (`LevelUpMenu.jsx`)
Le jeu se met en **PAUSE** et affiche **3 cartes d'upgrade aléatoires**. Chaque carte contient :
- Nom de l'upgrade + icône (emoji)
- Description de l'effet
- Niveau actuel (si déjà pris)
- Bordure colorée selon la rareté (gris = Commun, bleu = Rare, violet = Épique, doré = Légendaire)

### Pool d'upgrades (dans `upgradePool.js`)

**Nouvelles armes** (si slots disponibles) :
- Obtenir armes #2 à #6

**Améliorations d'armes existantes** (niveaux 1→5) :
- Propres à chaque arme

**Stats passives** :
- ❤️ +20 HP max (+ heal) | 🏃 +10% vitesse | 🧲 +30% rayon collecte XP
- 🛡️ +2 armure | 💚 +0.5 HP/sec régén | ⚡ +5% crit chance
- 💥 +25% dégâts crit | 📈 +10% dégâts globaux | 🕐 -8% cooldown armes | ✨ +15% XP gagnée

### Raretés
- **Commun (60%)** : stats basiques, upgrades armes niv 1-2
- **Rare (25%)** : stats améliorées, upgrades armes niv 3-4
- **Épique (12%)** : nouvelles armes, upgrades armes niv 5
- **Légendaire (3%)** : effets puissants ("Tous dégâts x1.5", "Invincibilité 2s au level-up", "Double XP")

---

## MAP & ENVIRONNEMENT

- **Taille** : 3000×3000 pixels
- **Caméra** : suit le joueur avec lerp/smoothing (`Camera.js`)
- **Fond** : grille subtile (lignes gris clair tous les 50px) sur fond sombre `#1a1a2e`
- **Bords** : murs invisibles, le joueur ne peut pas sortir
- **Décor** : rectangles gris foncé semi-transparents aléatoires (visuels uniquement, pas de collision)

---

## INTERFACE UTILISATEUR (HUD)

### En jeu — `HUD.jsx` (overlay React par-dessus le canvas)

**Haut gauche :** Barre HP (rouge/gris, 200px) + texte "HP: XXX/XXX" + Barre XP (bleu) + "Niv. XX"

**Haut droite :** Timer MM:SS + Kill count (crâne + nombre)

**Bas de l'écran :** 6 slots d'armes (icônes + niveaux)

**Flottants (dessinés sur le canvas via `DamageNumberSystem.js`)** :
- Dégâts normaux : blancs, float up + fade | Critiques : jaunes, plus gros
- "+XP" vert au ramassage de gemmes

### Écran titre — `TitleScreen.jsx`
- Titre stylé du jeu (ex: "BONK SURVIVOR")
- Sous-titre + bouton "JOUER" animé (pulse)
- Contrôles affichés
- Meilleur score (stocké en state, persisté via `localStorage` puisqu'on est en local)

### Écran Game Over — `GameOverScreen.jsx`
- "GAME OVER" en gros rouge
- Stats : temps survécu, ennemis tués, niveau atteint, dégâts totaux, armes utilisées
- Bouton "REJOUER"

### Barre de vie boss — `BossHealthBar.jsx`
- Grande barre rouge en haut de l'écran avec nom du boss

---

## EFFETS VISUELS & JUICE (dans `ParticleSystem.js` + `DamageNumberSystem.js` + rendu)

- **Screen shake** quand le joueur prend des dégâts
- **Flash blanc** sur ennemis touchés (0.1s)
- **Particules de mort** : 4-6 petits carrés colorés qui s'éloignent et fade
- **Expansion + fade** pour explosions et zones de dégâts
- **Pulsation** des gemmes XP (scale 0.8→1.2 en boucle)
- **Trail** derrière le joueur en mouvement
- **Grossissement** au level-up (1→1.5→1 en 0.3s)
- **Glow/aura** sur élites et boss
- **Damage numbers** flottants (critiques = jaunes + gros)

---

## AUDIO (`AudioSystem.js` via Web Audio API)

Sons procéduraux générés en code (pas de fichiers audio) :
- **Bip court aigu** : ennemi touché
- **Bip grave** : joueur touché
- **Jingle montant** : level-up
- **Explosion basse fréquence** : kill de boss
- **Bouton mute** dans le HUD pour couper le son

---

## INSTRUCTIONS DE LANCEMENT (à mettre dans `README.md`)

```bash
# 1. Cloner ou extraire le projet
cd survivor-game

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement
npm run dev

# 4. Ouvrir dans le navigateur
# → http://localhost:5173

# 5. (Optionnel) Build de production
npm run build
# Les fichiers statiques seront dans /dist
```

---

## PRIORITÉS D'IMPLÉMENTATION

Si le projet est trop volumineux, implémente dans cet ordre :

1. ✅ Projet Vite fonctionnel + structure de fichiers
2. ✅ Game loop + canvas + déplacement joueur + caméra
3. ✅ Spawn d'ennemis basiques qui poursuivent le joueur
4. ✅ Arme de départ (orbe tournoyant) qui tue les ennemis
5. ✅ Système d'XP + level-up avec choix d'upgrades
6. ✅ Au moins 3 armes différentes
7. ✅ 3 types d'ennemis différents
8. ✅ Mini-boss
9. ✅ HUD complet
10. ✅ Écrans titre + game over
11. ✅ Effets visuels (particules, damage numbers, screen shake)
12. ✅ Audio procédural
13. ⬜ Boss majeur (si le temps le permet)
14. ⬜ Les 6 armes complètes
15. ⬜ Les 5 types d'ennemis

---

## IMPORTANT — Ce que je veux absolument

- Le jeu doit **FONCTIONNER** dès `npm run dev` — pas de bug bloquant, pas d'erreur console
- Le jeu doit être **FUN** — la montée en puissance doit se sentir, les upgrades doivent avoir un impact visible
- Le jeu doit avoir du **JUICE** — les effets visuels font la différence entre "meh" et "wow"
- Les contrôles doivent être **RÉACTIFS** — zéro latence, le personnage répond instantanément
- Le **scaling de difficulté** doit être bien calibré — pas trop facile, pas impossible trop vite
- Le menu de **level-up doit être clair** et satisfaisant
- Le code doit être **propre et modulaire** — chaque fichier a une responsabilité claire
- Je dois pouvoir **modifier facilement** les constantes dans `data/constants.js` pour tweaker le gameplay
- Le projet doit **tourner sans erreur** avec un simple `npm install && npm run dev`

---

Crée-moi ce projet complet maintenant. Tous les fichiers, prêts à lancer.
