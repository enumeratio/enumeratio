# Sage's and PARI's answers for non-maximal quadratic orders (src/quadratic.ts's
# `quadraticOrder`): class numbers and fundamental units, and, for imaginary orders, each small
# element's kind found by brute force — independently of the kernel's methods: an element is
# prime when O/(α) has no zero divisors, irreducible when no product of two non-units in a box
# around the origin equals it. Run with `sage -python`:
#
#   sage -python scripts/collect-quadratic-orders-sage.py > tests/quadratic-orders.sage.json
#
# Elements are x + yω for the order's ω = (s + √D)/2, s = f·s_K, as in the kernel.

import json
from itertools import product
from math import isqrt

from sage.all import QQ, ZZ, QuadraticField, matrix, pari, squarefree_part

IMAGINARY = [-12, -16, -27, -28, -36, -44, -48, -60, -63, -64, -72, -75, -76, -80, -99, -108, -112]
REAL = [20, 32, 45, 48, 52, 72, 80, 96, 117, 125]
GRID = range(-6, 7)
# Brute force over O/(α) costs |N(α)|² products: elements of larger norm aren't classified here.
NORM_LIMIT = 150


def order_of(D):
    d = int(squarefree_part(D))
    DK = d if d % 4 == 1 else 4 * d
    f = isqrt(D // DK)
    assert f * f * DK == D and f > 1, D
    sK, rK = (-1, (d - 1) // 4) if d % 4 == 1 else (0, d)
    return d, f, f * sK, f * f * rK


def norm(s, r, x, y):
    return x * x + s * x * y - r * y * y


def times(s, r, a, b):
    # (x + yω)(u + vω), ω² = sω + r.
    (x, y), (u, v) = a, b
    return (x * u + r * y * v, x * v + y * u + s * y * v)


def quotient_is_domain(s, r, a):
    # O/(α) = ℤ²/L, L spanned by α·1 and α·ω; reduce pairs to residues by the Hermite form.
    x, y = a
    L = matrix(ZZ, [[x, y], [r * y, x + s * y]]).echelon_form()
    n = abs(L.det())
    reps = []
    (a11, a12), (_, a22) = L.rows()
    for u in range(abs(a11)):
        for v in range(abs(a22)):
            reps.append((u, v))

    def zero(p):
        # p ∈ L ⟺ p is an integer combination of L's rows.
        c = matrix(QQ, L).solve_left(matrix(QQ, [list(p)]))
        return all(t in ZZ for t in c.list())

    assert len(reps) == n
    for p, q in product(reps, repeat=2):
        if zero(p) or zero(q):
            continue
        if zero(times(s, r, p, q)):
            return False
    return True


def divides(s, r, b, a):
    # a/b in O: solve b·(u + vω) = a over ℚ and ask for integers.
    x, y = b
    M = matrix(QQ, [[x, y], [r * y, x + s * y]])
    if M.det() == 0:
        return False
    c = M.solve_left(matrix(QQ, [list(a)]))
    return all(t in ZZ for t in c.list())


def kind(D, s, r, a):
    n = abs(norm(s, r, *a))
    if n == 0:
        return "zero"
    if n == 1:
        return "unit"
    if quotient_is_domain(s, r, a):
        return "prime"
    # Every divisor of norm m ≤ n lies in |y| ≤ 2√(m/|D|), |x| ≤ √m + |s·y| (the norm form is
    # positive definite), so this box holds one from each pair of complementary divisors.
    top = isqrt(n) + 1
    ys = 2 * isqrt(4 * n // abs(D)) + 2
    for y in range(-ys, ys + 1):
        for x in range(-top - abs(s * y), top + abs(s * y) + 1):
            m = abs(norm(s, r, x, y))
            if m in (0, 1) or m >= n or n % m != 0:
                continue
            if divides(s, r, (x, y), a):
                return "composite"
    return "irreducible"


orders = []
for D in IMAGINARY + REAL:
    d, f, s, r = order_of(D)
    entry = {"D": D, "d": d, "f": f, "h": int(pari(f"quadclassunit({D})[1]"))}
    if D > 0:
        K = QuadraticField(d, "a")
        w = (s + K(D).sqrt()) / 2
        # PARI's fundamental unit of the order, as a + b·(D mod 2 + √D)/2; ours is ε > 1.
        a, b = int(pari(f"real(quadunit({D}))")), int(pari(f"imag(quadunit({D}))"))
        eps = a + b * (D % 2 + K(D).sqrt()) / 2
        eps = max([eps, -eps, 1 / eps, -1 / eps], key=lambda e: float(e.n()))
        y = (eps - eps.galois_conjugate()) / (w - w.galois_conjugate())
        entry["unit"] = [int(eps - y * w), int(y)]
    else:
        kinds = {}
        for x in GRID:
            for y in GRID:
                if abs(norm(s, r, x, y)) > NORM_LIMIT:
                    continue
                k = kind(D, s, r, (x, y))
                if k not in ("zero", "unit", "composite"):
                    kinds.setdefault(k, []).append(f"{x},{y}")
        entry["prime"] = " ".join(kinds.get("prime", []))
        entry["irreducible"] = " ".join(kinds.get("irreducible", []))
    orders.append(entry)

print(json.dumps({"grid": [GRID.start, GRID.stop - 1], "normLimit": NORM_LIMIT, "orders": orders}, indent=2))
