#!/usr/bin/env python3
"""build-pcic-core.py — committeable, CURATED, CEFR-graded Spanish core index (dev-time).

PROJECT RULE (single frequency list per language): every target language uses ONE
reference list for the coverage gate that is committeable AND curated AND CEFR-graded.
No "committeable-but-weak in CI + good-but-local" split. English uses NGSL; Spanish uses
the **PCIC / Instituto Cervantes** notional inventory (this script). This replaces the
raw-frequency es-core (FrequencyWords lemmatized) which, being corpus frequency, was a
noisy pedagogical yardstick (~60% vocab). PCIC is a curated CEFR inventory → a meaningful
coverage number comparable in KIND to NGSL.

Source: PCIC "Inventario de nociones" — nociones generales + nociones específicas, the
A1-A2 and B1-B2 pages (public reference, Instituto Cervantes). Each notion sits in a table
cell tagged by CEFR column (`<td headers="…a1|a2|b1|b2…">`), so we read the REAL per-item
level. Inside a cell each `<li>` is a lexical entry (single words, comma groups, `~`
collocation frames, `/` variants, `(x)` optional), often followed by `<em>` example
sentences — those illustrations are stripped (they would leak proper nouns like "Vigo").
We extract every content token, lemmatize with simplemma so ranks keys are lemmas (matching
lib-freq.lookupRank, which maps content surface forms toward their lemma). RANKING = CEFR
level PRIMARY, corpus frequency SECONDARY. So the top-1000 is exactly the official A1-A2
vocabulary curriculum, ordered most-useful-first within each level. CEFR-primary is deliberate:
it keeps the B1-B2 OpenSubtitles-frequent drama words (arma, disparar, asesino, soldado — all
B1-B2 in PCIC) OUT of the core the content must cover, so "reach 88% of the core" means teaching
real everyday A1-A2 vocabulary, not subtitle noise. PCIC contributes the curated CEFR MEMBERSHIP
+ grading; FrequencyWords (Hermit Dave / OpenSubtitles, CC BY-SA, es_50k.txt, lemmatized)
contributes only the intra-level order. Both sources are committeable → the output is ONE
committeable, curated, CEFR-graded list (project rule: one such list per language).

    pip install simplemma        # local build dependency only (CI uses the committed JSON)
    python tools/sources/build-pcic-core.py            # fetch (cache) + build
    python tools/sources/build-pcic-core.py --offline  # build from cached raw HTML only

Output: tools/sources/derived/es-core.json  (committed; license "Referencia pública").
"""
import json, re, sys, html, urllib.request
from pathlib import Path
import simplemma

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'tools/sources/raw'
OUT = ROOT / 'tools/sources/derived/es-core.json'
FREQ = ROOT / 'tools/sources/raw/es_50k.txt'   # FrequencyWords (CC BY-SA) — intra-level order
BASE = 'https://cvc.cervantes.es/ensenanza/biblioteca_ele/plan_curricular/niveles/'

# Page order breaks ties within a level: generales (existence/quantity/space/time) before
# thematic específicas. The CEFR column tag inside each page gives the actual level, so
# ranking is (level, page, doc-order) → top-1000 ≈ the A1-A2 core.
PAGES = [
    ('08_nociones_generales_inventario_a1-a2.htm'),
    ('09_nociones_especificas_inventario_a1-a2.htm'),
    ('08_nociones_generales_inventario_b1-b2.htm'),
    ('09_nociones_especificas_inventario_b1-b2.htm'),
]
LEVEL_ORDER = {'a1': 0, 'a2': 1, 'b1': 2, 'b2': 3}

WORD = re.compile(r'^[a-záéíóúñü]{2,}$')
CELL = re.compile(r'<td\s+headers="([^"]*(a1|a2|b1|b2))[^"]*"[^>]*>(.*?)</td>', re.I | re.S)
EM = re.compile(r'<em\b[^>]*>.*?</em>', re.I | re.S)
LI = re.compile(r'<li\b[^>]*>(.*?)</li>', re.I | re.S)
TAG = re.compile(r'<[^>]+>')


def fetch(fname):
    """Return page HTML, caching under tools/sources/raw/ (gitignored)."""
    cache = RAW / fname
    if cache.exists():
        return cache.read_text(encoding='utf-8')
    if '--offline' in sys.argv:
        sys.exit(f'✗ missing cached {cache} and --offline given. Run once online first.')
    RAW.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(BASE + fname, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        text = r.read().decode('utf-8', 'replace')
    cache.write_text(text, encoding='utf-8')
    return text


def load_freq_rank():
    """Lemma -> frequency rank (1 = most frequent) from FrequencyWords, lemmatized.
    Used only to order the PCIC-curated set within each CEFR level."""
    if not FREQ.exists():
        sys.exit(f'✗ missing {FREQ} (FrequencyWords es_50k.txt). Needed for intra-level order.')
    from collections import Counter
    freq = Counter()
    for line in FREQ.read_text(encoding='utf-8').splitlines():
        parts = line.split()
        if len(parts) != 2 or not WORD.match(parts[0].lower()):
            continue
        try:
            c = int(parts[1])
        except ValueError:
            continue
        lemma = simplemma.lemmatize(parts[0].lower(), lang='es')
        if WORD.match(lemma):
            freq[lemma] += c
    return {w: i + 1 for i, (w, _) in enumerate(freq.most_common())}


def tokens_of(li_html):
    """Content tokens from one <li>: drop tags/entities, ~ frames, / variants, (opt),
    then lemmatize each alphabetic token (>=2 letters)."""
    s = html.unescape(TAG.sub(' ', li_html))
    s = s.replace('~', ' ').replace('/', ' ').replace('(', '').replace(')', '')
    s = re.sub(r'[\[\].,;:¿?¡!«»"“”…\-]', ' ', s).lower()
    out = []
    for tok in s.split():
        tok = tok.strip("'´`")
        if not WORD.match(tok):
            continue
        lemma = simplemma.lemmatize(tok, lang='es')
        if WORD.match(lemma):
            out.append(lemma)
    return out


freq_rank = load_freq_rank()
FREQ_WORST = len(freq_rank) + 1                 # PCIC lemmas absent from the corpus sort last

# First appearance of each PCIC lemma decides its CEFR level (lowest level wins). Then rank
# by (level, frequency): CEFR-graded, most-frequent-first within each level.
best_level = {}     # lemma -> lowest LEVEL_ORDER seen
for page_index, fname in enumerate(PAGES):
    page = fetch(fname)
    for m in CELL.finditer(page):
        lvl = LEVEL_ORDER[m.group(2).lower()]  # a1|a2|b1|b2 -> 0..3
        cell = EM.sub(' ', m.group(3))         # drop <em> example sentences
        for li in LI.findall(cell):
            for lemma in tokens_of(li):
                if lemma not in best_level or lvl < best_level[lemma]:
                    best_level[lemma] = lvl

ordered = sorted(best_level, key=lambda w: (best_level[w], freq_rank.get(w, FREQ_WORST), w))
ranks = {lemma: i + 1 for i, lemma in enumerate(ordered)}
inv_level = {v: k for k, v in LEVEL_ORDER.items()}
by_level = {'a1': 0, 'a2': 0, 'b1': 0, 'b2': 0}
for lemma in ordered:
    by_level[inv_level[best_level[lemma]]] += 1

OUT.write_text(json.dumps({
    '_source': 'Plan Curricular del Instituto Cervantes (PCIC) — Inventario de nociones '
               '(generales + específicas, A1-A2 y B1-B2), membresía y grado CEFR; orden intra-nivel '
               'por frecuencia de FrequencyWords (OpenSubtitles). Lemas vía simplemma.',
    '_url': BASE,
    '_license': 'PCIC: Referencia pública (Instituto Cervantes). Orden de frecuencia: FrequencyWords '
                'CC BY-SA 3.0 (github.com/hermitdave/FrequencyWords). Índice derivado (lemas + rango).',
    '_note': 'Lista de cobertura curada y graduada por CEFR: rango = (nivel CEFR primario, frecuencia '
             'secundaria), así el top-1000 es el currículo de vocabulario A1-A2 oficial ordenado por '
             'utilidad, sin ruido de subtítulos B1-B2. Reemplaza el es-core de frecuencia cruda '
             '(regla: una sola lista committeable + curada + CEFR por idioma).',
    'lang': 'es', 'cap': len(ranks), 'ranks': ranks,
}, ensure_ascii=False), encoding='utf-8')

top = sorted(ranks, key=ranks.get)
a1a2 = by_level['a1'] + by_level['a2']
print(f'OK {len(ranks)} lemmas -> {OUT.relative_to(ROOT)}')
print(f'   by level (new lemmas): A1={by_level["a1"]} A2={by_level["a2"]} '
      f'B1={by_level["b1"]} B2={by_level["b2"]}  (A1-A2 core = ranks 1..{a1a2})')
print('top-40:', ' '.join(top[:40]))
print('around rank 1000:', ' '.join(top[990:1010]))
