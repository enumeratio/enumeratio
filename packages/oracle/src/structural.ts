// Comparing two MathJSON answers by VALUE, not by spelling.
//
// `compare` (compare.ts) works on printed text, which is all the Python-family systems
// give us. Wolfram can print `FullForm`, which `fromWolfram` parses back to MathJSON — so
// its answer and our pinned `expected` can both be reduced to the same shape: numbers where
// a number exists, lists recursively, and a canonical text for whatever is left symbolic.
// `["Rational", 157, 50]` and `3.14` then agree, `{{2, 3}, {3, 2}}` and
// `["List", ["Tuple", 2, 3], ["Tuple", 3, 2]]` agree, and `["PolyLog", 2.5, 2]` against
// `Complex[2.79, -1.36]` is a disagreement to classify rather than a shrug.
//
// Reducing a leaf needs an evaluator, which is the caller's compute-engine; this module
// stays engine-free so it can be tested on plain trees.

import { CARRIER_NAMES, CARRIER_PARAMS } from "./carrier-names-data.ts";
import { DEFINED_NAMES } from "./defined-names-data.ts";
import type { MathJSON } from "./emit.ts";
import type { Verdict } from "./compare.ts";

/**
 * A real as `mantissa × 10^exponent` (1 <= |mantissa| < 10, or 0), for one a double cannot hold
 * (`9.9*^301029`), and the error it vouches for: `relative` from a Wolfram precision mark
 * (`` x`15.95 ``), `absolute` from an accuracy mark (`` 0``69.3 `` is zero within 10^-69.3).
 */
export interface Approximate {
  readonly mantissa: number;
  readonly exponent: number;
  readonly relative?: number;
  readonly absolute?: number;
}

/** What a leaf reduces to: a real, a complex, a truth value, or a canonical symbolic text. */
export type Leaf = number | boolean | { readonly re: number; readonly im: number } | string | Approximate;
export type Tree = Leaf | readonly Tree[];

/** Heads whose operands are compared element-wise. `Set` is reduced order-free. An `Interval`
 * is its endpoints: without this the whole call reduces to its text, and `Interval(1/e, 2)`
 * never lines up with Wolfram's `Interval[{E^-1, 2}]`, whose endpoints are a numeric value. */
const SEQUENCE_HEADS = new Set(["List", "Tuple", "Set", "Interval"]);

/** A key/value pair, compared by its two operands, not its head — `fromWolfram` reads a
 * Wolfram `Rule[k, v]` back as `KeyValuePair` (`REVERSE_HEADS`'s ambiguity, resolved for the
 * `Over` option's own round trip), while our own kernels build `Rule` directly for a binding
 * or an `Association` entry (optimize.ts, find-instance.ts, expression-ops.ts,
 * list-functional.ts). Without this, an otherwise-agreeing `Maximize`/`FindInstance`/
 * `Association` answer reads as a false disagreement on head spelling alone. */
const PAIR_HEADS = new Set(["Rule", "KeyValuePair"]);

/** Numbers by value, everything else by its text — a stable order for a Set. */
const byValue = (a: Tree, b: Tree): number =>
  typeof a === "number" && typeof b === "number" ? a - b : JSON.stringify(a).localeCompare(JSON.stringify(b));

/** An unknown left free. Wolfram's empty rule list (`Solve[x == x, x]` is `{{}}`) and our
 * fresh parameter (`[t]`, compute-engine #397) say the same thing, so both read as this. */
export const UNCONSTRAINED = "Unconstrained";

/** Whether `node` mentions the symbol `name` anywhere. */
const mentions = (node: MathJSON, name: string): boolean =>
  node === name || (Array.isArray(node) && node.some((n) => mentions(n as MathJSON, name)));

/**
 * `Solve`'s answers as bare values, order-free. Wolfram answers a list of solutions, each a
 * list of rules (`{{x -> -1}, {x -> 1}}`); ours is a list of values, a `Tuple` for several
 * unknowns. The two say the same thing once the rules are read as their right-hand sides and
 * the solutions as a set. Anything that is not a list of rule lists is left alone.
 *
 * Given the `Solve` call, a solution that is a fresh parameter (a symbol compute-engine has
 * no definition for, absent from the call) reads as `UNCONSTRAINED`, as Wolfram's `{}` does.
 * `[Pi]` for `Solve(cos x = -1, x)` stays `Pi`: it has a definition.
 */
export function solutionSet(expr: MathJSON, call?: MathJSON): MathJSON {
  if (!Array.isArray(expr) || expr[0] !== "List") return expr;
  const solutions = expr.slice(1) as MathJSON[];
  const isRule = (e: MathJSON): boolean => Array.isArray(e) && PAIR_HEADS.has(e[0] as string) && e.length === 3;
  const isRuleList = (e: MathJSON): boolean => Array.isArray(e) && e[0] === "List" && e.slice(1).every(isRule);
  const fresh = (e: MathJSON): boolean =>
    call !== undefined && typeof e === "string" && !DEFINED_NAMES.has(e) && !mentions(call, e);
  if (!solutions.every(isRuleList))
    return ["Set", ...solutions.map((solution) => (fresh(solution) ? UNCONSTRAINED : solution))] as MathJSON;
  return [
    "Set",
    ...solutions.map((solution) => {
      const values = (solution as MathJSON[]).slice(1).map((rule) => (rule as MathJSON[])[2] as MathJSON);
      if (values.length === 0) return UNCONSTRAINED;
      return values.length === 1 ? (values[0] as MathJSON) : (["Tuple", ...values] as MathJSON);
    }),
  ] as MathJSON;
}

/** `expr` with every `Tuple` written as a `List`: Wolfram has only the one, and a call held on both
 * sides (`StyleBox("x", (FontWeight, "Bold"))`) is the same call whichever spells its pair. */
const tuplesAsLists = (expr: MathJSON): MathJSON =>
  Array.isArray(expr)
    ? ((expr[0] === "Tuple" ? ["List", ...expr.slice(1).map(tuplesAsLists)] : expr.map(tuplesAsLists)) as MathJSON)
    : expr;

/** The canonical text for something that did not reduce to a value. */
export const symbolic = (expr: MathJSON): string =>
  typeof expr === "string" ? expr : JSON.stringify(tuplesAsLists(expr));

/** Named constants a numeric value may mention, as `fromWolfram` spells them. */
const CONSTANTS = new Set(["Pi", "ExponentialE", "ImaginaryUnit", "GoldenRatio", "EulerGamma", "CatalanConstant"]);

/** Heads that only build a number from numbers. */
const ARITHMETIC = new Set([
  "Rational",
  "Complex",
  "Add",
  "Subtract",
  "Negate",
  "Multiply",
  "Divide",
  "Power",
  "Sqrt",
  "Root",
  "N",
]);

/**
 * Whether `expr` is a numeric value: numbers and named constants under arithmetic.
 * `MatrixRank[{1, 2, 3}]` is not, however the arguments look — it is a call the other
 * system declined.
 */
export const isNumericValue = (expr: MathJSON): boolean => {
  if (typeof expr === "number") return true;
  if (typeof expr === "string") return CONSTANTS.has(expr);
  if (!Array.isArray(expr) || typeof expr[0] !== "string" || !ARITHMETIC.has(expr[0])) {
    return false;
  }
  return expr.length > 1 && expr.slice(1).every(isNumericValue);
};

/**
 * Gate an evaluator to numeric values, leaving anything else as its symbolic text — for
 * another system's answer, which our engine must not evaluate on that system's behalf.
 */
export const valuesOnly =
  (evaluate: (expr: MathJSON) => Leaf) =>
  (expr: MathJSON): Leaf =>
    isNumericValue(expr) ? evaluate(expr) : symbolic(expr);

/** A decimal's text (`-2.0e-340`, `9.9e+301029`) as mantissa and exponent, `undefined` when it is not one. */
export function scaled(text: string): Approximate | undefined {
  const m = /^([+-]?)(\d*)\.?(\d*)(?:[eE]([+-]?\d+))?$/.exec(text.trim());
  if (m === null || (m[2] === "" && m[3] === "")) return undefined;
  const figures = `${m[2]}${m[3]}`;
  const lead = figures.search(/[1-9]/);
  if (lead < 0) return { mantissa: 0, exponent: 0 };
  const exponent = Number(m[4] ?? 0) + (m[2] as string).length - lead - 1;
  return { mantissa: Number(`${m[1]}${figures[lead]}.${figures.slice(lead + 1) || "0"}`), exponent };
}

/** A tagged Wolfram real (`{ num, precision }` / `{ num, accuracy }`, as `fromWolfram` keeps it) as a leaf. */
function taggedReal(expr: MathJSON): Approximate | undefined {
  if (typeof expr !== "object" || expr === null || Array.isArray(expr)) return undefined;
  const { num, precision, accuracy } = expr as { num?: unknown; precision?: unknown; accuracy?: unknown };
  if (typeof num !== "string" || (typeof precision !== "number" && typeof accuracy !== "number")) return undefined;
  const value = scaled(num);
  if (value === undefined) return undefined;
  return {
    ...value,
    ...(typeof precision === "number" ? { relative: 10 ** -precision } : {}),
    ...(typeof accuracy === "number" ? { absolute: 10 ** -accuracy } : {}),
  };
}

/**
 * Reduce `expr` to a comparable tree. `evaluate` turns a non-sequence node into a leaf —
 * a number when it has one, else its symbolic text (`symbolic` is a fine fallback).
 */
export function reduce(expr: MathJSON, evaluate: (expr: MathJSON) => Leaf): Tree {
  if (Array.isArray(expr) && typeof expr[0] === "string" && SEQUENCE_HEADS.has(expr[0])) {
    const items = expr.slice(1).map((item) => reduce(item, evaluate));
    return expr[0] === "Set" ? [...items].toSorted(byValue) : items;
  }
  if (Array.isArray(expr) && typeof expr[0] === "string" && PAIR_HEADS.has(expr[0]) && expr.length === 3) {
    return expr.slice(1).map((item) => reduce(item, evaluate));
  }
  // A delayed rule keeps its head in the tree: `x :> v` is not `x -> v`.
  if (Array.isArray(expr) && expr[0] === "RuleDelayed" && expr.length === 3) {
    return ["RuleDelayed", ...expr.slice(1).map((item) => reduce(item, evaluate))];
  }
  // An association is its entries in order, tagged so it never lines up with a bare list of rules.
  if (Array.isArray(expr) && expr[0] === "Association") {
    return ["Association", ...expr.slice(1).map((item) => reduce(item, evaluate))];
  }
  // CycleDecomposition/Wolfram's own `Cycles` (unmapped -- `Cycles` is never one of OUR
  // heads, so `fromWolfram` reads it through by name): Wolfram's `Cycles` omits a FIXED
  // POINT (a length-1 cycle) entirely, while ours always keeps one for every element -- so
  // `CycleDecomposition([[1,2,3],[4]])` and `Cycles[{{1,2,3}}]` are the SAME permutation,
  // not a shape mismatch. `reduceCycles` drops singleton cycles before comparing (a cycle's
  // own element order still matters -- (1 2 3) and (1 3 2) are different permutations -- so
  // only the top-level SET of cycles is order-free, not what is inside one).
  if (Array.isArray(expr) && (expr[0] === "CycleDecomposition" || expr[0] === "Cycles") && expr.length === 2) {
    return reduceCycles(expr[1] as MathJSON, evaluate);
  }
  // A carrier CONSTRUCTOR call (`Permutation([2, 1, 3])`) reduces to its contents, exactly
  // like `emit.ts` unwraps it for an external system — we decide what counts as equivalent,
  // and an external system's raw structure IS our carrier value, with no head wrapper needed
  // (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5). A carrier is always
  // declared over exactly one operand (`declareConstructor`'s `(shape) -> type` signature,
  // same as `contentsOf`), so this is a plain, order-preserving unwrap, not a new comparison
  // rule — the same structural leniency `SEQUENCE_HEADS` already gives List vs. Tuple.
  //
  // A family with `carrierParams` (`Tournament(n, edges)`) packs its leading params and its
  // element into that one operand as a `Tuple`; `emit.ts` never hands the other system `n`
  // (unwrapping past the carrier's own declared `carrierParams` count, `CARRIER_PARAMS`,
  // TQ-5), so this comparison has to reduce to that same remainder or a genuine agreement
  // would register as a shape mismatch (`[n, edges]` vs. the other system's bare `edges`).
  //
  // A COMPOSITE carrier (`carrierElements`, e.g. `StandardTableauPair`) packs the same
  // shape, but declares no `carrierParams` (0 leading slots to drop) -- reducing to only the
  // last slot would compare `Q` alone and silently ignore `P`. Falls out of the same rule as
  // `emit.ts`: what's left after dropping the declared leading-param count is either one
  // element (reduce to it) or the whole tuple, which carries meaning.
  if (Array.isArray(expr) && typeof expr[0] === "string" && CARRIER_NAMES.has(expr[0]) && expr.length === 2) {
    const contents = expr[1] as MathJSON;
    const packed = Array.isArray(contents) && contents[0] === "Tuple" && contents.length > 2 ? contents : undefined;
    if (packed === undefined) return reduce(contents, evaluate);
    const packedOperands = packed.slice(1) as MathJSON[];
    const rest = packedOperands.slice(CARRIER_PARAMS.get(expr[0]) ?? 0);
    return reduce(rest.length === 1 ? (rest[0] as MathJSON) : (["Tuple", ...rest] as MathJSON), evaluate);
  }
  // A `Graph` answer compares by vertices + edges, not by exact shape: Wolfram's own answer
  // carries a cached `SparseArray` adjacency matrix as its edge argument (`Graph[vertices,
  // {Null, SparseArray[...]}]`), not our `List[UndirectedEdge[...], ...]` -- structurally
  // nothing alike even for the identical graph. `reduceGraph` reduces either encoding to the
  // same canonical `[vertices, edgeKeys]` shape. Trailing options (`{GraphLayout -> ...}`)
  // don't change the graph.
  if (Array.isArray(expr) && expr[0] === "Graph" && expr.length >= 3) {
    return reduceGraph(expr[1] as MathJSON, expr[2] as MathJSON, evaluate);
  }
  // A real that states its own precision or accuracy is compared within it.
  const tagged = taggedReal(expr);
  if (tagged !== undefined) return tagged;
  if (typeof expr === "boolean") return expr;
  // Truth values are the symbols on both sides (fromWolfram reads `True` as "True"); an
  // evaluator that only reads values (`symbolic`, `valuesOnly`) would leave them as text.
  if (expr === "True") return true;
  if (expr === "False") return false;
  return evaluate(expr);
}

/** An edge, canonicalised to a comparable, order-free key: `min-max` for an undirected pair
 *  (a Wolfram adjacency matrix records both (i, j) and (j, i), so this also dedupes), `a->b`
 *  for a directed one. */
const edgeKey = (a: Tree, b: Tree, directed: boolean): string =>
  directed ? `${JSON.stringify(a)}->${JSON.stringify(b)}` : [JSON.stringify(a), JSON.stringify(b)].toSorted().join("-");

/**
 * Wolfram's own `Graph` answer packs its edges as a cached `{Null, SparseArray[...]}` (undirected)
 * or `{SparseArray[...], Null}` (directed) pair rather than an explicit edge list --
 * `SparseArray[Automatic, {n, n}, 0, {1, {rowPtr, colIndices}, values}]`, the
 * compressed-row-storage encoding of its (0/1) adjacency matrix.
 * `values` is irrelevant to topology (an edge either is or isn't there) and often prints
 * elided/truncated besides, so only `rowPtr`/`colIndices` are read: row `i`'s nonzero columns
 * are `colIndices[rowPtr[i-1] .. rowPtr[i]-1]`, each itself a singleton `{col}`.
 * `undefined` when `sparse` isn't shaped the way an adjacency matrix's SparseArray prints.
 */
function decodeSparseAdjacency(sparse: MathJSON): readonly (readonly [number, number])[] | undefined {
  if (!Array.isArray(sparse) || sparse[0] !== "SparseArray" || sparse.length < 5) return undefined;
  const structure = sparse[4];
  if (!Array.isArray(structure) || structure[0] !== "List" || structure.length < 3) return undefined;
  const inner = structure[2];
  if (!Array.isArray(inner) || inner[0] !== "List" || inner.length < 3) return undefined;
  const rowPtrList = inner[1];
  const colIndexList = inner[2];
  if (!Array.isArray(rowPtrList) || rowPtrList[0] !== "List") return undefined;
  if (!Array.isArray(colIndexList) || colIndexList[0] !== "List") return undefined;
  const rowPtr = rowPtrList.slice(1) as number[];
  const cols = colIndexList.slice(1).map((c) => (Array.isArray(c) && c[0] === "List" ? (c[1] as number) : undefined));
  const edges: [number, number][] = [];
  for (let row = 0; row < rowPtr.length - 1; row++) {
    for (let k = rowPtr[row]; k < rowPtr[row + 1]; k++) {
      const col = cols[k];
      if (col !== undefined) edges.push([row + 1, col]);
    }
  }
  return edges;
}

/** `cyclesArg`'s cycles, dropping any length-1 (fixed-point) cycle and sorting the rest by
 *  their own (order-preserved) contents — the canonical form both `CycleDecomposition([...])`
 *  and Wolfram's own `Cycles[{...}]` reduce to. */
function reduceCycles(cyclesArg: MathJSON, evaluate: (expr: MathJSON) => Leaf): Tree {
  const list = Array.isArray(cyclesArg) && cyclesArg[0] === "List" ? cyclesArg.slice(1) : [];
  const cycles = list
    .map((c) => (Array.isArray(c) && c[0] === "List" ? c.slice(1) : [c]))
    .filter((c) => c.length > 1)
    .map((c) => c.map((el) => reduce(el as MathJSON, evaluate)))
    .toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return cycles;
}

/** `Graph(vertices, edgeSpec)` reduced to `["Graph", sortedVertices, sortedEdgeKeys]`: our
 *  own `List[UndirectedEdge[a, b], ...]` / `List[DirectedEdge[a, b], ...]` edge spec, or
 *  Wolfram's cached `List[Null, SparseArray[...]]` (or directed `List[SparseArray[...], Null]`)
 *  one, read down to the same comparable shape either way. An edge spec neither form decodes reduces to an empty edge list rather
 *  than failing the whole comparison — a genuine shape mismatch still shows up as a vertex
 *  or edge-count disagreement. */
function reduceGraph(vertices: MathJSON, edgeSpec: MathJSON, evaluate: (expr: MathJSON) => Leaf): Tree {
  const vertexList = Array.isArray(vertices) && vertices[0] === "List" ? vertices.slice(1) : [];
  // A whole-number label is the number whichever way `evaluate` reads leaves (`symbolic` would make it
  // text), like the endpoints a `SparseArray` decodes to.
  const label = (v: MathJSON): Tree => (typeof v === "number" ? v : reduce(v, evaluate));
  const reducedVertices = vertexList.map((v) => label(v as MathJSON)).toSorted(byValue);

  const items = Array.isArray(edgeSpec) && edgeSpec[0] === "List" ? edgeSpec.slice(1) : [];
  let edgeKeys: string[];
  // `fromWolfram` reads Wolfram's `Null` back as OUR `Nothing` (its own reverse spelling,
  // `to-wolfram.ts`'s `SYMBOLS` table: `Nothing: "Null"`) -- never the string `"Null"`.
  // The pair is `{directed, undirected}`: `{SparseArray, Null}` or `{Null, SparseArray}`.
  const isSparse = (item: MathJSON | undefined): boolean => Array.isArray(item) && item[0] === "SparseArray";
  const isSlot = (item: MathJSON | undefined): boolean => item === "Nothing" || isSparse(item);
  if (items.length === 2 && isSlot(items[0] as MathJSON) && isSlot(items[1] as MathJSON)) {
    edgeKeys = [false, true].flatMap((directed) => {
      const slot = items[directed ? 0 : 1] as MathJSON;
      return (isSparse(slot) ? (decodeSparseAdjacency(slot) ?? []) : []).map(([a, b]) => edgeKey(a, b, directed));
    });
  } else {
    edgeKeys = items.flatMap((item) => {
      if (!Array.isArray(item) || item.length !== 3) return [];
      if (item[0] !== "UndirectedEdge" && item[0] !== "DirectedEdge") return [];
      const a = label(item[1] as MathJSON);
      const b = label(item[2] as MathJSON);
      return [edgeKey(a, b, item[0] === "DirectedEdge")];
    });
  }
  return ["Graph", reducedVertices, [...new Set(edgeKeys)].toSorted()];
}

const close = (a: number, b: number, tolerance: number): boolean =>
  Number.isNaN(a) && Number.isNaN(b) ? true : Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

const isComplex = (leaf: Leaf): leaf is { re: number; im: number } =>
  typeof leaf === "object" && leaf !== null && "re" in leaf;

const isApproximate = (leaf: Leaf): leaf is Approximate =>
  typeof leaf === "object" && leaf !== null && "mantissa" in leaf;

const scaledNumber = (n: number): Approximate | undefined =>
  Number.isFinite(n) ? scaled(n.toExponential()) : undefined;

const toDouble = (a: Approximate): number => Number(`${a.mantissa}e${a.exponent}`);

/**
 * Two reals, either of which may be approximate, within the loosest error either vouches for
 * (never tighter than `tolerance`). Past double range only the mantissas can be compared, which
 * is the relative error: a real that far out must agree in scale and in its leading figures.
 */
function approximatelyEqual(a: Approximate | number, b: Approximate | number, tolerance: number): boolean {
  const [x, y] = [a, b].map((n) => (typeof n === "number" ? scaledNumber(n) : n));
  if (x === undefined || y === undefined) return Object.is(a, b);
  const relative = Math.max(tolerance, x.relative ?? 0, y.relative ?? 0);
  const absolute = Math.max(x.absolute ?? 0, y.absolute ?? 0);
  const [dx, dy] = [toDouble(x), toDouble(y)];
  if (Number.isFinite(dx) && Number.isFinite(dy)) {
    return Math.abs(dx - dy) <= Math.max(absolute, relative * Math.max(1, Math.abs(dx), Math.abs(dy)));
  }
  if (x.mantissa * y.mantissa <= 0 || Math.abs(x.exponent - y.exponent) > 1) return false;
  const shift = 10 ** (x.exponent - y.exponent);
  const gap = Math.abs(x.mantissa * shift - y.mantissa);
  return gap <= relative * Math.max(Math.abs(x.mantissa * shift), Math.abs(y.mantissa));
}

/** Compare two reduced trees: element-wise, numerically within `tolerance`, textually
 * last. Never `inconclusive`: a parsed answer is always either the same or different. */
export function compareTrees(ours: Tree, theirs: Tree, tolerance = 1e-9): Verdict {
  if (Array.isArray(ours) || Array.isArray(theirs)) {
    if (!Array.isArray(ours) || !Array.isArray(theirs) || ours.length !== theirs.length) {
      return "disagree";
    }
    let verdict: Verdict = "agree";
    for (let i = 0; i < ours.length; i++) {
      const v = compareTrees(ours[i] as Tree, theirs[i] as Tree, tolerance);
      if (v === "disagree") return "disagree";
      if (v === "inconclusive") verdict = "inconclusive";
    }
    return verdict;
  }
  const a = ours as Leaf;
  const b = theirs as Leaf;
  if (typeof a === "number" && typeof b === "number") {
    return close(a, b, tolerance) ? "agree" : "disagree";
  }
  if (typeof a === "boolean" || typeof b === "boolean") return a === b ? "agree" : "disagree";
  if (isApproximate(a) || isApproximate(b)) {
    const real = (leaf: Leaf): Approximate | number | undefined =>
      typeof leaf === "number" || isApproximate(leaf) ? leaf : undefined;
    const [x, y] = [real(a), real(b)];
    return x !== undefined && y !== undefined && approximatelyEqual(x, y, tolerance) ? "agree" : "disagree";
  }
  if (isComplex(a) || isComplex(b)) {
    const ca = isComplex(a) ? a : typeof a === "number" ? { re: a, im: 0 } : undefined;
    const cb = isComplex(b) ? b : typeof b === "number" ? { re: b, im: 0 } : undefined;
    if (ca === undefined || cb === undefined) return "disagree";
    return close(ca.re, cb.re, tolerance) && close(ca.im, cb.im, tolerance) ? "agree" : "disagree";
  }
  // A value on one side and a symbol on the other IS a finding — one system evaluated
  // where the other declined — so it is a disagreement to classify, not a shrug.
  return a === b ? "agree" : "disagree";
}
