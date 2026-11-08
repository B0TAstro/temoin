# CLAUDE.md · Témoin

> Un tiers neutre dans la poche. Montrer plutôt que trancher.

## Le projet

Application mobile pour les matchs de tennis amateurs **sans arbitre**. Les téléphones de la session (**de 1 à N** : un seul suffit pour jouer, chaque téléphone en plus ajoute un angle) filment le match point par point et affichent tous le même score, validé par les deux camps. En cas de désaccord sur une balle, un joueur appuie sur **VAR** depuis n'importe quel téléphone : **tous** les téléphones de la session ouvrent le replay du point joué, chacun depuis son propre point de vue (ralenti, image par image, zoom). **L'app ne tranche jamais** : les joueurs décident devant la même image, et une règle de repli choisie avant le match s'applique si le désaccord persiste.

Principes non négociables :
1. **Montrer, pas trancher.** Toute aide (rebond, dedans/dehors) est une indication avec son incertitude, jamais un verdict.
2. **Se faire oublier.** Aucune interaction pendant l'échange.
3. **Tout en local.** Aucune vidéo ne quitte le téléphone qui l'a filmée. Aucun serveur, aucun compte.
4. **Pas de modèle de vision.** La détection est de l'algorithmique classique (OpenCV + géométrie). Le seul modèle embarqué est la reconnaissance vocale (Vosk).

## Versions

Chaque version ajoute une brique au socle sans remettre en cause la précédente. Une version = une release.

| Version | Ce qu'elle fait | Ce qu'elle permet de vérifier |
|---|---|---|
| **V0** | Le téléphone filme le point en cours et garde le point précédent. « VAR » affiche le point entier au ralenti, image par image, avec zoom. Le score est suivi par un tap des joueurs | Que voir la même image suffit à deux joueurs pour régler un litige, et que le score partagé est tenu |
| **V0.5** | Le score est suivi à la voix : l'app reconnaît l'annonce du serveur, met le score à jour et coupe le clip du point sans que les joueurs touchent le téléphone | Que le téléphone peut se faire oublier pendant l'échange |
| **V1** | La détection suit la balle dans le replay, surligne la ligne et le rebond, recadre sur le moment de la faute et donne dedans/dehors avec un indice de confiance, sans imposer de verdict | Que la détection aide réellement à lire l'image et renforce la confiance des joueurs |

## Stack

iOS **et** Android, et une session doit fonctionner avec un iPhone et un Android ensemble.

| Rôle | Choix |
|---|---|
| Framework | Expo (SDK 58) en development build, React Native 0.88, TypeScript strict |
| Navigation | expo-router |
| Caméra | react-native-vision-camera 5 (enregistreur persistant), `.mp4` sur les deux OS |
| Lecture vidéo | react-native-video |
| Gestes, zoom | react-native-gesture-handler, react-native-reanimated |
| Voix | react-native-vosk + `vosk-model-small-fr-0.22`, grammaire contrainte |
| Liaison | Bluetooth Low Energy en priorité (lib candidate : `munim-bluetooth`), Wi-Fi local en secours |
| Vision | `react-native-fast-opencv` pour les pixels, maths en TypeScript |
| Tests | Jest |

Les libs marquées « candidate » ou non encore testées sur Android doivent être validées sur un vrai téléphone avant d'être considérées comme acquises.

## Architecture

Schémas : `docs/schemas/architecture.png`, `docs/schemas/parcours.png` et `docs/schemas/synchro.png` (voix et VAR entre téléphones).

```
src/
├── app/        écrans (expo-router)
├── ui/         composants du design system (voir DESIGN.md)
├── features/   session, enregistrement, replay, voix, liaison, analyse
├── adapters/   briques natives derrière une interface (+ versions factices)
└── core/       TypeScript pur, zéro import React Native, testé sans téléphone
    ├── score/      machine à états du tennis
    ├── events/     journal d'événements
    ├── clips/      file des clips
    ├── protocol/   messages entre téléphones
    └── cv/         lignes, balle, rebond, homographie, confiance
```

Règles :
- `core` n'importe jamais React Native ni une lib native.
- Chaque brique native (caméra, voix, liaison, OpenCV) est derrière une interface, avec une version factice pour les tests.
- Le score n'est jamais stocké : il est dérivé du journal d'événements.

### Session : de 1 à N téléphones, une seule architecture

Un téléphone seul est une session normale : **un hôte sans invité**. Il n'y a pas de « mode solo » à part, le même code tourne avec 1, 2, 3 ou 10 téléphones.

- **Topologie en étoile** : un **hôte** (celui qui crée la session) et **0 à N invités**. L'hôte ordonne les événements, les invités ne parlent qu'à lui. Pas de maillage entre invités : plus simple, et un ordre unique des événements.
- **Chaque téléphone** a un `deviceId`, un rôle (hôte / invité), un point de vue (`north`, `south`, `side`…) et des capacités (caméra, micro). Un téléphone peut servir juste de tableau de score.
- **Un téléphone est lié à un point de vue sur le court, pas à un joueur** : les joueurs changent de côté, la machine à états sait qui est où.
- **Validation par les deux camps** = des personnes, pas des téléphones. Avec un seul téléphone, les deux joueurs valident sur le même écran (ou par accord tacite en V0.5).
- **Rejoindre en cours de match** : à tout moment, en scannant le QR code de l'hôte. L'invité reçoit le journal complet (quelques Ko) et commence à filmer.
- **Départ de l'hôte** (batterie, appli fermée) : tous les téléphones ont le journal, un invité peut reprendre le rôle d'hôte (le plus ancien dans la session). À faire après V0.

### Protocole de partage : un journal ordonné par l'hôte

Le même protocole sert quel que soit le nombre de téléphones et le transport (local, BLE, Wi-Fi).

1. **Intention** : un téléphone qui veut changer l'état (point, voix, VAR, décision, correction) envoie une intention à l'hôte avec une **clé d'idempotence** (par exemple `point:23` pour une annonce vocale). L'hôte lui-même passe par le même chemin, en local.
2. **Validation** : l'hôte applique la machine à états. Une intention invalide ou déjà traitée (même clé) est ignorée.
3. **Événement** : l'hôte l'ajoute au journal avec un **numéro de séquence** et le diffuse à tous.
4. **Application** : chaque téléphone applique les événements dans l'ordre des numéros. S'il en manque un, il redemande à partir du dernier reçu.
5. **Heartbeat** : chaque invité donne signe de vie, l'hôte affiche qui est connecté.

Coût : un événement fait quelques centaines d'octets, la diffusion est proportionnelle au nombre d'invités. On n'échange **jamais de vidéo** dans ce protocole.

### Liaison : Bluetooth d'abord, Wi-Fi en secours

0. **Un seul téléphone** : transport local, aucune radio utilisée.
1. **BLE (prioritaire)** : l'hôte émet, les invités s'y connectent grâce au QR code. Le nombre d'invités qu'un téléphone accepte en BLE dépend du matériel : à mesurer. Au-delà, ou si c'est instable, Wi-Fi.
2. **Heartbeat** : un ping par seconde. Le lien est jugé instable après plusieurs pongs manqués ou un aller-retour trop long (seuils à régler en test).
3. **Bascule Wi-Fi** : si le BLE est instable, les téléphones passent sur le Wi-Fi local (Wi-Fi du club ou partage de connexion d'un des téléphones). L'hôte ouvre un petit serveur local, son adresse est dans le QR code. La lib serveur reste à choisir et valider.
4. **Retour au BLE** quand il redevient stable. Comme les messages sont numérotés, une bascule ne perd rien.
5. L'état du lien est toujours visible à l'écran (Bluetooth, Wi-Fi ou perdu). Si tout est coupé, chaque téléphone continue de filmer.

## Enregistrement : le buffer se compte en points

On garde le buffer vidéo du POC replay, mais **son unité est le point, pas la durée**. Le buffer fixe de 30 s perdait l'image quand un point était contesté tard.
- La caméra enregistre en continu dans de petits fichiers.
- Un **clip** = les fichiers entre deux fins de point (fin de point = score validé par tap, ou annonce vocale reconnue).
- On garde le point en cours et le point précédent. Dès qu'un point sort de cette fenêtre, ses fichiers sont supprimés (sauf s'ils servent encore à un clip gardé).
- VAR verrouille les clips concernés le temps du litige. L'enregistrement continue derrière.
- Tout est supprimé en fin de match et au lancement de l'app (en cas de crash).

## Score

- Machine à états reprise du POC voix : points, égalité, avantage, point décisif, jeux, sets, tie-break, super tie-break, fin de match, rotation des serveurs, changements de côté.
- Pensée **par équipe** dès le départ (1 joueur en simple, 2 en double).
- Validation : un joueur de chaque équipe. En V0.5, l'annonce du serveur vaut proposition et le silence du receveur vaut accord. « Contester score » reste toujours disponible.

## Voix (V0.5)

Chaîne : le serveur annonce le score, **Vosk transforme la voix en texte** sur le téléphone (speech to text, hors connexion), le texte est comparé aux deux scores possibles, et le score candidat retenu met l'app à jour.

Avec plusieurs téléphones, **chacun fait tourner sa propre reconnaissance**. Il faut donc éviter qu'une même annonce compte deux fois :
1. Chaque téléphone envoie à l'hôte son candidat : `{ numéro du point, score candidat, confiance }`.
2. L'hôte accepte **une seule mise à jour par numéro de point**. Les candidats suivants pour ce même point sont des doublons et sont ignorés.
3. Si deux téléphones entendent des scores différents pour le même point dans une courte fenêtre, la meilleure confiance l'emporte. Si les deux sont incertains, rien ne change et l'écran l'indique (le tap reste possible).
4. L'hôte diffuse le score validé à tous, et chaque téléphone ferme son clip du point.

Avec un seul téléphone, c'est le même chemin avec un seul candidat. Avec plusieurs, le téléphone le plus proche du serveur entend mieux, les autres servent de secours (vent, distance). La grammaire est dérivée de l'état du score, jamais écrite à la main. Point à vérifier en premier : caméra et reconnaissance vocale sur le même micro.

## VAR

- Le bouton VAR peut être pressé sur **n'importe quel** téléphone. L'action part à l'hôte, qui l'envoie à tous.
- **Tous** les téléphones ouvrent le replay du **même point** (même numéro, issu du journal), chacun avec **son propre clip**, donc son propre angle.
- Avec un seul téléphone, c'est simplement le replay local.
- **Voir l'angle d'un autre téléphone** (proposition, après V0) : on ne transfère pas le clip entier (plusieurs dizaines de Mo) mais un **extrait court** autour du moment contesté, demandé à la volée, et **seulement si le Wi-Fi local est disponible** (le BLE est trop lent pour de la vidéo). L'extrait est supprimé à la fin du litige.
- La décision (point pour un camp, point rejoué, règle de repli) est proposée sur un téléphone, validée par l'autre camp, puis diffusée : tous les écrans reviennent au score mis à jour.

## Lecture assistée (V1)

Tourne **uniquement sur le point demandé**, jamais en continu.

1. **Lignes du court** : détection automatique des lignes blanches et des 4 coins (à fiabiliser à partir du POC 2). En secours, le joueur touche les 4 coins sur une image figée.
2. **Homographie** vers les dimensions réelles du court.
3. **Balle** : seuil de couleur jaune, nettoyage, contours, suivi par filtre de Kalman.
4. **Rebond** : changement brusque de la trajectoire, confirmé par le pic sonore si disponible. Marqué sur la timeline.
5. **Indice de confiance** : distance du rebond à la ligne rapportée à la marge d'erreur à cette distance. Affiché comme « 70 % sûr que la balle est sortie ».
6. Chaque téléphone juge la moitié de court la plus proche de lui.

Les constats mesurés dans `temoin-poc-cv-tracking/CLAUDE.md` (symétrie du court, top-hat, fusion des bords de bande…) s'appliquent : ne pas les défaire.

## Contraintes

- Batterie et chauffe : écran noir et assombri pendant l'échange, détection et voix seulement quand c'est utile.
- RGPD : accord des joueurs au lancement, prénoms ou initiales seulement, aucune vidéo transmise, tout supprimé en fin de match.

## Commandes

```bash
npm install
npm run setup:model          # télécharge le modèle Vosk
npx expo prebuild --clean
npx expo run:ios --device
npx expo run:android --device
npm test
npm run typecheck
npm run lint
```

## Conventions

- Code, commentaires, tests, commits : anglais. Interface : français. Échanges avec Tom : français.
- Proposer un plan avant de coder et attendre la validation. Avancer brique par brique, testable sur un vrai téléphone.
- Expliquer chaque choix technique en quelques lignes : Tom doit pouvoir le justifier devant un jury.
- Petits commits clairs à chaque étape qui marche.
- Ne jamais affirmer une capacité d'API ou de lib sans l'avoir vérifiée.

## Hors périmètre

- Tout modèle de vision (YOLO, TrackNet…).
- Verdict automatique imposé aux joueurs.
- Serveur distant, compte, cloud, export ou partage de vidéo en dehors des téléphones de la session.

## POC de référence

Dans `~/Desktop/Apps/Cours/2026/` :
- `temoin-poc-replay` : clips point par point, replay, score co-validé.
- `temoin-poc-voice-score` : machine à états du score et reconnaissance vocale.
- `temoin-poc-cv-tracking` : algorithmes Python de référence (balle, lignes du court).
