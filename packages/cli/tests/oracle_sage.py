# Sage side of the oracle, driven by cases.yaml. For each case, eval its sage expression, enumerate, and
# convert every element into enumeratio's canonical serial format via the per-collection converter. Emit a
# JSON list aligned to the cases file order: {card, elements[, stats]} or {error}. The TS test zips this against
# what enumeratio-client enumerates for the same {collection, args} and asserts set-equality (plus, for a case
# carrying `stats:`, per-element statistic equality against sage's own methods).
#
# Run under sage's python: `sage --python oracle_sage.py`.
import json, os, sys
import yaml
from sage.all import *  # noqa: F401,F403 — expose all sage names to the eval'd case expressions
from itertools import product  # AFTER the star import: sage.all exports its own symbolic `product`
import itertools
from fractions import Fraction
from math import isqrt


# element -> enumeratio serial, per collection. `a` is the case args (some formats need `size`).
def conv_permutations(p, a):
    return ''.join(map(str, list(p)))


def conv_signed_permutations(p, a):
    return ','.join(map(str, list(p)))


def conv_subsets(S, a):
    # pure's canonical since the finset rebuild: the indicator bitstring over the ground [n] ('1010' = {1,3} in [4])
    n = int(a.get('size', a.get('n', 0)))
    members = set(int(x) for x in S)
    return ''.join('1' if i in members else '0' for i in range(1, n + 1))


def conv_integer_partitions(p, a):
    # pure prints the empty partition (n=0) as "0" (its notation coalesces the empty join)
    return '+'.join(map(str, p)) or '0'


def conv_integer_compositions(c, a):
    return '+'.join(map(str, c))


def _rgs(P, size):
    # the restricted-growth string: block id per element, blocks numbered by least element, no delimiter
    blocks = sorted((sorted(int(x) for x in b) for b in P), key=lambda b: b[0])
    m = {}
    for i, b in enumerate(blocks):
        for e in b:
            m[e] = i
    return ''.join(str(m[i]) for i in range(1, size + 1))


def conv_set_partitions(P, a):
    # pure's canonical for an (unordered) set partition IS the RGS word
    return _rgs(P, a['size'])


def conv_restricted_growth_strings(P, a):
    # the WORD side of the same sage parent — pure renders it identically to a set partition
    return _rgs(P, a['size'])


def conv_set_compositions(P, a):
    # pure's canonical: comma within a block (ascending), bar between blocks, in COMPOSITION order (never re-sorted)
    return '|'.join(','.join(str(e) for e in sorted(int(x) for x in b)) for b in P)


def conv_surjections(P, a):
    # the WORD side: 1-based index of the ordered block each element falls in
    m = {}
    for i, block in enumerate(P, start=1):
        for e in block:
            m[int(e)] = i
    return ','.join(str(m[e]) for e in range(1, a['size'] + 1))


def conv_dyck_paths(w, a):
    # pure's U/D word: 1 = up = U, 0 = down = D (a sage DyckWord lists as 1/0)
    return ''.join('U' if int(x) == 1 else 'D' for x in list(w))


def conv_motzkin_paths(w, a):
    # pure's U/D/L word: 1 = up = U, -1 = down = D, 0 = flat = L — one char per step, no delimiter
    return ''.join('U' if x == 1 else 'D' if x == -1 else 'L' for x in w)


def motzkin_words(n):
    # Independent brute-force reference (sage has no MotzkinPaths class): every step word over {-1,0,1} of
    # length n whose prefix sums stay >= 0 and end at 0. A different algorithm from the DB's rank-based
    # unrank, so agreement genuinely validates the engine. Referenced by cases.yaml as `motzkin_words(n)`.
    from itertools import product
    out = []
    for w in product((-1, 0, 1), repeat=n):
        h, ok = 0, True
        for s in w:
            h += s
            if h < 0:
                ok = False
                break
        if ok and h == 0:
            out.append(list(w))
    return out


def conv_standard_tableaux(t, a):
    # our canonical form is the tableau rows: entries comma-separated within a row, rows slash-separated (1,3/2)
    return '/'.join(','.join(str(int(v)) for v in row) for row in t)


def conv_skew_partitions(sp, a):
    # our canonical form is λ/μ (outer parts comma-separated, then '/', then inner parts)
    return ','.join(str(int(x)) for x in sp[0]) + '/' + ','.join(str(int(x)) for x in sp[1])


def conv_decorated_permutations(dp, a):
    # our canonical form is the signed one-line word (a fixed point may be negative), comma-separated
    return ','.join(str(int(x)) for x in dp)


def conv_plane_partitions(pp, a):
    # our canonical form is the rows (entries comma-separated), rows slash-separated (e.g. 2,1/1)
    return '/'.join(','.join(str(int(v)) for v in row) for row in pp)


def conv_gelfand_tsetlin(g, a):
    # our canonical form is the triangle rows (entries comma-separated), rows slash-separated (2,0,0/1,0/1)
    return '/'.join(','.join(str(int(v)) for v in row) for row in g)


def conv_core_partitions(c, a):
    # our canonical form is the core partition, comma-separated
    return ','.join(str(int(x)) for x in c)


def conv_semistandard_tableaux(t, a):
    # our canonical form is the tableau rows (entries comma-separated), rows slash-separated (1,1/2)
    return '/'.join(','.join(str(int(v)) for v in row) for row in t)


def conv_alternating_sign_matrices(m, a):
    # our canonical form is the matrix rows (entries comma-separated), rows slash-separated
    M = m.to_matrix()
    return '/'.join(','.join(str(int(x)) for x in M.row(i)) for i in range(M.nrows()))


def conv_binary_trees(w, a):
    return w


def _luka(t):
    # Łukasiewicz preorder word (pure's canonical): leaf/empty = 0, internal node = 1 then its two subtrees
    return '0' if len(t) == 0 else '1' + _luka(t[0]) + _luka(t[1])


def binary_tree_parens(n):
    # sage's BinaryTrees, each as pure's Łukasiewicz word. Any convention gives the same SET, which is what the
    # oracle compares. (Name kept for the cases.yaml reference.)
    from sage.all import BinaryTrees
    return [_luka(t) for t in BinaryTrees(n)]


def all_labeled_trees(n):
    # a labeled tree on [n] <-> its Prufer code, a length-(n-2) word over [n] (n<=2: the one empty-code tree)
    import itertools
    return [()] if n <= 2 else list(itertools.product(range(1, n + 1), repeat=n - 2))


def conv_labeled_trees(code, a):
    # pure's canonical: the Prufer code parenthesized, comma-separated (empty code -> "()")
    return '(' + ','.join(str(int(x)) for x in code) + ')'


def conv_arrangements(w, a):
    # pure's canonical: the injective word, dash-separated (the empty arrangement -> "")
    return '-'.join(str(int(x)) for x in w)


def all_arrangements(n):
    # sage has no "every length" arrangements parent (Arrangements(mset) with no k raises), so build it:
    from sage.all import Arrangements
    return [a for k in range(n + 1) for a in Arrangements(list(range(1, n + 1)), k)]


def conv_modular_residues(x, a):
    # pure's canonical: the residue itself, 0..m-1
    return str(int(x))


def conv_lehmer_codes(p, a):
    # sage's own Lehmer code (same convention pg implements, verified n <= 6); pure renders it undelimited, always
    # with the trailing 0 — so even the empty (n=0) code prints as "0"
    return ''.join(str(int(x)) for x in p.to_lehmer_code()) or '0'


def lehmer_words(n):
    # Independent brute-force reference: the full digit box, one radix per position. A different
    # construction from sage's per-permutation encode, so agreement checks the convention itself.
    from itertools import product
    return [list(v) for v in product(*[range(n - i) for i in range(n)])]


def conv_lehmer_words(w, a):
    return ','.join(str(int(x)) for x in w)


def conv_words(w, a):
    # pure's canonical: the 1-based letters, comma-separated
    return ','.join(str(int(x)) for x in w)


def words_over(n, base):
    # sage's Words over an explicit 1..base alphabet
    from sage.all import Words
    return [list(w) for w in Words(list(range(1, base + 1)), n)]


def conv_endofunctions(w, a):
    # pure's canonical: the images concatenated as digits (n ≤ 9 in the oracle)
    return ''.join(str(int(x)) for x in w)


def finite_set_maps_over(m, n):
    # sage's FiniteSetMaps(m, n) = ALL maps [m] → [n] — the maps_of(fin(m), fin(n)) oracle (design §4e). A map's image
    # list, shifted to enumeratio's 1-based letters; FiniteSetMaps(n, n) is the endofunctions (the diagonal β = α).
    from sage.all import FiniteSetMaps
    out = []
    for f in FiniteSetMaps(m, n):
        try:
            imgs = [int(f(i)) for i in range(m)]
        except Exception:
            imgs = [int(x) for x in list(f)]
        out.append([x + 1 for x in imgs])
    return out


def conv_finsets(x, a):
    # our canonical form is "<ordinal>:<size>" — the atom together with its ground set
    return '%d:%d' % (int(x), a['size'])


def finset_atoms(n):
    # the atoms of [n]; sage's FiniteEnumeratedSet(range(1, n+1)) is the same list
    from sage.all import FiniteEnumeratedSet
    return list(FiniteEnumeratedSet(range(1, n + 1)))


def conv_perfect_matchings(m, a):
    # our canonical: least element leads each pair, pairs sorted by least element — "(1,2)(3,4)"
    pairs = sorted((tuple(sorted(int(x) for x in p)) for p in m), key=lambda p: p[0])
    return ''.join('(%d,%d)' % p for p in pairs)


def conv_weak_compositions_into_k_parts(v, a):
    return '+'.join(str(int(x)) for x in v)          # parts joined by + (zeros kept)


def conv_binary_words(w, a):
    return ''.join(str(int(b)) for b in w)           # bits concatenated: "0101"


def conv_parking_functions(pf, a):
    return ','.join(str(int(x)) for x in pf)


def binary_words_over(n):
    from itertools import product
    return [list(t) for t in product([0, 1], repeat=n)]   # all 2^n bit-lists (gray codes are a reordering of the same set)


def conv_ordered_trees(dw, a):
    # ordered_trees renders as balanced parens (the same C_n set as Dyck words): 1→'(', 0→')'
    return ''.join('(' if int(x) == 1 else ')' for x in dw)


def conv_subexcedant_seqs(w, a):
    return ','.join(str(int(x)) for x in w)


def subexcedant_seqs_over(n):
    # reference: the odometer product a_i in [1,i]; a different construction from the DB recursive build
    from itertools import product
    return [list(t) for t in product(*[range(1, i + 1) for i in range(1, n + 1)])]


def conv_k_dyck_paths(w, a):
    return w   # k_dyck_words already yields the U/D word


def is_baxter_perm(s):
    # avoid the vincular patterns 2-41-3 and 3-14-2 (the middle two letters ADJACENT). 0-based positions i<b, b+1<d.
    n = len(s)
    for b in range(n - 1):
        for i in range(b):
            for d in range(b + 2, n):
                if s[b + 1] < s[i] < s[d] < s[b]:        # 2-41-3
                    return False
                if s[b] < s[d] < s[i] < s[b + 1]:        # 3-14-2
                    return False
    return True


def is_simple_perm(s):
    # no non-trivial interval: a window [i..j] whose values span a consecutive range and 1 < len < n
    n = len(s)
    if n <= 2:
        return True
    for i in range(n):
        lo = hi = s[i]
        for j in range(i + 1, n):
            lo = min(lo, s[j])
            hi = max(hi, s[j])
            seg = j - i + 1
            if hi - lo + 1 == seg and seg < n:
                return False
    return True


def colored_perms_over(n, k):
    # brute-force reference for Z_k wr S_n: every (permutation, colour-vector) pair, independent of the DB floor
    from itertools import permutations, product
    return [(list(p), list(c)) for p in permutations(range(1, n + 1)) for c in product(range(k), repeat=n)]


def conv_k_colored_permutations(el, a):
    # pure's canonical: comma-joined permutation, ':', comma-joined colours — "2,4,1,3:0,1,0,1"
    perm, colors = el
    return ','.join(str(int(x)) for x in perm) + ':' + ','.join(str(int(c)) for c in colors)


def k_dyck_words(n, k):
    # Independent brute-force reference (sage has no k-Dyck class): choose which of the kn positions are up-steps
    # (rise k-1); keep those whose running height (up:+ (k-1), down: -1) never goes negative and ends at 0.
    from itertools import combinations
    L = k * n; out = []
    for ups in combinations(range(L), n):
        up = set(ups); h = 0; ok = True
        for i in range(L):
            h += (k - 1) if i in up else -1
            if h < 0:
                ok = False; break
        if ok and h == 0:
            out.append(''.join('U' if i in up else 'D' for i in range(L)))
    return out


def conv_plane_trees(d, a):
    return ','.join(str(int(x)) for x in d)   # pre-order child-count word, comma-separated


def plane_tree_words(n):
    # Independent brute-force reference (sage has no plane-tree-as-degree-word class): every length-n word of
    # child counts whose Σ(dᵢ−1) stays ≥ 0 on proper prefixes and lands at −1 (the Łukasiewicz condition), so it
    # is the pre-order degree word of a plane tree on n nodes. A different construction from the DB's Dyck borrow.
    import itertools
    out = []
    for d in itertools.product(range(n), repeat=n):
        if sum(d) != n - 1:
            continue
        s, ok = 0, True
        for i, x in enumerate(d):
            s += x - 1
            if i < n - 1 and s < 0:
                ok = False
                break
        if ok and s == -1:
            out.append(list(d))
    return out


def conv_labeled_forests(code, a):
    return '(' + ','.join(str(int(x)) for x in code) + ')'   # super-root Prüfer code, parenthesized (same carrier as labeled_trees)


def all_labeled_forests(n):
    # a rooted forest on [n] <-> the Prüfer code of its super-root tree on [n+1] (adjoin vertex n+1 joined to every
    # root): a length-(n-1) word over [n+1]. n<=1: the single empty-code forest.
    import itertools
    return [()] if n <= 1 else list(itertools.product(range(1, n + 2), repeat=n - 1))


def conv_rook_placements(v, a):
    return ','.join(str(int(x)) for x in v)   # cols[i] = column of the rook in row i (0 = empty), comma-separated


def rook_placements_over(n):
    # Independent brute-force reference (sage has no partial-permutation parent): every length-n word over {0..n}
    # whose nonzero entries are distinct (one rook per column). A different construction from the DB's rookDP unrank.
    import itertools
    out = []
    for w in itertools.product(range(n + 1), repeat=n):
        nz = [x for x in w if x != 0]
        if len(nz) == len(set(nz)):
            out.append(list(w))
    return out


def conv_k_motzkin_paths(w, a):
    return w   # k_motzkin_words already yields the U/H/D string


def k_motzkin_words(n, k):
    # Motzkin words (motzkin_words) of length n with exactly k level steps, rendered U/H/D (0 → H).
    out = []
    for m in motzkin_words(n):
        if m.count(0) == k:
            out.append(''.join('U' if x == 1 else 'D' if x == -1 else 'H' for x in m))
    return out


def conv_colored_motzkin_paths(w, a):
    return w   # colored_motzkin_words already yields the U/Hc/D string


def colored_motzkin_words(n, r):
    # Every Motzkin word of length n with each level (H) step assigned one of r colors, rendered U / H<color> / D.
    import itertools
    out = []
    for m in motzkin_words(n):
        hpos = [i for i, s in enumerate(m) if s == 0]
        for colors in itertools.product(range(r), repeat=len(hpos)):
            cmap = dict(zip(hpos, colors))
            out.append(''.join('U' if s == 1 else 'D' if s == -1 else 'H' + str(cmap[i]) for i, s in enumerate(m)))
    return out


# ── compositions, partitions and factorizations (#223) ──────────────────────────────────────────────────
# Sage's Partitions/Compositions with the defining filter; the factorization families recurse over divisors.
def is_zigzag(c):
    # strictly alternating: every step rises or falls, and the direction flips each step (either phase)
    up = [c[i] < c[i + 1] for i in range(len(c) - 1)]
    dn = [c[i] > c[i + 1] for i in range(len(c) - 1)]
    return all(up[i] if i % 2 == 0 else dn[i] for i in range(len(up))) or \
           all(dn[i] if i % 2 == 0 else up[i] for i in range(len(up)))


def unordered_factorizations(n, floor=2):
    out = []
    for d in range(floor, n + 1):
        if n % d:
            continue
        if d == n:
            out.append([n])
        else:
            out.extend([d] + rest for rest in unordered_factorizations(n // d, d))
    return [sorted(f, reverse=True) for f in out]


def ordered_factorizations_of(n):
    out = []
    for d in range(2, n + 1):
        if n % d:
            continue
        if d == n:
            out.append([d])
        else:
            out.extend([d] + rest for rest in ordered_factorizations_of(n // d))
    return out


def conv_factorization(f, a):
    return '\u00b7'.join(str(int(x)) for x in f)


def goldbach_pairs(n):
    from sage.all import is_prime
    return [(p, 2 * n - p) for p in range(2, n + 1) if is_prime(p) and is_prime(2 * n - p)]


def conv_goldbach_partitions(pair, a):
    return '%d+%d' % (int(pair[0]), int(pair[1]))


# ── words and strings (#223) ────────────────────────────────────────────────────────────────────────────
# None of these has a sage parent class, so every `*_over` reference is an independent brute-force
# enumeration from the definition (product + a filter, or a direct recursion) — never the DB's unrank/DP.


def weight_words_over(n, k):
    # binary_words_by_weight(n,k): every length-n bit word with exactly k ones. Independent of the DB's
    # k_subsets-borrowed unrank — this is the plain definitional filter over all 2^n words.
    return [list(w) for w in product([0, 1], repeat=n) if sum(w) == k]


def fib_strings_over(n):
    # no two LINEARLY adjacent 1s
    return [list(w) for w in product([0, 1], repeat=n)
            if not any(w[i] == 1 and w[i + 1] == 1 for i in range(n - 1))]


def lucas_strings_over(n):
    # no two CYCLICALLY adjacent 1s, wrap edge (n-1, 0) included — at n=1 the self-loop excludes "1"
    if n == 0:
        return [[]]
    return [list(w) for w in product([0, 1], repeat=n)
            if all(not (w[i] == 1 and w[(i + 1) % n] == 1) for i in range(n))]


def tri_strings_over(n):
    # no three consecutive 1s
    return [list(w) for w in product([0, 1], repeat=n)
            if not any(w[i] == 1 and w[i + 1] == 1 and w[i + 2] == 1 for i in range(n - 2))]


def ternary_words_over(n):
    # ternary_gray_codes: the Gray order is a permutation of ALL length-n words over {0,1,2}; the oracle
    # compares sets, so enumerating them in ANY order (here, plain product) gives the same set.
    return [list(w) for w in product([0, 1, 2], repeat=n)]


def conv_ternary_words(w, a):
    return ''.join(str(int(d)) for d in w)


def hyperbinary_over(n):
    # hyperbinary_representations(n): digit words over {0,1,2}, MSB-first, padded to the canonical width
    # W(n) = bit_length(n) (n=0 -> width 1), whose value Σ dᵢ·2^(W-1-i) equals n. Brute force over the width
    # box (3^W, tiny for n <= ~30) rather than the DB's remainder-DP recursion.
    width = max(1, n.bit_length())
    out = []
    for w in product(range(3), repeat=width):
        if sum(d * (2 ** (width - 1 - i)) for i, d in enumerate(w)) == n:
            out.append(list(w))
    return out


def conv_hyperbinary(w, a):
    return ''.join(str(int(d)) for d in w)


def hypernumerary_words(b, k, n):
    # hypernumerary(b,k,n): the same idea one base up — digit words over {0..b-1+k}, MSB-first, padded to the
    # canonical width W(n) = the number of base-b digits of n (n=0 -> 1), whose value Σ dᵢ·b^(W-1-i) is n.
    # k=1, b=2 is hyperbinary_representations; brute force over the width box, not the DB's carry recursion.
    width, m = 1, n
    while m >= b:
        width, m = width + 1, m // b
    return [list(w) for w in product(range(b + k), repeat=width)
            if sum(d * (b ** (width - 1 - i)) for i, d in enumerate(w)) == n]


def ascent_sequences_over(n):
    # x_1 = 0; for i >= 2, 0 <= x_i <= 1 + asc(x_1..x_{i-1}). Direct recursive definition (not the DB's
    # left-to-right array-build with the same recurrence spelled in SQL, though the underlying math is
    # necessarily the same — there's no other definition of an ascent sequence to check it against).
    if n == 0:
        return [[]]
    out = []

    def rec(seq, asc):
        if len(seq) == n:
            out.append(list(seq))
            return
        for a in range(0, asc + 2):
            new_asc = asc + (1 if seq and a > seq[-1] else 0)
            rec(seq + [a], new_asc)

    rec([0], 0)
    return out


def conv_ascent_sequences(s, a):
    return ','.join(str(int(x)) for x in s)


# ── lattice paths (#223) ────────────────────────────────────────────────────────────────────────────────
# Every generator below walks the step words of its carrier directly from the path definition — a different
# construction from the DB's rank-based unrank, so agreement is a genuine cross-check, not a replay.


# ── dyck_path carrier (steps ±1; notation 1='U', -1='D') ────────────────────────────────────────────────
def dyck_words(n):
    # every ±1 word of length 2n whose prefix sums stay >= 0 and total 0 (a Dyck path == a ballot sequence)
    out = []
    for w in product((1, -1), repeat=2 * n):
        h, ok = 0, True
        for s in w:
            h += s
            if h < 0:
                ok = False
                break
        if ok and h == 0:
            out.append(list(w))
    return out


def max_height(w):
    h = mx = 0
    for s in w:
        h += s
        mx = max(mx, h)
    return mx


def has_hill(w):
    # a hill: a U taken from height 0 immediately followed by a D
    h = 0
    for i, s in enumerate(w):
        if s == 1 and h == 0 and i + 1 < len(w) and w[i + 1] == -1:
            return True
        h += s
    return False


def peak_count(w):
    return sum(1 for i in range(len(w) - 1) if w[i] == 1 and w[i + 1] == -1)


def dyck_paths_by_height_words(n, h):
    return [w for w in dyck_words(n) if max_height(w) == h]


def fine_words(n):
    return [w for w in dyck_words(n) if not has_hill(w)]


def narayana_words(n, k):
    return [w for w in dyck_words(n) if peak_count(w) == k]


def grand_words(n):
    # free ±1 walk of length 2n back to 0 — NO positivity constraint (may dip below the axis)
    return [list(w) for w in product((1, -1), repeat=2 * n) if sum(w) == 0]


def conv_ud(w, a):
    return ''.join('U' if x == 1 else 'D' for x in w)


# ── lukasiewicz_path carrier (steps in {-1,0,1,2,...}; notation = comma-joined ints) ────────────────────
def lukasiewicz_words(n):
    # length n+1 words: every proper prefix sum >= 0, full sum = -1. A step above n is never useful (n+1
    # steps summing to -1 can't need a rise bigger than n), so bounding the alphabet at n is safe and keeps
    # the brute force finite.
    out = []
    for w in product(range(-1, n + 1), repeat=n + 1):
        s, ok = 0, True
        for i, x in enumerate(w):
            s += x
            if i < n and s < 0:
                ok = False
                break
        if ok and s == -1:
            out.append(list(w))
    return out


def conv_luka(w, a):
    return ','.join(str(x) for x in w)


# ── delannoy_path carrier (steps 0=E,1=N,2=D; notation E/N/D) ───────────────────────────────────────────
def delannoy_words(n):
    # king-move paths (0,0) -> (n,n): E advances x, N advances y, D advances both
    results = []

    def rec(path, x, y):
        if x == n and y == n:
            results.append(list(path))
            return
        if x < n:
            path.append(0); rec(path, x + 1, y); path.pop()
        if y < n:
            path.append(1); rec(path, x, y + 1); path.pop()
        if x < n and y < n:
            path.append(2); rec(path, x + 1, y + 1); path.pop()

    rec([], 0, 0)
    return results


def conv_delannoy(w, a):
    return ''.join({0: 'E', 1: 'N', 2: 'D'}[x] for x in w)


# ── schroeder_path carrier (steps 1=U,-1=D,0=F width-2; notation U/D/F) ─────────────────────────────────
def schroeder_words(n):
    # large Schroeder: U=(1,1), D=(1,-1), F=(2,0), never below the x-axis, total x-width 2n
    results = []

    def rec(path, h, x):
        if x == 2 * n and h == 0:
            results.append(list(path))
            return
        if x >= 2 * n:
            return
        if x + 1 <= 2 * n:
            path.append(1); rec(path, h + 1, x + 1); path.pop()
            if h - 1 >= 0:
                path.append(-1); rec(path, h - 1, x + 1); path.pop()
        if x + 2 <= 2 * n:
            path.append(0); rec(path, h, x + 2); path.pop()

    rec([], 0, 0)
    return results


def little_schroeder_words(n):
    # little Schroeder: same steps, but NO flat (F) step while at height 0
    results = []

    def rec(path, h, x):
        if x == 2 * n and h == 0:
            results.append(list(path))
            return
        if x >= 2 * n:
            return
        if x + 1 <= 2 * n:
            path.append(1); rec(path, h + 1, x + 1); path.pop()
            if h - 1 >= 0:
                path.append(-1); rec(path, h - 1, x + 1); path.pop()
        if x + 2 <= 2 * n and h > 0:
            path.append(0); rec(path, h, x + 2); path.pop()

    rec([], 0, 0)
    return results


def little_hills(w):
    # a hill: a U taken from height 0 immediately followed by a D (same shape as has_hill, but counted)
    h, c = 0, 0
    for i, s in enumerate(w):
        if s == 1 and h == 0 and i + 1 < len(w) and w[i + 1] == -1:
            c += 1
        h += s
    return c


def conv_schroeder(w, a):
    return ''.join({1: 'U', -1: 'D', 0: 'F'}[x] for x in w)


def motzkin_peak_count(w):
    return sum(1 for i in range(len(w) - 1) if w[i] == 1 and w[i + 1] == -1)


def riordan_words(n):
    # Motzkin paths with no level (L=0) step sitting at height 0
    out = []
    for w in motzkin_words(n):
        h, ok = 0, True
        for s in w:
            if s == 0 and h == 0:
                ok = False
                break
            h += s
        if ok:
            out.append(w)
    return out


def conv_motzkin(w, a):
    return ''.join({1: 'U', -1: 'D', 0: 'L'}[x] for x in w)


# ── rational_dyck_path carrier (steps 0=E,1=N; notation E/N) ────────────────────────────────────────────
def rational_dyck_words(a, b):
    # (a,b)-Dyck: (0,0) -> (b,a) via unit E/N steps, staying weakly above the diagonal b*y >= a*x
    results = []

    def rec(path, x, y):
        if x == b and y == a:
            results.append(list(path))
            return
        if y < a:
            path.append(1); rec(path, x, y + 1); path.pop()
        if x < b and b * y >= a * (x + 1):
            path.append(0); rec(path, x + 1, y); path.pop()

    rec([], 0, 0)
    return results


def conv_rational_dyck(w, a):
    return ''.join({0: 'E', 1: 'N'}[x] for x in w)


# ── k_ary_tree carrier (preorder 1/0 word; notation = the word itself, no delimiter) ─────────────────────
def _compositions(total, parts):
    # every way to split `total` into `parts` nonnegative summands, order matters (one per child slot)
    if parts == 1:
        yield (total,)
        return
    for i in range(total + 1):
        for rest in _compositions(total - i, parts - 1):
            yield (i,) + rest


def k_ary_words(n, k):
    # a k-ary tree with n internal nodes (each with exactly k children) as its preorder 1(internal)/0(leaf)
    # word: n=0 is the single leaf '0'; otherwise the root's k children share the remaining n-1 internal
    # nodes among them (every composition of n-1 into k parts), each child independently a smaller k-ary tree.
    if n == 0:
        return ['0']
    results = []
    for comp in _compositions(n - 1, k):
        child_word_lists = [k_ary_words(c, k) for c in comp]
        for combo in product(*child_word_lists):
            results.append('1' + ''.join(combo))
    return results


def conv_k_ary(w, a):
    return w


# ── sets, matchings and permutation restrictions (#223) ─────────────────────────────────────────────────
# Real sage parents (Subsets / OrderedSetPartitions / SetPartitions / PerfectMatchings / Permutations with a
# restated pattern predicate) where one exists, else brute force from the definition.


def _bitstring(S, a):
    # boolean_algebra / simplex borrow the subsets carrier verbatim: the indicator bitstring over [n]
    # ('1010' = {1,3} in [4]) — same convention as conv_subsets in oracle_sage.py.
    n = int(a['size'])
    members = set(int(x) for x in S)
    return ''.join('1' if i in members else '0' for i in range(1, n + 1))


def conv_boolean_algebra(S, a):
    return _bitstring(S, a)


def conv_simplex(S, a):
    return _bitstring(S, a)


def signed_subsets_over(n):
    # Independent construction (signed_subsets.sql): every choice of absent/+k/-k per axis k=1..n, coords kept
    # in axis order (already ascending by |value|). A different algorithm from the DB's 5-way recursive unrank.
    from itertools import product
    out = []
    for choices in product([0, 1, -1], repeat=n):
        out.append([sign * (i + 1) for i, sign in enumerate(choices) if sign != 0])
    return out


def conv_signed_subsets(coords, a):
    # signed_subsets.sql notation(): '{' + coords comma-joined + '}' ('{}' = the body). cross_polytope
    # borrows this carrier verbatim (polytope-collections.sql), so shares the converter.
    return '{' + ','.join(str(x) for x in coords) + '}'


def multisets_over(n, k):
    # Independent construction (multisets.sql): every ascending k-length sequence over [n] with repetition —
    # combinations_with_replacement, not the DB's stars-and-bars unrank via subset_unrank_colex.
    from itertools import combinations_with_replacement
    return [list(t) for t in combinations_with_replacement(range(1, n + 1), k)]


def conv_multisets(m, a):
    # multisets.sql notation(): '{' + elements comma-joined + '}'
    return '{' + ','.join(str(x) for x in m) + '}'


def conv_permutahedron(P, a):
    # permutahedron borrows the set_composition carrier verbatim (polytope-collections.sql): comma within a
    # block (ascending), bar between blocks, in composition order — same as conv_set_compositions.
    return '|'.join(','.join(str(e) for e in sorted(int(x) for x in b)) for b in P)


def signed_set_compositions_over(n):
    # Independent construction (signed_set_compositions.sql): every ordered set partition of [n] (sage
    # OrderedSetPartitions) crossed with an independent +/- sign per block. Order within the returned list
    # doesn't matter — the oracle compares SETS.
    from sage.all import OrderedSetPartitions
    from itertools import product
    out = []
    for P in OrderedSetPartitions(n):
        k = len(P)
        for signs in product([1, -1], repeat=k):
            out.append((P, signs))
    return out


def conv_signed_set_compositions(el, a):
    # signed_set_compositions.sql notation(): per block (in composition/label order), sign then comma-joined
    # elements, blocks '|'-joined — e.g. "+1,2|-3".
    P, signs = el
    parts = []
    for block, s in zip(P, signs):
        sign_ch = '+' if s == 1 else '-'
        parts.append(sign_ch + ','.join(str(int(x)) for x in sorted(int(y) for y in block)))
    return '|'.join(parts)


def is_non_crossing(m):
    # non_crossing_matchings.sql predicate, restated directly from the definition (not transcribed from the
    # SQL): no two pairs (a,b),(c,d) with a<c<b<d.
    pairs = [tuple(sorted((int(x), int(y)))) for x, y in m]
    for i, (a1, b1) in enumerate(pairs):
        for j, (c1, d1) in enumerate(pairs):
            if i != j and a1 < c1 < b1 < d1:
                return False
    return True


def ndpf_over(n):
    # Independent construction (non_decreasing_parking_functions.sql): every weakly-increasing sequence
    # a_1<=...<=a_n with a_i <= i — brute force over [1,n]^n, not the DB's dyck-path-transported unrank.
    from itertools import product
    out = []
    for seq in product(range(1, n + 1), repeat=n):
        if all(seq[i] <= seq[i + 1] for i in range(n - 1)) and all(seq[i] <= i + 1 for i in range(n)):
            out.append(list(seq))
    return out


def conv_partition_algebra(P, a):
    return _rgs(P, a['size'])


def conv_set_partitions_into_k_blocks(P, a):
    return _rgs(P, a['size'])


def is_boolean_perm(s):
    # boolean_permutations.sql predicate, restated from the definition: no NON-ADJACENT inversion — for all
    # i<j (0-based) with j-i>=2, s[i] < s[j].
    n = len(s)
    for i in range(n):
        for j in range(i + 2, n):
            if s[i] > s[j]:
                return False
    return True


# ── tableaux, dissections and polytope faces (#223) ─────────────────────────────────────────────────────
# Sage's own StandardTableaux(shape) / StandardSkewTableaux / PlanePartitions / RSK where they fit; the
# dissection families are generated as independent sets of the diagonal crossing graph.


# ── shared tableau row-notation (matches conv_standard_tableaux in oracle_sage.py: rows comma-joined,
# rows slash-separated — a sage Tableau/StandardTableau iterates its rows top-to-bottom) ────────────────
def _rows_notation(t):
    return '/'.join(','.join(str(int(v)) for v in row) for row in t)


def conv_syt_hook_shape(t, a):
    return _rows_notation(t)


def conv_syt_two_row(t, a):
    return _rows_notation(t)


def conv_syt_two_column(t, a):
    return _rows_notation(t)


def hook_shapes(n):
    # hook shapes (a, 1^b) with a+b = n, a >= 1 (b = 0 allowed: the single row); a different construction
    # from the DB's row-word restriction predicate — this builds shapes directly from the hook definition.
    return [[a] + [1] * (n - a) for a in range(1, n + 1)] if n > 0 else [[]]


def two_row_shapes(n):
    # shapes (a,b) with a >= b >= 0, a+b = n — at most 2 rows
    return [[n - k, k] if k > 0 else [n] for k in range(0, n // 2 + 1)] if n > 0 else [[]]


def two_column_shapes(n):
    # conjugate family: shapes with every part <= 2, i.e. k pairs then a leftover column of 1s
    return [[2] * k + [1] * (n - 2 * k) for k in range(0, n // 2 + 1)] if n > 0 else [[]]


def standard_tableaux_of_shapes(shapes):
    out = []
    for shape in shapes:
        shape = [x for x in shape if x > 0]
        out.extend(StandardTableaux(shape) if shape else StandardTableaux([]))
    return out


# ── shifted standard tableaux: strict partitions -> shifted diagram -> standard fillings, all by direct
# backtracking (independent of the DB's ballot-word floor — no shared code) ──────────────────────────────
def strict_partitions(n):
    # parts strictly decreasing, each >= 1, summing to n
    out = []

    def rec(remaining, max_part, parts):
        if remaining == 0:
            out.append(list(parts))
            return
        for p in range(min(max_part, remaining), 0, -1):
            parts.append(p)
            rec(remaining - p, p - 1, parts)
            parts.pop()

    rec(n, n, [])
    return out


def shifted_cells(shape):
    # row i (0-based) occupies columns i..i+shape[i]-1 — one row of cells per row, right-shifted each time
    return [[(i, i + k) for k in range(shape[i])] for i in range(len(shape))]


def standard_fillings_of_cells(flat):
    # backtracking: place 1..n one at a time into any open cell whose left and upper neighbours (if in the
    # shape) are already filled. Independent brute force — a different technique from the DB's ballot word.
    n = len(flat)
    pos = {c: idx for idx, c in enumerate(flat)}
    filled = [None] * n
    out = []

    def ready(c):
        i, j = c
        left = (i, j - 1)
        up = (i - 1, j)
        if left in pos and filled[pos[left]] is None:
            return False
        if up in pos and filled[pos[up]] is None:
            return False
        return True

    def rec(k):
        if k == n + 1:
            out.append(list(filled))
            return
        for c in flat:
            idx = pos[c]
            if filled[idx] is None and ready(c):
                filled[idx] = k
                rec(k + 1)
                filled[idx] = None

    rec(1)
    return out


def shifted_standard_tableaux_of(n):
    # each result: a list of rows (row i = the row-i entries, ascending) — same shape _rows_notation expects
    out = []
    for shape in strict_partitions(n):
        cells = shifted_cells(shape)
        flat = [c for row in cells for c in row]
        for filling in standard_fillings_of_cells(flat):
            row_vals = {}
            for c, v in zip(flat, filling):
                row_vals.setdefault(c[0], []).append(v)
            out.append([sorted(row_vals[i]) for i in range(len(shape))])
    return out


def conv_shifted_standard_tableaux(rows, a):
    return _rows_notation(rows)


# ── skew standard tableaux: sage's own StandardSkewTableaux(n) — a real Sage class, independent of our
# ballot-word floor. Render pads each row's skipped (mu-offset) cells with '.', matching the DB's
# notation() for skew_tableau: a comma list per row where the leading mu[r] tokens are '.' and the rest are
# the (ascending) entries, rows slash-separated ──────────────────────────────────────────────────────────
def conv_skew_standard_tableaux(t, a):
    return '/'.join(','.join('.' if x is None else str(int(x)) for x in row) for row in t)


# ── standard tableau pairs: the RSK codomain. Render "(P ; Q)" with each side in the standard_tableaux row
# notation — matches the DB's own worked example: notation(perm_rsk(2413)) = "(1,3/2,4 ; 1,2/3,4)" ────────
def rsk_pairs(n):
    return [RSK(p) for p in Permutations(n)]


def conv_standard_tableau_pairs(pq, a):
    P, Q = pq
    return '(' + _rows_notation(P) + ' ; ' + _rows_notation(Q) + ')'


# ── boxed plane partitions: shares the plane_partition carrier/render with plane_partitions (rows
# comma-joined, rows slash-separated) — same convention already verified for the size-graded collection ──
def conv_boxed_plane_partitions(pp, a):
    return '/'.join(','.join(str(int(v)) for v in row) for row in pp)


# ── dissections / associahedron / cyclohedron: all share the `dissection` carrier and its notation() —
# "i-j" per diagonal (0-based polygon vertices), comma-joined in code order (c = i*m+j, so already sorted
# since we only ever extend chosen diagonals in increasing (i,j) order), "{}" for the empty face. Generated
# by plain backtracking over the crossing-graph independent sets — a different technique from the DB's
# per-diagonal binary-choice recursive CTE, but the same "non-crossing subset" definition ─────────────────
def polygon_diagonals(m):
    return sorted((i, j) for i in range(m) for j in range(i + 1, m)
                  if j - i >= 2 and not (i == 0 and j == m - 1))


def _cross(d1, d2):
    a, b = d1
    c, d = d2
    return (a < c < b < d) or (c < a < d < b)


def all_dissections(m):
    diags = polygon_diagonals(m)
    n = len(diags)
    chosen = []
    out = []

    def backtrack(idx):
        out.append(list(chosen))
        for k in range(idx, n):
            d = diags[k]
            if all(not _cross(d, e) for e in chosen):
                chosen.append(d)
                backtrack(k + 1)
                chosen.pop()

    backtrack(0)
    return out


def _rotate_diag(d, m):
    i, j = d
    a, b = (i + m // 2) % m, (j + m // 2) % m
    return (min(a, b), max(a, b))


def cyclohedron_faces(n):
    # centrally symmetric dissections of the (2n+2)-gon (Simion's model of W_n's faces)
    m = 2 * n + 2
    out = []
    for d in all_dissections(m):
        if set(_rotate_diag(x, m) for x in d) == set(d):
            out.append(d)
    return out


def _dissection_notation(diags):
    if not diags:
        return '{}'
    return ','.join('%d-%d' % (i, j) for i, j in diags)


def conv_associahedron(d, a):
    return _dissection_notation(d)


def conv_cyclohedron(d, a):
    return _dissection_notation(d)


def conv_dissections(d, a):
    return _dissection_notation(d)


# ── trees and graphs (#223) ─────────────────────────────────────────────────────────────────────────────
# Real sage classes (RootedTrees / graphs.trees / BinaryTrees / Graph.is_connected) where they exist; the
# code-carried families (Prüfer, recursive-tree parent words, phylogenetic codes) enumerate their code space.


# ── prufer_sequences: words of length n-2 over {1..n} (the Prüfer code space itself); n<=2 -> the one empty code.
# Same render as labeled_trees (a notation sibling over the identical carrier): "(a,b,...)".
def prufer_words(n):
    if n <= 2:
        return [()]
    return list(itertools.product(range(1, n + 1), repeat=n - 2))


def conv_prufer_sequences(code, a):
    return '(' + ','.join(str(int(x)) for x in code) + ')'


# ── recursive_trees: parent(i) in {1,...,i-1} for i=2..n, parent(1)=0 (root sentinel) — every choice independent,
# so this is the direct Cartesian product of choices, prefixed with the sentinel. (n-1)! total.
def recursive_trees_over(n):
    if n <= 0:
        return [[]]
    if n == 1:
        return [[0]]
    ranges = [range(1, i) for i in range(2, n + 1)]
    return [[0] + list(combo) for combo in itertools.product(*ranges)]


def conv_recursive_trees(parent, a):
    return '(' + ','.join(str(int(x)) for x in parent) + ')'


# ── rooted_unlabeled_trees: rooted trees on n unlabeled nodes up to isomorphism (A000081), rendered as a
# DFS-preorder depth sequence, root depth 0, canonical children order = sorted so each (already-canonical, then
# +1-shifted) child sequence is NON-INCREASING under plain list comparison (Python's default list ordering is
# already elementwise with shorter-is-smaller-on-a-prefix, exactly the comparison rule the SQL specifies — no
# special comparator needed). Sage's RootedTrees(n) is the independent generator (nauty-free, its own dedup by
# isomorphism); we only supply OUR OWN canonicalization of each shape, from the spec, not from the plpgsql code.
def _rut_canon(t):
    children = list(t)
    if not children:
        return [0]
    shifted = sorted(([x + 1 for x in _rut_canon(c)] for c in children), reverse=True)
    out = [0]
    for s in shifted:
        out += s
    return out


def rooted_unlabeled_trees_over(n):
    return [_rut_canon(t) for t in RootedTrees(n)]


def conv_rooted_unlabeled_trees(levels, a):
    return ','.join(str(int(x)) for x in levels)


# ── unlabeled_free_trees: free (unrooted) trees on n unlabeled nodes (A000055), canonically rooted at the
# centroid (ties broken by keeping the lexicographically smaller of the two centroid-rootings' encodings — a
# bicentroid only ever has 2, adjacent, centroids). Sage's graphs.trees(n) is the independent generator (a
# different code path than our rooted-tree-dedup floor entirely); centroid-finding + the same canonical child
# order as rooted_unlabeled_trees are the only pieces we re-derive, from the spec.
def _fte_canon_rooted(adj, v, parent):
    children = [u for u in adj[v] if u != parent]
    if not children:
        return [0]
    shifted = sorted(([x + 1 for x in _fte_canon_rooted(adj, c, v)] for c in children), reverse=True)
    out = [0]
    for s in shifted:
        out += s
    return out


def _free_tree_canonical(g):
    adj = {v: list(g.neighbors(v)) for v in g.vertices()}
    n = g.order()
    if n == 1:
        return [0]
    root0 = g.vertices()[0]
    parent = {root0: None}
    order = [root0]
    stack = [root0]
    seen = {root0}
    while stack:
        u = stack.pop()
        for w in adj[u]:
            if w not in seen:
                seen.add(w)
                parent[w] = u
                order.append(w)
                stack.append(w)
    subtree_size = {v: 1 for v in order}
    for u in reversed(order):
        if parent[u] is not None:
            subtree_size[parent[u]] += subtree_size[u]
    max_branch = {}
    for u in order:
        branch = (n - subtree_size[u]) if parent[u] is not None else 0
        for w in adj[u]:
            if parent.get(w) == u:
                branch = max(branch, subtree_size[w])
        max_branch[u] = branch
    minb = min(max_branch.values())
    centroids = [u for u in order if max_branch[u] == minb]
    cands = [_fte_canon_rooted(adj, c, None) for c in centroids]
    return min(cands) if len(cands) > 1 else cands[0]


def unlabeled_free_trees_over(n):
    return [_free_tree_canonical(t) for t in graphs.trees(n)]


def conv_unlabeled_free_trees(levels, a):
    return ','.join(str(int(x)) for x in levels)


# ── non_crossing_trees: spanning trees on n+1 circle-labeled vertices {0..n} with pairwise non-crossing chords
# (no a<c<b<d). Brute force over every n-subset of the C(n+1,2) possible chords, filtered by the crossing test and
# a union-find tree check (n edges on n+1 vertices, connected <=> acyclic).
def non_crossing_trees_over(n):
    verts = list(range(n + 1))
    all_edges = list(itertools.combinations(verts, 2))
    out = []
    for edges in itertools.combinations(all_edges, n):
        ok = True
        for i in range(n):
            a, b = edges[i]
            for j in range(i + 1, n):
                c, d = edges[j]
                if (a < c < b < d) or (c < a < d < b):
                    ok = False
                    break
            if not ok:
                break
        if not ok:
            continue
        parent = list(range(n + 1))

        def find(x):
            while parent[x] != x:
                x = parent[x]
            return x

        valid = True
        for a, b in edges:
            ra, rb = find(a), find(b)
            if ra == rb:
                valid = False
                break
            parent[ra] = rb
        if valid:
            out.append(edges)
    return out


def conv_non_crossing_trees(edges, a):
    return '-'.join('%d%d' % (e[0], e[1]) for e in sorted(edges))


# ── increasing_binary_trees: binary trees (left/right, either optional) on n labeled nodes, heap-ordered (every
# child's label exceeds its parent's); n! total. Brute force independent of the specific label-splitting
# bijection: take every Sage BinaryTrees(n) SHAPE, assign each shape's nodes fixed structural (preorder) ids, then
# try every one of the n! ways to assign labels 1..n to those ids and keep only the heap-valid assignments — the
# n! surviving (shape, labeling) pairs across all Catalan(n) shapes are exactly the increasing binary trees.
def _ibt_structure(shape):
    edges = {}
    counter = [0]

    def visit(node):
        counter[0] += 1
        my_id = counter[0]
        left, right = list(node)
        left_id = right_id = 0
        if not left.is_empty():
            left_id = visit(left)
        if not right.is_empty():
            right_id = visit(right)
        edges[my_id] = (left_id, right_id)
        return my_id

    root_id = visit(shape)
    return root_id, edges


def increasing_binary_trees_over(n):
    if n == 0:
        return [(0, (), ())]
    out = []
    for shape in BinaryTrees(n):
        root_id, edges = _ibt_structure(shape)
        for perm in itertools.permutations(range(1, n + 1)):
            label = {sid + 1: perm[sid] for sid in range(n)}
            ok = True
            for sid, (lid, rid) in edges.items():
                if (lid and label[lid] <= label[sid]) or (rid and label[rid] <= label[sid]):
                    ok = False
                    break
            if not ok:
                continue
            left_arr = [0] * (n + 1)
            right_arr = [0] * (n + 1)
            for sid, (lid, rid) in edges.items():
                left_arr[label[sid]] = label[lid] if lid else 0
                right_arr[label[sid]] = label[rid] if rid else 0
            out.append((label[root_id], tuple(left_arr[1:]), tuple(right_arr[1:])))
    return out


def conv_increasing_binary_trees(t, a):
    root, left, right = t
    return 'root=%d L=(%s) R=(%s)' % (root, ','.join(map(str, left)), ','.join(map(str, right)))


# ── phylogenetic_trees: rooted binary trees on n labeled leaves, unlabeled internal nodes; (2n-3)!! of them. The
# carrier IS a mixed-radix odometer with NO validity constraint beyond each digit's range (s_k in [0, 2k-4] for
# k=3..n) — so the reference is simply the full box product, independent of any tree-insertion semantics.
def phylogenetic_words(n):
    if n <= 2:
        return [()]
    return list(itertools.product(*[range(2 * k - 3) for k in range(3, n + 1)]))


def conv_phylogenetic_trees(seq, a):
    return '.'.join(str(int(x)) for x in seq)


# ── total_partitions: Schröder's fourth problem — total bracketings of a ROW of n items. Recursive definition,
# built top-down from integer compositions (a completely different construction from the SQL's token-stream DP):
# a bracketing of n>=2 items is an ordered composition of n into k>=2 parts, each part either a bare item (part=1)
# or itself a fully-bracketed sub-partition of that many items (recursively, same rule); n=1 is the trivial single
# item, unbracketed.
def _positive_compositions(n):
    if n == 0:
        yield ()
        return
    for bits in itertools.product((0, 1), repeat=n - 1):
        parts, cur = [], 1
        for b in bits:
            if b == 0:
                cur += 1
            else:
                parts.append(cur)
                cur = 1
        parts.append(cur)
        yield tuple(parts)


def _block_trees(n):
    if n == 1:
        return ['LEAF']
    out = []
    for parts in _positive_compositions(n):
        if len(parts) < 2:
            continue
        options = [(['LEAF'] if p == 1 else _block_trees(p)) for p in parts]
        for combo in itertools.product(*options):
            out.append(list(combo))
    return out


def total_partitions_over(n):
    return _block_trees(n)


def conv_total_partitions(root, a):
    counter = [0]

    def next_letter():
        counter[0] += 1
        return chr(96 + counter[0])

    def render(x):
        if x == 'LEAF':
            return next_letter()
        return '(' + ''.join(render(c) for c in x) + ')'

    if root == 'LEAF':
        return next_letter()
    return ''.join(render(c) for c in root)


# ── labeled_graphs / labeled_graphs_by_edges: an indicator bit over the C(n,2) possible edges, with NO structural
# constraint (labeled_graphs = the full edge-powerset; labeled_graphs_by_edges = the exactly-m-edges slice). The
# render digit at each position is a featureless '0'/'1' — since EVERY subset (of the right size) occurs, the SET
# of rendered strings is exactly "every length-M binary string" (resp. "every length-M string with popcount m"),
# regardless of which edge any given bit happens to represent — so no edge-numbering scheme needs to be known.
def labeled_graphs_over(n):
    m = n * (n - 1) // 2
    return [''.join(bits) for bits in itertools.product('01', repeat=m)]


def conv_labeled_graphs(s, a):
    return s


def labeled_graphs_by_edges_over(n, k):
    m = n * (n - 1) // 2
    out = []
    for positions in itertools.combinations(range(m), k):
        bits = ['0'] * m
        for p in positions:
            bits[p] = '1'
        out.append(''.join(bits))
    return out


def conv_labeled_graphs_by_edges(s, a):
    return s


# ── connected_labeled_graphs / tournaments: here the render DOES depend on which vertex-pair a bit represents (a
# comma-joined "i→j" list, or genuine connectivity), so both need the actual edge<->position map. That map is the
# standard combinatorial-number-system colex order for 2-subsets of [n] — a universal, textbook numbering (not
# something borrowed from our SQL): sort pairs (i,j), i<j, by (j,i) ascending, i.e. group by larger endpoint.
def graph_edge_pairs(n):
    return [(i, j) for j in range(2, n + 1) for i in range(1, j)]


def connected_labeled_graphs_over(n):
    pairs = graph_edge_pairs(n)
    m = len(pairs)
    out = []
    for bits in itertools.product([0, 1], repeat=m):
        edges = [pairs[i] for i in range(m) if bits[i]]
        G = Graph([list(range(1, n + 1)), edges], format='vertices_and_edges')
        if n > 0 and G.is_connected():   # Sage's own connectivity check — independent of our union-find
            out.append(''.join(str(b) for b in bits))
    return out


def conv_connected_labeled_graphs(s, a):
    return s


def tournaments_over(n):
    pairs = graph_edge_pairs(n)
    m = len(pairs)
    out = []
    for bits in itertools.product([0, 1], repeat=m):
        parts = []
        for idx, (i, j) in enumerate(pairs):
            parts.append('%d→%d' % (j, i) if bits[idx] else '%d→%d' % (i, j))
        out.append(','.join(parts))
    return out


def conv_tournaments(s, a):
    return s


# ── number-theoretic and misc (#223) ────────────────────────────────────────────────────────────────────
# The defining predicate, recomputed — never the stored terms: fibonacci_primes sweeps the Fibonacci sequence
# under is_prime, idoneal_numbers tests one-class-per-genus over BinaryQF_reduced_representatives.
#
# DROPPED: giuga_numbers. The collection's floor is the complete literal 7-term seed (up to ~4.3e14); an honest
# independent case would need to sweep every n up to that bound testing the Giuga predicate p | (n/p−1) for every
# prime p | n — infeasible in oracle time. A bounded sweep only recovers a subset (30,858,1722,66198 below 10^6)
# and would never set-equal the full collection, so it's dropped rather than faked.


# ── farey_sequences(n): reduced p/q, 0<=p<=q<=n — the definition, directly ──────────────────────────────────
def farey_set(n):
    return [QQ(p) / QQ(q) for q in range(1, n + 1) for p in range(0, q + 1) if gcd(p, q) == 1]


def conv_farey_sequences(x, a):
    return str(x)   # sage's Rational str: integers print bare ("0","1"), else "p/q" — matches pure's notation


# ── continued_fractions(q): the CF expansion of every reduced p/q, 1<=p<=q — sage's own continued_fraction_list ──
def continued_fractions_set(q):
    return [continued_fraction_list(QQ(p) / QQ(q)) for p in range(1, q + 1) if gcd(p, q) == 1]


def conv_continued_fractions(cf, a):
    # pure's canonical: '[a0;a1,a2,...]', no ';' when there's only one term
    terms = list(cf)
    return '[' + str(int(terms[0])) + (';' + ','.join(str(int(t)) for t in terms[1:]) if len(terms) > 1 else '') + ']'


# ── sums_of_two_squares(n): n = a^2+b^2, 0<=a<=b — brute-force isqrt search from the definition ──────────────
def sums_two_squares_set(n):
    out = []
    for a in range(0, isqrt(n // 2) + 1):
        b2 = n - a * a
        b = isqrt(b2)
        if b * b == b2 and b >= a:
            out.append((a, b))
    return out


def conv_sums_of_two_squares(v, a):
    # pure's gaussian_integer notation, restricted to re>=0, im>=0 (the only case this collection's carrier hits)
    re, im = v
    if im == 0:
        return str(re)
    if re == 0:
        return 'i' if im == 1 else f'{im}i'
    return str(re) + ('+i' if im == 1 else f'+{im}i')


# ── pythagorean_triples(hypotenuse): a^2+b^2=c^2, 0<a<b<c — brute-force from the definition ───────────────────
def pythagorean_triples_set(c):
    out = []
    for a in range(1, c):
        b2 = c * c - a * a
        if b2 <= 0:
            continue
        b = isqrt(b2)
        if b * b == b2 and b > a and b < c:
            out.append((a, b, c))
    return out


def conv_pythagorean_triples(t, a):
    x, y, z = t
    return f'({x},{y},{z})'


# ── collatz_trajectories(n): direct simulation of the 3n+1 map, a singleton fiber ────────────────────────────
def collatz_traj(n):
    seq = [n]
    v = n
    while v != 1:
        v = v // 2 if v % 2 == 0 else 3 * v + 1
        seq.append(v)
    return seq


def conv_collatz_trajectories(t, a):
    return '→'.join(str(int(x)) for x in t)


# ── fibonacci_primes: A005478 recomputed — sweep Fibonacci numbers up to MAX_SAFE_INTEGER, keep the primes ───
def fibonacci_primes_set():
    limit = 2 ** 53
    out = []
    i = 0
    while True:
        f = fibonacci(i)
        if f > limit:
            break
        if is_prime(f):
            out.append(f)
        i += 1
    return out


def conv_fibonacci_primes(v, a):
    return str(int(v))


# ── idoneal_numbers: Euler's numeri idonei, recomputed via the genus criterion — every class of discriminant
# -4n is AMBIGUOUS (self-inverse), which for REDUCED forms (a,b,c) is the purely syntactic test b=0 or a=b or
# a=c (a classical fact: ambiguous classes biject with genera, so "one class per genus" <=> "every reduced form
# is ambiguous"). Computed via sage's own BinaryQF_reduced_representatives — no composition/class-group needed,
# and nothing here restates Euler's literal list. Verified (outside this file) to reproduce all 65 known terms
# exactly for n up to 2000, with none extra.
def is_idoneal(n):
    if n < 1:
        return False
    D = -4 * n
    for f in BinaryQF_reduced_representatives(D, primitive_only=True):
        a, b, c = f[0], f[1], f[2]
        if not (b == 0 or a == b or a == c):
            return False
    return True


def idoneal_numbers_set(bound):
    return [n for n in range(1, bound + 1) if is_idoneal(n)]


def conv_idoneal_numbers(v, a):
    return str(int(v))


# ── egyptian_fractions(k): k distinct unit-fraction denominators summing to 1 — exact-rational backtracking
# search (Fraction, no floating point), independent of the SQL's bigint-reduction implementation. The bounds
# (next denominator >= ceil(remaining_den/remaining_num), <= count_left*remaining_den/remaining_num) are forced
# by the definition itself (strictly increasing denominators), not a choice borrowed from our engine.
def egypt_search(k):
    results = []

    def rec(remaining, min_next, count_left, chosen):
        if count_left == 0:
            if remaining == 0:
                results.append(tuple(chosen))
            return
        if remaining <= 0:
            return
        lo = max(min_next + 1, -(-remaining.denominator // remaining.numerator))   # ceil(den/num)
        hi = (count_left * remaining.denominator) // remaining.numerator
        for d in range(lo, hi + 1):
            rec(remaining - Fraction(1, d), d, count_left - 1, chosen + [d])

    rec(Fraction(1), 0, k, [])
    return results


def conv_egyptian_fractions(v, a):
    return '+'.join(f'1/{int(d)}' for d in v)


# ── multicomplex_numbers(modulus, level): Cn(Z/M) — every 2^level-coefficient vector over Z/M IS an element (the
# full Cartesian product; no further constraint), so cartesian_product([range(M)]*2^level) enumerates the whole
# fiber directly from the definition. The converter reconstructs pure's balanced-form notation independently.
def mc_notation(coeffs, m):
    out = ''
    first = True
    for i, c0 in enumerate(coeffs, start=1):
        c = c0 % m
        if c == 0:
            continue
        bal = c - m if c > m // 2 else c
        mag = abs(bal)
        unit = '' if i == 1 else f'j{i - 1}'
        body = str(mag) if i == 1 else (unit if mag == 1 else f'{mag}{unit}')
        if first:
            out = ('-' if bal < 0 else '') + body
            first = False
        else:
            out += (' - ' if bal < 0 else ' + ') + body
    return out if not first else '0'


def conv_multicomplex_numbers(v, a):
    return mc_notation(list(v), int(a['modulus']))


# ── singleton_species(n): the atomic species X — one structure (the atom on the 1-element label set) at n=1,
# none elsewhere. No sage class needed; the definition IS the enumeration.
def conv_singleton_species(v, a):
    return 'X[{' + str(int(v)) + '}]'


# ── affine_permutations(n, radius): window a_i = u(i) + n*c_i, u a permutation of [n], c an integer vector with
# |c_i|<=radius and sum(c)=0 — brute force over the definition (every (u,c) pair), independent of the DP unrank.
def affine_perms_set(n, r):
    from itertools import permutations, product
    cs = [c for c in product(range(-r, r + 1), repeat=n) if sum(c) == 0]
    out = []
    for u in permutations(range(1, n + 1)):
        for c in cs:
            out.append(tuple(u[i] + n * c[i] for i in range(n)))
    return out


def conv_affine_permutations(w, a):
    return '[' + ','.join(str(int(x)) for x in w) + ']'


CONV = {
    # number-theoretic and misc (#223)
    'farey_sequences': conv_farey_sequences,
    'continued_fractions': conv_continued_fractions,
    'sums_of_two_squares': conv_sums_of_two_squares,
    'pythagorean_triples': conv_pythagorean_triples,
    'collatz_trajectories': conv_collatz_trajectories,
    'fibonacci_primes': conv_fibonacci_primes,
    'idoneal_numbers': conv_idoneal_numbers,
    'egyptian_fractions': conv_egyptian_fractions,
    'multicomplex_numbers': conv_multicomplex_numbers,
    'singleton_species': conv_singleton_species,
    'affine_permutations': conv_affine_permutations,
    # trees and graphs (#223)
    'prufer_sequences': conv_prufer_sequences,
    'recursive_trees': conv_recursive_trees,
    'rooted_unlabeled_trees': conv_rooted_unlabeled_trees,
    'unlabeled_free_trees': conv_unlabeled_free_trees,
    'non_crossing_trees': conv_non_crossing_trees,
    'increasing_binary_trees': conv_increasing_binary_trees,
    'phylogenetic_trees': conv_phylogenetic_trees,
    'total_partitions': conv_total_partitions,
    'labeled_graphs': conv_labeled_graphs,
    'labeled_graphs_by_edges': conv_labeled_graphs_by_edges,
    'connected_labeled_graphs': conv_connected_labeled_graphs,
    'tournaments': conv_tournaments,
    # tableaux, dissections and polytope faces (#223)
    'syt_hook_shape': conv_syt_hook_shape,
    'syt_two_row': conv_syt_two_row,
    'syt_two_column': conv_syt_two_column,
    'shifted_standard_tableaux': conv_shifted_standard_tableaux,
    'skew_standard_tableaux': conv_skew_standard_tableaux,
    'standard_tableau_pairs': conv_standard_tableau_pairs,
    'boxed_plane_partitions': conv_boxed_plane_partitions,
    'associahedron': conv_associahedron,
    'cyclohedron': conv_cyclohedron,
    'dissections': conv_dissections,
    # sets, matchings and permutation restrictions (#223)
    'boolean_algebra': conv_boolean_algebra,
    'simplex': conv_simplex,
    'signed_subsets': conv_signed_subsets,
    'cross_polytope': conv_signed_subsets,
    'multisets': conv_multisets,
    'permutahedron': conv_permutahedron,
    'signed_set_compositions': conv_signed_set_compositions,
    'non_crossing_matchings': conv_perfect_matchings,
    'non_decreasing_parking_functions': conv_parking_functions,
    'partition_algebra': conv_partition_algebra,
    'set_partitions_into_k_blocks': conv_set_partitions_into_k_blocks,
    'boolean_permutations': conv_permutations,
    'smooth_permutations': conv_permutations,
    'k_inversion_permutations': conv_permutations,
    # lattice paths (#223)
    'ballot_sequences': conv_ud,
    'dyck_paths_by_height': conv_ud,
    'fine_paths': conv_ud,
    'grand_dyck_paths': conv_ud,
    'narayana_numbers': conv_ud,
    'lukasiewicz_paths': conv_luka,
    'delannoy_paths': conv_delannoy,
    'schroeder_paths': conv_schroeder,
    'schroeder_triangle': conv_schroeder,
    'little_schroder_triangle': conv_schroeder,
    'motzkin_paths_by_peaks': conv_motzkin,
    'riordan_paths': conv_motzkin,
    'rational_dyck_paths': conv_rational_dyck,
    'k_ary_trees': conv_k_ary,
    # words and strings (#223)
    'binary_words_by_weight': conv_binary_words,
    'fib_strings': conv_binary_words,
    'lucas_strings': conv_binary_words,
    'tri_strings': conv_binary_words,
    'calkin_wilf_paths': conv_binary_words,
    'stern_brocot_paths': conv_binary_words,
    'ternary_gray_codes': conv_ternary_words,
    'hyperbinary_representations': conv_hyperbinary,
    'hypernumerary': conv_hyperbinary,   # same widened-numeral carrier, one base up
    'ascent_sequences': conv_ascent_sequences,
    # compositions, partitions and factorizations (#223)
    'fibonacci_compositions': conv_integer_compositions,
    'step_compositions': conv_integer_compositions,
    'tri_compositions': conv_integer_compositions,
    'tetra_compositions': conv_integer_compositions,
    'dyadic_compositions': conv_integer_compositions,
    'prime_compositions': conv_integer_compositions,
    'triangular_composition': conv_integer_compositions,
    'zigzag_composition': conv_integer_compositions,
    'k_bounded_compositions': conv_integer_compositions,
    'weak3_compositions': conv_integer_compositions,
    'prime_partition': conv_integer_partitions,
    'square_partitions': conv_integer_partitions,
    'triangular_partitions': conv_integer_partitions,
    'largest_part_partitions': conv_integer_partitions,
    'multiplicative_partitions': conv_factorization,
    'ordered_factorizations': conv_factorization,
    'goldbach_partitions': conv_goldbach_partitions,
    'permutations': conv_permutations,
    'plane_trees': conv_plane_trees,
    'labeled_forests': conv_labeled_forests,
    'rook_placements': conv_rook_placements,
    'k_motzkin_paths': conv_k_motzkin_paths,
    'colored_motzkin_paths': conv_colored_motzkin_paths,
    'non_crossing_partitions': conv_set_partitions,   # restriction over the set_partition carrier (RGS render)
    'non_nesting_partitions': conv_set_partitions,
    'perfect_matchings': conv_perfect_matchings,
    'subexcedant_seqs': conv_subexcedant_seqs,
    'non_nesting_matchings': conv_perfect_matchings,
    'derangements': conv_permutations,        # restriction collections over the permutation carrier (one-line render)
    'alternating_permutations': conv_permutations,
    'grassmannian_permutations': conv_permutations,
    'cograssmannian_permutations': conv_permutations,
    'connected_permutations': conv_permutations,
    'permutations_avoiding_123': conv_permutations, 'permutations_avoiding_132': conv_permutations,
    'permutations_avoiding_213': conv_permutations, 'permutations_avoiding_231': conv_permutations,
    'permutations_avoiding_312': conv_permutations, 'permutations_avoiding_321': conv_permutations,
    'vexillary_permutations': conv_permutations, 'separable_permutations': conv_permutations,
    'baxter_permutations': conv_permutations, 'simple_permutations': conv_permutations,
    'non_crossing_permutations': conv_permutations,
    'k_cycle_permutations': conv_permutations, 'k_descent_permutations': conv_permutations,
    'k_colored_permutations': conv_k_colored_permutations,
    'involutions': conv_permutations,
    'binary_palindromes': conv_binary_words,
    'primitive_binary_strings': conv_binary_words,
    'lyndon_words': conv_binary_words,
    'independent_sets_cycle': conv_binary_words,
    'binary_necklaces': conv_binary_words,
    'binary_bracelets': conv_binary_words,
    'k_necklaces': conv_words, 'k_bracelets': conv_words, 'k_lyndon_words': conv_words,
    'k_dyck_paths': conv_k_dyck_paths,
    'even_permutations': conv_permutations,
    'cyclic_permutations': conv_permutations,
    'compositions_into_k_parts': conv_integer_compositions,   # (n,k) over the composition carrier
    'k_part_partitions': conv_integer_partitions,             # (n,k) over the integer_partition carrier
    'bounded_part_partitions': conv_integer_partitions,
    'box_confined_partitions': conv_integer_partitions,
    'weak_compositions_into_k_parts': conv_weak_compositions_into_k_parts,
    'binary_words': conv_binary_words,
    'gray_codes': conv_binary_words,                          # same 2^n bit-strings, reordered
    'sparse_subsets': conv_binary_words,                      # bit-strings with no two adjacent 1s
    'parking_functions': conv_parking_functions,
    'ordered_trees': conv_ordered_trees,                      # balanced parens = the Dyck-word set
    'signed_permutations': conv_signed_permutations,
    'subsets': conv_subsets,
    'integer_partitions': conv_integer_partitions,
    'integer_compositions': conv_integer_compositions,
    'set_partitions': conv_set_partitions,
    'set_compositions': conv_set_compositions,
    'restricted_growth_strings': conv_restricted_growth_strings,
    'surjections': conv_surjections,
    'surjections_onto_k': conv_surjections,   # same word carrier, (n,k)-graded (OrderedSetPartitions(n,k))
    'finite_sets': conv_subsets,              # same subset carrier, single-graded powerset / (n,k) k-subsets
    'finite_set_elements': conv_finsets,      # renamed from finsets
    'distinct_partitions': conv_integer_partitions,        # restriction collections over the integer_partition carrier
    'odd_partitions': conv_integer_partitions,
    'self_conjugate_partitions': conv_integer_partitions,
    'odd_compositions': conv_integer_compositions,         # restriction collections over the integer_composition carrier
    'palindromic_compositions': conv_integer_compositions,
    'carlitz_compositions': conv_integer_compositions,
    'proper_compositions': conv_integer_compositions,
    'dyck_paths': conv_dyck_paths,
    'motzkin_paths': conv_motzkin_paths,
    'finsets': conv_finsets,
    'words': conv_words,
    'k_subsets': conv_subsets,
    'endofunctions': conv_endofunctions,
    'binary_trees': conv_binary_trees,
    'standard_tableaux': conv_standard_tableaux,
    'skew_partitions': conv_skew_partitions,
    'decorated_permutations': conv_decorated_permutations,
    'plane_partitions': conv_plane_partitions,
    'gelfand_tsetlin': conv_gelfand_tsetlin,
    'core_partitions': conv_core_partitions,
    'semistandard_tableaux': conv_semistandard_tableaux,
    'alternating_sign_matrices': conv_alternating_sign_matrices,
    'lehmer_codes': conv_lehmer_codes,
    'modular_residues': conv_modular_residues,
    'arrangements': conv_arrangements,
    'labeled_trees': conv_labeled_trees,
}

with open(os.path.join(os.path.dirname(__file__), '..', 'cases.yaml')) as f:
    cases = yaml.safe_load(f)

out = []
for c in cases:
    try:
        coll, args, expr = c['collection'], c['args'], c['sage']
        conv = CONV[coll]
        elements = list(eval(expr, globals()))  # noqa: S307 — our own test data, not untrusted input
        serials = [conv(el, args) for el in elements]
        # optional per-element STATISTICS: {our stat id: a sage expression over `el` (the sage element) and `a` (the
        # case args)}. Emitted as {stat id: {serial: value-as-text}} so the TS side can compare per element without
        # depending on enumeration order. Only for cases whose sage side yields native sage objects with the method.
        stats = {}
        for sid, sexpr in (c.get('stats') or {}).items():
            vals = [eval(sexpr, globals(), {'el': el, 'a': args}) for el in elements]  # noqa: S307
            stats[sid] = {s: str(v) for s, v in zip(serials, vals)}
        row = {'card': len(elements), 'elements': serials}
        if stats:
            row['stats'] = stats
        out.append(row)
    except Exception as e:  # keep one bad case from killing the rest; the TS test surfaces it
        out.append({'error': repr(e)})

json.dump(out, sys.stdout)
