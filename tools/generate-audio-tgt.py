#!/usr/bin/env python3
"""
generate-audio-tgt.py
Generates WAV audio files for any non-English target language using edge-tts
(Microsoft Azure Neural TTS). Voice filenames match the Kokoro voice IDs
declared in lang-pair.js so audio-player.js can locate them without changes.

ADDING A NEW LANGUAGE
─────────────────────
1. Add an entry to LANG_VOICE_MAPS below:
     'xx': { 'xf_name': 'xx-XX-NeuralVoice', ... }
   Key = Kokoro-style voice ID (must match pair.ttsVoices in lang-pair.js).
   Value = Azure Neural voice name (see edge-tts docs for the full list).

2. Run:
     python generate-audio-tgt.py --lang xx

That's all. No other script changes needed.

USAGE
─────
  python generate-audio-tgt.py --lang es            # all Spanish sources
  python generate-audio-tgt.py --lang fr            # all French sources
  python generate-audio-tgt.py --lang es --check    # dry-run
  python generate-audio-tgt.py --lang es --topic greetings
  python generate-audio-tgt.py --lang es --topic vocab
  python generate-audio-tgt.py --lang es --topic vocab_gym

Safe to re-run — existing files are always skipped.
"""

import asyncio
import hashlib
import json
import re
import sys
import subprocess
import unicodedata
from pathlib import Path

import imageio_ffmpeg
import edge_tts


# Slugs are capped at SLUG_MAX chars, suffixed with an 8-char sha256 of the
# original text when exceeded, to keep audio paths within Windows MAX_PATH (260).
# Must stay identical to slugify in assign-alt-slugs.mjs and generate-audio.mjs.
SLUG_MAX = 100


def slugify(s: str) -> str:
    """Convert text to a capped, filename-safe slug (mirrors slugify in assign-alt-slugs.mjs)."""
    base = s.lower()
    base = unicodedata.normalize('NFD', base)
    base = ''.join(c for c in base if unicodedata.category(c) != 'Mn')
    base = re.sub(r'[^a-z0-9]+', '_', base)
    base = base.strip('_')
    if len(base) <= SLUG_MAX:
        return base
    digest = hashlib.sha256(s.encode('utf-8')).hexdigest()[:8]
    head = base[:SLUG_MAX - 9].rstrip('_')  # 9 = '_' + 8 hex
    return f'{head}_{digest}'

# ── Language → voice map ──────────────────────────────────────────────────────
#
# Key   = Kokoro-style voice ID written into the filename ({audioSlug}-{voice}.wav).
#         Must match the ttsVoices array in lang-pair.js for the same language.
# Value = Azure Neural voice name passed to edge-tts.
#
# To discover available Azure voices: edge-tts --list-voices
# Common locale codes: es-MX, es-US, es-ES, fr-FR, fr-CA, de-DE, pt-BR, it-IT,
#                      ja-JP, ko-KR, zh-CN, zh-TW, ar-SA, nl-NL, pl-PL, ru-RU

LANG_VOICE_MAPS = {
    'es': {
        'ef_dora':  'es-MX-DaliaNeural',    # female, Mexico — neutral
        'em_alex':  'es-MX-JorgeNeural',    # male,   Mexico — neutral
        'em_santa': 'es-US-PalomaNeural',   # female, US Spanish — neutral
    },
    'fr': {
        'ff_siwis':  'fr-FR-DeniseNeural',  # female, France
        'fm_gaston': 'fr-FR-HenriNeural',   # male,   France
    },
    'de': {
        'df_hedda': 'de-DE-KatjaNeural',    # female, Germany
        'dm_bernd': 'de-DE-BerndNeural',    # male,   Germany
    },
    'it': {
        'if_sara':   'it-IT-ElsaNeural',    # female, Italy
        'im_nicola': 'it-IT-DiegoNeural',   # male,   Italy
    },
    'pt': {
        'pf_dora':  'pt-BR-FranciscaNeural', # female, Brazil
        'pm_alex':  'pt-BR-AntonioNeural',   # male,   Brazil
        'pm_santa': 'pt-BR-ThalitaNeural',   # female, Brazil — alt
    },
    'nl': {
        'nlf_colette': 'nl-NL-ColetteNeural',  # female, Netherlands
        'nlm_maarten': 'nl-NL-MaartenNeural',  # male,   Netherlands
    },
    'pl': {
        'plf_zofia': 'pl-PL-ZofiaNeural',  # female, Poland
        'plm_marek': 'pl-PL-MarekNeural',  # male,   Poland
    },
    'sv': {
        'svf_sofie':   'sv-SE-SofieNeural',    # female, Sweden
        'svm_mattias': 'sv-SE-MattiasNeural',  # male,   Sweden
    },
    'no': {
        'nof_pernille': 'nb-NO-PernilleNeural', # female, Norway
        'nom_finn':     'nb-NO-FinnNeural',     # male,   Norway
    },
    'da': {
        'daf_christel': 'da-DK-ChristelNeural', # female, Denmark
        'dam_jeppe':    'da-DK-JeppeNeural',    # male,   Denmark
    },
    'fi': {
        'fif_selma': 'fi-FI-SelmaNeural',  # female, Finland
        'fim_harri': 'fi-FI-HarriNeural',  # male,   Finland
    },
    'cs': {
        'csf_vlasta':   'cs-CZ-VlastaNeural',   # female, Czech Republic
        'csm_antonin':  'cs-CZ-AntoninNeural',  # male,   Czech Republic
    },
    'lv': {
        'lvf_everita': 'lv-LV-EveritaNeural', # female, Latvia
        'lvm_nils':    'lv-LV-NilsNeural',    # male,   Latvia
    },
    'lt': {
        'ltf_ona':    'lt-LT-OnaNeural',    # female, Lithuania
        'ltm_leonas': 'lt-LT-LeonasNeural', # male,   Lithuania
    },
    'et': {
        'etf_anu':  'et-EE-AnuNeural',  # female, Estonia
        'etm_kert': 'et-EE-KertNeural', # male,   Estonia
    },
}

# ── Configuration ─────────────────────────────────────────────────────────────

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

PHRASE_TOPICS = [
    'greetings', 'emociones', 'restaurant', 'supermarket', 'kitchen',
    'transportation', 'airport', 'accommodation',
    'movies', 'music', 'theater', 'museums',
    'gym', 'technology', 'accountability', 'personal_info', 'family', 'daily_routine',
]

# emociones and museums are phrase-only (no vocabulary file), mirroring shared/js/topics.js
VOCAB_TOPICS = [t for t in PHRASE_TOPICS if t not in ('emociones', 'museums')]

ROOT  = Path(__file__).parent.parent  # practice_english.github.io/
JSON  = ROOT / 'shared' / 'json'
AUDIO = ROOT / 'shared' / 'audio'

# ── Helpers for alternative audio ─────────────────────────────────────────────

def _pair_id(lang_code):
    """Return the pair directory ID for a given target language code (e.g. 'es' → 'en-es')."""
    return f'en-{lang_code}'


def flatten_tgt_alts(data):
    """Return [{audioSlug, text, id}] for all non-style alternatives in target[1..]."""
    alts = []
    for p in data.get('phrases', []):
        target = p.get('target', [])
        # target[0] is the base form; alts start at index 1
        for a in target[1:]:
            if not isinstance(a, dict):
                continue
            if a.get('audioSlug') is not None:
                alts.append({
                    'audioSlug': a['audioSlug'],
                    'text': a.get('text', ''),
                    'id': f"alt_{a['audioSlug']}",
                })
    return alts


# ── Source definitions ─────────────────────────────────────────────────────────

def build_sources(lang_code):
    """Return all source definitions for the given target language."""
    sources = []
    suffix  = f'__{lang_code}'
    pair    = _pair_id(lang_code)

    # Phrase topics — text = target[0].text from per-pair JSON
    for topic in PHRASE_TOPICS:
        sources.append({
            'id':        f'{topic}{suffix}',
            'json':      JSON / 'pairs' / pair / f'{topic}.json',
            'out_dir':   AUDIO / pair / topic,
            'get_items': lambda d: d.get('phrases', []),
            'get_text':  lambda item: (item.get('target') or [{}])[0].get('text', ''),
            'get_id':    lambda item: item.get('id', ''),
            'get_index': lambda item: (
                (item.get('target') or [{}])[0].get('audioSlug')
                or slugify((item.get('target') or [{}])[0].get('text', item.get('id', '')))
            ),
        })

    # General vocabulary — text = translations[lang_code] (per-pair vocab since Part C)
    sources.append({
        'id':        f'vocab{suffix}',
        'json':      JSON / 'pairs' / pair / 'vocab' / 'words.json',
        'out_dir':   AUDIO / pair / 'vocab',
        'get_items': lambda d: d.get('words', []),
        'get_text':  lambda item, lc=lang_code: (
            item.get('translations', {}).get(lc) or item.get('word', '')
        ),
        'get_id':    lambda item: item.get('id', ''),
        'get_index': lambda item: item.get('id', ''),
    })

    # Topic vocabulary — text = translations[lang_code] (per-pair vocab since Part C)
    for topic in VOCAB_TOPICS:
        sources.append({
            'id':        f'vocab_{topic}{suffix}',
            'json':      JSON / 'pairs' / pair / 'vocab' / f'words-{topic}.json',
            'out_dir':   AUDIO / pair / f'vocab_{topic}',
            'get_items': lambda d: d.get('words', []),
            'get_text':  lambda item, lc=lang_code: (
                item.get('translations', {}).get(lc) or item.get('word', '')
            ),
            'get_id':    lambda item: item.get('id', ''),
            'get_index': lambda item: item.get('id', ''),
        })

    # Phrase alternatives — text from target[1..] in per-pair JSON
    for topic in PHRASE_TOPICS:
        sources.append({
            'id':        f'{topic}{suffix}__alts',
            'json':      JSON / 'pairs' / pair / f'{topic}.json',
            'out_dir':   AUDIO / pair / topic,
            'get_items': lambda d: flatten_tgt_alts(d),
            'get_text':  lambda item: item.get('text', ''),
            'get_id':    lambda item: item.get('id', ''),
            'get_index': lambda item: item.get('audioSlug'),
        })

    return sources


# ── Core helpers ───────────────────────────────────────────────────────────────

async def tts_to_mp3(text: str, voice: str) -> bytes:
    """Synthesize text with edge-tts and return raw MP3 bytes."""
    tts = edge_tts.Communicate(text, voice)
    chunks = []
    async for chunk in tts.stream():
        if chunk['type'] == 'audio':
            chunks.append(chunk['data'])
    return b''.join(chunks)


def mp3_to_wav(mp3_bytes: bytes) -> bytes:
    """Convert MP3 bytes to WAV bytes via ffmpeg."""
    result = subprocess.run(
        [FFMPEG, '-y', '-loglevel', 'error',
         '-f', 'mp3', '-i', 'pipe:0',
         '-f', 'wav', 'pipe:1'],
        input=mp3_bytes,
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f'ffmpeg error: {result.stderr.decode()}')
    return result.stdout


async def generate_source(src: dict, voice_map: dict, check_only: bool) -> tuple[int, int, int]:
    """Process one source definition. Returns (generated, skipped, errors)."""
    json_path = src['json']
    out_dir   = src['out_dir']

    if not json_path.exists():
        print(f'  [SKIP] JSON not found: {json_path}')
        return 0, 0, 0

    with open(json_path, encoding='utf-8') as f:
        data = json.load(f)

    items = src['get_items'](data)
    if not items:
        return 0, 0, 0

    out_dir.mkdir(parents=True, exist_ok=True)

    get_index = src.get('get_index')
    generated = skipped = errors = 0

    for idx, item in enumerate(items):
        text = src['get_text'](item)
        if not text:
            continue

        file_idx = get_index(item) if get_index else idx

        for voice_name, edge_voice in voice_map.items():
            out_path = out_dir / f'{file_idx}-{voice_name}.wav'

            if out_path.exists():
                skipped += 1
                continue

            if check_only:
                print(f'  [MISSING] {out_path.relative_to(ROOT)}')
                generated += 1  # count as "would generate"
                continue

            try:
                mp3  = await tts_to_mp3(text, edge_voice)
                wav  = mp3_to_wav(mp3)
                out_path.write_bytes(wav)
                generated += 1
                print(f'  OK {out_path.relative_to(ROOT)}')
            except Exception as e:
                errors += 1
                print(f'  ERR {out_path.relative_to(ROOT)}: {e}')

    return generated, skipped, errors


# ── Main ───────────────────────────────────────────────────────────────────────

async def main():
    args       = sys.argv[1:]
    check_only = '--check' in args
    topic_arg  = args[args.index('--topic') + 1] if '--topic' in args else None

    if '--lang' not in args:
        print('Usage: python generate-audio-tgt.py --lang <code> [--check] [--topic <id>]')
        print('Registered languages:', ', '.join(LANG_VOICE_MAPS.keys()))
        sys.exit(1)

    lang_code = args[args.index('--lang') + 1]

    if lang_code not in LANG_VOICE_MAPS:
        print(f'Unknown language: "{lang_code}"')
        print('Registered languages:', ', '.join(LANG_VOICE_MAPS.keys()))
        print('Add an entry to LANG_VOICE_MAPS in this file to support a new language.')
        sys.exit(1)

    voice_map   = LANG_VOICE_MAPS[lang_code]
    all_sources = build_sources(lang_code)

    if topic_arg:
        # Accept both "greetings" (auto-suffix) and "greetings__fr" (explicit)
        bare = topic_arg.removesuffix(f'__{lang_code}')
        sources = [s for s in all_sources
                   if s['id'] == topic_arg
                   or s['id'] == topic_arg + '__alts'
                   or s['id'] == f'{bare}__{lang_code}'
                   or s['id'] == f'{bare}__{lang_code}__alts']
        if not sources:
            valid = '\n  '.join(s['id'] for s in all_sources)
            print(f'Unknown topic: "{topic_arg}". Valid IDs for --lang {lang_code}:\n  {valid}')
            sys.exit(1)
    else:
        sources = all_sources

    total_gen = total_skip = total_err = 0

    for src in sources:
        label = 'CHECK' if check_only else 'GEN'
        print(f'\n[{label}] {src["id"]}')
        gen, skip, err = await generate_source(src, voice_map, check_only)
        total_gen  += gen
        total_skip += skip
        total_err  += err

    action = 'would generate' if check_only else 'generated'
    print(f'\nDone — {total_gen} {action}, {total_skip} already existed, {total_err} errors')


if __name__ == '__main__':
    asyncio.run(main())
