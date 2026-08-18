#!/usr/bin/env python3
"""build-freq-es.py — committeable Spanish core-frequency index (dev-time, local).

Spanish's CEFR-graded list (ELELex) is CC BY-NC-SA → cannot ship in the public repo,
so the coverage GATE would be local-only. FrequencyWords (Hermit Dave / OpenSubtitles)
is CC BY-SA 3.0 → committeable, but it is SURFACE frequency (está, están, casas …),
which makes a coverage metric meaningless (fragmented by inflection). This lemmatizes it
with `simplemma` (está→estar, casas→casa) and re-ranks by summed lemma frequency, giving
a committeable lemma-frequency Spanish core comparable in KIND to NGSL — so Spanish
coverage runs in CI. The output (tools/sources/derived/es-core.json) is a derivative of
FrequencyWords → committed under CC BY-SA 3.0 with attribution (see CREDITS.md).

    pip install simplemma        # local build dependency only (CI uses the committed JSON)
    python tools/sources/build-freq-es.py
"""
import json, re, sys
from collections import Counter
from pathlib import Path
import simplemma

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'tools/sources/raw/es_50k.txt'
OUT = ROOT / 'tools/sources/derived/es-core.json'
CAP = 6000
WORD = re.compile(r'[a-záéíóúñü]{2,}$')

freq = Counter()
for line in RAW.read_text(encoding='utf-8').splitlines():
    parts = line.split()
    if len(parts) != 2:
        continue
    word = parts[0].lower()
    if not WORD.match(word):
        continue
    try:
        count = int(parts[1])
    except ValueError:
        continue
    lemma = simplemma.lemmatize(word, lang='es')
    if WORD.match(lemma):
        freq[lemma] += count

ranked = [w for w, _ in freq.most_common(CAP)]
ranks = {w: i + 1 for i, w in enumerate(ranked)}
OUT.write_text(json.dumps({
    '_source': 'FrequencyWords (Hermit Dave, OpenSubtitles) — lemmatized with simplemma + re-ranked',
    '_url': 'https://github.com/hermitdave/FrequencyWords',
    '_license': 'CC BY-SA 3.0 (derivative index; lemmatization via simplemma)',
    'lang': 'es', 'cap': CAP, 'ranks': ranks,
}, ensure_ascii=False), encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
print(f'OK {len(ranks)} lemmas -> {OUT.relative_to(ROOT)}')
print('top-30:', ' '.join(ranked[:30]))
