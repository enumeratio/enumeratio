import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, symbolNameOf } from "@enumeratio/boxed";

// FindInstance(expr, vars, [domain], [n]) — Wolfram finds `n` instances of `vars` that
// make `expr` true, over `domain` (default Complexes). We scope down hard, to a core
// that is provably correct rather than merely plausible:
//
//   1. a univariate polynomial EQUATION (degree <= 2, exact integer coefficients) is
//      solved by our own quadratic formula, which is a COMPLETE enumeration of its real
//      roots — so when every root fails the rest of the constraints, the conjunction is
//      genuinely infeasible, not just "nothing found".
//   2. failing that, compute-engine's `Solve` is tried as a best-effort finder — useful
//      for higher-degree/transcendental equations it happens to solve, but never trusted
//      to prove absence (see the empty-`Solve` note on `tryUnivariateAlgebraic` below).
//   3. a bounded integer search: when every variable's range is IMPLIED by simple
//      per-variable inequalities in `expr` (not just asserted), brute-force the box.
//      Exhaustive by construction, so an empty result here IS proof of infeasibility.
//
// Every candidate this file returns is re-substituted into every original constraint
// and re-evaluated (`verify`) before being accepted — the actual safety net, independent
// of which path produced the candidate.
//
// Anything outside this — Or, multivariate reals, non-polynomial univariate reals with
// no equation, an unbounded integer search, any domain other than Reals/Integers
// (including the default Complexes) — declines (`undefined`, left unevaluated) rather
// than guess.

const RELATIONS = new Set(["Equal", "NotEqual", "Less", "LessEqual", "Greater", "GreaterEqual"]);

interface Atom {
  readonly rel: string;
  readonly lhs: BoxedExpression;
  readonly rhs: BoxedExpression;
}

/** Flatten `expr` into its ANDed atomic relations — nested `And` flattened, an n-ary
 * chain (`Less(a,b,c)`) decomposed into consecutive pairs, our own `Inequality`
 * evaluated first so a mixed chain reaches here the same way. `undefined` for anything
 * this scope doesn't cover (`Or`, a non-relational head, ...). */
function flattenConstraints(expr: BoxedExpression): Atom[] | undefined {
  const op = expr.operator;
  if (op === "And") {
    const out: Atom[] = [];
    for (const o of operandsOf(expr)) {
      const sub = flattenConstraints(o);
      if (sub === undefined) return undefined;
      out.push(...sub);
    }
    return out;
  }
  if (op === "Inequality") {
    const reduced = expr.evaluate();
    return reduced.operator === "Inequality" ? undefined : flattenConstraints(reduced);
  }
  if (RELATIONS.has(op)) {
    const ops = operandsOf(expr);
    if (ops.length < 2) return undefined;
    const out: Atom[] = [];
    for (let i = 0; i + 1 < ops.length; i++) out.push({ rel: op, lhs: ops[i]!, rhs: ops[i + 1]! });
    return out;
  }
  return symbolNameOf(expr) === "True" ? [] : undefined;
}

function varsOf(arg: BoxedExpression): string[] | undefined {
  const name = symbolNameOf(arg);
  if (name !== undefined) return [name];
  if (arg.operator !== "List") return undefined;
  const names = operandsOf(arg).map(symbolNameOf);
  return names.every((n): n is string => n !== undefined) ? names : undefined;
}

function domainOf(arg: BoxedExpression | undefined): "Reals" | "Integers" | undefined {
  if (arg === undefined) return undefined; // the unstated default is Complexes -- out of scope
  const name = symbolNameOf(arg);
  if (name === "Reals" || name === "RealNumbers") return "Reals";
  return name === "Integers" ? "Integers" : undefined;
}

function countOf(arg: BoxedExpression | undefined): number | undefined {
  if (arg === undefined) return 1;
  const n = integerAt(arg.evaluate());
  return n !== undefined && n > 0 ? n : undefined;
}

function holds(atom: Atom, assignment: Record<string, BoxedExpression>, ce: ComputeEngine): boolean {
  return symbolNameOf(ce.function(atom.rel, [atom.lhs, atom.rhs]).subs(assignment).evaluate()) === "True";
}

function verify(atoms: readonly Atom[], assignment: Record<string, BoxedExpression>, ce: ComputeEngine): boolean {
  return atoms.every((a) => holds(a, assignment, ce));
}

// ---- degree <= 2, exact-integer-coefficient polynomials -----------------------------

function trimPoly(c: readonly number[]): number[] {
  const out = c.slice();
  while (out.length > 1 && out[out.length - 1] === 0) out.pop();
  return out;
}

function addPoly(a: readonly number[], b: readonly number[]): number[] {
  const n = Math.max(a.length, b.length);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push((a[i] ?? 0) + (b[i] ?? 0));
  return trimPoly(out);
}

function mulPoly(a: readonly number[], b: readonly number[]): number[] {
  const out = Array.from({ length: a.length + b.length - 1 }, () => 0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j]! += a[i]! * b[j]!;
  return trimPoly(out);
}

/** Exact ascending coefficients of `expr` as a polynomial in `x`, degree <= 2 —
 * `undefined` for anything outside Add/Subtract/Negate/Multiply/integer `Power(<= 2)`/a
 * bare `x` or integer literal. No division: a fractional coefficient would need exact
 * rational tracking to stay provable, which this route doesn't carry, so it declines
 * rather than round. */
function quadraticCoeffs(expr: BoxedExpression, x: string): number[] | undefined {
  const has = (e: BoxedExpression): boolean => symbolNameOf(e) === x || operandsOf(e).some(has);
  function go(e: BoxedExpression): number[] | undefined {
    if (!has(e)) {
      const v = integerAt(e.evaluate());
      return v === undefined ? undefined : [v];
    }
    if (symbolNameOf(e) === x) return [0, 1];
    const op = e.operator;
    const ops = operandsOf(e);
    if (op === "Negate" && ops.length === 1) return go(ops[0]!)?.map((c) => -c);
    if (op === "Add") {
      let acc: number[] = [0];
      for (const o of ops) {
        const p = go(o);
        if (p === undefined || (acc = addPoly(acc, p)).length > 3) return undefined;
      }
      return acc;
    }
    if (op === "Subtract" && ops.length === 2) {
      const a = go(ops[0]!);
      const b = go(ops[1]!);
      if (a === undefined || b === undefined) return undefined;
      const r = addPoly(
        a,
        b.map((c) => -c),
      );
      return r.length > 3 ? undefined : r;
    }
    if (op === "Multiply") {
      let acc: number[] = [1];
      for (const o of ops) {
        const p = go(o);
        if (p === undefined || (acc = mulPoly(acc, p)).length > 3) return undefined;
      }
      return acc;
    }
    if (op === "Power" && ops.length === 2) {
      const deg = integerAt(ops[1]!);
      if (deg === undefined || deg < 0 || deg > 2) return undefined;
      const base = go(ops[0]!);
      if (base === undefined) return undefined;
      let acc: number[] = [1];
      for (let i = 0; i < deg; i++) if ((acc = mulPoly(acc, base)).length > 3) return undefined;
      return acc;
    }
    return undefined;
  }
  return go(expr);
}

/** The COMPLETE real-root set of a degree <= 2 polynomial with ascending coefficients
 * `coeffs` — `[]` when PROVEN to have none (negative discriminant), `undefined` when
 * `coeffs` is degree 0 (no `x` term to solve: not this route's problem). */
function realRootsOfQuadratic(ce: ComputeEngine, coeffs: readonly number[]): BoxedExpression[] | undefined {
  const c = trimPoly(coeffs);
  if (c.length === 1) return undefined;
  if (c.length === 2) {
    const [c0, b] = c as [number, number];
    return [ce.function("Divide", [-c0, b]).evaluate()];
  }
  const [c0, b, a] = c as [number, number, number];
  const d = b * b - 4 * a * c0;
  if (d < 0) return [];
  if (d === 0) return [ce.function("Divide", [-b, 2 * a]).evaluate()];
  const sqrtD = Math.sqrt(d);
  const sqrtExpr = Number.isInteger(sqrtD) ? ce.number(sqrtD) : ce.function("Sqrt", [d]);
  return [
    ce.function("Divide", [ce.function("Add", [ce.function("Negate", [b]), sqrtExpr]), 2 * a]).evaluate(),
    ce.function("Divide", [ce.function("Subtract", [ce.function("Negate", [b]), sqrtExpr]), 2 * a]).evaluate(),
  ];
}

/** Real candidates from compute-engine's own `Solve` — a best-effort finder, not a
 * completeness proof (`Solve` returns the same empty list for "no solution", "solves to
 * every value" and "gave up" — see the header note). Never used to declare infeasibility. */
function solveRealCandidates(ce: ComputeEngine, equation: BoxedExpression, x: string): BoxedExpression[] {
  const solved = ce.function("Solve", [equation, ce.symbol(x)]).evaluate();
  return solved.operator === "List" ? operandsOf(solved).filter((v) => v.N().im === 0) : [];
}

function tryUnivariateAlgebraic(
  ce: ComputeEngine,
  atoms: readonly Atom[],
  x: string,
  domain: "Reals" | "Integers",
  n: number,
): readonly BoxedExpression[] | "infeasible" | undefined {
  const equalities = atoms.filter((a) => a.rel === "Equal");
  if (equalities.length === 0) return undefined;

  for (const eq of equalities) {
    const coeffs = quadraticCoeffs(ce.function("Subtract", [eq.lhs, eq.rhs]), x);
    if (coeffs === undefined) continue;
    const roots = realRootsOfQuadratic(ce, coeffs);
    if (roots === undefined) continue;
    const candidates = domain === "Integers" ? roots.filter((r) => r.isInteger === true) : roots;
    const found = candidates.filter((r) => verify(atoms, { [x]: r }, ce)).slice(0, n);
    // `roots` is the COMPLETE real root set of this equation: every solution of the
    // whole conjunction must be among them, so none surviving `verify` is a proof.
    return found.length > 0 ? found : "infeasible";
  }

  for (const eq of equalities) {
    const reals = solveRealCandidates(ce, ce.function("Equal", [eq.lhs, eq.rhs]), x);
    const candidates = domain === "Integers" ? reals.filter((r) => r.isInteger === true) : reals;
    const found = candidates.filter((r) => verify(atoms, { [x]: r }, ce)).slice(0, n);
    if (found.length > 0) return found;
  }
  return undefined;
}

// ---- bounded integer search (any number of variables) -------------------------------

/** The bound one relational `atom` places on `varName` alone — `undefined` when the
 * atom doesn't compare `varName` directly to a literal constant (couples two variables,
 * is about a different variable, or is `NotEqual`, which bounds nothing). */
function boundFromAtom(atom: Atom, varName: string): { lo?: number; hi?: number } | undefined {
  const lhsIsVar = symbolNameOf(atom.lhs) === varName;
  const rhsIsVar = symbolNameOf(atom.rhs) === varName;
  if (lhsIsVar === rhsIsVar) return undefined;
  const c = (lhsIsVar ? atom.rhs : atom.lhs).evaluate().N().re;
  if (!Number.isFinite(c)) return undefined;
  // Read every relation as "var <rel> c" -- flip it when `var` was the constant's side.
  const FLIP: Record<string, string> = {
    Less: "Greater",
    Greater: "Less",
    LessEqual: "GreaterEqual",
    GreaterEqual: "LessEqual",
  };
  const rel = lhsIsVar ? atom.rel : (FLIP[atom.rel] ?? atom.rel);
  switch (rel) {
    case "Equal":
      return { lo: Math.ceil(c), hi: Math.floor(c) };
    case "Less":
      return { hi: Math.ceil(c) - 1 };
    case "LessEqual":
      return { hi: Math.floor(c) };
    case "Greater":
      return { lo: Math.floor(c) + 1 };
    case "GreaterEqual":
      return { lo: Math.ceil(c) };
    default:
      return undefined;
  }
}

/** Every variable's range, tightened by every bound `atoms` implies for it directly —
 * `undefined` when ANY variable is left unbounded on either side (the search would not
 * terminate, or worse, silently miss instances outside an assumed box). */
function integerBounds(atoms: readonly Atom[], vars: readonly string[]): Map<string, [number, number]> | undefined {
  const bounds = new Map<string, [number, number]>(vars.map((v) => [v, [-Infinity, Infinity]]));
  for (const atom of atoms) {
    for (const v of vars) {
      const b = boundFromAtom(atom, v);
      if (b === undefined) continue;
      const [lo, hi] = bounds.get(v)!;
      bounds.set(v, [b.lo !== undefined ? Math.max(lo, b.lo) : lo, b.hi !== undefined ? Math.min(hi, b.hi) : hi]);
    }
  }
  for (const v of vars) {
    const [lo, hi] = bounds.get(v)!;
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) return undefined;
  }
  return bounds;
}

// A box past this many points declines rather than search -- keeps the call fast and
// bounded, matching the "small" in "small bounded integer searches".
const MAX_BOX_SIZE = 200_000;

function tryBoundedIntegerSearch(
  ce: ComputeEngine,
  atoms: readonly Atom[],
  vars: readonly string[],
  n: number,
): readonly BoxedExpression[][] | undefined {
  const bounds = integerBounds(atoms, vars);
  if (bounds === undefined) return undefined;
  const los = vars.map((v) => bounds.get(v)![0]);
  const sizes = vars.map((v, i) => bounds.get(v)![1] - los[i]! + 1);
  const total = sizes.reduce((a, b) => a * b, 1);
  if (total > MAX_BOX_SIZE) return undefined;

  const found: BoxedExpression[][] = [];
  for (let idx = 0; idx < total && found.length < n; idx++) {
    let rem = idx;
    const values: number[] = Array.from({ length: vars.length });
    for (let i = vars.length - 1; i >= 0; i--) {
      values[i] = los[i]! + (rem % sizes[i]!);
      rem = Math.floor(rem / sizes[i]!);
    }
    const assignment: Record<string, BoxedExpression> = {};
    vars.forEach((v, i) => (assignment[v] = ce.number(values[i]!)));
    if (verify(atoms, assignment, ce)) found.push(vars.map((v) => assignment[v]!));
  }
  // Every point in a finite, fully-bounded integer box was checked -- `[]` here is as
  // much a proof of infeasibility as the quadratic route's exhausted root set.
  return found;
}

export function declareFindInstance(ce: ComputeEngine): void {
  ce.declare("FindInstance", {
    signature: "(any, any, any?, any?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [exprArg, varsArg, domainArg, nArg] = ops;
      if (exprArg === undefined || varsArg === undefined) return undefined;
      const vars = varsOf(varsArg);
      if (vars === undefined || vars.length === 0) return undefined;
      const domain = domainOf(domainArg);
      if (domain === undefined) return undefined;
      const n = countOf(nArg);
      if (n === undefined) return undefined;
      const atoms = flattenConstraints(exprArg);
      if (atoms === undefined) return undefined;

      const wrap = (instances: readonly (readonly BoxedExpression[])[]): BoxedExpression =>
        ce.function(
          "List",
          instances.map((inst) =>
            ce.function(
              "List",
              inst.map((v, i) => ce.function("Rule", [ce.symbol(vars[i]!), v])),
            ),
          ),
        );

      if (vars.length === 1) {
        const result = tryUnivariateAlgebraic(ce, atoms, vars[0]!, domain, n);
        if (result === "infeasible") return wrap([]);
        if (result !== undefined) return wrap(result.map((v) => [v]));
      }

      if (domain === "Integers") {
        const found = tryBoundedIntegerSearch(ce, atoms, vars, n);
        if (found !== undefined) return wrap(found);
      }

      return undefined;
    },
  });
}
