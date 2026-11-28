# Design · Lineo

## 1. Intention

Lineo doit **soulager la charge mentale** du joueur, pas en ajouter. Il se fait oublier pendant l'échange et n'apparaît qu'entre les points et au moment du litige. Quand il apparaît, il montre une preuve aussi claire qu'une image de télévision, et il laisse les joueurs décider.

## 2. Principes UX

1. **Invisible pendant l'échange.** Aucune notification, aucun son, aucune action requise pendant que la balle est en jeu.
2. **Un regard suffit.** Le score se lit à plusieurs mètres, en plein soleil, en moins d'une seconde.
3. **Une main moite, un pouce.** Cibles larges, jamais de geste fin pour une action de match.
4. **Montrer, pas trancher.** L'app surligne, mesure et explique. La décision reste toujours aux joueurs, avec un bouton pour chaque issue.
5. **Calme.** Pas de rouge alarmant, pas de vocabulaire accusateur (« faute », « tricherie »). Ton neutre, comme un arbitre.
6. **Symétrie.** Tous les téléphones de la session affichent la même chose au même moment. Aucun camp n'a d'information que l'autre n'a pas.
7. **Moins d'une minute** entre l'ouverture de l'app et le premier point filmé.

## 3. Contexte physique

- Le téléphone est posé **au fond du court**, caméra vers le terrain, en **paysage**. Son écran est donc tourné **vers le grillage**, pas vers les joueurs.
- Conséquence : pendant le jeu, personne ne regarde l'écran. Le retour passe par le **son** (un bip court quand le score change) et le joueur consulte l'écran quand il revient chercher une balle ou au changement de côté.
- Position recommandée : en hauteur (pince sur le grillage, ~1,5 m) pour que le joueur ne masque pas sa propre moitié. À valider sur le terrain.

## 4. Parcours principal

Schéma complet : [`parcours.md`](parcours.md).

```
1 Accueil ─► 2a Créer ──────┐
          └► 2b Rejoindre ──┴─► 3 Connexion et placement ─► 4 SCORE ─► 7 Fin
                                                             │  ▲
                                         VAR ─► 5 Replay ────┤  │
                              Contester score ─► 6 Corriger ─┴──┘
```

Objectif : moins d'une minute entre l'ouverture de l'app et le premier point filmé, grâce aux valeurs pré-remplies.

## 5. Écrans

Maquette et design system : Figma `lf5sfGc7zUZLD9BE8juhNG`, pages « Maquette » et « Design System ». Ce qui n'a pas encore de logique est en place dans l'interface et marqué `UI only` dans le code.

### 5.1 Accueil
La roue en haut à droite ouvre les Paramètres. Le logo complet et « la ligne a toujours raison. », une carte de trois conseils (posez le téléphone, jouez normalement, un doute : VAR), puis **Créer une session** (citron) et **Rejoindre une session** (contour blanc). *À venir* : liens légaux.

### 5.2 Créer une session (3 étapes, tout pré-rempli)
1. **Type de match** : format simple / double, nombre de sets, dernier set (super tie-break ou set normal), à 40-40 (avantage ou point décisif).
2. **Le terrain** : lieu et surface, qui règlent la détection de la balle.
3. **Les joueurs** (simple) ou **les équipes** (double : noms d'équipe, 4 joueurs répartis A / B, premier serveur).

Points d'étape au-dessus de **Suivant** / **Retour** / **Créer**. *UI only* : le double, les 5 sets (le score reste en simple, 2 sets gagnants ; en double, le match se joue entre les deux noms d'équipe).

### 5.3 Rejoindre
La caméra dans une carte, avec les 4 coins citron du viseur. Le scan rejoint seul. Ou la phrase de session (`XE56-JFHF-K3QB`), tapée dans le champ : « Rejoindre » s'active dès qu'elle est complète.

### 5.4 Ajouter un téléphone (depuis le match, hôte seulement)
Consigne, la phrase de session en grand, le nombre de téléphones dans la session, et le QR code sur sa carte blanche.

### 5.5 Score (pendant tout le match)
Paysage, fond noir, le score en grand : rien d'autre ne doit attirer l'œil.
- À gauche, un rail d'icônes : Infos, QR (hôte), changer de caméra, micro.
- En haut à droite : la pastille d'état (REC, icône du lien en usage, Bluetooth ou Wi-Fi, téléphones liés, état du lien), repliable.
- Au centre : chaque camp avec **−** (retirer le dernier point, seulement le camp qui l'a gagné) et **+** (proposer le point), la pastille du serveur, les points en Outfit 200 ; entre les deux, les jeux de chaque set et « SET 3 » / « TIE-BREAK ». En double, les prénoms sous le nom d'équipe.
- En bas : **Quitter**, **Pause** (enregistrement, voix et horloge arrêtés sur ce téléphone, « Reprendre »), **VAR** (citron). Un point proposé prend la place de Quitter et Pause : « Point pour Léa ? » avec Refuser / Valider.
- **Infos** : le retour caméra, la liaison (Bluetooth, Wi-Fi, voix, chacun avec son état), REC avec les images par seconde mesurées, et la configuration (points en mémoire, taille d'un point, stockage, cadence). La caméra tourne en permanence, même panneau fermé. **Calibrer** (citron, en haut à droite de l'image) : l'aperçu montre toute l'image, le joueur touche les 4 coins du court puis les glisse, choisit le rectangle (double, simple, carrés de service), Tourner, Recommencer, Annuler ou Valider. Ensuite, les lignes du court en citron sur l'aperçu, et « Recalibrer ».

### 5.6 Replay (litige sur une balle)
S'ouvre **sur tous les téléphones de la session en même temps**, chacun avec sa propre caméra. Un vrai lecteur, dont les contrôles s'effacent après 3 s sans activité (un tap les rappelle) :
- En haut : retour au score, le point (« POINT EN COURS ») et ses flèches, le panneau de décision.
- Au centre : image précédente, son précédent, lecture, son suivant, image suivante.
- En bas : la barre de lecture (tap ou glisser) avec un **losange citron par son fort**, puis ✦ suivi de la balle, son, vitesse **x1 → x0,5 → x0,25**. Pas de plein écran : un tap sur la vidéo efface déjà les contrôles, et le panneau de décision se ferme par son bouton.
- S'ouvre à x1, au début du point, ou une seconde avant sa fin (Paramètres). Pincer pour zoomer, double-tap pour revenir. Le son ne joue qu'à x1.
- Le panneau de décision : Point Léa, Point Tom, Point rejoué, puis l'autre camp valide. **← Retour** ferme sans rien changer.
- Le suivi de la balle : une sphère citron, une traînée blanche légère, et une marque au sol à chaque son fort (*UI only* : un son n'est pas encore un rebond).
- Build dev : l'icône robot remplace les points du match par les vidéos de test.

### 5.7 Lecture assistée (v0.9, *UI only*)
Quand le suivi a analysé tout le point, une carte s'ouvre sur la vidéo : « 70 % dehors », la jauge dedans / incertain / dehors, rebond, ligne, marge d'erreur. Repliée, elle devient une pastille. Entre 40 % et 60 % : « incertain ». Sans calcul, un build release montre des tirets ; un build dev montre les chiffres de la maquette marqués « Aperçu ». Jamais un chiffre inventé devant les joueurs.

### 5.8 Corriger le score
Aujourd'hui : **−** à côté du camp qui a gagné le dernier point. *À venir* : la liste des derniers points, pour corriger plus loin en arrière.

### 5.9 Paramètres
Enregistrement (images par seconde, points gardés en mémoire), pendant le match (score à la voix, lecture assistée du replay, ouverture du replay : début ou fin du point), vos données (vidéos supprimées en fin de match : toujours ; *UI only* : non, sauf les points revus). Les choix s'ouvrent sur place sous leur ligne, le choix actif coché en citron, la phrase « tout est filmé et traité sur ce téléphone », puis la version. Les réglages s'appliquent au match suivant. S'ouvre aussi par la roue de l'écran de match, en calque, avec « S'applique au prochain match ». *UI only* : conditions d'utilisation et confidentialité.

### 5.10 Fin de match
Qui gagne, en combien de sets et de temps, le score de chaque set, les points revus au VAR, les litiges réglés sans rejouer et leur durée moyenne, « Vidéos supprimées », **Terminer**. Les vidéos sont effacées dès que le match est gagné. Durée et temps des litiges sont mesurés sur le téléphone (le journal n'a pas d'heure) : un invité arrivé en cours de match compte depuis son arrivée.

## 6. États à concevoir

| État | Affichage |
|---|---|
| Bluetooth instable | Bascule automatique sur Wi-Fi, pastille « Wi-Fi ». Tout coupé : « Lien perdu, l'enregistrement continue », reconnexion automatique |
| Désaccord de score entre téléphones | Bandeau « Scores différents » avec le journal et un bouton pour se resynchroniser sur l'hôte |
| Voix non reconnue | Rien ne change, icône micro grisée brièvement, le tap reste disponible |
| Chauffe | « Le téléphone chauffe : qualité réduite », passage à 30 fps |
| Batterie faible (< 15 %) | Bandeau orange, suggestion de brancher |
| Stockage insuffisant | Blocage au lancement avec l'espace nécessaire |
| Permission refusée | Écran d'explication et bouton vers les réglages |

## 7. Design system

Source : Figma, page « Design System ». Dans le code : `src/shared/ui/theme.ts` (jetons) et les composants de `src/shared/ui/`.

### 7.1 Couleurs

| Jeton | Valeur | Usage |
|---|---|---|
| `bg` Noir | `#0A0A0A` | Fonds |
| `card` Noir doux | `#161816` | Cartes, champs, bouton retour |
| `text` Blanc | `#FFFFFF` | Texte, lignes, contours |
| `textDim` Fumée | `#8A8F8C` | Textes secondaires |
| `accent` Citron | `#D4F53C` | L'accent unique : l'action principale d'un écran, VAR, le serveur, les sons |
| `warning` Orange | `#F2A93B` | Liaison instable (et repères de dev) |
| `danger` Rouge | `#E5484D` | Liaison perdue, enregistrement, toujours en petit |

**Une seule action en citron par écran.** Contrastes :

| Paire | Ratio | Règle |
|---|---|---|
| Blanc sur noir | 19,8 | Score, texte principal |
| Citron sur noir | 16,0 | Accent |
| Noir sur citron | 16,0 | Boutons d'action |
| Fumée sur noir | 6,0 | Textes secondaires |
| Citron sur blanc | 1,2 | **Interdit** |

### 7.2 Typographie
**Outfit** (Google Fonts), embarquée par le plugin `expo-font`, chiffres tabulaires.
- Score : Regular 200 (le design system dit Thin 130 à 200, l'écran de match utilise Regular).
- Titre d'écran : Light 28 à 40. Bouton : Medium 18 à 20 (VAR en SemiBold). Corps : Light 16 à 18.
- Section : Medium 13, capitales, interlettrage 1,3. Les petites légendes vont jusqu'à 11.

### 7.3 Espacement et formes
- Grille de 8 · 16 · 24. Coins arrondis 12 (16 pour une carte de plusieurs lignes).
- Cibles **64 pt minimum** (80 pour un bouton de match). Contours fins de 1,5 pt, aucune ombre.

### 7.4 Logo et icônes
- `assets/logo/` : `lineo-full` (le nom, son o est la balle citron) et `lineo-symbol` (la balle seule, l'icône d'app). Toujours sur fond sombre, jamais recomposé ni recoloré.
- `assets/icons/` : les icônes du design system, 24 pt, trait 2 pt, inspirées de Lucide ; leur blanc est `currentColor`. Hors Figma : `minus` (score), `bot` (dev).
- `assets/images/` : l'icône d'app et le splash, aux noms par défaut d'Expo.

### 7.5 Composants
Partagés (`shared/ui`) : `Button` (primary, secondary, var, ghost), `Chip`, `TextField`, `Toggle`, `IconButton` (tool, plain, overlay), `ScreenTitle`, `StatusDot`, `ServeDot`, `Logo`, `Icon`, `Fade`, `MessageScreen`, `QrCode`, `ZoomableView`. Par écran : `ScoreDisplay`, `StatusPill`, `MatchInfo`, `MatchControls`, `MatchEndScreen`, `PendingBanner`, `ClipPlayer` (`Seekbar`, `PlayerControls`, `PlayerTools`, `PlayerTopBar`), `DecisionPanel`, `AssistedReading`, `BallTrackOverlay`.

## 8. Interactions et retours

| Moment | Retour |
|---|---|
| Point validé | Bip court + vibration légère sur les deux téléphones |
| Point proposé par l'autre | Bandeau + double vibration |
| VAR | Son distinct, ouverture simultanée du replay |
| Annonce vocale reconnue | Bip + score animé (fondu 200 ms) |
| Erreur | Vibration longue, texte explicatif, jamais de son agressif |

- Animations courtes (≤ 250 ms), désactivées si l'utilisateur a réduit les animations dans les réglages.
- Aucune action destructrice sans confirmation (annuler un point, terminer le match).
- Pas de geste caché pour une action de match, sauf l'appui long « annuler », doublé d'un bouton dans un menu.

## 9. Ton et vocabulaire

- Français simple, phrases courtes, vouvoiement neutre dans les consignes.
- On dit « point contesté », jamais « faute » ou « triche ». On dit « estimation », jamais « verdict ».
- Termes de tennis officiels : égalité, avantage, jeu, tie-break, jeu décisif accepté en synonyme.

## 10. Accessibilité
- Contrastes ci-dessus, tailles de texte dynamiques respectées hors écran de score.
- Libellés d'accessibilité sur tous les boutons (VoiceOver, TalkBack).
- L'information n'est jamais portée par la couleur seule (serveur = pastille + position, rebond = losange + texte).
