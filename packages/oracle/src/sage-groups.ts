// The Sage helpers behind the groupalgebra bindings (`enumeratio_*` in run.ts's Sage preamble).
// A .sage file is preparsed: integers are `Integer`s and `^` is a power, so this stays in `**`
// and converts with `int` before anything is printed or dumped as JSON.

/** Python, `String.raw` so its backslashes and `${` reach Sage untouched. */
export const SAGE_GROUPS = String.raw`
# Our Cycles value: the cycles as written, fixed points dropped.
class _EnumeratioCycles:
    def __init__(self, cycles):
        self.cycles = [[int(p) for p in c] for c in cycles if len(c) > 1]

    def __str__(self):
        return _enumeratio_cycles_json(self.cycles)

    __repr__ = __str__

    def __eq__(self, other):
        return isinstance(other, _EnumeratioCycles) and self.cycles == other.cycles

def enumeratio_cycles(cycles):
    return _EnumeratioCycles(cycles)

# Cycles as MathJSON text, which is how a scan prints ours (Cycles is no carrier name).
def _enumeratio_cycles_json(cycles):
    import json
    return json.dumps(["Cycles", ["List"] + [["List"] + [int(p) for p in c] for c in cycles]])

# Any notation of a permutation as its cycles, singletons dropped: a Cycles value, or a one-line word.
def _enumeratio_cycles_of(x):
    if isinstance(x, _EnumeratioCycles):
        return x.cycles
    return [[int(p) for p in c] for c in Permutation(list(x)).to_cycles(singletons=False)]

# Run f on Sage permutations of the operands, relabeled onto 1..m (the points they move, in order), so a
# point like 10^8 costs nothing; f answers a Sage permutation, which comes back in the operands' notation:
# Cycles if any operand is one, else a one-line word as long as the longest operand.
def _enumeratio_permuted(operands, f, notation=None):
    cycles = [_enumeratio_cycles_of(x) for x in operands]
    points = sorted({p for cs in cycles for c in cs for p in c})
    at = {p: i for i, p in enumerate(points, 1)}
    perms = [Permutation([tuple(at[p] for p in c) for c in cs]) if cs else Permutation([]) for cs in cycles]
    result = f(*perms)
    back = [[points[int(p) - 1] for p in c] for c in result.to_cycles(singletons=False)]
    as_cycles = any(isinstance(x, _EnumeratioCycles) for x in operands) if notation is None else notation == "cycles"
    if as_cycles:
        return _EnumeratioCycles(back)
    n = max([len(x) for x in operands if not isinstance(x, _EnumeratioCycles)] + [0])
    image = {}
    for c in back:
        for j, p in enumerate(c):
            image[p] = c[(j + 1) % len(c)]
    return [image.get(i, i) for i in range(1, n + 1)]

def enumeratio_permutation_product(*factors):
    return _enumeratio_permuted(factors, lambda *ps: prod(ps[1:], ps[0]))

def enumeratio_permutation_power(x, k):
    return _enumeratio_permuted([x], lambda p: p ** int(k))

def enumeratio_inverse_permutation(x):
    return _enumeratio_permuted([x], lambda p: p.inverse())

def enumeratio_permutation_cycles(x):
    return _EnumeratioCycles(_enumeratio_cycles_of(x))

# The images of 1..n (n the largest point moved, unless given).
def enumeratio_permutation_list(x, n=None):
    cycles = _enumeratio_cycles_of(x)
    size = max([p for c in cycles for p in c] + [0]) if n is None else int(n)
    image = {}
    for c in cycles:
        for j, p in enumerate(c):
            image[p] = c[(j + 1) % len(c)]
    return [image.get(i, i) for i in range(1, size + 1)]

# A point or list of points goes through the permutation; a Cycles value is conjugated by it (its points
# renamed), which is p^-1 * c * p when Sage multiplies left to right.
def enumeratio_permutation_replace(x, y):
    p = Permutation([tuple(c) for c in y.cycles]) if y.cycles else Permutation([])
    if isinstance(x, _EnumeratioCycles):
        if not x.cycles:
            return _EnumeratioCycles([])
        points = sorted({q for c in x.cycles + y.cycles for q in c})
        at = {q: i for i, q in enumerate(points, 1)}
        mine = Permutation([tuple(at[q] for q in c) for c in x.cycles])
        theirs = Permutation([tuple(at[q] for q in c) for c in y.cycles])
        back = [[points[int(q) - 1] for q in c] for c in (theirs.inverse() * mine * theirs).to_cycles(singletons=False)]
        return _EnumeratioCycles(back)
    swap = {q: c[(j + 1) % len(c)] for c in y.cycles for j, q in enumerate(c)}
    if isinstance(x, list):
        return [swap.get(int(q), int(q)) for q in x]
    return swap.get(int(x), int(x))

# Sage's Permutation.action puts the entry at position i in position p(i)^-1; Wolfram's Permute moves it to
# position p(i), so it is the inverse that acts. A word shorter than the list moves its first points only.
def _enumeratio_permute_by(x, g):
    word = list(g) if not isinstance(g, _EnumeratioCycles) else enumeratio_permutation_list(g, len(x))
    word = word + list(range(len(word) + 1, len(x) + 1))
    return list(Permutation(word).inverse().action(x))

def enumeratio_permute(x, g):
    if isinstance(g, _EnumeratioGroup):
        return [_enumeratio_permute_by(x, _EnumeratioCycles(_enumeratio_cycle_tuples(e))) for e in _enumeratio_sorted_elements(g.G)]
    return _enumeratio_permute_by(x, g)

# Groups. A group is a Sage permutation group, wrapped with the labels ours gives its elements where it
# has them (Z_n: 0 ... n-1 for the powers of the n-cycle; D_n: k for the k-th power of the rotation and
# sk for the reflection times it; a direct product: a/b).
class _EnumeratioGroup:
    def __init__(self, G, pairs=None):
        self.G = G
        pairs = pairs or []
        self.labels = [l for l, _ in pairs]
        self.elem = dict(pairs)
        self.label = {e: l for l, e in pairs}

    def __eq__(self, other):
        return isinstance(other, _EnumeratioGroup) and self.G == other.G

    def generators(self):
        return [_EnumeratioCycles(_enumeratio_cycle_tuples(g)) for g in self.G.gens()]

    def __str__(self):
        return "[" + ", ".join(str(g) for g in self.generators()) + "]"

def _enumeratio_wrapped(x):
    return x if isinstance(x, _EnumeratioGroup) else _EnumeratioGroup(x)

def _enumeratio_group(x):
    return x.G if isinstance(x, _EnumeratioGroup) else x

def _enumeratio_cycle_tuples(g):
    return [[int(p) for p in c] for c in g.cycle_tuples()]

# Wolfram's order for GroupElements: by the one-line word, lexicographically.
def _enumeratio_sorted_elements(G):
    n = int(G.degree())
    return sorted(G.list(), key=lambda g: [int(g(i)) for i in range(1, n + 1)])

def enumeratio_cyclic(n):
    G = CyclicPermutationGroup(n)
    r = G.gen(0) if n > 1 else G.one()
    return _EnumeratioGroup(G, [(str(k), r ** k) for k in range(n)])

def enumeratio_dihedral(n):
    G = DihedralGroup(n)
    gens = G.gens()
    r, s = (G.one(), gens[0]) if n == 1 else (gens[0], gens[1])
    return _EnumeratioGroup(G, [(str(k), r ** k) for k in range(n)] + [("s" + str(k), s * r ** k) for k in range(n)])

def enumeratio_direct(g, h):
    P, i1, i2, p1, p2 = g.G.direct_product(h.G, maps=True)
    return _EnumeratioGroup(P, [(a + "/" + b, i1(g.elem[a]) * i2(h.elem[b])) for a in g.labels for b in h.labels])

def enumeratio_permutation_group(generators):
    return _EnumeratioGroup(PermutationGroup([[tuple(c) for c in g.cycles] for g in generators if g.cycles]))

def enumeratio_order(g):
    return int(_enumeratio_group(g).order())

def enumeratio_is_abelian(g):
    return bool(_enumeratio_group(g).is_abelian())

def enumeratio_group_algebra(g):
    return _enumeratio_group(g).algebra(QQ)

def enumeratio_centre_dimension(g):
    return len(_enumeratio_group(g).conjugacy_classes_representatives())

# The elements: their Cycles, or for a labelled group a combination apiece, in ours' order. A position list
# picks from the end when negative.
def enumeratio_group_elements(g, positions=None):
    g = _enumeratio_wrapped(g)
    if g.labels:
        items = [{"GroupBasis(" + l + ")": int(1)} for l in g.labels]
    else:
        items = [_EnumeratioCycles(_enumeratio_cycle_tuples(e)) for e in _enumeratio_sorted_elements(g.G)]
    if positions is not None:
        items = [items[int(k) - 1 if k > 0 else int(k)] for k in positions]
    if g.labels:
        import json
        return "combinations:" + json.dumps(items)
    return items

def enumeratio_group_generators(g):
    return _enumeratio_wrapped(g).generators()

# A basis element before it names its group, and a combination of them, printed as the scan reads one.
class _EnumeratioBasis:
    def __init__(self, label, coefficients=None):
        self.coefficients = coefficients if coefficients is not None else {str(label): int(1)}

    def __str__(self):
        import json
        return "combination:" + json.dumps({"GroupBasis(" + l + ")": int(c) for l, c in self.coefficients.items() if c != 0})

def enumeratio_basis(label):
    return _EnumeratioBasis(label)

def _enumeratio_times(g, a, b):
    out = {}
    for l, c in a.coefficients.items():
        for m, d in b.coefficients.items():
            k = g.label[g.elem[l] * g.elem[m]]
            out[k] = int(out.get(k, 0)) + int(c) * int(d)
    return out

def enumeratio_group_product(g, a, b):
    return _EnumeratioBasis(None, _enumeratio_times(g, a, b))

# Our classes: each led by its smallest label, in label order.
def _enumeratio_classes(g):
    at = {l: i for i, l in enumerate(g.labels)}
    classes = [sorted((g.label[e] for e in c), key=at.get) for c in g.G.conjugacy_classes()]
    return sorted(classes, key=lambda c: at[c[0]])

def enumeratio_class_sum(g, k):
    return _EnumeratioBasis(None, {l: int(1) for l in _enumeratio_classes(g)[int(k) - 1]})

def enumeratio_is_central(g, x):
    return all(
        _enumeratio_times(g, x, _EnumeratioBasis(g.label[s])) == _enumeratio_times(g, _EnumeratioBasis(g.label[s]), x)
        for s in g.G.gens()
    )

# The cycle index, in the variables given, from Sage's power-sum form: one p_i per i-cycle. Sage's group is on
# the points up to its degree, ours on the points it moves, so a variable list short of the degree is no answer.
def enumeratio_cycle_index(g, variables):
    G = _enumeratio_group(g)
    if len(variables) < G.degree():
        return None
    index = G.cycle_index().monomial_coefficients()
    return sum(c * prod(variables[i - 1] for i in part) for part, c in index.items())

# Pólya: each x_i becomes the power sum of the weights (or the number of colors, for a single number),
# all together.
def enumeratio_orbit_inventory(index, variables, weights):
    power = lambda i: weights if not isinstance(weights, (list, tuple)) else sum(w ** i for w in weights)
    return SR(index).subs({v: power(i) for i, v in enumerate(variables, 1)}).expand()
`;
