# Sage side of the oracle, driven by cases.yaml. For each case, eval its sage expression, enumerate, and
# convert every element into enumeratio's canonical serial format via the per-collection converter. Emit a
# JSON list aligned to the cases file order: {card, elements} or {error}. The TS test zips this against
# what enumeratio-client enumerates for the same {collection, args} and asserts set-equality.
#
# Run under sage's python: `sage --python oracle_sage.py`.
import json, os, sys
import yaml
from sage.all import *  # noqa: F401,F403 — expose all sage names to the eval'd case expressions


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


CONV = {
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
        out.append({'card': len(elements), 'elements': [conv(el, args) for el in elements]})
    except Exception as e:  # keep one bad case from killing the rest; the TS test surfaces it
        out.append({'error': repr(e)})

json.dump(out, sys.stdout)
