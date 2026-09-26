import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, stringAt, wrapOperator } from "@enumeratio/boxed";
import { matches } from "./expression-ops.ts";
import { integerGraph } from "./graphs.ts";
import { rngFor } from "./list-frontier.ts";

// A third wave of Wolfram-frontier heads: DiagonalMatrix/HilbertMatrix (matrix
// constructors), Extract/DeleteCases (expression surgery, built on the same primitives as
// #241's MatchQ/FreeQ), Key (an Association accessor, riding the same `At` extension
// point `list-functional.ts` uses for the rest of Association's interface), CharacterRange,
// NumberQ, ReIm, RandomComplex (seeded off the same PRNG stream as RandomInteger), and
// KaryTree (a graph constructor — NOT the same thing as our `KAryTrees` domain, nor
// `CompleteKaryTree` in graphs.ts; see that head's own note). KaryTree/KAryTrees no longer
// collide on the site's per-symbol page generator once the domain went plural (design/
// domains.md's naming rule) — restored here after #260 pulled it for exactly that collision.
//
// Out of scope for this wave, with reasons: WeightedAdjacencyMatrix (Graph has no edge-weight
// representation — see graphs.ts, edges are a bare List of UndirectedEdge with no attribute
// slot — so there is nothing to read a weight OFF of; would need to land graph weights first)
// and BooleanConvert (compute-engine's logic heads have no DNF/CNF normal-form routine to
// build on — `And`/`Or`/`Not` `.simplify()` doesn't produce a canonical normal form, and
// bare boolean symbols default-infer as `number`, so even a probe call needs explicit
// typing before it does anything useful — writing a full boolean normalizer from scratch is
// out of scope here).

/** Wolfram 1-based position, negative counting from the end, to a positive 1-based index. */
const normalizePosition = (position: number, length: number): number =>
  position < 0 ? length + position + 1 : position;

// --- DiagonalMatrix / HilbertMatrix -------------------------------------------------------

/** `DiagonalMatrix(list)` / `DiagonalMatrix(list, k)`: a square matrix with `list` down the
 *  `k`-th diagonal (`k = 0`: main diagonal, `k > 0`: `k` steps above it, `k < 0`: `|k|` steps
 *  below), zero elsewhere. The result is `Length(list) + |k|` square — Wolfram's own
 *  convention, kernel-checked: `DiagonalMatrix[{1, 2}, 1]` is a 3×3 matrix with `1, 2` on the
 *  super-diagonal, not a 2×2 one. */
function diagonalMatrix(ce: ComputeEngine, list: readonly BoxedExpression[], k: number): BoxedExpression {
  const n = list.length;
  const size = n + Math.abs(k);
  const rows: BoxedExpression[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => ce.Zero));
  for (let m = 0; m < n; m++) {
    const row = k >= 0 ? m : m + Math.abs(k);
    const col = k >= 0 ? m + k : m;
    rows[row]![col] = list[m]!;
  }
  return ce.function(
    "List",
    rows.map((row) => ce.function("List", row)),
  );
}

/** `HilbertMatrix(n)` / `HilbertMatrix({m, n})`: the (possibly rectangular) Hilbert matrix,
 *  entry `(i, j) = 1/(i + j - 1)` (1-based), kept EXACT (a rational per entry, never a
 *  float) — Wolfram's own default. The rectangular form takes its dimensions as a `{m, n}`
 *  LIST, not two bare arguments — kernel-checked: Wolfram's `HilbertMatrix` has no 2-argument
 *  form at all, only `HilbertMatrix[n]` and `HilbertMatrix[{m, n}]`. */
function hilbertMatrix(ce: ComputeEngine, m: number, n: number): BoxedExpression | undefined {
  if (!Number.isSafeInteger(m) || !Number.isSafeInteger(n) || m < 1 || n < 1) return undefined;
  const rows: BoxedExpression[][] = [];
  for (let i = 1; i <= m; i++) {
    const row: BoxedExpression[] = [];
    for (let j = 1; j <= n; j++) row.push(ce.number([1, i + j - 1]));
    rows.push(row);
  }
  return ce.function(
    "List",
    rows.map((row) => ce.function("List", row)),
  );
}

// --- Extract -------------------------------------------------------------------------------

/** Navigate `path` (top-down, Wolfram 1-based-or-negative indices) into `expr`'s nested
 *  operands, `undefined` if any step is out of range or drills into a leaf. */
function atPath(expr: BoxedExpression, path: readonly number[]): BoxedExpression | undefined {
  let node = expr;
  for (const step of path) {
    const ops = operandsOf(node);
    const index = normalizePosition(step, ops.length) - 1;
    const next = ops[index];
    if (next === undefined) return undefined;
    node = next;
  }
  return node;
}

/** Read an `Extract` position specification as a top-down path of 1-based-or-negative
 *  indices — a bare integer is a one-step path, a `List` of integers a multi-step one. */
function pathOf(expr: BoxedExpression): number[] | undefined {
  if (expr.operator === "List") {
    const items = operandsOf(expr).map(integerAt);
    return items.some((n) => n === undefined) ? undefined : (items as number[]);
  }
  const n = integerAt(expr);
  return n === undefined ? undefined : [n];
}

/** Whether `pos` is Wolfram's "list of paths" shape (`{{i1}, {i2}, …}`, every element a
 *  `List`) rather than a single path (`{i1, i2, …}`, elements are plain integers). An empty
 *  `pos` reads as a single (trivial, zero-step) path — `Extract(expr, {})` is `expr`. */
const isListOfPaths = (pos: BoxedExpression): boolean =>
  pos.operator === "List" && operandsOf(pos).length > 0 && operandsOf(pos).every((op) => op.operator === "List");

/** `Extract(expr, pos)`: the part of `expr` at position `pos`, or (`pos` a `{{path1},
 *  {path2}, …}`) the LIST of parts at each of several positions — Wolfram's own
 *  single-path-vs-list-of-paths disambiguation: `pos` is one path unless every one of its
 *  own elements is itself a `List`. Same 1-based/negative indexing as `At`/`Part`. */
function declareExtract(ce: ComputeEngine): void {
  ce.declare("Extract", {
    signature: "(any, any) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [expr, pos] = ops;
      if (expr === undefined || pos === undefined) return undefined;
      if (isListOfPaths(pos)) {
        const paths = operandsOf(pos).map(pathOf);
        if (paths.some((p) => p === undefined)) return undefined;
        const parts = paths.map((p) => atPath(expr, p!));
        if (parts.some((part) => part === undefined)) return undefined;
        return ce.function("List", parts as BoxedExpression[]);
      }
      const path = pathOf(pos);
      return path === undefined ? undefined : atPath(expr, path);
    },
  });
}

// --- DeleteCases -----------------------------------------------------------------------------

/** `DeleteCases(list, pattern)`: `list` with every TOP-LEVEL element matching `pattern`
 *  removed — the complement of `Select(list, MatchQ(#, pattern)&)`, built on the same
 *  `matches` primitive as `MatchQ`/`FreeQ` (`expression-ops.ts`) rather than a fresh copy of
 *  it. Only the 2-argument form; Wolfram's optional `levelspec`/`n` (a level to search below
 *  the top, and a cap on how many to delete) aren't implemented. */
function declareDeleteCases(ce: ComputeEngine): void {
  ce.declare("DeleteCases", {
    signature: "(any, any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const listExpr = ops[0]?.evaluate();
      const pattern = ops[1];
      if (listExpr === undefined || pattern === undefined) return undefined;
      const kept = operandsOf(listExpr).filter((item) => !matches(item, pattern));
      return ce.function(listExpr.operator as never, kept);
    },
  });
}

// --- Key (an Association accessor) --------------------------------------------------------

/** `Key(k)`: an inert tag around `k`, meaningful only as the second operand of `At` on an
 *  `Association` (see `list-functional.ts` for the Rule-pair `Association` this reads) —
 *  `At(assoc, Key(k))` is the key lookup. Wolfram's OTHER reading of `Key` — as a
 *  standalone operator, `Key(k)(assoc)` — isn't implemented; document as a divergence. */
function declareKey(ce: ComputeEngine): void {
  ce.declare("Key", {
    signature: "(any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const k = ops[0];
      return k === undefined ? undefined : ce.function("Key", [k]);
    },
  });

  wrapOperator(
    ce,
    ["At", 2, 2],
    (ops) => ops[0]?.operator === "Association" && ops[1]?.operator === "Key",
    () => (ops) => {
      const keyExpr = operandsOf(ops[1]!)[0];
      if (keyExpr === undefined) return undefined;
      for (const rule of operandsOf(ops[0]!)) {
        const [key, value] = operandsOf(rule);
        if (key !== undefined && key.isSame(keyExpr)) return value;
      }
      return ce.symbol("Missing");
    },
    2,
  );
}

// --- CharacterRange --------------------------------------------------------------------------

/** `CharacterRange("a", "e")` / `CharacterRange(n1, n2)`: every character from the first
 *  to the second, inclusive, by Unicode code point — the string form reads each endpoint's
 *  own code point (`Array.from(text)[0]`, so an astral character stays one code point, same
 *  convention as `ToCharacterCode`/`StringLength` in `expression-ops.ts`). */
function declareCharacterRange(ce: ComputeEngine): void {
  ce.declare("CharacterRange", {
    signature: "(any, any) -> list<string>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [a, b] = ops;
      if (a === undefined || b === undefined) return undefined;
      let lo: number | undefined;
      let hi: number | undefined;
      const aText = stringAt(a);
      const bText = stringAt(b);
      if (aText !== undefined && bText !== undefined) {
        lo = Array.from(aText)[0]?.codePointAt(0);
        hi = Array.from(bText)[0]?.codePointAt(0);
      } else {
        lo = integerAt(a);
        hi = integerAt(b);
      }
      if (lo === undefined || hi === undefined || lo > hi) return undefined;
      const chars: BoxedExpression[] = [];
      for (let cp = lo; cp <= hi; cp++) chars.push(ce.string(String.fromCodePoint(cp)));
      return ce.function("List", chars);
    },
  });
}

// --- NumberQ -----------------------------------------------------------------------------

/** `NumberQ(expr)`: True only for an explicit numeric LITERAL (`Integer`/`Real`/`Rational`/
 *  `Complex`) — unlike compute-engine's own `isNumber`, a symbolic constant like `Pi` is
 *  NOT `NumberQ` (kernel-checked: `NumberQ[Pi]` is `False`, `NumberQ[N[Pi]]` is `True`).
 *  Read via `.numericValue`, which is set on a literal's own boxed-number interface and
 *  unset on a symbol (Pi, GoldenRatio, …) even though `.isNumber` is `true` for both. */
function declareNumberQ(ce: ComputeEngine): void {
  ce.declare("NumberQ", {
    signature: "(any) -> boolean",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const x = ops[0];
      if (x === undefined) return undefined;
      const numericValue = (x as { numericValue?: unknown }).numericValue;
      return numericValue !== undefined ? ce.True : ce.False;
    },
  });
}

// --- ReIm --------------------------------------------------------------------------------

/** `ReIm(z) = {Re(z), Im(z)}`, threading over a `List` the way Wolfram's `Listable` ReIm
 *  does — `ReIm({z1, z2})` is `{ReIm(z1), ReIm(z2)}`, not a single flat pair. */
function declareReIm(ce: ComputeEngine): void {
  const reIm = (z: BoxedExpression): BoxedExpression =>
    z.operator === "List"
      ? ce.function("List", operandsOf(z).map(reIm))
      : ce.function("List", [ce.function("Re", [z]).evaluate(), ce.function("Im", [z]).evaluate()]);

  ce.declare("ReIm", {
    signature: "(any) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const z = ops[0];
      return z === undefined ? undefined : reIm(z);
    },
  });
}

// --- RandomComplex -------------------------------------------------------------------------

/** `RandomComplex()`: uniform over the unit square, real and imaginary parts each in
 *  `[0, 1]`. `RandomComplex(zmax)`: uniform over the rectangle with corners `0` and `zmax`.
 *  `RandomComplex({zmin, zmax})`: uniform over the rectangle with those corners. Draws from
 *  the SAME seeded stream as `RandomInteger`/`RandomGraph` (`rngFor`, `list-frontier.ts`),
 *  not Wolfram's own generator — same divergence those heads already document. */
function declareRandomComplex(ce: ComputeEngine): void {
  const cornersOf = (
    zmax: BoxedExpression | undefined,
    zmin: BoxedExpression | undefined,
  ): readonly [number, number, number, number] | undefined => {
    if (zmax === undefined) return [0, 1, 0, 1];
    const re = (e: BoxedExpression): number | undefined => (typeof e.re === "number" ? e.re : undefined);
    const im = (e: BoxedExpression): number | undefined => (typeof e.im === "number" ? e.im : undefined);
    const zminRe = zmin === undefined ? 0 : re(zmin);
    const zminIm = zmin === undefined ? 0 : im(zmin);
    const zmaxRe = re(zmax);
    const zmaxIm = im(zmax);
    if (zminRe === undefined || zminIm === undefined || zmaxRe === undefined || zmaxIm === undefined) {
      return undefined;
    }
    return [Math.min(zminRe, zmaxRe), Math.max(zminRe, zmaxRe), Math.min(zminIm, zmaxIm), Math.max(zminIm, zmaxIm)];
  };

  ce.declare("RandomComplex", {
    signature: "(any?) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const spec = ops[0];
      const corners =
        spec === undefined
          ? cornersOf(undefined, undefined)
          : spec.operator === "List"
            ? cornersOf(operandsOf(spec)[1], operandsOf(spec)[0])
            : cornersOf(spec, undefined);
      if (corners === undefined) return undefined;
      const [reLo, reHi, imLo, imHi] = corners;
      const next = rngFor(ce);
      const re = reLo + next() * (reHi - reLo);
      const im = imLo + next() * (imHi - imLo);
      return ce.number(ce.complex(re, im));
    },
  });
}

// --- KaryTree ------------------------------------------------------------------------------

/** `KaryTree(n)` (binary, `k = 2`) / `KaryTree(n, k)`: the `k`-ary tree on `n` VERTICES, in
 *  breadth-first (heap) layout — vertex `i`'s parent is `⌊(i - 2) / k⌋ + 1`. NOT the same
 *  head as our `KAryTrees` DOMAIN (`domains/src/domain-data.ts`, the combinatorial family of
 *  every n-node k-ary tree shape, for enumeration/ranking) or `CompleteKaryTree` in
 *  `graphs.ts` (a LEVEL count, always perfectly filled) — Wolfram's `KaryTree` is a single
 *  specific tree sized by vertex count, not level count, and the last level need not be
 *  full. Reuses `integerGraph` (graphs.ts) for the same `Graph(vertices, edges)` shape every
 *  other named-family constructor there builds. */
function karyTree(ce: ComputeEngine, n: number, k: number): BoxedExpression | undefined {
  if (!Number.isSafeInteger(n) || n < 1 || !Number.isSafeInteger(k) || k < 1) return undefined;
  const edges: [number, number][] = [];
  for (let i = 2; i <= n; i++) {
    const parent = Math.floor((i - 2) / k) + 1;
    edges.push([parent, i]);
  }
  return integerGraph(ce, n, edges);
}

function declareKaryTree(ce: ComputeEngine): void {
  ce.declare("KaryTree", {
    signature: "(integer, integer?) -> value",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const n = ops[0] === undefined ? undefined : integerAt(ops[0]);
      const k = ops[1] === undefined ? 2 : integerAt(ops[1]);
      return n === undefined || k === undefined ? undefined : karyTree(ce, n, k);
    },
  });
}

// --- declare everything ----------------------------------------------------------------------

/** Declare this wave's heads: DiagonalMatrix, HilbertMatrix, Extract, DeleteCases, Key,
 *  CharacterRange, NumberQ, ReIm, RandomComplex, KaryTree. See the module doc for what's out
 *  of scope (WeightedAdjacencyMatrix, BooleanConvert) and why. */
export function declareMiscFrontier(ce: ComputeEngine): void {
  ce.declare("DiagonalMatrix", {
    signature: "(any, integer?) -> list<any>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const listExpr = ops[0];
      if (listExpr === undefined || listExpr.operator !== "List") return undefined;
      const k = ops[1] === undefined ? 0 : integerAt(ops[1]);
      if (k === undefined) return undefined;
      return diagonalMatrix(ce, operandsOf(listExpr), k);
    },
  });

  ce.declare("HilbertMatrix", {
    signature: "(any) -> list<any>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      // Exactly one argument — the declared signature already rejects a 2-argument call at
      // BOX time, before this ever runs (Wolfram's rectangular form takes its dimensions as
      // a single {m, n} LIST, see hilbertMatrix's doc comment, not a bare 2-argument call).
      const spec = ops[0];
      if (spec === undefined) return undefined;
      if (spec.operator === "List") {
        const [m, n] = operandsOf(spec).map(integerAt);
        return m === undefined || n === undefined ? undefined : hilbertMatrix(ce, m, n);
      }
      const n = integerAt(spec);
      return n === undefined ? undefined : hilbertMatrix(ce, n, n);
    },
  });

  declareExtract(ce);
  declareDeleteCases(ce);
  declareKey(ce);
  declareCharacterRange(ce);
  declareNumberQ(ce);
  declareReIm(ce);
  declareRandomComplex(ce);
  declareKaryTree(ce);
}
