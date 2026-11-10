#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL="vosk-model-small-fr-0.22"
URL="https://alphacephei.com/vosk/models/$MODEL.zip"
MODEL_DIR="$ROOT/models/$MODEL"

if [ -d "$MODEL_DIR" ]; then
  echo "→ $MODEL already in models/"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ downloading $MODEL"
curl -sSfL -o "$TMP/$MODEL.zip" "$URL"
unzip -q "$TMP/$MODEL.zip" -d "$TMP"
mkdir -p "$ROOT/models"
mv "$TMP/$MODEL" "$MODEL_DIR"

echo "✓ ready ($(du -sh "$MODEL_DIR" | cut -f1))"
