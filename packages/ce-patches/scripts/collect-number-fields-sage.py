# Sage's answers for number fields ℚ(θ), θ a root of monic f (numerics/number-field.ts): the
# field discriminant, the maximal order's basis on 1, θ, …, θⁿ⁻¹, the signature, and, for
# every element with small coordinates on the power basis, whether it generates a prime ideal
# of O_K. Run with `sage -python`:
#
#   sage -python scripts/collect-number-fields-sage.py > tests/number-fields.sage.json

import json
from itertools import product

from sage.all import QQ, NumberField, PolynomialRing

R = PolynomialRing(QQ, "x")
x = R.gen()
FIELDS = [
    x**3 - 2, x**3 - x**2 - 2*x - 8, x**3 - 19, x**3 - 10, x**3 - x - 1, x**3 + x**2 - 2*x - 1,
    x**3 - 175, x**3 - 12, x**4 - 2, x**4 + x**3 + x**2 + x + 1, x**4 - 4*x**2 + 2, x**4 - 12,
    x**4 + 12, x**4 - x - 1, x**5 - x - 1, x**5 - 2, x**6 + x**5 + x**4 + x**3 + x**2 + x + 1,
]
COEFFICIENTS = range(-2, 3)
NORM_LIMIT = 2000

fields = []
for f in FIELDS:
    K = NumberField(f, "t")
    t = K.gen()
    n = f.degree()
    O = K.maximal_order()
    Z = K.order(t)
    basis = [[str(c) for c in list(b)] for b in O.basis()]
    primes = []
    for c in product(COEFFICIENTS, repeat=n):
        a = sum(ci * t**i for i, ci in enumerate(c))
        if a == 0 or abs(a.norm()) > NORM_LIMIT or abs(a.norm()) == 1:
            continue
        key = ",".join(map(str, c))
        if K.ideal(a).is_prime():
            primes.append(key)
    fields.append({
        "f": [str(c) for c in f.list()],
        "discriminant": str(K.discriminant()),
        "index": str(Z.index_in(O)),
        "signature": [int(r) for r in K.signature()],
        "basis": basis,
        "primes": " ".join(primes),
    })

print(json.dumps({"coefficients": [COEFFICIENTS.start, COEFFICIENTS.stop - 1], "normLimit": NORM_LIMIT, "fields": fields}, indent=1))
