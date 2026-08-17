#!/usr/bin/env python3
"""img-probe.py — Pixel-level facts for the topic-image checks/audit.

Reads image paths (one per line on stdin, or as argv), and prints a JSON object
keyed by path with: width, height, ok (decodable), sharp (variance of Laplacian),
border {t,b,l,r} (thickness in px of a near-uniform edge bar = letterbox/pillarbox),
and ahash (64-bit average hash, hex — for duplicate detection).

Deterministic and dependency-light (Pillow + numpy, both present). No writes.
"""
import sys, json
import numpy as np
from PIL import Image

# An edge line counts as a "bar" if its pixels are near-constant (std below this).
BAR_STD = 1.5

def uniform_run(gray, edge):
    """Count consecutive near-uniform lines from an edge. edge in t/b/l/r."""
    if edge in ('t', 'b'):
        rows = gray if edge == 't' else gray[::-1]
        n = 0
        for r in rows:
            if r.std() <= BAR_STD:
                n += 1
            else:
                break
        return n
    cols = gray.T if edge == 'l' else gray.T[::-1]
    n = 0
    for c in cols:
        if c.std() <= BAR_STD:
            n += 1
        else:
            break
    return n

def ahash(im):
    g = np.asarray(im.convert('L').resize((8, 8), Image.BILINEAR), dtype=np.float64)
    bits = (g > g.mean()).flatten()
    v = 0
    for b in bits:
        v = (v << 1) | int(b)
    return format(v, '016x')

def probe(path):
    try:
        im = Image.open(path)
        im.load()
    except Exception as e:
        return {'ok': False, 'err': str(e)[:80]}
    w, h = im.size
    g = np.asarray(im.convert('L'), dtype=np.float64)
    # variance of Laplacian (sharpness); interior only to ignore edges
    lap = (-4 * g + np.roll(g, 1, 0) + np.roll(g, -1, 0)
           + np.roll(g, 1, 1) + np.roll(g, -1, 1))[1:-1, 1:-1]
    return {
        'ok': True, 'w': w, 'h': h,
        'sharp': round(float(lap.var()), 1),
        'border': {e: uniform_run(g, e) for e in ('t', 'b', 'l', 'r')},
        'ahash': ahash(im),
    }

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    paths = args if args else [ln.strip() for ln in sys.stdin if ln.strip()]
    print(json.dumps({p: probe(p) for p in paths}))

if __name__ == '__main__':
    main()
