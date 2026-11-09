#!/usr/bin/env bash
# Regenerates the slide images in docs/images/ from the Mermaid block of each docs/*.md. The .md is
# the source: edit it, then run this, never the other way round.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MERMAID_CLI="@mermaid-js/mermaid-cli@12.0.0"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for md in "$ROOT"/docs/*.md; do
  name="$(basename "$md" .md)"
  # The lines between ```mermaid and the next ```.
  awk '/^```mermaid$/ { inside = 1; next } /^```$/ { inside = 0 } inside' "$md" > "$TMP/$name.mmd"
  [ -s "$TMP/$name.mmd" ] || continue
  echo "→ docs/images/$name.png"
  # Scale 2: sharp on a slide.
  npx -y "$MERMAID_CLI" -i "$TMP/$name.mmd" -o "$ROOT/docs/images/$name.png" -s 2 -b white -q
done
