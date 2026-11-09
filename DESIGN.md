# DESIGN.md · Témoin

## 1. Intention

Témoin doit **soulager la charge mentale** du joueur, pas en ajouter. Il se fait oublier pendant l'échange et n'apparaît qu'entre les points et au moment du litige. Quand il apparaît, il montre une preuve aussi claire qu'une image de télévision, et il laisse les joueurs décider.

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

Schéma complet : `docs/schemas/parcours.png`.

```
1 Accueil ─► 2a Créer ──────┐
          └► 2b Rejoindre ──┴─► 3 Connexion et placement ─► 4 SCORE ─► 7 Fin
                                                             │  ▲
                                         VAR ─► 5 Replay ────┤  │
                              Contester score ─► 6 Corriger ─┴──┘
```

Objectif : moins d'une minute entre l'ouverture de l'app et le premier point filmé, grâce aux valeurs pré-remplies.

## 5. Écrans

### 5.1 Écran 1 · Accueil
Deux gros boutons empilés : **Créer une session** (vert) et **Rejoindre une session** (contour blanc). Rien d'autre.

### 5.2 Écran 2a · Créer
Un seul écran, tout pré-rempli : simple ou double, noms des joueurs (prénoms ou initiales), format du match. Bouton bas pleine largeur : **Créer**.

### 5.3 Écran 2b · Rejoindre
Caméra ouverte avec un cadre de visée : « Scannez le QR code du téléphone hôte ».

### 5.4 Écran 3 · Connexion et placement
- Hôte : QR code très grand et liste des téléphones connectés (0, 1, 2…), avec le lien de chacun (Bluetooth, ou Wi-Fi en secours).
- On peut commencer **seul**, sans attendre d'invité. Un autre téléphone peut rejoindre plus tard en scannant le QR code (accessible depuis le menu de l'écran Score).
- Accord des joueurs : une case par camp (« vidéo gardée sur ce téléphone, supprimée en fin de match »).
- Aperçu caméra plein écran, en paysage : « Posez le téléphone en hauteur, au fond du court ».
- Lignes du court détectées en surimpression (vertes = trouvées). Sinon : « Touchez les 4 coins du court ».
- Bouton **Commencer le match**.

### 5.5 Écran 4 · Score (pendant tout le match)
Paysage, **fond noir**, uniquement le score et deux boutons.

```
┌────────────────────────────────────────────────────────────────┐
│ ● REC   Bluetooth ✓                             Set 1 · 4 / 3  │
│                                                                │
│      LÉA  •                          30                        │
│      TOM                             15                        │
│                                                                │
│  ┌──────────────────────────┐   ┌───────────────────────────┐  │
│  │           VAR            │   │      Contester score      │  │
│  └──────────────────────────┘   └───────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

- Points en très grand (≥ 40 % de la hauteur), jeux et sets en haut à droite, pastille jaune devant le serveur.
- **VAR** (jaune balle) : litige sur une balle, ouvre le replay sur les deux téléphones.
- **Contester score** (contour blanc) : le score affiché est faux, ouvre la correction.
- v0.1 : le gagnant du point touche sa ligne de score (+1), l'autre téléphone affiche « Point pour Léa ? Valider ». v0.3 : le score change seul à l'annonce du serveur, avec un bip.
- Après 10 s sans interaction, la luminosité baisse. Un tap la rétablit.

### 5.6 Écran 5 · Replay (litige sur une balle)
S'ouvre **sur tous les téléphones de la session en même temps**, quel que soit celui où l'on a appuyé sur VAR. Chacun montre le même point depuis sa propre caméra. Avec un seul téléphone, c'est le replay local.

À challenger en test : après v1.0, un sélecteur d'angle (« Ce téléphone · Côté nord · Côté sud ») permettrait de voir sur un seul écran un extrait court filmé par un autre téléphone, transféré en Wi-Fi local uniquement. Doit ressembler à un ralenti de télévision.

```
┌────────────────────────────────────────────────────────────────┐
│  ← Retour au score            Point 23 · Caméra côté nord      │
│                                                                │
│                    [ vidéo plein écran, zoomable ]             │
│                                                                │
│  ◀◀ image   ▶ / ❚❚   image ▶▶      x0.25  x0.5  x1            │
│  ├─────────●────────◆─────────────◆───────────────────────┤   │
│                                                                │
│  [ Point Léa ]      [ Point Tom ]      [ Point rejoué ]        │
└────────────────────────────────────────────────────────────────┘
```

- Vidéo bord à bord, commandes sur une barre noire semi-opaque.
- Ouvre au ralenti x0.5 sur la dernière seconde du point.
- Pincer pour zoomer, glisser pour se déplacer, double-tap pour revenir.
- Timeline épaisse (doigt), rebonds détectés en losanges jaunes (v0.9).
- Sélecteur de point (point en cours, précédent).
- Trois boutons toujours visibles, qui servent uniquement à **saisir le résultat décidé par les joueurs** : point pour un camp, point pour l'autre, point rejoué. Le choix est envoyé à l'autre camp, qui doit confirmer.
- **← Retour au score** ferme le replay sans rien changer : l'app ne gère pas un désaccord qui persiste.
- v0.9 : une suggestion chiffrée peut s'afficher (« 80 % sûr que la balle est sortie »), jamais un avis tranché, et aucun bouton ne l'applique d'office.

### 5.7 Analyse (v0.5, v0.7 à v0.9, dans le replay)
Déclenchée par un tap sur un losange de rebond, puis **Analyser**.
- Utilise les lignes détectées à l'écran 3. Si elles manquent : image figée, « Touchez les 4 coins du court », loupe sous le doigt.
- Résultat en surimpression : lignes du court projetées en blanc, point de rebond en jaune, cercle d'incertitude autour.
- Texte en trois lignes, sans verdict :
  - « Rebond estimé à 4 cm à l'extérieur de la ligne de fond »
  - « Marge d'erreur à cette distance : ± 9 cm »
  - « Estimation : **70 % sûr que la balle est sortie** »
- Mention fixe : « Indication, pas une décision. »
- Entre 40 % et 60 %, on affiche « Trop incertain pour conclure » plutôt qu'un pourcentage proche de 50.

### 5.8 Écran 6 · Corriger le score
Liste des derniers points joués (qui a gagné, score après chaque point). Le joueur choisit le point où le score a dérapé et propose la correction. L'autre téléphone affiche la proposition : **Valider** / **Refuser**.

### 5.9 Écran 7 · Fin de match
Score final, durée, nombre de litiges. Message : « Les vidéos ont été supprimées de ce téléphone. » Un seul bouton : **Terminer**.

## 6. États à concevoir

| État | Affichage |
|---|---|
| Bluetooth instable | Bascule automatique sur Wi-Fi, pastille « Wi-Fi ». Tout coupé : « Lien perdu, l'enregistrement continue », reconnexion automatique |
| Désaccord de score entre téléphones | Bandeau « Scores différents » avec le journal et un bouton pour se resynchroniser sur l'hôte |
| Voix non reconnue | Rien ne change, icône micro grisée brièvement, le tap reste disponible |
| Chauffe | « Le téléphone chauffe : qualité réduite », passage à 30 fps |
| Batterie faible (< 15 %) | Bandeau jaune, suggestion de brancher |
| Stockage insuffisant | Blocage au lancement avec l'espace nécessaire |
| Permission refusée | Écran d'explication et bouton vers les réglages |

## 7. Design system

### 7.1 Couleurs

| Jeton | Valeur | Usage |
|---|---|---|
| `court` | `#3E7A57` | Primaire : actions principales, confirmations, en-têtes |
| `ball` | `#E9B44C` | Secondaire : VAR, serveur, rebonds, focus |
| `ink` | `#111111` | Fond des écrans de match, texte sur jaune |
| `line` | `#FFFFFF` | Texte sur fond sombre, lignes du court, contours |
| `ink-soft` | `#1E1E1E` | Barres et cartes sur fond noir |
| `line-dim` | `#FFFFFF` à 60 % | Textes secondaires |

Contrastes mesurés (WCAG) et règles qui en découlent :

| Paire | Ratio | Règle |
|---|---|---|
| Blanc sur noir | 18,9 | Score et texte principal |
| Noir sur jaune | 10,0 | Bouton VAR, pastilles |
| Blanc sur vert | 5,1 | Boutons primaires (texte ≥ 18 pt gras) |
| Vert sur noir | 3,7 | Décor et icônes seulement, **jamais** de texte |
| Jaune sur blanc | 1,9 | **Interdit** |

Les écrans de match sont en **fond noir** : meilleur contraste au soleil et économie de batterie sur écran OLED.

### 7.2 Typographie
- Police système (SF Pro sur iOS, Roboto sur Android), **chiffres tabulaires** pour que le score ne bouge pas.
- Score : 160 à 220 pt, gras. Jeux et sets : 40 pt. Titres : 28 pt. Corps : 20 pt minimum. Rien en dessous de 16 pt.
- Majuscules réservées aux libellés courts (VAR, REC).

### 7.3 Espacement et formes
- Grille de 8 pt. Marges d'écran 24 pt.
- Cibles tactiles : **64 pt minimum** (au-delà des 44 pt iOS et 48 dp Android, pour une main moite). Boutons de match : 80 pt de haut.
- 16 pt d'écart minimum entre deux boutons d'action.
- Coins arrondis 16 pt. Pas d'ombre : aplats et contours blancs de 2 pt.

### 7.4 Composants
`ScoreDisplay`, `ServeDot`, `PointButton`, `VarButton`, `PendingBanner`, `LinkStatus`, `RecIndicator`, `ReplayPlayer`, `FrameStepper`, `SpeedPicker`, `Timeline` (avec `BounceMarker`), `OutcomeBar`, `CornerPicker`, `AnalysisCard`, `ConsentToggle`.

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
