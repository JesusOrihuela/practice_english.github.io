#!/usr/bin/env bash
# fetch-sources.sh — Download the content-source corpora used by the curation
# tools (reconcile.mjs, build-candidates.mjs). These files are gitignored
# (large / share-alike); this script makes them reproducible. Run from repo root
# or from tools/sources. After fetching, run: node build-freq-inventory.mjs
#
# Sources & licenses (see ../../CREDITS.md):
#   FrequencyWords (Hermit Dave)  — CC BY-SA 3.0
#   Tatoeba via OPUS              — CC BY 2.0 FR
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/raw"
mkdir -p "$DIR"

echo "→ FrequencyWords (es, en) — OpenSubtitles 2018, CC BY-SA 3.0"
curl -sSL --max-time 120 -o "$DIR/es_50k.txt" \
  "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt"
curl -sSL --max-time 120 -o "$DIR/en_50k.txt" \
  "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt"

echo "→ Tatoeba en-es sentence pairs — OPUS, CC BY 2.0 FR"
curl -sSL --max-time 180 -o "$DIR/tatoeba-en-es.zip" \
  "https://object.pouta.csc.fi/OPUS-Tatoeba/v2023-04-12/moses/en-es.txt.zip"
( cd "$DIR" && unzip -o tatoeba-en-es.zip >/dev/null )

echo "✓ Fuentes descargadas en $DIR"
echo "  Ahora: node \"$(dirname "${BASH_SOURCE[0]}")/build-freq-inventory.mjs\""
