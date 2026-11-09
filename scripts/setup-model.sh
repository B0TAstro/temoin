#!/usr/bin/env bash
# Downloads the French Vosk model once into models/, where the react-native-vosk config plugin
# picks it up for both platforms (app.json). The folder name is the name VoskEngine loads.
# ~65 MB unpacked, never committed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="vosk-model-small-fr-0.22"
DEST="$ROOT/models/$NAME"

if [ -d "$DEST" ]; then
  echo "→ $NAME already in models/"
  exit 0
fi

echo "→ downloading $NAME"
TMP="$(mktemp -d)"
curl -sSfL -o "$TMP/$NAME.zip" "https://alphacephei.com/vosk/models/$NAME.zip"
unzip -q "$TMP/$NAME.zip" -d "$TMP"
mkdir -p "$ROOT/models"
mv "$TMP/$NAME" "$DEST"
rm -rf "$TMP"

echo "✓ ready ($(du -sh "$DEST" | cut -f1))"
