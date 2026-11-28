# CLAUDE.md · Lineo

> Un tiers neutre dans la poche. Montrer plutôt que trancher.

**Historique** : **Témoin** était le nom du prototype (v0.0 à v0.5). Lineo est l'app finale, construite à partir de ce prototype. Seuls les dossiers des POC (`temoin-poc-*`) gardent l'ancien nom.

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
| **v0.7** · Court calibré | Le joueur touche les 4 coins (« Calibrer » du panneau Infos), homographie vers le court réel, lignes projetées dans le replay. Au passage : rejoindre une session par une phrase (« Ou saisissez la phrase », aujourd'hui « Bientôt disponible ») | Que la géométrie tient sur un vrai court |
| **v0.8** · Court détecté | Détection automatique des lignes du court et du filet, les 4 coins restent en secours | Que la calibration manuelle devient inutile |
| **v0.9** · Rebond et confiance | Rebond (trajectoire + pic sonore), recadrage sur le moment contesté, dedans/dehors avec un indice de confiance, jamais un verdict | Que la détection aide réellement à lire l'image et renforce la confiance des joueurs |
| **v1.0** · Match complet | Test terrain d'une heure, chauffe et batterie maîtrisées, finitions. Le double compté (4 joueurs, rotation des serveurs et des receveurs, validation par équipe ; aujourd'hui les noms des équipiers sont seulement affichés), le format en 5 sets (choisi à la création, pas encore lu par le score ; `setsToWinMatch` existe dans `sports/tennis`), les conditions d'utilisation et la politique de confidentialité (liens des Paramètres) | Que l'app tient un vrai match |
| Plus tard | Voir l'angle d'un autre téléphone (Wi-Fi), reprise du rôle d'hôte | |

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
| Liaison | Bluetooth Low Energy en priorité (`munim-bluetooth`), Wi-Fi local en secours |
| Chiffrement | `@noble/ciphers` (XChaCha20-Poly1305), `expo-crypto` pour la clé de session |
| Vision | `react-native-fast-opencv` pour les pixels, maths en TypeScript |
| Tests | Jest (jest-expo) |
| CI | GitHub Actions |

Les libs marquées « candidate » ou non encore testées sur Android doivent être validées sur un vrai téléphone avant d'être considérées comme acquises.

## Architecture

Schémas (Mermaid, affichés par GitHub) : `docs/architecture.md`, `docs/parcours.md`, `docs/synchro.md` (voix et VAR entre téléphones) et `docs/tracking.md` (suivi de balle dans le replay, en 4 étapes). Un seul schéma Mermaid par fichier : le script en fait une image. Les PNG pour les slides sont dans `docs/images/`, regénérés par `npm run docs:images` (ou `npm run docs:images -- architecture` pour un seul) : on modifie le `.md`, jamais l'image.

```
models/         modèle Vosk (téléchargé par `npm run setup:model`, jamais commité)
modules/        modules natifs locaux (sound-levels : niveau sonore d'un clip, pour les pics du replay ; clip-frames : images d'un clip, pour le suivi de balle ; lan-link : lignes de texte en TCP sur le Wi-Fi local, et la découverte Bonjour de l'hôte, pour la session)
assets/         images/ (icône d'app et splash aux noms par défaut d'Expo, images de l'interface comme le coin du viseur), logo/ (`lineo-full` : le nom avec la balle, `lineo-symbol` : la balle seule ; SVG + PNG, exports Figma) et icons/ (icônes du design system en SVG, leur blanc est `currentColor`)
src/
├── app/        routes expo-router, minces : elles lisent leurs paramètres et affichent un écran
├── features/   une fonctionnalité = un dossier complet, entrée par son index.ts
│   ├── session/      hôte et invité : journal d'événements, protocole chiffré, BLE, écrans créer / rejoindre / QR
│   ├── recording/    un fichier par point : file des clips, enregistreur, caméra du match
│   ├── replay/       VAR : lecteur, panneau de lecture, décisions des joueurs
│   ├── sound-peaks/  pics sonores d'un clip (resserviront au rebond, v0.9)
│   ├── ball-tracking/ balle suivie dans le replay (OpenCV + Kalman)
│   ├── court/        court calibré : les 4 coins sur l'image caméra, homographie, lignes du court sur l'aperçu et le replay, zone du court pour le suivi de balle
│   ├── voice/        annonce du serveur → score (Vosk)
│   ├── score/        affichage du score
│   ├── settings/     paramètres (cadence, points gardés, voix, lecture assistée), seul fichier gardé entre deux lancements
│   └── match/        l'écran de match, qui assemble les autres
├── sports/
│   └── tennis/       ce qui change d'un sport à l'autre : machine à états du score, libellés, annonces, format du match
└── shared/     ce qui ne connaît aucun métier
    ├── ui/           design system (voir `docs/design.md`) : theme, Icon, Logo, Button, Chip, TextField, Toggle, ScreenTitle, StatusDot, ServeDot, IconButton…
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
- **Une brique native = un objet et un hook mince.** L'objet (`VoiceListener`, `ClipRecorder`) vit au-delà des rendus, pilote sa brique et garde son état dans un `Store` (`shared/lib/Store.ts`, pattern Observer). Le hook le construit et le lit avec `useSyncExternalStore`, sans `useRef` ni polling. L'objet reçoit sa brique par son constructeur (injection, avec une factory : `CreateSpeechEngine`, `CreateVideoRecorder`), il ne fait jamais `new VoskEngine` lui-même : avec une fausse brique, il tourne sans téléphone.
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
- **Rejoindre en cours de match** : à tout moment, en scannant le QR code de l'hôte ou en tapant sa phrase de session. L'invité reçoit le journal complet (quelques Ko) et commence à filmer.
- **Départ de l'hôte** (batterie, appli fermée) : tous les téléphones ont le journal, un invité peut reprendre le rôle d'hôte (le plus ancien dans la session). À faire après v1.0.

### Protocole de partage : un journal ordonné par l'hôte

Le même protocole sert quel que soit le nombre de téléphones et le transport (local, BLE, Wi-Fi).

1. **Intention** : un téléphone qui veut changer l'état (point, voix, VAR, décision, correction) envoie une intention à l'hôte. L'hôte lui-même passe par le même chemin, en local. Il n'y a **pas de clé d'idempotence** : une annonce vocale porte `afterSeq` (le dernier événement que le téléphone connaissait), refusée si le journal a bougé depuis ; une intention n'est **jamais envoyée deux fois** (un invité n'envoie que sur un seul lien, voir Liaison), car « Annuler le point » reçu deux fois annulerait deux points.
2. **Validation** : l'hôte applique la machine à états. Une intention invalide (plus possible dans l'état actuel) est ignorée.
3. **Événement** : l'hôte l'ajoute au journal avec un **numéro de séquence** et le diffuse à tous.
4. **Application** : chaque téléphone applique les événements dans l'ordre des numéros. S'il en manque un, il redemande le journal complet (quelques Ko) : plus simple qu'un rattrapage partiel, et c'est le même message qu'à la connexion.
5. **Présence** : le heartbeat (v0.6). L'hôte envoie `ping` chaque seconde sur chaque lien, chaque invité répond `pong` (avec un identifiant tiré au hasard pour la session) sur le lien d'arrivée : l'hôte compte ses invités par leurs pongs, sur tous les liens.

Coût : un événement fait quelques centaines d'octets, la diffusion est proportionnelle au nombre d'invités. On n'échange **jamais de vidéo** dans ce protocole.

### Liaison : Bluetooth d'abord, Wi-Fi en secours

0. **Un seul téléphone** : l'hôte annonce quand même la session en BLE, pour qu'un invité puisse rejoindre à tout moment. Si le Bluetooth est refusé ou indisponible, il passe sur `LocalHost` (aucune radio) et le match continue.
1. **BLE (prioritaire)** : l'hôte émet, les invités s'y connectent grâce au QR code. Le nombre d'invités qu'un téléphone accepte en BLE dépend du matériel : à mesurer. Au-delà, ou si c'est instable, Wi-Fi.
2. **Wi-Fi local, à côté du BLE** (v0.6) : l'hôte écoute en TCP sur un port libre, sur toutes ses interfaces (Wi-Fi du club, ou son propre partage de connexion), avec le module natif `modules/lan-link` (Network.framework sur iOS, `ServerSocket` sur Android ; aucune lib serveur maintenue et compatible New Architecture). Ses adresses (`ip:port`, IPv4 privées des interfaces Wi-Fi et hotspot, listées par le module : `expo-network` rate le hotspot) sont dans le QR code (`w=`) **et dans chaque ping** : un invité les apprend par le BLE, même si le partage de connexion est allumé après le QR. Une ligne scellée par message (pas de paquets de 180 octets comme en BLE) ; une connexion qui envoie une ligne non scellée avec la clé est fermée. **Bonjour** (v0.7) : l'hôte s'annonce aussi sous `Lineo-<code>` (`_lineo._tcp`, `NSBonjourServices`) ; un invité qui ne connaît aucune adresse (il a tapé la phrase, sans Bluetooth à portée, comme le simulateur) s'y connecte par ce nom (`connectService` : `NWConnection` vers le service sur iOS, `NsdManager` sur Android). Android : l'invité accroche l'app au Wi-Fi (`bindProcessToNetwork`), sinon un Wi-Fi sans internet perd contre les données mobiles. iOS : se connecter demande la permission « réseau local » (`NSLocalNetworkUsageDescription`), écouter non ; la première tentative échoue pendant la demande, la suivante passe.
3. **L'hôte envoie tout sur tous les liens** (`SessionHost`) : un invité ignore un événement ou un journal déjà reçu, l'hôte n'a donc pas à savoir par où passe chaque invité. **L'invité garde les deux liens ouverts** et choisit seul celui où il envoie (`SessionGuest`) : jamais deux à la fois (pas de clé d'idempotence, voir Protocole).
4. **Heartbeat et bascule** (`logic/linkHealth.ts`, `logic/chooseLink.ts`) : un lien est `ok` avec un ping il y a moins de 2,5 s, `unstable` au-delà (environ 3 pings manqués), `lost` après 6 s. L'invité envoie par le Bluetooth s'il est `ok`, sinon par le Wi-Fi s'il est `ok` ; il ne revient au Bluetooth qu'après 10 s de Bluetooth `ok` d'affilée (pas de va-et-vient sur un lien limite). À chaque changement de lien, il redemande le journal complet : rien de ce que l'ancien lien a perdu ne manque. Seuils à régler sur le court.
5. L'état du lien est toujours visible (`linkStatus.ts`) : pastille avec l'icône du lien en usage (Bluetooth ou Wi-Fi), « Relié par Wi-Fi · Bluetooth instable », chaque lien dans le panneau Infos, « Lien perdu, l'enregistrement continue » quand tout est coupé. Si tout est coupé, chaque téléphone continue de filmer.
   - **À vérifier sur de vrais téléphones** : Wi-Fi du club, partage de connexion d'un Android, partage de connexion d'un iPhone (Apple ne le garantit pas pour du trafic entre apps, et iOS 18 a changé son adressage : seulement IPv4 pour l'instant), Wi-Fi sans internet avec les données mobiles allumées.
6. **Lien chiffré** : l'hôte tire une **phrase de session** (v0.7, `logic/sessionPhrase.ts` : 12 caractères en base32 de Crockford, sans I L O U, en 3 groupes, `XE56-JFHF-K3QB`, 60 bits de hasard). Le code de session (public, dans le nom Bluetooth et le nom Bonjour) en est tiré par SHA-256, la clé (32 octets) par PBKDF2-SHA-256 (20 000 itérations, `@noble/hashes`). Taper la phrase redonne donc le même code et la même clé : rien n'est échangé par radio, le protocole ne change pas. Le QR code porte le code et la clé, l'écran d'invitation montre la phrase. Compromis assumé : la clé a 60 bits d'entropie au lieu de 256 ; pour un espion qui aurait capté un message chiffré, chaque essai de phrase coûte 20 000 SHA-256, soit environ 2^74 opérations pour toutes les essayer, hors de portée pour un match de tennis. La saisie est tolérante (minuscules, espaces, tirets, O lu 0, I et L lus 1). Chaque message est chiffré et signé avec la clé (XChaCha20-Poly1305, `@noble/ciphers`, dans `features/session/logic/SealedCodec.ts`) : sans le QR ni la phrase, un téléphone à portée ne lit ni ne modifie le score. Le côté qui a scellé le message (hôte ou invité) est signé avec lui (données associées) : un message renvoyé au téléphone qui l'a écrit (un faux hôte qui renvoie à l'invité son propre « sync ») est rejeté. Les deux côtés ignorent aussi tout type de message qui n'est pas le leur. Un message déjà reçu (même nonce) est ignoré, et un invité ignore un journal complet plus court que le sien (le journal ne fait que grandir) : on ne peut pas rejouer un vieux message enregistré. `PROTOCOL_VERSION` 4 (heartbeat, adresses Wi-Fi). La route `match` vérifie le code et la clé d'un lien `lineo://match` avant de démarrer la session, sinon « Lien de session invalide ».

## Enregistrement : le buffer se compte en points

On garde le buffer vidéo du POC replay, mais **son unité est le point, pas la durée**. Le buffer fixe de 30 s perdait l'image quand un point était contesté tard.
- **Un point = un fichier vidéo = un replay.** La caméra enregistre en continu et le fichier n'est coupé qu'à la fin du point. Pourquoi pas de petits fichiers : sur Android, CameraX n'accepte qu'un enregistrement actif à la fois, donc chaque coupe laisse un petit trou ; avec un fichier par point, ce trou tombe entre deux points, jamais pendant l'échange. Le replay lit aussi un seul fichier, sans recollage.
- Coupe : sur iOS le fichier suivant démarre avant que le précédent s'arrête (aucune image perdue) ; sur Android le précédent s'arrête d'abord (trou mesuré, entre deux points).
- La fin de point est la **proposition** du point (tap ou annonce vocale reconnue), au plus près de la vraie fin de l'échange. Si la proposition est refusée, le fichier déjà coupé est rattaché au point qui continue : ce point a exceptionnellement deux fichiers, joués l'un après l'autre.
- Garde-fou : si aucun point n'est marqué pendant 5 min (oubli, changement de côté), un nouveau fichier démarre.
- On garde **3 points** par défaut : le point en cours et les 2 précédents (de 1 à 3 précédents dans les Paramètres). Dès qu'un point sort de cette fenêtre, son fichier est supprimé.
- VAR verrouille les clips concernés le temps du litige. L'enregistrement est **mis en pause** pendant le replay pour soulager le téléphone (chauffe, batterie), et reprend au retour au score.
- **Pause** (barre sous le score) : les joueurs mettent le match en pause sur ce téléphone (changement de côté, discussion). L'enregistrement et la voix s'arrêtent, l'horloge du match aussi (`MatchClock`), « Reprendre » relance tout. Pause est locale : chaque téléphone filme pour lui, ce n'est pas un événement du journal.
- Tout est supprimé en fin de match et au lancement de l'app (en cas de crash).
- Une session est en **paysage** (les menus restent en portrait), replay compris : une vidéo filmée en portrait s'y affiche avec des bandes. Chaque téléphone choisit sa caméra : arrière (meilleure image) ou avant (les joueurs voient l'écran et le score). Pas de miroir : le replay montre le court tel qu'il est, sinon la caméra avant inverserait gauche et droite.

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

## Balle suivie (v0.5)

Portage du POC 1 (`temoin-poc-cv-tracking`, tag `poc1-ball-tracking`), dans `features/ball-tracking`.

- **Interrupteur « Tracking »** dans le replay : allumé, `ReplayBallTracker` lit les images autour du temps à l'écran, de 1,5 s avant à 1,5 s après, et calcule la trajectoire **sur toutes ces images à la fois** : un replay est un fichier, la suite d'une image est connue autant que ce qui la précède. Ce qui a été lu est gardé (8 s au plus) : reculer image par image, mettre en pause ou rejouer dedans ne relit rien et ne change pas la trajectoire. Le lecteur ne va qu'en avant : revenir avant ce qui a été lu repart 1,5 s plus tôt ; plus de 0,5 s de retard (saut en avant, lecture plus rapide que l'analyse) repart 0,2 s avant le temps à l'écran. Rien ne tourne éteint, ni pendant qu'on filme.
- **Ralentir n'aide pas la détection** : les images sont les mêmes à toutes les vitesses (taille et flou de la balle fixés au tournage). Le ralenti laisse seulement plus de temps de calcul par image affichée. Ce qui aide : filmer à haute cadence, une balle plus grosse en pixels, du contraste.
- **Images** : `modules/clip-frames` (AVAssetReader en BGRA sur iOS, MediaExtractor + MediaCodec en YUV sur Android) lit le fichier en avant, une image à la fois, en **1280 px** de côté long (une balle au fond du court ne fait que 3 à 10 px, la réduire à 640 la perd), redressée selon la rotation du fichier, en RGB compact (`ArrayBuffer`).
- **Pixels** : `react-native-fast-opencv` 1.0.1 (`native/OpenCvDetector.ts`, seul fichier qui l'importe). Sur un court, la balle fait quelques pixels parmi les gradins, les vêtements, les chaussures et les ombres. Ce qui la distingue dans une image, c'est qu'elle **passe** : à sa place, l'image est plus claire et plus jaune qu'un instant avant et qu'un instant après. Sur les pixels tels que filmés (un flou efface une balle de 2 px) :
  1. chaque image est comparée à celles 30 ms avant et 30 ms après (`logic/framesToCompare.ts` : 2 images d'écart à 60 i/s, 1 à 30) : plus claire que les deux d'au moins 25 niveaux de gris ET plus jaune que les deux (`min(rouge, vert) - bleu`, au moins 4). Une ombre qui arrive est plus sombre, une ombre qui part reste claire, un maillot est encore là l'image d'après. La réponse pour une image arrive donc 1 ou 2 images plus tard ;
  2. pas plus rouge que verte (rouge - vert ≤ 10) : un bras ou une jambe passe aussi, mais la peau est rouge avant d'être verte ;
  3. taches de 2 px à 3 % de la largeur, dans une petite zone de mouvement (≤ 4 % de la largeur, différence de gris flouté avec l'image d'avant, seuil 20, dilatée) : une personne qui bouge fait une grande zone (`logic/candidates.ts`, `ballBlobs`). Une image identique à la précédente (enregistrement d'écran) est sautée.
  - Pas de couleur absolue : la version précédente exigeait un jaune HSV `[25, 50, 140]` → `[45, 255, 255]`. Mesuré sur la vidéo de référence : au fond du court, la balle de 2 px se mélange au mur sombre et sort de cette plage de 2 unités (teinte 47, saturation 50) alors que son mouvement est net (40 à 70 niveaux de gris). La couleur d'une vidéo est stockée à demi-résolution : à cette taille, c'est la luminosité qui porte l'information.
  - iOS : patch `patches/react-native-fast-opencv+1.0.1.patch` (repris de la PR #119 du dépôt, non fusionnée) : la lib s'installait par l'ancien pont (`RCTCxxBridge`), supprimé depuis RN 0.87. Elle passe par `RCTTurboModuleWithJSIBindings`.
  - Android : OpenCV 4.12 (Maven), environ 23,5 Mo non compressés par architecture. iOS : OpenCV 4.9.
- **Suivi dans le replay** (`logic/trackClip.ts`, TS pur), d'après le tracker de balle de tennis de Yan, Christmas et Kittler (BMVC 2005). Une image seule ne distingue pas la balle des autres taches ; ce qui la distingue, c'est que ses taches s'alignent sur une parabole, image après image :
  - `withoutResidents`, avant tout : la caméra ne bouge pas pendant un point, donc une tache entourée d'autres taches à moins de 1,2 % de la largeur sur 40 % des images d'une fenêtre de 1,5 s habite là (un pied, une feuille, un spectateur). La balle, elle, ne fait que passer ;
  - `findArcs` : trois taches proches dans le temps et à peu près alignées donnent une parabole (x et y quadratiques dans le temps, moindres carrés, `fitQuadratic`). Elle ramasse les taches proches d'elle (0,4 % de la largeur), un peu plus loin à chaque passe, et est réajustée jusqu'à ne plus rien trouver. Un rebond ou une frappe casse la parabole : l'arc s'arrête là, un autre commence ;
  - un arc est gardé s'il passe par 6 taches au moins, sur 30 % de ses images, s'il voyage (une tache qui scintille sur place ne voyage pas) et s'il se courbe vers le bas (une balle en vol tombe ; une chaussure jaune qui glisse le long de la ligne de fond va tout droit, un pied qui se lève se courbe un peu vers le haut). Seule la perspective courbe un vol vers le haut, et alors fortement (balle rapide au-dessus de la caméra, près d'elle) : accepté au-delà de 0,8 % de la largeur ;
  - `linkArcs` : il n'y a qu'une balle. La trajectoire est la chaîne d'arcs vue sur le plus d'images, où chaque arc commence là où le précédent a pu amener la balle (programmation dynamique). Deux arcs qui se chevauchent sont coupés là où ils se croisent : c'est la frappe ou le rebond ;
  - position, vitesse et accélération sont lues sur l'arc : justes dès la première image après un rebond. « Prédite » = la balle n'a pas été détectée sur cette image, l'arc passe quand même par là. Seuils en largeurs d'image et en secondes : ils tiennent à toute résolution et toute cadence.
- **Suivi live** (`logic/BallTracker.ts`, dev seulement) : le tracker image par image du POC (Kalman 4 états à vitesse constante, une seule piste, la tache la plus proche dans une porte autour de la prédiction). Il ne connaît pas la suite d'une image : sur un vrai court il part sur les faux candidats. Gardé pour régler la couleur et les tailles sur le court, pas pour suivre.
- **Réglages** (`logic/ballConfig.ts`), mesurés hors de l'app sur `dev-videos/` (matchs filmés depuis le fond du court). Ceux du POC (`ball.yaml`) n'étaient pas calibrés (le fichier le dit) et visaient une balle à 30 cm d'une webcam : aire ≥ 150 px², ils ne trouvaient la balle sur aucune image. Vidéo de référence : 10 s d'un vrai échange filmé du fond du court, 1280 px, environ 30 i/s. Images où la balle est montrée, sur 298 : tracker image par image du POC 291, presque toujours sur les chaussures jaunes du joueur du fond ; arcs sur tout le clip avec le détecteur HSV 129, dont environ 7 sur 10 sur la balle ; arcs avec le détecteur actuel 167, dont environ 9 sur 10 sur la balle (32 images vérifiées à l'œil : 29 sur la balle, 2 près des pieds du joueur, 1 décalée). Le détecteur trouve 1,3 tache par image au lieu de 3. Ce qui limite maintenant : la balle contre un joueur (au moment de la frappe) et une seule vidéo de référence, qui n'est pas filmée par l'app.
- **Affichage** (design Lineo) : une sphère citron là où le suivi met la balle (plus pâle quand elle est seulement prédite), une traînée blanche légère qui s'efface, et au sol, à chaque pic sonore, une marque de rebond (ellipse citron en pointillés et balle cerclée de noir). La marque est UI only : un bruit fort n'est pas encore un rebond, la v0.9 le confirmera par la trajectoire. Plus de flèche de vitesse ; le bandeau de chiffres du POC reste en build dev seulement. Le calque est dans `ZoomableView`, il zoome avec la vidéo ; la position suit le letterbox de `contain`. Aucun dedans / dehors.
- **Lecture assistée** (UI only, v0.9) : quand le suivi est allé jusqu'au bout du point (`done`), une carte s'ouvre sur la vidéo (pourcentage, jauge dedans / incertain / dehors, rebond, ligne, marge d'erreur) et se replie en pastille. Sans calcul, un build release affiche des tirets ; un build dev affiche les chiffres de la maquette marqués « Aperçu ». Jamais un chiffre inventé devant les joueurs.
- **Réglages par terrain** (`logic/ballConfigFor.ts`) : à la création de la session, l'hôte indique le lieu (intérieur, extérieur) et la surface (gazon, dur, terre battue) : `Court` dans `sports/tennis`, rangé dans `SetupForm`. Il voyage avec les réglages du match (paramètre de route chez l'hôte, « snapshot » chez les invités), pas dans le journal : chaque téléphone détecte seul, avec le même terrain. `ballConfigFor(court)` donne les réglages de base (`BALL_CONFIG`), puis ce que le lieu change, puis ce que la surface change (`COURT_SETTINGS`). **Règle : un écart n'entre dans `COURT_SETTINGS` que mesuré sur une vidéo de ce terrain.** Aujourd'hui la table est vide : la seule vidéo de référence est un court en dur en extérieur, tous les terrains ont donc les réglages de base. À mesurer en premier (calculs sur des couleurs typiques, pas des mesures) : sur terre battue, le test « pas plus rouge que vert » (`maxRedOverGreen`) écarte probablement la balle de 2 à 3 px près du sol, mélangée à l'orange ; en intérieur, `brighterBy` est probablement trop strict (moins de lumière, balle plus floue). Une balle devant le ciel n'est pas « plus claire qu'avant et après » : ça demande de changer le détecteur, pas un réglage. Un invité dont l'hôte a un build plus ancien ne reçoit pas de terrain : il prend celui par défaut (`completeForm`). L'écran de création actuel a deux choix de plus ; l'assistant en 3 étapes de la maquette n'est pas fait.
- **Vidéos test (dev seulement)** : `npm run dev:videos` copie des vidéos de vrais matchs (par défaut `dev-videos/`, ignoré par git : vidéos filmées depuis le fond du court, en 720p) dans `Documents/dev-videos` de l'app sur l'iPhone branché (`xcrun devicectl`, iOS seulement), avec un `index.json` (durée et fps lus par `ffprobe`). Rien n'entre dans le build. Dans le replay, l'icône robot de la barre du haut (à côté du bouton du panneau de décision, build dev seulement) remplace les points du match par **toutes** ces vidéos (pas de limite à 3 points : autant de replays que de vidéos), sans le panneau de décision ; un second appui revient aux points du match. On teste le suivi sans filmer un match.
- **Balle live (dev seulement)** : le bouton ✦ sur l'image caméra du panneau Infos (même design que le Tracking du replay, éteint par défaut). La sortie d'images de la caméra (demandée en 640×360, `VGA_16_9` ; l'iPhone 12 la donne en 1280×720, c'est la taille affichée dans le bandeau) passe en RGB redressé, et une image à la fois part au JS (`useMatchCamera(onCameraFrame)`, drapeau `createSynchronizable` : la suivante n'est envoyée qu'une fois la précédente traitée). Même détecteur que le replay, tracker image par image (`BallTracker`), anneau et traîne sur l'aperçu caméra, temps par image affiché. Sert à régler la couleur et les tailles sur le court ; jamais dans un build de release.
- **À vérifier sur un vrai court** : temps par image en 1280 px et temps du calcul de trajectoire sur les deux téléphones (affichés dans le bandeau ; le calcul de trajectoire tourne sur le thread JS, toutes les 30 images lues ; à ×0,5, une vidéo à 60 i/s demande moins de 33 ms par image, sinon l'analyse prend du retard et repart juste avant le temps à l'écran) ; seuils de luminosité et de jaune au soleil, à l'ombre et le soir, à 60 i/s (la vidéo de référence est à 30) ; balle au fond du court ; alignement du calque en image par image (rotation du fichier, caméra avant).

## Court calibré (v0.7)

Portage de la partie géométrie du POC 2 (`temoin-poc-cv-tracking`), dans `features/court`.

- **Calibrer, sur le flux en direct** : dans le panneau Infos, « Calibrer » pose `ui/CalibrationLayer` sur l'aperçu caméra, qui reste en direct et passe de `cover` à `contain` le temps de la calibration. On voit toute l'image, comme le clip enregistré, et un point placé est une fraction de cette image : l'aperçu en `cover` rogne, un tap y tomberait à côté. Le joueur touche les 4 coins dans n'importe quel ordre, puis glisse chaque poignée (64 pt, « jamais de geste fin »). Dès 4 points, le trapèze et les lignes du court s'affichent là où ils seraient. Le joueur choisit aussi le rectangle visé (« Court double » par défaut, « Court simple », ou « Carrés de service » quand les coins extérieurs sortent de l'image, comme le recommande le README du POC), puis « Tourner », « Recommencer », « Annuler » ou « Valider ».
- **Maths** (`logic/`, TS pur, sans OpenCV) :
  - `courtModel.ts` : les dimensions de `configs/court.yaml` (2377 × 1097 cm, simple 823, ligne de service à 640 cm du filet) et les 10 lignes de `court_model.py` ;
  - `homography.ts` : homographie exacte à 4 points, comme le POC (`getPerspectiveTransform`, pas `findHomography`) ;
  - `orderCorners.ts` : les points triés autour de leur centre, en commençant par le plus proche du haut à gauche (`order_corners` du POC) ;
  - `turned` : la symétrie du court ne se lit pas sur l'image (constat du POC, à ne pas défaire) : « Tourner » décale les coins d'un quart. 0 = caméra derrière le fond proche, 1 et 3 = caméra sur le côté.
- **Où elle vit** : `CourtCalibration` (objet + `Store`), créé par `MatchScreen`, en mémoire pour ce téléphone et ce match. Chaque téléphone a son angle : la calibration n'est ni dans le journal ni dans `settings.json`. Elle est effacée quand on change de caméra.
- **Lignes du court** (`ui/CourtLinesOverlay`, citron, une couleur qu'aucun court n'a) : sur l'aperçu du panneau Infos en `cover` (si le téléphone a bougé, ça se voit), et sur le replay en `contain`, dans `ZoomableView` (elles zooment avec la vidéo). Outil « Lignes » dans la barre du replay, absent sans calibration. Pas sur les vidéos test : elles ne viennent pas de cette caméra.
- **Zone du court pour le suivi de balle** (`courtArea`) : avec une calibration, le suivi du replay ne garde que les taches dans le court élargi de 35 % de sa largeur de chaque côté, à chaque hauteur de l'image (au-dessus du fond lointain, la largeur du fond lointain). C'est calculé dans l'image, pas au sol : une balle en l'air n'est pas sur le plan du sol, et un lob au-dessus du fond lointain doit rester. Rien n'est coupé en haut ni en bas. Les gradins et les spectateurs sur les côtés disparaissent.
- **Limites connues** : rien ne détecte un téléphone déplacé (on recalibre, et les lignes sur l'aperçu aident à s'en apercevoir) ; la calibration s'applique à tous les clips du match, même ceux filmés avant (les clips ne savent pas quelle caméra les a filmés) ; pas de correction de la distorsion de l'objectif ; précision moindre au fond du court (POC). L'aperçu est supposé en 16:9, comme la vidéo.
- **À vérifier sur un vrai court** : que les lignes collent au court en image par image dans le replay, au fond du court surtout, et que la zone ne coupe pas un lob.

## Lecture assistée (v0.5, v0.7 à v0.9)

Tourne **uniquement sur le point demandé**, jamais en continu.

1. **Lignes du court** : détection automatique des lignes blanches et des 4 coins (v0.8, à fiabiliser à partir du POC 2). En secours, le joueur place les 4 coins sur l'aperçu caméra (v0.7, voir Court calibré).
2. **Homographie** vers les dimensions réelles du court.
3. **Balle** : seuil de couleur jaune, nettoyage, contours, suivi par filtre de Kalman.
4. **Rebond** : changement brusque de la trajectoire, confirmé par le pic sonore si disponible. Marqué sur la timeline.
5. **Indice de confiance** : distance du rebond à la ligne rapportée à la marge d'erreur à cette distance. Affiché comme « 70 % sûr que la balle est sortie ».
6. Chaque téléphone juge la moitié de court la plus proche de lui.

Les constats mesurés dans `temoin-poc-cv-tracking/CLAUDE.md` (symétrie du court, top-hat, fusion des bords de bande…) s'appliquent : ne pas les défaire.

## Paramètres

Écran `settings`, ouvert depuis l'accueil ou par la roue de l'écran de match (en calque, « S'applique au prochain match »). Images par seconde (60 ou 30), points gardés en mémoire (1 à 3 en plus du point en cours), score à la voix, lecture assistée du replay, ouverture du replay (au début du point, par défaut, ou sur sa dernière seconde). Les choix s'ouvrent sur place (`ui/SelectRow`), dans le design de l'app. « Vidéos supprimées en fin de match » : seul « Toujours » est actif, « Non » et « Sauf les points revus » sont *UI only* (marqués « Bientôt »). Enregistrés dans `settings.json` (dossier Documents de l'app) : **le seul fichier que l'app garde entre deux lancements**, sans vidéo ni prénom. Lus au début du match et figés pendant tout le match : changer la cadence ou le buffer en cours de match redémarrerait la caméra et effacerait les clips. Un changement fait pendant le match vaut pour le suivant. La voix se coupe toujours pendant le match avec le micro du rail.

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
npm run dev:videos           # dev : copie des vidéos de test sur l'iPhone (replay → « Vidéos test »)

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
