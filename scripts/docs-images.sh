#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MERMAID_CLI="@mermaid-js/mermaid-cli@12.0.0"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ $# -gt 0 ]; then
  docs=()
  for name in "$@"; do docs+=("$ROOT/docs/$name.md"); done
else
  docs=("$ROOT"/docs/*.md)
fi

for md in "${docs[@]}"; do
  name="$(basename "$md" .md)"
  if [ ! -f "$md" ]; then
    echo "✗ docs/$name.md not found" >&2
    exit 1
  fi
  awk '/^```mermaid$/ { inside = 1; next } /^```$/ { inside = 0 } inside' "$md" > "$TMP/$name.mmd"
  [ -s "$TMP/$name.mmd" ] || continue
  echo "→ docs/images/$name.png"
  npx -y "$MERMAID_CLI" -i "$TMP/$name.mmd" -o "$ROOT/docs/images/$name.png" -s 2 -b white -q
done
