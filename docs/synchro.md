# Synchronisation

Comment une annonce vocale et un VAR passent d'un téléphone à tous les autres, en **v0.4**. Chaque téléphone écoute ; l'hôte garde une seule version et la diffuse. Chaque message est chiffré et signé avec la clé du QR code. Le protocole est décrit dans [`CLAUDE.md`](../CLAUDE.md#protocole-de-partage--un-journal-ordonné-par-lhôte).

Image pour les slides : [`images/synchro.png`](images/synchro.png) (`npm run docs:images` la regénère depuis ce fichier).

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Helvetica, Arial','fontSize':'15px','actorBkg':'#111111','actorTextColor':'#FFFFFF','actorBorder':'#111111','noteBkgColor':'#FFF6E3','noteBorderColor':'#E9B44C','signalColor':'#111111','signalTextColor':'#111111','labelBoxBkgColor':'#E8F1EC','labelBoxBorderColor':'#3E7A57'}}}%%
sequenceDiagram
  autonumber
  participant S as 🎾 Serveur (joueur)
  participant H as 📱 Hôte
  participant I1 as 📱 Invité 1
  participant I2 as 📱 Invité 2 (option)

  rect rgb(232,241,236)
  Note over S,I2: v0.3 · Le score à la voix (le journal en est à l'événement n°41)
  S->>H: annonce « trente quinze »
  S->>I1: (même annonce, entendue de plus loin)
  H->>H: Vosk : voix → texte → 30-15 = point pour le serveur
  H->>H: intention « point annoncé » (entendue après n°41)<br/>acceptée → événement n°42
  I1->>H: intention « point annoncé » (entendue après n°41)
  H->>H: le journal en est à n°42 : copie ignorée
  H-->>I1: événement n°42
  H-->>I2: événement n°42
  Note over H,I2: tous les écrans affichent 30-15<br/>chaque téléphone coupe son clip : le point suivant commence
  Note over H,I2: aujourd'hui la première annonce gagne<br/>plus tard : deux scores différents → la meilleure confiance l'emporte
  end

  rect rgb(255,246,227)
  Note over S,I2: VAR · Litige sur une balle
  I1->>H: intention « VAR »
  H-->>I1: événement « VAR ouvert »
  H-->>I2: événement « VAR ouvert »
  Note over H,I2: chaque téléphone met sa caméra en pause, coupe la voix<br/>et ouvre SES 3 derniers points, depuis SON point de vue (aucune vidéo échangée)
  Note over H,I2: les joueurs décident devant n'importe quel téléphone<br/>« Point Léa » → « l'autre camp est d'accord ? » → Valider
  I1->>H: intentions : résultat (ex. point corrigé) + « VAR fermé »
  H-->>I1: événements, retour au score mis à jour
  H-->>I2: événements, retour au score mis à jour
  end
```
