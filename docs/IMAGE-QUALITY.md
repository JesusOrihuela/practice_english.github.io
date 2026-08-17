# Image quality — topic/category images

Topic cards (`topic-grid.js`) show one photo per **(activity, topic)** cell:
`{activity}/img/{topic}.jpg` (1280×720) + `.webp` (800×450, what the card renders).
Phrase activities (cloze, dictation, scramble, speaking, translation) carry phrase
topics; the two vocab activities (quiz, vocabulary) carry vocab topics — one **distinct**
photo per activity for variety.

Images used to be pulled as a single **random** keyword match with no quality gate, so
many were off-topic, badly cropped, letterboxed, or missing. This is the repeatable,
gated pipeline that replaced that — two layers, mirroring the content-quality system:

## The two layers

**1. Deterministic checks — `tools/check-images.mjs` (CI-blockable, zero false positives)**
Every expected cell must have both `.jpg` and `.webp`, at the exact canonical dimensions,
16:9, with **no letterbox/pillarbox bar**, decodable, sharp enough, and **unique** within
an activity (no two topics sharing a photo). Orphan images for removed/demoted topics are
flagged too. Pixel facts come from `tools/img-probe.py` (Pillow + numpy) in one pass.

```
node tools/check-images.mjs            # exits 1 on any issue (CI)
node tools/check-images.mjs --report   # full list, never exits 1
```

**2. Perceptual relevance — `tools/audit-images.mjs` (dev-time, report-only + waivers)**
CLIP (`tools/lib-clip.mjs`, Xenova/clip-vit-base-patch32) scores each image against its
topic descriptor and against every other topic's descriptor. Two buckets, worst-first:
`low-relevance` (below an absolute floor) and `mismatch` (another topic scores clearly
higher — e.g. a "Home" card that is really an outdoor couch). A human confirms; reviewed
exceptions go in `tools/image-audit-waivers.json`. Embeddings are cached by file hash.

## Authoring — pick the best, don't take the first (`tools/fetch-topic-images.mjs`)
Prevention at the source: fetch many Creative-Commons candidates, score each with CLIP,
keep those above the bar, and assign the top **distinct** ones — one per activity. Chosen
images are cover-cropped to the canonical pair by `tools/process-image.py` (scale-to-fill +
entropy crop — never contain/pad, so no bars, and the subject stays in frame). License and
author are recorded for `CREDITS.md`.

```
node tools/fetch-topic-images.mjs --topic fiesta --topic objetos
node tools/fetch-topic-images.mjs --topic hogar --dry        # score candidates, no writes
```

### Image source
- **Default: Wikimedia Commons** — no API key, free, clean attribution. Good for concrete
  topics (nature, food, places); weaker for abstract/product ones.
- **Optional: Pixabay** — higher quality, no attribution burden. Put a free key in the
  **gitignored** `tools/.image-keys.json` (`{"pixabay":"…"}`) or `$PIXABAY_KEY`; the tool
  auto-detects it. The key is **never committed**.

CLIP relevance filtering + cover-crop mean the source only has to supply candidates — the
pipeline guarantees the framing and rejects off-topic ones regardless of source.

## Workflow
1. **Author / replace** a topic image → `fetch-topic-images` (pick-the-best).
2. **CI** runs `check-images` (deterministic gate).
3. **After changes** run `audit-images` (relevance) → triage the short list → re-fetch the
   failures, or waive a reviewed exception.
4. Each topic also has a `--topic-clr` accent in `index/css/generalities.css`.
