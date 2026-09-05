# The SymPy side of the oracle, driven by cases-sympy.yaml — same shape and purpose as oracle_sage.py's sage
# side (see that file's header). For each case, eval its sympy expression, enumerate, and convert every element
# into enumeratio's canonical serial format via the per-collection converter below. Emit a JSON list aligned to
# the cases file order: {card, elements} or {error}. oracle_sympy.test.ts zips this against what
# enumeratio-client enumerates for the same {collection, args} and asserts set-equality.
#
# Unlike sage (an optional external system, gated on SAGE_PATH), sympy is a normal pip package — no external
# binary, no SAGE_PATH-style dance. Run directly: `python3 oracle_sympy.py`. The test still gates on
# `python3 -c "import sympy"` succeeding, so a dev box without sympy skips cleanly instead of failing.
#
# SURVEY (issue: SymPy as a live-oracle cross-reference, alongside the sage/wolfram doc-verified rows):
# sympy.utilities.iterables and sympy.combinatorics were surveyed against the full collection catalog
# (~240 ids in base_collection). Genuine element-level matches, each independently confirmed against small-n
# enumeratio output before being trusted (never from a plausible-looking name alone):
#   generate_bell        -> permutations            (Steinhaus-Johnson-Trotter order; same SET as lex order)
#   generate_derangements-> derangements
#   generate_involutions -> involutions
#   subsets(seq[,k])      -> subsets / k_subsets
#   partitions(n)         -> integer_partitions      (dict multiplicities -> descending parts list)
#   multiset_partitions(n)-> set_partitions           (multiset_partitions of an int n = multiset range(n))
#   signed_permutations   -> signed_permutations
#   variations(seq,k)     -> arrangements             (k-permutations, no repetition)
#   variations(seq,k,True)-> words                    (length-k tuples with repetition = words(size=k,base=len(seq)))
#   necklaces(n,k)        -> binary_necklaces (k=2) / k_necklaces  (lex-least rotation representative, same convention)
#   bracelets(n,k)        -> binary_bracelets (k=2) / k_bracelets  (lex-least rotation+reflection representative)
#
# EXCLUDED (looked genuine, rejected on inspection — don't re-add without re-verifying):
#   - ordered_partitions(n): the name suggests compositions (all orderings of parts), but it actually yields
#     each partition of n exactly once, ascending — i.e. it's integer_partitions again (p(4) has 5 partitions
#     AND `ordered_partitions(4)` returns exactly 5 lists), not the 2^(n-1) compositions. Confirmed live before
#     writing this note — cardinality mismatched integer_compositions(8) (22 vs the correct 128) on first try.
#   - signed_subsets: 3^n choices of absent/+k/-k per axis has no direct sympy generator (permute_signs only
#     permutes signs of a FIXED tuple's nonzero entries, it doesn't also choose which axes are absent).
#   - kbins: partitions a SEQUENCE into k contiguous-by-default groups under an `ordered` flag whose semantics
#     don't line up cleanly with any one collection's canonical order; skipped rather than force a weak match.
#   - multiset_permutations / multiset_combinations: only match a collection when the input multiset's
#     multiplicities are fixed structure (not one of our size-parameterized families) — no clean case.
#   - lyndon_words / k_lyndon_words: sympy has no direct Lyndon-word generator (only aperiodicity as a
#     necklaces/bracelets side effect); would need a hand-rolled aperiodicity filter, same as oracle_sage.py's
#     brute-force references, which duplicates that file's job with a weaker (no-external-system) oracle. Left
#     to the existing sage oracle.
#   - Number-only functions already covered by wolfram-refs.sql / references.sql (catalan, bell, stirling1/2,
#     partition/partitions-count, fibonacci, lucas, subfactorial) were not re-added here — no new information.
#     motzkin/tribonacci ARE new (wolfram has no MotzkinNumber symbol; see wolfram-refs.sql's own header) and
#     are cross-checked live in this file too (see CARDINALITY_CHECKS below) before being written into
#     sympy-refs.sql — motzkin needed `motzkin.find_first_n_motzkins`, NOT the `motzkin(n)` function itself,
#     which (as tested against sympy 1.11.1) is off by one term from the standard/OEIS A001006 indexing that
#     enumeratio and find_first_n_motzkins both use.
import json
import os
import sys

from sympy import tribonacci
from sympy import motzkin as _motzkin
from sympy.utilities.iterables import (
    generate_bell,
    generate_derangements,
    generate_involutions,
    subsets,
    partitions as _sympy_partitions_raw,
    multiset_partitions,
    signed_permutations,
    variations,
    necklaces,
    bracelets,
)


def shift1(xs):
    """0-indexed tuples/lists -> 1-based tuples (sympy's [0..n-1] convention -> enumeratio's [1..n])."""
    return [[x + 1 for x in t] for t in xs]


def sympy_partitions(n):
    """partitions(n) yields {part_size: multiplicity} dicts; expand to a descending parts list (our + sage's
    convention: e.g. {2: 2, 1: 1} -> [2, 2, 1])."""
    out = []
    for p in _sympy_partitions_raw(n):
        parts = []
        for size, mult in p.items():
            parts.extend([size] * mult)
        out.append(sorted(parts, reverse=True))
    return out


# element -> enumeratio serial, per collection. `a` is the case args (some formats need `size`/`n`).
def conv_permutations(p, a):
    return ''.join(map(str, list(p)))


def conv_subsets(S, a):
    n = int(a.get('size', a.get('n', 0)))
    members = set(int(x) for x in S)
    return ''.join('1' if i in members else '0' for i in range(1, n + 1))


def conv_integer_partitions(p, a):
    return '+'.join(map(str, p)) or '0'


def conv_integer_compositions(c, a):
    return '+'.join(map(str, c))


def _rgs(blocks, size):
    m = {}
    for i, b in enumerate(sorted((sorted(int(x) for x in b) for b in blocks), key=lambda b: b[0])):
        for e in b:
            m[e] = i
    return ''.join(str(m[i]) for i in range(1, size + 1))


def conv_set_partitions(P, a):
    # multiset_partitions(n) blocks are 0-indexed (over range(n)); shift to 1-based before RGS-ing.
    blocks = [[int(x) + 1 for x in b] for b in P]
    return _rgs(blocks, a['size'])


def conv_signed_permutations(p, a):
    return ','.join(map(str, list(p)))


def conv_arrangements(w, a):
    return '-'.join(str(int(x)) for x in w) if len(w) else ''


def conv_words(w, a):
    return ','.join(str(int(x)) for x in w)


def conv_binary_words(w, a):
    return ''.join(str(int(b)) for b in w)


CONV = {
    'permutations': conv_permutations,
    'derangements': conv_permutations,
    'involutions': conv_permutations,
    'subsets': conv_subsets,
    'k_subsets': conv_subsets,
    'integer_partitions': conv_integer_partitions,
    'integer_compositions': conv_integer_compositions,
    'set_partitions': conv_set_partitions,
    'signed_permutations': conv_signed_permutations,
    'arrangements': conv_arrangements,
    'words': conv_words,
    'binary_necklaces': conv_binary_words,
    'k_necklaces': conv_words,
    'binary_bracelets': conv_binary_words,
    'k_bracelets': conv_words,
}

# Independent, standalone check (not part of the cases.yaml element-set flow): the two number sequences sympy
# adds that wolfram-refs.sql explicitly could NOT cover (no WL builtin). Verified live here; the confirmed
# literal sequences are what sympy-refs.sql's base_example pins.
CARDINALITY_CHECKS = {
    'motzkin_numbers': [int(x) for x in _motzkin.find_first_n_motzkins(9)],
    'tribonacci_numbers': [int(tribonacci(n)) for n in range(8)],  # sympy's own T0=0,T1=1,... (see delta in sympy-refs.sql)
}

if __name__ == '__main__':
    import yaml

    with open(os.path.join(os.path.dirname(__file__), '..', 'cases-sympy.yaml')) as f:
        cases = yaml.safe_load(f)

    out = []
    for c in cases:
        try:
            coll, args, expr = c['collection'], c['args'], c['sympy']
            conv = CONV[coll]
            elements = list(eval(expr, globals()))  # noqa: S307 — our own test data, not untrusted input
            out.append({'card': len(elements), 'elements': [conv(el, args) for el in elements]})
        except Exception as e:  # keep one bad case from killing the rest; the TS test surfaces it
            out.append({'error': repr(e)})

    if len(sys.argv) > 1 and sys.argv[1] == '--cardinality-checks':
        json.dump(CARDINALITY_CHECKS, sys.stdout)
    else:
        json.dump(out, sys.stdout)
