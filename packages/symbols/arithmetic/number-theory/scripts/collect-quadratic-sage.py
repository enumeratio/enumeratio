# Sage's answers for the quadratic-ring kernel (src/quadratic.ts): class numbers, fundamental
# units, and which small elements generate prime ideals. Run with `sage -python`:
#
#   sage -python scripts/collect-quadratic-sage.py > tests/quadratic.sage.json
#
# Elements are x + yω, ω = (−1 + √d)/2 for d ≡ 1 (mod 4) and √d otherwise, as in the kernel.

import json
from sage.all import QQ, QuadraticField, is_squarefree

D_RANGE = range(-120, 121)
GRID = range(-7, 8)

fields = []
for d in D_RANGE:
    if d in (0, 1) or not is_squarefree(d):
        continue
    K = QuadraticField(d, "a")
    a = K.gen()
    w = (-1 + a) / 2 if d % 4 == 1 else a
    entry = {"d": d, "h": int(K.class_number(proof=False))}
    if d > 0:
        u = K.units(proof=False)[0]
        candidates = [u, -u, 1 / u, -1 / u]
        u = max(candidates, key=lambda e: float(e.n()))
        y = (u - u.galois_conjugate()) / (w - w.galois_conjugate())
        x = u - y * w
        entry["unit"] = [int(x), int(y)]
    primes = []
    for x in GRID:
        for y in GRID:
            alpha = x + y * w
            if alpha == 0 or abs(alpha.norm()) == 1:
                continue
            if K.ideal(alpha).is_prime():
                primes.append(f"{x},{y}")
    # One string per field keeps the formatted file a line per field.
    entry["primes"] = " ".join(primes)
    fields.append(entry)

print(json.dumps({"grid": [GRID.start, GRID.stop - 1], "fields": fields}, indent=2))
