#!/usr/bin/env python3
"""process-image.py — Cover-crop a source image to the canonical topic-image pair.

    python tools/process-image.py <src> <out_base>
      → writes <out_base>.jpg (1280×720, q82) and <out_base>.webp (800×450, q80)

Uses COVER fit (scale-to-fill + crop) — never contain/pad — so results never have
letterbox/pillarbox bars. The crop offset along the over-sized axis maximizes edge
energy (entropy crop), which tends to keep the subject in frame instead of slicing
it off. Pillow + numpy (both present). No network.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

JPG = (1280, 720)
WEBP = (800, 450)

def _best_offset(energy, span):
    """Offset in [0, len-span] whose window has the most edge energy."""
    cum = np.concatenate([[0.0], np.cumsum(energy)])
    total = len(energy) - span
    if total <= 0:
        return 0
    best, bo = -1.0, 0
    step = max(1, total // 40)
    for off in range(0, total + 1, step):
        e = cum[off + span] - cum[off]
        if e > best:
            best, bo = e, off
    return bo

def cover(im, tw, th):
    w, h = im.size
    scale = max(tw / w, th / h)
    nw, nh = round(w * scale), round(h * scale)
    im = im.resize((nw, nh), Image.LANCZOS)
    edges = np.asarray(im.convert('L').filter(ImageFilter.FIND_EDGES), dtype=np.float64)
    if nw > tw:
        left, top = _best_offset(edges.sum(axis=0), tw), 0
    elif nh > th:
        left, top = 0, _best_offset(edges.sum(axis=1), th)
    else:
        left, top = 0, 0
    return im.crop((left, top, left + tw, top + th))

def main():
    src, out_base = sys.argv[1], sys.argv[2]
    im = Image.open(src)
    if im.mode != 'RGB':
        im = im.convert('RGB')
    big = cover(im, *JPG)
    big.save(out_base + '.jpg', 'JPEG', quality=82, optimize=True)
    big.resize(WEBP, Image.LANCZOS).save(out_base + '.webp', 'WEBP', quality=80, method=6)
    print('wrote', out_base + '.jpg', out_base + '.webp')

if __name__ == '__main__':
    main()
