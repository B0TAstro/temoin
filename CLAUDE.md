# CLAUDE.md · Témoin

> Un tiers neutre dans la poche. Montrer plutôt que trancher.

## Le projet

Application mobile pour les matchs de tennis amateurs **sans arbitre**. Les téléphones de la session (**de 1 à N** : un seul suffit pour jouer, chaque téléphone en plus ajoute un angle) filment le match point par point et affichent tous le même score, validé par les deux camps. En cas de désaccord sur une balle, un joueur appuie sur **VAR** depuis n'importe quel téléphone : **tous** les téléphones de la session ouvrent le replay du point joué, chacun depuis son propre point de vue (ralenti, image par image, zoom). **L'app ne tranche jamais** : elle montre ce qui s'est passé, les joueurs décident devant la même image. Elle ne gère pas un désaccord qui persiste : sans accord, on ferme le replay et le score ne change pas.

Principes non négociables :
1. **Montrer, pas trancher.** Toute aide (rebond, dedans/dehors) est une indication avec son incertitude, jamais un verdict.
2. **Se faire oublier.** Aucune interaction pendant l'échange.
3. **Tout en local.** Aucune vidéo ne quitte le téléphone qui l'a filmée. Aucun serveur, aucun compte.
4. **Pas de modèle de vision.** La détection est de l'algorithmique classique (OpenCV + géométrie). Le seul modèle embarqué est la reconnaissance vocale (Vosk).

## Versions

Chaque version ajoute une brique au socle sans remettre en cause la précédente. Une version = une release.

| Version | Ce qu'elle fait | Ce qu'elle permet de vérifier |
|---|---|---|
| **v0.0** · Socle | L'app se lance sur iPhone et Android avec un simple titre « Témoin ». Architecture `src/` en place, Jest, typecheck, lint, règle d'import qui protège `core` | Que le build et l'outillage tiennent sur les deux OS |
| **v0.0.1** · CI | Intégration continue sur chaque PR : format, lint, typecheck, tests, qualité (sécurité des dépendances, revue, taille du build). Un label sur une PR génère un build installable pour tester la PR avant de la fusionner sur `main` | Qu'aucune régression n'arrive sur `main` et qu'une PR se teste sur un vrai téléphone |
| **v0.1** · Replay seul | Un téléphone filme point par point et garde le point en cours et le précédent. « VAR » affiche le point au ralenti, image par image, avec zoom. Score au tap, validé sur le même écran | Que voir la même image suffit à deux joueurs pour régler un litige |
| **v0.2** · Session à plusieurs | Hôte et invités en Bluetooth (BLE), QR code pour rejoindre à tout moment, score partagé, VAR ouvert sur tous les téléphones | Que le score partagé tient, iPhone et Android ensemble |
| **v0.3** · Voix | L'app reconnaît l'annonce du serveur (Vosk), met le score à jour et coupe le clip sans que personne ne touche le téléphone. Vidéo sans son : Vosk a le micro pour lui seul | Que le téléphone peut se faire oublier pendant l'échange |
| **v0.4** · Son | Le son est enregistré avec la vidéo pendant que Vosk écoute. Les pics sonores (frappe, rebond) sont marqués sur la timeline du replay | Que le son aide à lire le replay et peut confirmer un rebond |
| **v0.5** · Balle suivie | Suivi de la balle dans le replay (seuil de couleur + filtre de Kalman), trajectoire affichée | Que la balle se suit sans modèle de vision |
| **v0.6** · Wi-Fi de secours | Bascule automatique BLE ↔ Wi-Fi local quand le lien est instable, retour au BLE ensuite, état du lien toujours visible | Qu'aucun événement n'est perdu quand le Bluetooth lâche |
| **v0.7** · Court calibré | Le joueur touche les 4 coins, homographie vers le court réel, lignes projetées dans le replay | Que la géométrie tient sur un vrai court |
| **v0.8** · Court détecté | Détection automatique des lignes du court et du filet, les 4 coins restent en secours | Que la calibration manuelle devient inutile |
| **v0.9** · Rebond et confiance | Rebond (trajectoire + pic sonore), recadrage sur le moment contesté, dedans/dehors avec un indice de confiance, jamais un verdict | Que la détection aide réellement à lire l'image et renforce la confiance des joueurs |
| **v1.0** · Match complet | Test terrain d'une heure, chauffe et batterie maîtrisées, finitions | Que l'app tient un vrai match |
| Plus tard | Voir l'angle d'un autre téléphone (Wi-Fi), reprise du rôle d'hôte, interface du double | |

Les tests qui lèvent un risque technique passent au début de la version qui en dépend : enregistreur Android et image par image (v0.1), BLE iPhone ↔ Android (v0.2), micro partagé caméra + Vosk (v0.4), lecture des images d'un clip avec OpenCV (v0.5).

## Stack

iOS **et** Android, et une session doit fonctionner avec un iPhone et un Android ensemble.

| Rôle | Choix |
|---|---|
| Framework | Expo (SDK 58) en development build, React Native 0.88, TypeScript strict (+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Navigation | expo-router |
| Caméra | react-native-vision-camera 5 (enregistreur persistant), `.mp4` sur les deux OS |
| Lecture vidéo | react-native-video |
| Gestes, zoom | react-native-gesture-handler, react-native-reanimated |
| Voix | react-native-vosk + `vosk-model-small-fr-0.22`, grammaire contrainte |
| Liaison | Bluetooth Low Energy en priorité (lib candidate : `munim-bluetooth`), Wi-Fi local en secours |
| Vision | `react-native-fast-opencv` pour les pixels, maths en TypeScript |
| Tests | Jest (jest-expo) |
| CI | GitHub Actions |

Les libs marquées « candidate » ou non encore testées sur Android doivent être validées sur un vrai téléphone avant d'être considérées comme acquises.

## Architecture

Schémas (Mermaid, affichés par GitHub) : `docs/architecture.md`, `docs/parcours.md` et `docs/synchro.md` (voix et VAR entre téléphones). Les PNG pour les slides sont dans `docs/images/`, regénérés par `npm run docs:images` (ou `npm run docs:images -- architecture` pour un seul) : on modifie le `.md`, jamais l'image.

```
models/         modèle Vosk (téléchargé par `npm run setup:model`, jamais commité)
modules/        modules natifs locaux (sound-levels : niveau sonore d'un clip, pour les pics du replay)
assets/         icon/ (icône, splash) et images/ (images de l'interface) uniquement
src/
├── app/        routes expo-router, minces : elles lisent leurs paramètres et affichent un écran
├── features/   une fonctionnalité = un dossier complet, entrée par son index.ts
│   ├── session/      hôte et invité : journal d'événements, protocole chiffré, BLE, écrans créer / rejoindre / QR
│   ├── recording/    un fichier par point : file des clips, enregistreur, caméra du match
│   ├── replay/       VAR : lecteur, panneau de lecture, décisions des joueurs
│   ├── sound-peaks/  pics sonores d'un clip (resserviront au rebond, v0.9)
│   ├── voice/        annonce du serveur → score (Vosk)
│   ├── score/        affichage du score
│   └── match/        l'écran de match, qui assemble les autres
├── sports/
│   └── tennis/       ce qui change d'un sport à l'autre : machine à états du score, libellés, annonces, format du match
└── shared/     ce qui ne connaît aucun métier
    ├── ui/           design system (voir `docs/design.md`) : Button, theme, IconButton…
    ├── lib/          TS pur : base64url
    └── native/       files, random
```

Dans une fonctionnalité, toujours les mêmes sous-dossiers :
```
features/<nom>/
├── logic/      TypeScript pur, testé sans téléphone
├── native/     briques natives derrière une interface (caméra, BLE, Vosk, OpenCV)
├── ui/         composants et écrans
├── use*.ts     hooks : la colle entre logic, native et React
└── index.ts    ce que le reste de l'app a le droit d'utiliser
```
**Ajouter une fonctionnalité** (le suivi de balle en v0.5) = ajouter `features/ball-tracking/` avec ces sous-dossiers, puis l'importer depuis l'écran qui s'en sert : `import { useBallTrack } from '@/features/ball-tracking'`. **Ajouter un sport** = ajouter `sports/badminton/` ; il faudra alors une interface commune (créer un match, appliquer un point, afficher le score), aujourd'hui le journal appelle directement le tennis.

Qui appelle qui (exemple, le tap « +1 Léa ») : `features/match/ui/MatchControls` → `dispatch` → `features/session/useHostSession` → `logic/hostLog` valide (`logic/matchLog` → `sports/tennis/stateMachine`) et numérote → `native/ble/BleHost` diffuse à tous → le journal change → `MatchScreen` se ré-affiche → `features/score/ui/ScoreDisplay`.

Règles (imposées par ESLint dans `eslint.config.js`) :
- **Sens unique** : `app → features → sports → shared`. `shared` ne connaît ni fonctionnalité ni sport ; un sport ne connaît que ses règles.
- **Pur** : `logic/`, `sports/` et `shared/lib/` n'importent ni React, ni React Native, ni Expo, ni lib native.
- **Par l'index** : on entre dans une fonctionnalité ou un sport par `@/features/<nom>` ou `@/sports/<nom>`, jamais dans ses fichiers. Dans une fonctionnalité, imports relatifs. Une fonctionnalité peut en utiliser une autre par son index (`match` les assemble toutes, `replay` utilise `recording`, `sound-peaks`, `session`). Limite : un import relatif vers une autre fonctionnalité (`../../autre`) n'est pas détecté, à surveiller en relecture.
- **Pas de cycle** entre fichiers (`import/no-cycle`), imports triés (`import/order`).
- **Un fichier = une responsabilité**, un export principal nommé comme lui (`PascalCase` pour composants et classes, `camelCase` pour hooks et fonctions). Un seul `index.ts` par fonctionnalité et par sport, nulle part ailleurs.
- **Liaison en trois couches** (dans `features/session`) : le protocole (`logic/`, quels messages et dans quel ordre) ne connaît pas le transport ; le transport (`native/Transport.ts`, `HostTransport` / `GuestTransport`) fait passer les messages ; le codec (`logic/SealedCodec.ts`) chiffre chaque message en une ligne de texte ; le format sur le fil (`native/ble/framing.ts`, paquets de 180 octets) est un détail du BLE. Le Wi-Fi (v0.6) ajoute un transport, sans toucher au protocole.
- Le score n'est jamais stocké : il est dérivé du journal d'événements (`replayLog`).

### Session : de 1 à N téléphones, une seule architecture

Un téléphone seul est une session normale : **un hôte sans invité**. Il n'y a pas de « mode solo » à part, le même code tourne avec 1, 2, 3 ou 10 téléphones.

- **Topologie en étoile** : un **hôte** (celui qui crée la session) et **0 à N invités**. L'hôte ordonne les événements, les invités ne parlent qu'à lui. Pas de maillage entre invités : plus simple, et un ordre unique des événements.
- **Chaque téléphone** a un `deviceId`, un rôle (hôte / invité), un point de vue (`north`, `south`, `side`…) et des capacités (caméra, micro). Un téléphone peut servir juste de tableau de score.
- **Un téléphone est lié à un point de vue sur le court, pas à un joueur** : les joueurs changent de côté, la machine à états sait qui est où.
- **Validation par les deux camps** = des personnes, pas des téléphones. Avec un seul téléphone, les deux joueurs valident sur le même écran (ou par accord tacite avec la voix, v0.3).
- **Rejoindre en cours de match** : à tout moment, en scannant le QR code de l'hôte. L'invité reçoit le journal complet (quelques Ko) et commence à filmer.
- **Départ de l'hôte** (batterie, appli fermée) : tous les téléphones ont le journal, un invité peut reprendre le rôle d'hôte (le plus ancien dans la session). À faire après v1.0.

### Protocole de partage : un journal ordonné par l'hôte

Le même protocole sert quel que soit le nombre de téléphones et le transport (local, BLE, Wi-Fi).

1. **Intention** : un téléphone qui veut changer l'état (point, voix, VAR, décision, correction) envoie une intention à l'hôte avec une **clé d'idempotence** (par exemple `point:23` pour une annonce vocale). L'hôte lui-même passe par le même chemin, en local.
2. **Validation** : l'hôte applique la machine à états. Une intention invalide ou déjà traitée (même clé) est ignorée.
3. **Événement** : l'hôte l'ajoute au journal avec un **numéro de séquence** et le diffuse à tous.
4. **Application** : chaque téléphone applique les événements dans l'ordre des numéros. S'il en manque un, il redemande le journal complet (quelques Ko) : plus simple qu'un rattrapage partiel, et c'est le même message qu'à la connexion.
5. **Présence** : en v0.2, l'état du lien vient des événements de connexion Bluetooth (abonnement, déconnexion). Le heartbeat arrive avec la bascule Wi-Fi (v0.6), qui en a besoin pour juger un lien instable.

Coût : un événement fait quelques centaines d'octets, la diffusion est proportionnelle au nombre d'invités. On n'échange **jamais de vidéo** dans ce protocole.

### Liaison : Bluetooth d'abord, Wi-Fi en secours

0. **Un seul téléphone** : l'hôte annonce quand même la session en BLE, pour qu'un invité puisse rejoindre à tout moment. Si le Bluetooth est refusé ou indisponible, il passe sur `LocalHost` (aucune radio) et le match continue.
1. **BLE (prioritaire)** : l'hôte émet, les invités s'y connectent grâce au QR code. Le nombre d'invités qu'un téléphone accepte en BLE dépend du matériel : à mesurer. Au-delà, ou si c'est instable, Wi-Fi.
2. **Heartbeat** : un ping par seconde. Le lien est jugé instable après plusieurs pongs manqués ou un aller-retour trop long (seuils à régler en test).
3. **Bascule Wi-Fi** : si le BLE est instable, les téléphones passent sur le Wi-Fi local (Wi-Fi du club ou partage de connexion d'un des téléphones). L'hôte ouvre un petit serveur local, son adresse est dans le QR code. La lib serveur reste à choisir et valider.
4. **Retour au BLE** quand il redevient stable. Comme les messages sont numérotés, une bascule ne perd rien.
5. L'état du lien est toujours visible à l'écran (Bluetooth, Wi-Fi ou perdu). Si tout est coupé, chaque téléphone continue de filmer.
6. **Lien chiffré** : l'hôte tire une clé de session (32 octets, `expo-crypto`) qui n'est que dans le QR code, jamais envoyée par radio. Chaque message est chiffré et signé avec elle (XChaCha20-Poly1305, `@noble/ciphers`, dans `features/session/logic/SealedCodec.ts`) : sans le QR, un téléphone à portée ne lit ni ne modifie le score. Un message déjà reçu (même nonce) est ignoré, et un invité ignore un journal complet plus court que le sien (le journal ne fait que grandir) : on ne peut pas rejouer un vieux message enregistré. `PROTOCOL_VERSION` 2.

## Enregistrement : le buffer se compte en points

On garde le buffer vidéo du POC replay, mais **son unité est le point, pas la durée**. Le buffer fixe de 30 s perdait l'image quand un point était contesté tard.
- **Un point = un fichier vidéo = un replay.** La caméra enregistre en continu et le fichier n'est coupé qu'à la fin du point. Pourquoi pas de petits fichiers : sur Android, CameraX n'accepte qu'un enregistrement actif à la fois, donc chaque coupe laisse un petit trou ; avec un fichier par point, ce trou tombe entre deux points, jamais pendant l'échange. Le replay lit aussi un seul fichier, sans recollage.
- Coupe : sur iOS le fichier suivant démarre avant que le précédent s'arrête (aucune image perdue) ; sur Android le précédent s'arrête d'abord (trou mesuré, entre deux points).
- La fin de point est la **proposition** du point (tap ou annonce vocale reconnue), au plus près de la vraie fin de l'échange. Si la proposition est refusée, le fichier déjà coupé est rattaché au point qui continue : ce point a exceptionnellement deux fichiers, joués l'un après l'autre.
- Garde-fou : si aucun point n'est marqué pendant 5 min (oubli, changement de côté), un nouveau fichier démarre.
- On garde **3 points** : le point en cours et les 2 précédents. Dès qu'un point sort de cette fenêtre, son fichier est supprimé.
- VAR verrouille les clips concernés le temps du litige. L'enregistrement est **mis en pause** pendant le replay pour soulager le téléphone (chauffe, batterie), et reprend au retour au score.
- Tout est supprimé en fin de match et au lancement de l'app (en cas de crash).
- Une session est en **paysage** (les menus restent en portrait). Chaque téléphone choisit sa caméra : arrière (meilleure image) ou avant (les joueurs voient l'écran et le score). Pas de miroir : le replay montre le court tel qu'il est, sinon la caméra avant inverserait gauche et droite.

## Score

- Machine à états reprise du **POC voix** (`temoin-poc-voice-score/src/core/score`), qui sert de référence ; celle du POC replay est abandonnée. Le score se recalcule en rejouant le journal.
- Elle couvre : points, égalité, avantage, point décisif, jeux, sets, tie-break, super tie-break, fin de match, rotation des serveurs, changements de côté.
- Pensée **par équipe** dès le départ (1 joueur en simple, 2 en double).
- Validation : un joueur de chaque équipe. Avec la voix (v0.3), l'annonce du serveur vaut proposition et le silence du receveur vaut accord. « Contester score » reste toujours disponible.

## Voix (v0.3)

Chaîne : le serveur annonce le score, **Vosk transforme la voix en texte** sur le téléphone (speech to text, hors connexion), le texte est comparé aux deux scores possibles, et le score candidat retenu met l'app à jour.

Avec plusieurs téléphones, **chacun fait tourner sa propre reconnaissance**. Il faut donc éviter qu'une même annonce compte deux fois :
1. Chaque téléphone envoie à l'hôte son candidat : `{ numéro du point, score candidat, confiance }`.
2. L'hôte accepte **une seule mise à jour par numéro de point**. Les candidats suivants pour ce même point sont des doublons et sont ignorés.
3. Si deux téléphones entendent des scores différents pour le même point dans une courte fenêtre, la meilleure confiance l'emporte. Si les deux sont incertains, rien ne change et l'écran l'indique (le tap reste possible).
4. L'hôte diffuse le score validé à tous, et chaque téléphone ferme son clip du point.

Avec un seul téléphone, c'est le même chemin avec un seul candidat. Avec plusieurs, le téléphone le plus proche du serveur entend mieux, les autres servent de secours (vent, distance). La grammaire est dérivée de l'état du score, jamais écrite à la main. Point à vérifier en premier : caméra et reconnaissance vocale sur le même micro.

Ce qui est en place en v0.3 :
- Code du POC voix repris tel quel : `sports/tennis/announce.ts` (formulations attendues), `features/voice/logic/` (normalisation, lexique, similarité, `decide`, grammaire). Son `ScoreListener` n'est pas repris : le journal d'événements tient ce rôle.
- Une annonce comprise devient l'événement `point-called { winners, afterSeq }` : le point compte tout de suite (silence du receveur = accord) et le clip est coupé. Pour contester : VAR ou « Annuler le point ».
- Doublons : `afterSeq` est le dernier événement que le téléphone avait en entendant l'annonce. L'hôte ne l'accepte que si le journal n'a pas bougé depuis : la copie d'un autre téléphone, ou une copie en retard après « Annuler le point », est ignorée. Refusée aussi pendant le VAR. **Simplification** : la première annonce reçue gagne, pas encore de fenêtre « meilleure confiance » entre téléphones.
- Resynchronisation du POC : un saut de 1 ou 2 points en avant (annonce manquée) est appliqué en un seul événement, sauf si deux ordres des points y mènent (0-0 → 15-15) : l'app ne devine pas qui a gagné le dernier point ; un saut en arrière est affiché, jamais appliqué (on corrige au tap).
- L'écoute est coupée pendant le VAR (les joueurs discutent devant le replay) et quand la caméra est en pause. Bouton pour couper la voix.
- En v0.3 la vidéo était sans son. Depuis la v0.4, caméra et Vosk partagent le micro (voir Son).

## Son (v0.4)

- La vidéo enregistre le son (`enableAudio`) si le micro est autorisé, demandé juste après la caméra. Refusé : vidéo muette, rien d'autre ne change.
- iOS : Vosk forçait la session audio en « enregistrement seul » et la désactivait à l'arrêt, ce qui aurait coupé le son de la vidéo à chaque changement de jeu (Vosk redémarre pour changer de grammaire). Patch `patches/react-native-vosk+2.1.7.patch` (appliqué par `postinstall`) : Vosk rejoint la session lecture + enregistrement de la caméra et ne la désactive plus. Android : rien à changer, CameraX et Vosk lisent le micro en même temps (constaté au premier test, son et voix ensemble).
- Le replay joue le son à ×1 seulement (étiré au ralenti, il n'aide pas), même téléphone en silencieux.
- **Pics sonores** : calculés à l'ouverture du VAR, sur le point affiché seulement. Le module natif local `modules/sound-levels` lit la piste audio du clip (AVAssetReader sur iOS, MediaExtractor + MediaCodec sur Android) et renvoie le niveau sonore (RMS) par tranches de 10 ms. `features/sound-peaks/logic/soundPeaks.ts` garde les maximums locaux 4 fois au-dessus du fond sonore du clip (la médiane), espacés d'au moins 80 ms. Seuils de départ, à régler sur un vrai court.
- Une marque dit « bruit fort ici », jamais ce que c'était (frappe, rebond, cri, grillage). Les boutons « ◀ Son » / « Son ▶ » mettent en pause 0,15 s avant le pic, pour avancer image par image.
- **À vérifier sur un vrai court** : (1) iOS lit le son ré-échantillonné à 16 kHz mono, Android à sa fréquence d'origine ; le 16 kHz coupe les aigus au-dessus de 8 kHz, là où est le « clac » d'une frappe : comparer les marques sur le même échange filmé par les deux téléphones. (2) Sur Android, le décodeur AAC ajoute quelques millisecondes de silence au début (priming, ~20 à 45 ms) que `MediaExtractor` ne retire pas : vérifier en image par image que la marque tombe sur l'impact, pas 1 à 3 images après.

## VAR

- Le bouton VAR peut être pressé sur **n'importe quel** téléphone. L'action part à l'hôte, qui l'envoie à tous.
- **Tous** les téléphones ouvrent le replay du **même point** (même numéro, issu du journal), chacun avec **son propre clip**, donc son propre angle.
- Avec un seul téléphone, c'est simplement le replay local.
- **Voir l'angle d'un autre téléphone** (proposition, après v1.0) : on ne transfère pas le clip entier (plusieurs dizaines de Mo) mais un **extrait court** autour du moment contesté, demandé à la volée, et **seulement si le Wi-Fi local est disponible** (le BLE est trop lent pour de la vidéo). L'extrait est supprimé à la fin du litige.
- Les boutons du replay servent uniquement à **saisir le résultat décidé par les joueurs** : point pour un camp, point pour l'autre, point rejoué. Le résultat est proposé sur un téléphone, validé par l'autre camp, puis diffusé : tous les écrans reviennent au score mis à jour.
- On peut aussi **fermer le replay sans rien changer** au score.
- Avec la lecture assistée (v0.9), le replay peut afficher une **suggestion chiffrée** (« 80 % sûr que la balle est sortie »), jamais un avis tranché ni un bouton qui l'applique.

## Lecture assistée (v0.5, v0.7 à v0.9)

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
npm run format:check

# Release : passer "version" de app.json et package.json à X.Y.Z, merger sur main.
# Android : la CI voit une version sans tag, construit l'APK, crée le tag et la release.
npx expo run:ios --device --configuration Release   # iOS : build autonome sur l'iPhone branché
```

## Intégration continue (v0.0.1)

GitHub Actions, dans `.github/` :
- **`ci.yml`** (push sur `main` et PR) : format, lint, typecheck, tests, `expo-doctor` ; audit des dépendances livrées (bloque à partir de « high ») et revue des nouvelles dépendances sur les PR ; taille du bundle JS iOS et Android dans le résumé du job.
- **`pr-build.yml`** : le label `build` sur une PR génère un **APK Android** installable, lien posté en commentaire.
- **`release.yml`** (push sur `main`) : si la version de `package.json` (égale à celle de `app.json`, sinon échec) n'a pas encore de tag, construit l'APK puis crée le tag `vX.Y.Z` et la release GitHub. Une version déjà taguée ne fait rien. Une version `X.Y.Z-quelquechose` sort en pré-release. Relançable à la main (après un build raté, par exemple).
- **Actions partagées** (`.github/actions/`) : `setup` (Node + `npm ci`) et `build-android` (APK, modèle Vosk en cache).
- **iOS** n'est pas construit en CI : un build installable demande un compte Apple Developer payant. La release iOS se fait en local (voir Commandes).

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
