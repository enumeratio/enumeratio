# Golden data for @enumeratio/adeles from Hertogh's Sage `adeles` (github.com/mathehertogh/adeles).
#
#   sage -pip install git+https://github.com/mathehertogh/adeles
#   sage -python packages/symbols/arithmetic/adeles/scripts/collect-golden.py > packages/symbols/arithmetic/adeles/tests/adeles.golden.json
#
# Each case is {input, expected} in MathJSON; expected is Sage's answer written in our
# normal form. Inputs are seeded, so a rerun only changes the file when Sage's answers do.
#
# ProfiniteNumber/Idele/Adele/ProfiniteDecomposition themselves moved to reference role:test
# examples with mapped Sage bindings (run.ts's SAGE_PREAMBLE carries the same is_* monkeypatch
# and value printers this script used to need on its own). Two families stay here because the
# oracle's per-head-and-arity binding table cannot express what they need:
#
# - "glue": ProfiniteNumber(List(AdicNumeral, ...)) -- CRT-gluing a list of AdicNumeral values.
#   AdicNumeral itself has no Sage binding (it belongs to packages/symbols/arithmetic/numerals'
#   own golden/lane), so any example whose INPUT contains one simply fails to emit as Sage
#   source; there is no row to add on this side that would change that.
# - "fibonacci": Fibonacci(ProfiniteNumber(...)) -- Lenstra's profinite Fibonacci numbers. The
#   oracle's mapping table keys only on (head, arity), and Fibonacci already has a plain-integer
#   Sage row at arity 1 (`fibonacci($1)`, packages/symbols/arithmetic/number-theory); a second
#   arity-1 row for a profinite argument would silently shadow or collide with it, and Sage's
#   own profinite Fibonacci is a distinct callable (`ProfiniteFibonacci()`), not an overload of
#   `fibonacci`. There is no argument-type dispatch in the mapping table to tell them apart.

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

from adeles.all import ProfiniteFibonacci, Qhat, Zhat  # noqa: E402

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


cases = {}


def case(family, input, expected):
    cases.setdefault(family, []).append({"input": input, "expected": expected})


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

print(json.dumps(cases, indent=1))
