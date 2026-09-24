# Golden data for @enumeratio/adeles from Hertogh's Sage `adeles` (github.com/mathehertogh/adeles).
#
#   sage -pip install git+https://github.com/mathehertogh/adeles
#   sage -python packages/adeles/scripts/collect-golden.py > packages/adeles/tests/adeles.golden.json
#
# Each case is {input, expected} in MathJSON; expected is Sage's answer written in our
# normal form. Inputs are seeded, so a rerun only changes the file when Sage's answers do.

from sage.all import *  # noqa: F403

# Sage 10.9 removed the is_* helpers the package still imports; restore them before it loads.
import sage.rings.number_field.number_field as _nf
import sage.rings.number_field.number_field_element as _nfe
import sage.rings.number_field.number_field_ideal as _nfi
import sage.rings.quotient_ring as _qr
from sage.rings.number_field.number_field_base import NumberField as _NumberField

_nf.is_NumberField = lambda K: isinstance(K, _NumberField)
_nfi.is_NumberFieldIdeal = lambda x: isinstance(x, _nfi.NumberFieldFractionalIdeal)
_nfe.is_NumberFieldElement = lambda x: isinstance(x, _nfe.NumberFieldElement)
_qr.is_QuotientRing = lambda x: isinstance(x, _qr.QuotientRing_generic)

import json
import random

from adeles.all import Adeles, Ideles, ProfiniteFibonacci, Qhat, Zhat  # noqa: E402
from adeles.matrix import factor_GLQhat  # noqa: E402

random.seed(20260924)
PRIMES = [2, 3, 5, 7, 11, 13]


def integer(n):
    # Past 2^53 compute-engine writes an integer as {"num": "…"}; JSON numbers would round.
    n = int(n)
    return n if abs(n) < 2**53 else {"num": str(n)}


def num(x):
    x = QQ(x)
    if x.denominator() == 1:
        return integer(x)
    return ["Rational", integer(x.numerator()), integer(x.denominator())]


def profinite(z):
    return num(z.value()) if z.modulus() == 0 else ["ProfiniteNumber", num(z.value()), num(z.modulus())]


def rational(bound=12, den=6):
    return QQ((random.randint(-bound, bound), random.randint(1, den)))


def modulus():
    return QQ((random.randint(1, 60), random.choice([1, 1, 1, 2, 3, 5, 6])))


def qhat():
    return Qhat(rational(), modulus() if random.random() < 0.9 else 0)


cases = {}


def case(family, input, expected):
    cases.setdefault(family, []).append({"input": input, "expected": expected})


for _ in range(120):
    x, y = qhat(), qhat()
    case("add", ["Add", profinite(x), profinite(y)], profinite(x + y))
    case("multiply", ["Multiply", profinite(x), profinite(y)], profinite(x * y))
    case("equal", ["Equal", profinite(x), profinite(y)], "True" if x == y else "False")
    case("numerator", ["Numerator", profinite(x)], profinite(Qhat(x.numerator())))
    case("denominator", ["Denominator", profinite(x)], int(x.denominator()))

# Gluing p-adics: Zp components for Ẑ, Qp (negative valuation) for Q̂.
for _ in range(60):
    primes = random.sample(PRIMES, random.randint(1, 3))
    padics, adics = [], []
    for p in primes:
        prec = random.randint(1, 4)
        if random.random() < 0.7:
            v = random.randint(0, p**prec - 1)
            padics.append(Zp(p)(v, prec))
            adics.append(["AdicNumeral", p, v, prec])
        else:
            v = QQ((random.randint(1, p**prec), p ** random.randint(1, 2)))
            padics.append(Qp(p)(v, prec))
            adics.append(["AdicNumeral", p, num(v), prec])
    glued = Qhat(padics) if any(a.valuation() < 0 for a in padics) else Qhat(Zhat(padics))
    case("glue", ["ProfiniteNumber", ["List", *adics]], profinite(glued))

F = ProfiniteFibonacci()
for _ in range(60):
    n = random.randint(1, 3000)
    a = random.randint(0, n - 1)
    case("fibonacci", ["Fibonacci", ["ProfiniteNumber", a, n]], profinite(F(Zhat(a, n))))


def idele(u):
    """Sage's idèle in our normal form: principal, or scale + units mod pⁿ."""
    r = real(u.infinite_part()[0])
    if u.has_exact_finite_part():
        return ["Idele", r, num(u.finite_part())]
    scale, units = QQ(1), []
    for p in sorted(u.stored_primes()):
        c, n = u[p].center(), u[p].prec()
        v = c.valuation(p)
        scale *= QQ(p) ** v
        unit = c / QQ(p) ** v
        if n == Infinity:
            units.append(["AdicNumeral", int(p), num(unit)])
        elif n > (1 if p == 2 else 0):
            m = int(p) ** int(n)
            units.append(["AdicNumeral", int(p), int(mod(unit, m).lift()), int(n)])
    return ["Idele", r, num(scale), ["List", *units]]


def real(x):
    """The real component, which these cases keep integral so Sage's interval is exact."""
    assert x.is_exact() if hasattr(x, "is_exact") else x.diameter() == 0
    return num(x.center())


def random_idele():
    J = Ideles(QQ)
    # ±1 keeps quotients of real parts exact on both sides.
    sign = random.choice([1, -1])
    if random.random() < 0.25:
        return J([sign], rational(9, 4) or QQ(1))
    finite = {}
    for p in random.sample(PRIMES, random.randint(1, 3)):
        c = QQ((random.randint(1, 40), random.randint(1, 9)))
        finite[p] = (c, random.randint(0, 4))
    return J([sign], finite)


A = Adeles(QQ)
for _ in range(60):
    u, w = random_idele(), random_idele()
    case("idele-multiply", ["Multiply", idele(u), idele(w)], idele(u * w))
    case("idele-divide", ["Divide", idele(u), idele(w)], idele(u / w))
    a = A(u)
    case("idele-to-adele", ["Adele", idele(u)], ["Adele", real(a.infinite_part()[0]), profinite(a.finite_part())])


# GL_n(Q̂) = GL_n(Ẑ)·GL_n⁺(Q): moduli chosen so Hertogh's precision test passes.
for _ in range(40):
    n = random.choice([2, 2, 3])
    while True:
        V = matrix(QQ, n, n, [rational(9, random.choice([1, 1, 2, 3])) for _ in range(n * n)])
        if V.det() != 0:
            break
    D = [lcm([V[i, j].denominator() for i in range(n)]) for j in range(n)]
    gauge = abs(V.det() * prod(D))
    M = matrix(
        Qhat,
        n,
        n,
        [Qhat(V[i, j], gauge * random.randint(1, 4) / D[j]) for i in range(n) for j in range(n)],
    )
    Afound = factor_GLQhat(M, V.det())
    B = M * Afound.inverse().change_ring(Qhat)
    case(
        "profinite-decomposition",
        ["ProfiniteDecomposition", ["List", *[["List", *[profinite(M[i, j]) for j in range(n)]] for i in range(n)]], num(V.det())],
        [
            "List",
            ["List", *[["List", *[profinite(B[i, j]) for j in range(n)]] for i in range(n)]],
            ["List", *[["List", *[num(Afound[i, j]) for j in range(n)]] for i in range(n)]],
        ],
    )

print(json.dumps(cases, indent=1))
