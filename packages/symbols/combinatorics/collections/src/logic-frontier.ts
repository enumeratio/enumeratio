import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, stringAt, symbolNameOf } from "@enumeratio/boxed";

// A fourth wave of Wolfram-frontier heads: boolean normal forms (LogicalExpand,
// BooleanConvert) and a batch of `Is…` predicates (our naming for Wolfram's `…Q` — see
// IsPrime, IsConnectedGraph) that a previous lane left unimplemented. Probed first:
// compute-engine 0.134 ships And/Or/Not/Implies/Equivalent/Xor/Nand/Nor but no DNF/CNF/NNF
// routine (`.simplify()` leaves Implies/Xor exactly as given), and none of IsInteger,
// IsVector, IsMatrix, IsArray, TrueQ-equivalent or MersennePrimeExponentQ-equivalent exist
// yet under either name. A bare symbol boxes as `type: "unknown"` in this compute-engine
// version, not `number` as an earlier lane found — so the walk below is structural (by
// `.operator`) regardless, since that's robust either way and is what a boolean-agnostic
// connective needs.
//
// Out of scope here: BooleanMinimize (Quine–McCluskey) — the four required forms already
// cover the frontier rows this wave targets; a minimizer is a separate, larger unit of work.
// BooleanConvert's other Wolfram forms ("ESOP", "AC", "BF") are left unevaluated with no
// implementation — DNF/CNF/NNF are what Wolfram documents as the common ones.

// --- boolean connective elimination -------------------------------------------------------

const CONNECTIVES = new Set(["And", "Or", "Not", "Implies", "Equivalent", "Xor", "Nand", "Nor"]);

/** Apply a `Function` literal (or symbol naming one) to a single boxed argument — same
 *  calling convention as the number-theory backlog's `applyFn`: box `[fn, arg]` as a call
 *  with `fn` itself as the head. */
const applyFn = (ce: ComputeEngine, fn: BoxedExpression, arg: BoxedExpression): BoxedExpression =>
  ce.box([fn.json, arg.json] as never).evaluate();

const passesTest = (ce: ComputeEngine, test: BoxedExpression | undefined, arg: BoxedExpression): boolean =>
  test === undefined || symbolNameOf(applyFn(ce, test, arg)) === "True";

/** Rewrite every `Implies`/`Equivalent`/`Xor`/`Nand`/`Nor` in `expr` down to `And`/`Or`/`Not`
 *  over the same leaves, recursively. Non-boolean subexpressions (plain symbols, `Greater`
 *  comparisons, predicate calls, …) are left alone as opaque literals. */
export function eliminateConnectives(ce: ComputeEngine, expr: BoxedExpression): BoxedExpression {
  const op = expr.operator;
  if (!CONNECTIVES.has(op)) return expr;
  const args = operandsOf(expr).map((a) => eliminateConnectives(ce, a));
  switch (op) {
    case "Not":
      return ce.function("Not", [args[0]!]);
    case "And":
      return args.length === 1 ? args[0]! : ce.function("And", args);
    case "Or":
      return args.length === 1 ? args[0]! : ce.function("Or", args);
    case "Implies": {
      const [a, b] = args;
      return ce.function("Or", [ce.function("Not", [a!]), b!]);
    }
    case "Nand":
      return ce.function("Not", [ce.function("And", args)]);
    case "Nor":
      return ce.function("Not", [ce.function("Or", args)]);
    case "Xor":
      // Parity fold: Xor(a, b) = Or(And(a, Not(b)), And(Not(a), b)); n-ary Xor is the
      // pairwise fold of that, since XOR is associative on truth values.
      return args.reduce((acc, cur) =>
        ce.function("Or", [
          ce.function("And", [acc, ce.function("Not", [cur])]),
          ce.function("And", [ce.function("Not", [acc]), cur]),
        ]),
      );
    case "Equivalent": {
      // All-equal: And of consecutive-pair equivalences (transitive — a=b and b=c gives
      // a=c), each pair rewritten as (a∧b)∨(¬a∧¬b). compute-engine's own `Equivalent` is
      // capped at 2 operands (a 3rd errors at box time) as of 0.134, so the n-ary branch
      // here is forward-looking rather than reachable through a boxed `Equivalent` today.
      const pairs: BoxedExpression[] = [];
      for (let i = 0; i < args.length - 1; i++) {
        const a = args[i]!;
        const b = args[i + 1]!;
        pairs.push(
          ce.function("Or", [
            ce.function("And", [a, b]),
            ce.function("And", [ce.function("Not", [a]), ce.function("Not", [b])]),
          ]),
        );
      }
      return pairs.length === 0 ? ce.symbol("True") : pairs.length === 1 ? pairs[0]! : ce.function("And", pairs);
    }
    default:
      return expr;
  }
}

/** Push `Not` down to the leaves (De Morgan), collapsing double negation — `expr` must
 *  already be past `eliminateConnectives` (only `And`/`Or`/`Not` connectives left). */
function pushNegations(ce: ComputeEngine, expr: BoxedExpression): BoxedExpression {
  const op = expr.operator;
  if (op === "Not") {
    const inner = operandsOf(expr)[0]!;
    if (inner.operator === "Not") return pushNegations(ce, operandsOf(inner)[0]!);
    if (inner.operator === "And")
      return ce.function(
        "Or",
        operandsOf(inner).map((a) => pushNegations(ce, ce.function("Not", [a]))),
      );
    if (inner.operator === "Or")
      return ce.function(
        "And",
        operandsOf(inner).map((a) => pushNegations(ce, ce.function("Not", [a]))),
      );
    return ce.function("Not", [pushNegations(ce, inner)]);
  }
  if (op === "And" || op === "Or")
    return ce.function(
      op,
      operandsOf(expr).map((a) => pushNegations(ce, a)),
    );
  return expr;
}

const toBooleanNnfTree = (ce: ComputeEngine, expr: BoxedExpression): BoxedExpression =>
  pushNegations(ce, eliminateConnectives(ce, expr));

// --- canonical (deterministic) ordering ----------------------------------------------------

/** A stable sort/dedup key for a literal or subexpression — its MathJSON, serialized. Two
 *  structurally-equal boxed expressions always produce the same key, which is all
 *  determinism needs here (no claim of a "canonical" MathJSON beyond that). */
const exprKey = (expr: BoxedExpression): string => JSON.stringify(expr.json);

/** Sort and dedupe the direct operands of an `And`/`Or`, recursively — used for `"NNF"`,
 *  which (unlike DNF/CNF) doesn't otherwise get a canonicalization pass. */
function canonicalizeAndOr(ce: ComputeEngine, expr: BoxedExpression): BoxedExpression {
  const op = expr.operator;
  if (op === "And" || op === "Or") {
    const args = operandsOf(expr).map((a) => canonicalizeAndOr(ce, a));
    const uniq = dedupeSorted(args);
    return uniq.length === 1 ? uniq[0]! : ce.function(op, uniq);
  }
  if (op === "Not") return ce.function("Not", [canonicalizeAndOr(ce, operandsOf(expr)[0]!)]);
  return expr;
}

function dedupeSorted(exprs: readonly BoxedExpression[]): BoxedExpression[] {
  const seen = new Map<string, BoxedExpression>();
  for (const e of exprs) seen.set(exprKey(e), e);
  return [...seen.values()].sort((a, b) => exprKey(a).localeCompare(exprKey(b)));
}

/** A literal, decomposed into its polarity and the key of the atom it names — `Not(p)` and
 *  `p` share an atom key but differ in `neg`, which is what makes a complementary pair
 *  (`p` and `Not(p)` in the same clause) cheap to spot. */
interface Literal {
  readonly neg: boolean;
  readonly atomKey: string;
  readonly expr: BoxedExpression;
}

const toLiteral = (expr: BoxedExpression): Literal =>
  expr.operator === "Not"
    ? { neg: true, atomKey: exprKey(operandsOf(expr)[0]!), expr }
    : { neg: false, atomKey: exprKey(expr), expr };

const literalSortKey = (l: Literal): string => (l.neg ? "1" : "0") + l.atomKey;

/** Whether some atom appears both bare and negated in the same clause (`p ∧ ¬p`, or its
 *  `Or` dual `p ∨ ¬p`) — always-false for a DNF term, always-true for a CNF clause. */
function hasComplementaryPair(literals: readonly Literal[]): boolean {
  const pos = new Set<string>();
  const neg = new Set<string>();
  for (const l of literals) (l.neg ? neg : pos).add(l.atomKey);
  for (const k of pos) if (neg.has(k)) return true;
  return false;
}

function dedupeLiterals(literals: readonly Literal[]): Literal[] {
  const seen = new Map<string, Literal>();
  for (const l of literals) seen.set(literalSortKey(l), l);
  return [...seen.values()].sort((a, b) => literalSortKey(a).localeCompare(literalSortKey(b)));
}

/** Flatten `expr` (an NNF tree of `And`/`Or`/literal) into a list of clauses by distributing
 *  `splitOp` over `joinOp` — `splitOp = "Or", joinOp = "And"` builds DNF terms (an `Or` of
 *  `And`s becomes a list of AND-clauses already; an `And` of `Or`s is distributed via the
 *  cartesian product below); swapping the two ops builds CNF instead. */
function toClauses(expr: BoxedExpression, splitOp: "And" | "Or", joinOp: "And" | "Or"): BoxedExpression[][] {
  const op = expr.operator;
  if (op === splitOp) return operandsOf(expr).flatMap((a) => toClauses(a, splitOp, joinOp));
  if (op === joinOp) {
    const subs = operandsOf(expr).map((a) => toClauses(a, splitOp, joinOp));
    let acc: BoxedExpression[][] = [[]];
    for (const s of subs) {
      const next: BoxedExpression[][] = [];
      for (const partial of acc) for (const clause of s) next.push([...partial, ...clause]);
      acc = next;
    }
    return acc;
  }
  return [[expr]];
}

/** Build the final `outerOp`-of-`innerOp` expression from a set of literal clauses:
 *  drop any clause with a complementary pair (a DNF term that's always false, or a CNF
 *  clause that's always true — either way it drops out of its parent connective), dedupe
 *  literals within a clause and clauses against each other, then sort both levels for a
 *  deterministic result. `emptyValue` is what's left when every clause was dropped. */
function buildNormalForm(
  ce: ComputeEngine,
  rawClauses: readonly BoxedExpression[][],
  outerOp: "And" | "Or",
  innerOp: "And" | "Or",
  emptyValue: "True" | "False",
): BoxedExpression {
  const clauses = rawClauses.map((c) => dedupeLiterals(c.map(toLiteral))).filter((c) => !hasComplementaryPair(c));
  const clauseKey = (c: readonly Literal[]) => c.map(literalSortKey).join(",");
  const uniqueClauses = [...new Map(clauses.map((c) => [clauseKey(c), c])).values()].sort((a, b) =>
    clauseKey(a).localeCompare(clauseKey(b)),
  );
  if (uniqueClauses.length === 0) return ce.symbol(emptyValue);
  const clauseExprs = uniqueClauses.map((literals) => {
    const exprs = literals.map((l) => l.expr);
    return exprs.length === 1 ? exprs[0]! : ce.function(innerOp, exprs);
  });
  return clauseExprs.length === 1 ? clauseExprs[0]! : ce.function(outerOp, clauseExprs);
}

/** `expr` in disjunction-of-conjunctions form (an `Or` of `And`s, or simpler). */
export function normalizeToDnf(ce: ComputeEngine, expr: BoxedExpression): BoxedExpression {
  const nnf = toBooleanNnfTree(ce, expr);
  return buildNormalForm(ce, toClauses(nnf, "Or", "And"), "Or", "And", "False");
}

/** `expr` in conjunction-of-disjunctions form (an `And` of `Or`s, or simpler). */
export function normalizeToCnf(ce: ComputeEngine, expr: BoxedExpression): BoxedExpression {
  const nnf = toBooleanNnfTree(ce, expr);
  return buildNormalForm(ce, toClauses(nnf, "And", "Or"), "And", "Or", "True");
}

/** `expr` with `Implies`/`Equivalent`/`Xor`/`Nand`/`Nor` eliminated and `Not` pushed to the
 *  leaves, but NOT distributed — `And`/`Or` keep their original nesting shape, only
 *  canonically sorted/deduped at each level. */
export function normalizeToNnf(ce: ComputeEngine, expr: BoxedExpression): BoxedExpression {
  return canonicalizeAndOr(ce, toBooleanNnfTree(ce, expr));
}

// --- LogicalExpand / BooleanConvert --------------------------------------------------------

function declareLogicalExpand(ce: ComputeEngine): void {
  ce.declare("LogicalExpand", {
    signature: "(any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const expr = ops[0];
      return expr === undefined ? undefined : normalizeToDnf(ce, expr);
    },
  });
}

// "DNF"/"CNF" are Wolfram's own forms; "NNF" is our own extension — Wolfram 15's
// BooleanConvert has no "NNF" form at all (stays unevaluated there), but it falls
// straight out of the same elimination pipeline so it's implemented anyway (see
// BooleanConvert.yaml for the divergence note).
const BOOLEAN_CONVERT_FORMS = new Set(["DNF", "CNF", "NNF"]);

function declareBooleanConvert(ce: ComputeEngine): void {
  ce.declare("BooleanConvert", {
    signature: "(any, string?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const expr = ops[0];
      if (expr === undefined) return undefined;
      const form = ops.length > 1 ? stringAt(ops[1]) : "DNF";
      if (form === undefined || !BOOLEAN_CONVERT_FORMS.has(form)) return undefined; // "ESOP" etc. not implemented
      if (form === "DNF") return normalizeToDnf(ce, expr);
      if (form === "CNF") return normalizeToCnf(ce, expr);
      return normalizeToNnf(ce, expr);
    },
  });
}

// --- TrueQ -----------------------------------------------------------------------------------

/** `IsTrue(expr)`: `True` only when `expr` EVALUATES to the literal symbol `True` — anything
 *  else (an unevaluated symbolic expression, `False`, a number, …) is `False`, never a third
 *  "unknown" outcome. Matches Wolfram's `TrueQ`. */
function declareIsTrue(ce: ComputeEngine): void {
  ce.declare("IsTrue", {
    signature: "(any) -> boolean",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const expr = ops[0];
      return expr === undefined ? undefined : ce.symbol(symbolNameOf(expr.evaluate()) === "True" ? "True" : "False");
    },
  });
}

// --- IntegerQ ----------------------------------------------------------------------------

/** `IsInteger(x)`: `True` only when `x` is manifestly an integer (compute-engine's own
 *  `isInteger` check on the evaluated expression) — `False` for anything else, including a
 *  free symbol or an expression compute-engine can't classify, same "no third outcome"
 *  convention as `IsPrime`. */
function declareIsInteger(ce: ComputeEngine): void {
  ce.declare("IsInteger", {
    signature: "(any) -> boolean",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const x = ops[0];
      return x === undefined ? undefined : ce.symbol(x.evaluate().isInteger === true ? "True" : "False");
    },
  });
}

// --- VectorQ / MatrixQ / ArrayQ -------------------------------------------------------------

const isListExpr = (expr: BoxedExpression): boolean => expr.operator === "List";

/** `IsVector(list)` / `IsVector(list, test)`: `list` is a `List` none of whose elements are
 *  themselves `List`s (rank exactly 1 — a nested list is a matrix, not a vector), and (if
 *  given) `test` holds of every element. */
function declareIsVector(ce: ComputeEngine): void {
  ce.declare("IsVector", {
    signature: "(any, function?) -> boolean",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const expr = ops[0];
      if (expr === undefined) return undefined;
      if (!isListExpr(expr)) return ce.symbol("False");
      const elements = operandsOf(expr);
      const ok = !elements.some(isListExpr) && elements.every((e) => passesTest(ce, ops[1], e));
      return ce.symbol(ok ? "True" : "False");
    },
  });
}

/** `IsMatrix(m)` / `IsMatrix(m, test)`: `m` is a non-empty `List` of `List` rows, all the
 *  same length, no row itself containing a `List` (rank exactly 2), and (if given) `test`
 *  holds of every entry. */
function declareIsMatrix(ce: ComputeEngine): void {
  ce.declare("IsMatrix", {
    signature: "(any, function?) -> boolean",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const expr = ops[0];
      if (expr === undefined) return undefined;
      if (!isListExpr(expr)) return ce.symbol("False");
      const rows = operandsOf(expr);
      if (rows.length === 0 || !rows.every(isListExpr)) return ce.symbol("False");
      const width = operandsOf(rows[0]!).length;
      for (const row of rows) {
        const cells = operandsOf(row);
        if (cells.length !== width || cells.some(isListExpr) || !cells.every((c) => passesTest(ce, ops[1], c))) {
          return ce.symbol("False");
        }
      }
      return ce.symbol("True");
    },
  });
}

/** The shape of `expr` as a list of per-level lengths, `undefined` if it isn't rectangular
 *  (a ragged nesting) — a `List` leaf (no further `List` inside) has shape `[]`. */
function arrayShape(expr: BoxedExpression): number[] | undefined {
  if (expr.operator !== "List") return [];
  const elements = operandsOf(expr);
  if (elements.length === 0) return [0];
  const subShapes = elements.map(arrayShape);
  const first = subShapes[0];
  if (first === undefined) return undefined;
  for (const s of subShapes) {
    if (s === undefined || s.length !== first.length || s.some((v, i) => v !== first[i])) return undefined;
  }
  return [elements.length, ...first];
}

function arrayLeaves(expr: BoxedExpression): BoxedExpression[] {
  return expr.operator === "List" ? operandsOf(expr).flatMap(arrayLeaves) : [expr];
}

/** `IsArray(t)` / `IsArray(t, test)`: `t` is a `List` with a uniform (non-ragged) shape at
 *  every depth — any rank ≥ 1 — and (if given) `test` holds of every leaf. */
function declareIsArray(ce: ComputeEngine): void {
  ce.declare("IsArray", {
    signature: "(any, function?) -> boolean",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const expr = ops[0];
      if (expr === undefined) return undefined;
      if (!isListExpr(expr)) return ce.symbol("False");
      const shape = arrayShape(expr);
      if (shape === undefined) return ce.symbol("False");
      const ok = arrayLeaves(expr).every((leaf) => passesTest(ce, ops[1], leaf));
      return ce.symbol(ok ? "True" : "False");
    },
  });
}

// --- IsMersennePrimeExponent (Lucas–Lehmer) --------------------------------------------------

/** The exponent of the 20th known Mersenne prime — number-theory's own `MersennePrimeExponent`
 *  table (proven complete since the 1950s) tops out here too. Past this, whether `2^p − 1` is
 *  prime is an open GIMPS-scale search, so `IsMersennePrimeExponent` stays unevaluated rather
 *  than running Lucas–Lehmer on something search-scale — the cap keeps every answer this head
 *  gives EXACT rather than "probably". */
const MERSENNE_EXPONENT_CAP = 4423;

function isSmallPrime(n: number): boolean {
  if (n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return false;
  return true;
}

/** Lucas–Lehmer: `2^p − 1` is prime iff the sequence `s₀ = 4, sᵢ₊₁ = sᵢ² − 2 (mod 2^p − 1)`
 *  reaches `0` at `s_{p-2}` — requires `p` itself prime first (a composite exponent's
 *  Mersenne number always has a proper Mersenne-number factor, so it's never prime). */
function isMersennePrimeExponent(p: number): boolean {
  if (p === 2) return true;
  if (!isSmallPrime(p)) return false;
  const modulus = (1n << BigInt(p)) - 1n;
  let s = 4n;
  for (let i = 0; i < p - 2; i++) {
    s = (s * s - 2n) % modulus;
    if (s < 0n) s += modulus;
  }
  return s === 0n;
}

function declareIsMersennePrimeExponent(ce: ComputeEngine): void {
  ce.declare("IsMersennePrimeExponent", {
    signature: "(integer) -> boolean",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const n = ops[0];
      if (n === undefined || !n.isInteger) return undefined;
      const p = Number(n.re ?? Number.NaN);
      if (!Number.isFinite(p) || !Number.isInteger(p)) return undefined;
      if (p < 2) return ce.symbol("False");
      if (p > MERSENNE_EXPONENT_CAP) return undefined;
      return ce.symbol(isMersennePrimeExponent(p) ? "True" : "False");
    },
  });
}

// --- IsIntervalMember --------------------------------------------------------------------

/** A single `Interval` bound, unwrapped from `Open(...)` (default closed) and read as a
 *  double — exact enough for membership, which only ever needs a comparison. */
function intervalBound(
  bound: BoxedExpression | undefined,
): { readonly value: number; readonly open: boolean } | undefined {
  if (bound === undefined) return undefined;
  const open = bound.operator === "Open";
  const raw = open ? operandsOf(bound)[0] : bound;
  if (raw === undefined) return undefined;
  const value = raw.N().re;
  return value === undefined || Number.isNaN(value) ? undefined : { value, open };
}

/** `IsIntervalMember(Interval(lo, hi), x)`: whether `x` falls within the interval, honoring
 *  `Open(...)` on either bound (default closed). Only a single `Interval(lo, hi)` — Wolfram's
 *  union-of-intervals form `Interval({a, b}, {c, d}, …)` isn't handled. */
function declareIsIntervalMember(ce: ComputeEngine): void {
  ce.declare("IsIntervalMember", {
    signature: "(any, any) -> boolean",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [interval, x] = ops;
      if (interval === undefined || x === undefined || interval.operator !== "Interval") return undefined;
      const [loRaw, hiRaw] = operandsOf(interval);
      const lo = intervalBound(loRaw);
      const hi = intervalBound(hiRaw);
      const xv = x.N().re;
      if (lo === undefined || hi === undefined || xv === undefined || Number.isNaN(xv)) return undefined;
      const loOk = lo.open ? xv > lo.value : xv >= lo.value;
      const hiOk = hi.open ? xv < hi.value : xv <= hi.value;
      return ce.symbol(loOk && hiOk ? "True" : "False");
    },
  });
}

/** Declare the fourth Wolfram-frontier wave: boolean normal forms and the `Is…` predicates
 *  above. See the module doc for what's out of scope and why. */
export function declareLogicFrontier(ce: ComputeEngine): void {
  declareLogicalExpand(ce);
  declareBooleanConvert(ce);
  declareIsTrue(ce);
  declareIsInteger(ce);
  declareIsVector(ce);
  declareIsMatrix(ce);
  declareIsArray(ce);
  declareIsMersennePrimeExponent(ce);
  declareIsIntervalMember(ce);
}
