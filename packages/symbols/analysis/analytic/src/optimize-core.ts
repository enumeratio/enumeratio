import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";
import { containsVar, type Recognized, recognize, signShape } from "./function-properties.ts";

// Shared machinery behind Minimize/Maximize/MinValue/MaxValue/ArgMin/ArgMax: an exact
// global optimizer for a real expression in ONE variable, over an interval that is either
// the whole line or a simple constraint Wolfram would accept as `{f, cons}`.
//
// The design principle throughout: `recognize` (from function-properties.ts) and its plain
// `number` coefficients are used ONLY for STRUCTURAL decisions -- how many real zeros a
// denominator/radicand has, which side of an asymptote is unbounded, whether a shape is in
// scope at all. Every NUMBER this file actually returns -- a critical point, an extreme
// value, a domain edge -- comes back out of the ORIGINAL exact expression through
// compute-engine's own `D` (derivative), `Solve` (critical points, poles, domain zeros),
// `Limit` (tail/edge behaviour) and `subs`+`evaluate` (the value at a point). None of that
// is reimplemented by hand, so none of it can silently drift from what compute-engine
// itself would say about the same expression.
//
// Scope (see each declaring file's reference entry for the precise list):
//   - poly, rational (P/Q with a real denominator), sqrt/log of an affine-or-quadratic
//     argument, exp of an affine argument: full Minimize/Maximize/MinValue/MaxValue/
//     ArgMin/ArgMax, unconstrained or with a simple interval constraint.
//   - sin/cos of an affine argument: MinValue/MaxValue only (the exact amplitude +-1),
//     unconstrained. Minimize/Maximize/ArgMin/ArgMax decline -- Wolfram itself picks one
//     of infinitely many equally-valid minimizers via an internal search this file has no
//     way to reproduce or verify, and a WRONG "the" point is worse than declining.
//   - a rational function with a real pole strictly inside the interval being optimized
//     over, or a sqrt whose domain splits into two disjoint rays under the requested
//     interval, decline rather than silently pick one branch.
//   - more than one variable declines outright (left for later -- see the package's
//     Minimize.yaml `details`).

// ---- interval endpoints ---------------------------------------------------------------

/** One end of an interval. `expr === undefined` means unbounded (`approx` carries the
 * sign, +-Infinity); otherwise `expr` is the EXACT boundary value and `closed` says
 * whether it is included (attained) or open (a limit, not a value, at that end). */
export interface End {
  readonly expr: BoxedExpression | undefined;
  readonly approx: number;
  readonly closed: boolean;
}

export interface Ivl {
  readonly lo: End;
  readonly hi: End;
}

export const UNBOUNDED_LO: End = { expr: undefined, approx: -Infinity, closed: false };
export const UNBOUNDED_HI: End = { expr: undefined, approx: Infinity, closed: false };
export const UNBOUNDED_IVL: Ivl = { lo: UNBOUNDED_LO, hi: UNBOUNDED_HI };

const combineLo = (a: End, b: End): End => (a.approx !== b.approx ? (a.approx > b.approx ? a : b) : a.closed ? b : a);
const combineHi = (a: End, b: End): End => (a.approx !== b.approx ? (a.approx < b.approx ? a : b) : a.closed ? b : a);

/** Intersect two intervals -- the tighter bound wins on each side, an open end beating a
 * coincident closed one. */
export function intersectIvl(a: Ivl, b: Ivl): Ivl {
  return { lo: combineLo(a.lo, b.lo), hi: combineHi(a.hi, b.hi) };
}

/** `lo <= hi` (feasible) with equal open ends counted as infeasible (an empty interval). */
export function feasible(ivl: Ivl): boolean {
  if (ivl.lo.approx > ivl.hi.approx) return false;
  if (ivl.lo.approx === ivl.hi.approx && (!ivl.lo.closed || !ivl.hi.closed)) return false;
  return true;
}

// ---- parsing a simple interval constraint ----------------------------------------------

const RELATIONS = new Set(["Less", "LessEqual", "Greater", "GreaterEqual"]);
const FLIP: Record<string, string> = {
  Less: "Greater",
  Greater: "Less",
  LessEqual: "GreaterEqual",
  GreaterEqual: "LessEqual",
};

interface Atom {
  readonly rel: string;
  readonly lhs: BoxedExpression;
  readonly rhs: BoxedExpression;
}

/** Flatten `cons` into its ANDed atomic relations -- `And` flattened, an n-ary chain
 * (`LessEqual(a, x, b)`) decomposed into consecutive pairs. `undefined` for anything this
 * scope doesn't cover (`Or`, a non-relational head). */
function flattenAtoms(cons: BoxedExpression): Atom[] | undefined {
  const op = cons.operator;
  const ops = operandsOf(cons);
  if (op === "And") {
    const out: Atom[] = [];
    for (const o of ops) {
      const sub = flattenAtoms(o);
      if (sub === undefined) return undefined;
      out.push(...sub);
    }
    return out;
  }
  if (RELATIONS.has(op) && ops.length >= 2) {
    const out: Atom[] = [];
    for (let i = 0; i + 1 < ops.length; i++) out.push({ rel: op, lhs: ops[i]!, rhs: ops[i + 1]! });
    return out;
  }
  return undefined;
}

/**
 * `cons`, a Wolfram-style simple interval constraint on `x` (`x >= a`, `a <= x <= b`, an
 * `And` of two one-sided bounds, ...), as an `Ivl`. `undefined` when `cons` isn't built
 * from that small vocabulary, couples `x` to something other than a constant, or is
 * infeasible (`lo > hi`) -- every case declines rather than guess at Wolfram's intent.
 */
export function parseInterval(ce: ComputeEngine, cons: BoxedExpression, x: string): Ivl | undefined {
  const atoms = flattenAtoms(cons);
  if (atoms === undefined || atoms.length === 0) return undefined;
  let ivl = UNBOUNDED_IVL;
  for (const atom of atoms) {
    const lhsIsX = symbolNameOf(atom.lhs) === x;
    const rhsIsX = symbolNameOf(atom.rhs) === x;
    if (lhsIsX === rhsIsX) return undefined; // both sides (or neither) mention x -- not a simple bound
    const constExpr = lhsIsX ? atom.rhs : atom.lhs;
    if (containsVar(constExpr, x)) return undefined;
    const n = constExpr.N();
    if (n.im !== 0 || !Number.isFinite(n.re)) return undefined;
    const rel = lhsIsX ? atom.rel : FLIP[atom.rel]!;
    const end: End = { expr: constExpr, approx: n.re, closed: rel === "LessEqual" || rel === "GreaterEqual" };
    if (rel === "GreaterEqual" || rel === "Greater") ivl = { lo: combineLo(ivl.lo, end), hi: ivl.hi };
    else ivl = { lo: ivl.lo, hi: combineHi(ivl.hi, end) };
  }
  return feasible(ivl) ? ivl : undefined;
}

// ---- exact real solutions of an equation, via compute-engine's own Solve ---------------

/**
 * The real roots of `lhs = 0` in `x`, EXACT and COMPLETE, or `undefined` when `Solve`
 * couldn't fully solve it (a numeric fallback root, or a non-`List` result). Never used to
 * conclude "no roots" from a decline -- only an actual `[]` list means that.
 */
export function exactRealRootsOf(ce: ComputeEngine, lhs: BoxedExpression, x: string): BoxedExpression[] | undefined {
  const solved = ce.function("Solve", [ce.function("Equal", [lhs, 0]), ce.symbol(x)]).evaluate();
  if (solved.operator !== "List") return undefined;
  const out: BoxedExpression[] = [];
  for (const r of operandsOf(solved)) {
    const n = r.N();
    if (n.im !== 0) continue;
    // `Solve` answers an equation like `1/x = 0` with `[PositiveInfinity,
    // ComplexInfinity]` -- an asymptotic "root at infinity", not a finite one. Not a
    // genuine critical point (nothing to `subs` a finite `x` with), so it's skipped, not
    // treated as a reason to decline the whole computation. Checked BEFORE `isExact`:
    // `ComplexInfinity` itself reports `isExact === false` (an "undirected infinity" isn't
    // exact in compute-engine's own numeric-literal sense), which is a different question
    // from the one `isExact` is asked below -- did `Solve` fall back to a float for a
    // otherwise-finite root -- and would wrongly decline the whole computation over a
    // candidate this file was always going to throw away.
    if (!Number.isFinite(n.re)) continue;
    if ((r as { isExact?: unknown }).isExact === false) return undefined;
    out.push(r);
  }
  return out;
}

// ---- tail/edge behaviour, via compute-engine's own Limit -------------------------------

export type Tail =
  | { readonly kind: "pos-inf"; readonly atPoint: BoxedExpression }
  | { readonly kind: "neg-inf"; readonly atPoint: BoxedExpression }
  | {
      readonly kind: "finite";
      readonly value: BoxedExpression;
      readonly approx: number;
      readonly atPoint: BoxedExpression;
    };

/** The behaviour of `expr` as `x` approaches an open end of the interval -- `end.expr`
 * itself (from the domain side, directionally) when finite, or +-Infinity when unbounded.
 * `undefined` when `Limit` can't determine it (declines, or a complex/indeterminate
 * result) -- the caller declines the whole optimization rather than guess. */
export function limitAt(
  ce: ComputeEngine,
  expr: BoxedExpression,
  x: string,
  end: End,
  side: "lo" | "hi",
): Tail | undefined {
  const point: BoxedExpression =
    end.expr === undefined ? ce.symbol(end.approx < 0 ? "NegativeInfinity" : "PositiveInfinity") : end.expr;
  const args: BoxedExpression[] =
    end.expr === undefined
      ? [expr, ce.symbol(x), point]
      : [expr, ce.symbol(x), point, ce.number(side === "lo" ? 1 : -1)];
  const r = ce.function("Limit", args).evaluate();
  if (r.operator === "Limit") return undefined;
  const n = r.N();
  if (n.im !== 0) return undefined;
  if (n.re === Infinity) return { kind: "pos-inf", atPoint: point };
  if (n.re === -Infinity) return { kind: "neg-inf", atPoint: point };
  if (!Number.isFinite(n.re)) return undefined;
  return { kind: "finite", value: r, approx: n.re, atPoint: point };
}

// ---- the extremizer ---------------------------------------------------------------------

export interface Extreme {
  readonly value: BoxedExpression;
  readonly point: BoxedExpression;
  readonly attained: boolean;
}

/**
 * Global min/max of `expr` (a single real variable `x`) over `ivl`, given that `ivl`
 * already accounts for `expr`'s own natural domain (see each shape's caller in
 * `optimize.ts`) -- `undefined` declines. Candidates are: every critical point of `D(expr,
 * x)` strictly inside `ivl` (via `Solve`, exact real roots only, or decline), plus `ivl`'s
 * own closed finite ends; each open end (finite or +-Infinity) contributes its `Limit`
 * instead, as a value that may or may not be attained. The winner is chosen by comparing
 * NUMERIC approximations (`.N()`), but the returned value/point is always the ORIGINAL
 * exact expression -- comparing approximations to pick a winner is safe (it only has to
 * order two real numbers), returning one is not (see the file header).
 */
export function extremize(
  ce: ComputeEngine,
  expr: BoxedExpression,
  x: string,
  ivl: Ivl,
  direction: "min" | "max",
): Extreme | undefined {
  const deriv = ce.function("D", [expr, ce.symbol(x)]).evaluate();
  // An identically-zero derivative means expr is constant on ivl -- Wolfram's own answer
  // there picks one arbitrary point among infinitely many correct ones (verified against
  // wolframscript: `Minimize[5, x]` names a "random"-looking rational), which this file
  // has no principled way to reproduce. Decline rather than invent a different one. Checked
  // exactly (does `deriv` still mention `x`, and is what's left exactly zero), not by
  // sampling -- a symmetric non-constant function (`x^2` on `[-1, 1]`) can give equal
  // samples at two points without being constant.
  if (!containsVar(deriv, x)) {
    const d = deriv.N();
    if (d.im === 0 && d.re === 0) return undefined;
  }

  const critical = exactRealRootsOf(ce, deriv, x);
  if (critical === undefined) return undefined;

  const strictlyInside = (pt: BoxedExpression): boolean => {
    const a = pt.N().re;
    return a > ivl.lo.approx && a < ivl.hi.approx;
  };
  const candidates: BoxedExpression[] = critical.filter(strictlyInside);
  if (ivl.lo.expr !== undefined && ivl.lo.closed) candidates.push(ivl.lo.expr);
  if (ivl.hi.expr !== undefined && ivl.hi.closed) candidates.push(ivl.hi.expr);

  let best: Extreme | undefined;
  const consider = (value: BoxedExpression, point: BoxedExpression, attained: boolean): void => {
    const n = value.N();
    // +-Infinity is a legitimate candidate (an unbounded tail) -- only NaN/complex are
    // rejected here. `Number.isFinite` would also reject +-Infinity, which is exactly the
    // value an unbounded direction needs to report.
    if (n.im !== 0 || Number.isNaN(n.re)) return;
    if (best === undefined) {
      best = { value, point, attained };
      return;
    }
    const bn = best.value.N().re;
    const better = direction === "min" ? n.re < bn : n.re > bn;
    // On a tie, an ATTAINED candidate beats an unattained one (a true minimizer beats a
    // mere infimum at the same value).
    const tie = n.re === bn;
    if (better || (tie && attained && !best.attained)) best = { value, point, attained };
  };

  for (const c of candidates) consider(expr.subs({ [x]: c }).evaluate(), c, true);

  const openEnds: Array<{ end: End; side: "lo" | "hi" }> = [];
  if (ivl.lo.expr === undefined || !ivl.lo.closed) openEnds.push({ end: ivl.lo, side: "lo" });
  if (ivl.hi.expr === undefined || !ivl.hi.closed) openEnds.push({ end: ivl.hi, side: "hi" });

  for (const { end, side } of openEnds) {
    const tail = limitAt(ce, expr, x, end, side);
    if (tail === undefined) return undefined;
    if (tail.kind === "pos-inf") {
      if (direction === "max") consider(ce.symbol("PositiveInfinity"), tail.atPoint, false);
    } else if (tail.kind === "neg-inf") {
      if (direction === "min") consider(ce.symbol("NegativeInfinity"), tail.atPoint, false);
    } else {
      consider(tail.value, tail.atPoint, false);
    }
  }

  return best;
}

// ---- pulling the exact sub-expression a Recognized shape's tag names out of `expr` -----

/** The one operand `rec`'s shape is built from, read directly off the ORIGINAL `expr` --
 * exact, unlike `Recognized`'s own (structural-only) float coefficients. `undefined` when
 * `expr`'s top-level shape doesn't match what a `recognize` tag promises (kept narrow on
 * purpose: this file only ever calls it right after `recognize` returned that same tag). */
export function exactPart(expr: BoxedExpression, tag: Recognized["tag"]): BoxedExpression | undefined {
  const op = expr.operator;
  const ops = operandsOf(expr);
  switch (tag) {
    case "rational":
      return op === "Divide" && ops.length === 2 ? ops[1] : undefined;
    case "sqrt":
      if (op === "Sqrt" && ops.length === 1) return ops[0];
      if (op === "Power" && ops.length === 2) return ops[0];
      return undefined;
    case "log":
      return (op === "Ln" || op === "Log") && ops.length === 1 ? ops[0] : undefined;
    case "exp":
      return op === "Exp" && ops.length === 1 ? ops[0] : undefined;
    case "trig":
      return (op === "Sin" || op === "Cos" || op === "Tan") && ops.length === 1 ? ops[0] : undefined;
    case "poly":
      return undefined;
  }
}

/** `rec`'s natural domain, as an `Ivl` -- `undefined` declines, `"empty"` when the domain
 * is provably empty (e.g. `Sqrt` of an always-negative quadratic). Built from EXACT zeros
 * of the exact sub-expression (`exactPart`), with only the SHAPE (how many zeros, which
 * side is which) read off `rec`'s float reconstruction. */
export function naturalDomain(
  ce: ComputeEngine,
  rec: Recognized,
  expr: BoxedExpression,
  x: string,
): Ivl | "empty" | undefined {
  switch (rec.tag) {
    case "poly":
    case "exp":
    case "rational": // a rational's poles are handled as a separate post-check, not a domain restriction
      return UNBOUNDED_IVL;
    case "sqrt": {
      const shape = signShape(rec.radicand);
      if (shape === undefined) return undefined;
      if (shape.sign === "neg") return "empty";
      // "nonpos" is a downward quadratic touching zero only at its vertex -- a single-
      // point domain, degenerate enough to decline rather than special-case.
      if (shape.sign === "nonpos") return undefined;
      if (shape.sign === "pos" || shape.sign === "nonneg" || shape.zeros.length === 0) return UNBOUNDED_IVL;
      const radicand = exactPart(expr, "sqrt");
      if (radicand === undefined) return undefined;
      const zeros = exactRealRootsOf(ce, radicand, x);
      if (zeros === undefined || zeros.length === 0 || zeros.length > 2) return undefined;
      if (zeros.length === 1) {
        const z = zeros[0]!;
        const end: End = { expr: z, approx: z.N().re, closed: true };
        // A degree-1 radicand (`shape.sign === "mixed"`, one zero): `outsideSign` says
        // which side of it is nonnegative. A degree-2 double root (`shape.sign ===
        // "nonneg"`) touches zero at its vertex and is nonnegative everywhere -- already
        // routed to the `sign === "nonneg"` branch above, so this is always the degree-1
        // case, and `outsideSign` is always defined here.
        return shape.outsideSign === 1 ? { lo: end, hi: UNBOUNDED_HI } : { lo: UNBOUNDED_LO, hi: end };
      }
      // Two distinct real zeros (shape.sign === "mixed" -- the "nonneg"/"nonpos" double-
      // root cases were already routed away above): nonneg BETWEEN them (downward
      // quadratic) is the only single-interval case; nonneg OUTSIDE them (upward) is two
      // disjoint rays -- decline.
      const [a, b] = zeros.sort((p, q) => p.N().re - q.N().re) as [BoxedExpression, BoxedExpression];
      const leadPositive = rec.radicand[rec.radicand.length - 1]! > 0;
      if (leadPositive) return undefined; // outside the roots: two disjoint rays
      return { lo: { expr: a, approx: a.N().re, closed: true }, hi: { expr: b, approx: b.N().re, closed: true } };
    }
    case "log": {
      const arg = exactPart(expr, "log");
      if (arg === undefined) return undefined;
      const zeros = exactRealRootsOf(ce, arg, x);
      if (zeros === undefined || zeros.length !== 1) return undefined;
      const z = zeros[0]!;
      const end: End = { expr: z, approx: z.N().re, closed: false };
      return rec.a > 0 ? { lo: end, hi: UNBOUNDED_HI } : { lo: UNBOUNDED_LO, hi: end };
    }
    case "trig":
      return undefined; // handled separately -- see optimize.ts
  }
}

/** For `rational` only: `expr`'s exact real poles, or `undefined` to decline (`Solve`
 * wasn't exact/complete). `[]` is a proven "no real poles". */
export function realPolesOf(ce: ComputeEngine, expr: BoxedExpression, x: string): BoxedExpression[] | undefined {
  const den = exactPart(expr, "rational");
  if (den === undefined) return undefined;
  return exactRealRootsOf(ce, den, x);
}

/** Does any of `poles` sit strictly inside, or exactly on a CLOSED end of, `ivl`? Either
 * way the interval isn't cleanly `expr`'s domain, so the caller should decline. */
export function polesConflict(poles: readonly BoxedExpression[], ivl: Ivl): boolean {
  for (const p of poles) {
    const a = p.N().re;
    if (a > ivl.lo.approx && a < ivl.hi.approx) return true;
    if (ivl.lo.closed && a === ivl.lo.approx) return true;
    if (ivl.hi.closed && a === ivl.hi.approx) return true;
  }
  return false;
}

/**
 * The full pipeline for one recognized, in-scope shape: natural domain -> intersect with
 * the caller's interval -> (rational only) pole check -> `extremize`. `undefined` declines
 * at any step. Trig is EXCLUDED here on purpose (see the file header) -- callers route it
 * to their own MinValue/MaxValue-only handling instead.
 */
export function optimizeRecognized(
  ce: ComputeEngine,
  rec: Recognized,
  expr: BoxedExpression,
  x: string,
  given: Ivl,
  direction: "min" | "max",
): Extreme | undefined {
  if (rec.tag === "trig") return undefined;
  const natural = naturalDomain(ce, rec, expr, x);
  if (natural === undefined || natural === "empty") return undefined;
  const ivl = intersectIvl(natural, given);
  if (!feasible(ivl)) return undefined;
  if (rec.tag === "rational") {
    const poles = realPolesOf(ce, expr, x);
    if (poles === undefined) return undefined;
    if (poles.length > 0) {
      // Unconstrained (still the whole line on both sides): a real pole splits the domain
      // into more than one interval -- out of scope. Constrained: fine, as long as none
      // falls inside (or on a closed end of) the interval actually being optimized over.
      const unconstrained = given.lo.expr === undefined && given.hi.expr === undefined;
      if (unconstrained || polesConflict(poles, ivl)) return undefined;
    }
  }
  return extremize(ce, expr, x, ivl, direction);
}

// Re-exported so `optimize.ts` and `nminmax.ts` can classify a call's expression without a
// second import of function-properties.ts.
export { recognize, type Recognized };
