import { type BoxedExpression, type ComputeEngine, isNumber, isSymbol } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import type { EvalOptions, NativeEval } from "./box.ts";

// DifferentialRootReduce(f(x), x) / DifferentialRoot(...)[x]: Wolfram's holonomic (D-finite)
// representation of a function — DifferentialRoot[Function[{y, x}, {ODE == 0, y[x0] == …,
// y'[x0] == …}]][x], a linear ODE with polynomial(x) coefficients plus enough derivatives at
// one point to pin down the solution. Confirmed against a local wolframscript for every case
// below: same ODE, up to the expansion point (Wolfram anchors erf/BesselJ/Airy at x = 1,
// where we use whichever point is ordinary and cheapest — 0 unless that's singular).
//
// SCOPE: exp(ax), sin(ax), cos(ax), polynomials in x, a single-pole rational function
// A/(x−a), log(1+x), arctan(x), erf(x), BesselJ(ν, x), AiryAi(x), AiryBi(x). Sums and
// products are declined (no small closure algorithm here beats a wrong answer).
//
// REPRESENTATION mirrors difference-root.ts: `Σ coeffs[i](x)·y⁽ⁱ⁾(x) == 0`, `y⁽ⁱ⁾` written
// `Apply(Derivative(y, i), x)` for i ≥ 1 (bare `y(x)` for i = 0) — the shape CE itself gives a
// `Function`-scoped `Derivative` applied to a point (see the module header of derivatives.ts).
//
// EVALUATION: DifferentialRoot(fn)(x0) is attached in place onto `Apply` (never re-declared),
// same as difference-root.ts. It expands the Taylor series of the ODE's solution about the
// stored expansion point and sums it numerically — this is the one place this package computes
// a numeric (not exact) answer by design, per the task: "evaluates numerically only if ... a
// Taylor series at an ordinary point within the radius of convergence". It declines if the
// leading coefficient vanishes at the expansion point (not an ordinary point) or if the series
// doesn't visibly settle within a generous term budget (likely outside the radius, or the
// target is complex/non-numeric).

// Self-contained -- see the same convention (and why) in difference-root.ts.
type Json = number | string | boolean | { num: string } | readonly Json[];
const j = (expr: BoxedExpression): Json => expr.json as unknown as Json;

function freshSymbol(expr: BoxedExpression, base: string): string {
  const used = new Set(expr.freeVariables);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}${i}`)) return `${base}${i}`;
}

const isExactNumber = (x: BoxedExpression): boolean => isNumber(x) && x.isExact;
const isZeroExpr = (x: BoxedExpression): boolean => isExactNumber(x) && x.re === 0 && x.im === 0;

function intLiteral(x: BoxedExpression): number | undefined {
  if (!isExactNumber(x) || x.im !== 0 || !Number.isInteger(x.re)) return undefined;
  return x.re;
}

/** `a` such that `expr` is exactly `a·varName` (a·x, x, or −x) — declines any other shape. */
function linearHomogeneousCoeff(
  ce: ComputeEngine,
  expr: BoxedExpression,
  varName: string,
): BoxedExpression | undefined {
  if (isSymbol(expr) && expr.symbol === varName) return ce.One;
  if (expr.operator === "Negate") {
    const inner = operandsOf(expr)[0];
    return inner !== undefined && isSymbol(inner) && inner.symbol === varName ? ce.NegativeOne : undefined;
  }
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    const varOps = ops.filter((o) => isSymbol(o) && o.symbol === varName);
    const rest = ops.filter((o) => !(isSymbol(o) && o.symbol === varName));
    if (varOps.length !== 1 || rest.some((o) => o.freeVariables.includes(varName))) return undefined;
    return rest.length === 0 ? ce.One : ce.box(["Multiply", ...rest.map(j)] as never).evaluate();
  }
  return undefined;
}

/** The root `a` of a degree-≤1 expression in `varName` (`c·(x − a)`, any nonzero `c`), found
 * from its values at x = 0 and x = 1 rather than by differentiating: `deg0 = e(0)`,
 * `deg1 = e(1) − e(0)`, `root = −deg0 / deg1`. Declines a non-degree-1 or non-affine input. */
function linearRoot(ce: ComputeEngine, expr: BoxedExpression, varName: string): BoxedExpression | undefined {
  const at = (v: number) => expr.subs({ [varName]: v } as never).evaluate();
  const deg0 = at(0);
  const deg1 = ce.box(["Subtract", j(at(1)), j(deg0)] as never).evaluate();
  if (isZeroExpr(deg1)) return undefined; // not degree 1 (or identically 0)
  // sanity: an actually-linear expression must reproduce its own value at x = 2 from these two
  const predicted = ce.box(["Add", j(deg0), ["Multiply", 2, j(deg1)]] as never).evaluate();
  if (!predicted.isEqual(at(2))) return undefined; // not affine in varName (e.g. quadratic)
  return ce.box(["Divide", ["Negate", j(deg0)], j(deg1)] as never).evaluate();
}

/** The internal, order-agnostic ODE shape (always homogeneous — see the header): `Σ
 * coeffs[i](x)·y⁽ⁱ⁾(x) == 0`, plus `y⁽ⁱ⁾(x0)` for i = 0..order−1 at one expansion point. */
interface LinearOde {
  readonly order: number;
  readonly coeffs: readonly BoxedExpression[]; // length order + 1, functions of varName
  readonly varName: string;
  readonly x0: number; // the expansion point — 0 unless it's singular for this ODE
  readonly ics: readonly BoxedExpression[]; // length order, y(x0), y'(x0), …
}

function reduceOde(ce: ComputeEngine, expr: BoxedExpression, varName: string): LinearOde | undefined {
  const ops = operandsOf(expr);

  // compute-engine canonicalizes `Exp(u)` to `Power(ExponentialE, u)`, so both shapes are
  // checked (the guard is symmetric: whichever operand isn't `E` must be the linear exponent).
  const isE = (e: BoxedExpression) => isSymbol(e) && e.symbol === "ExponentialE";
  if (expr.operator === "Exp" || (expr.operator === "Power" && ops.length === 2 && isE(ops[0]!))) {
    const exponent = expr.operator === "Exp" ? ops[0] : ops[1];
    const a = exponent === undefined ? undefined : linearHomogeneousCoeff(ce, exponent, varName);
    if (a === undefined) return undefined;
    return { order: 1, coeffs: [ce.box(["Negate", j(a)] as never).evaluate(), ce.One], varName, x0: 0, ics: [ce.One] };
  }
  if (expr.operator === "Sin" || expr.operator === "Cos") {
    const a = ops.length === 1 ? linearHomogeneousCoeff(ce, ops[0]!, varName) : undefined;
    if (a === undefined) return undefined;
    const a2 = ce.box(["Multiply", j(a), j(a)] as never).evaluate();
    const ics = expr.operator === "Sin" ? [ce.Zero, a] : [ce.One, ce.Zero];
    return { order: 2, coeffs: [a2, ce.Zero, ce.One], varName, x0: 0, ics };
  }
  if (expr.operator === "Ln" && ops.length === 1) {
    const arg = ops[0]!;
    const isOnePlusX =
      arg.operator === "Add" &&
      operandsOf(arg).length === 2 &&
      operandsOf(arg).some((o) => isExactNumber(o) && o.re === 1) &&
      operandsOf(arg).some((o) => isSymbol(o) && o.symbol === varName);
    if (!isOnePlusX) return undefined;
    // (1+x) y'' + y' == 0, y(0) = 0, y'(0) = 1
    return {
      order: 2,
      coeffs: [ce.Zero, ce.One, ce.box(["Add", 1, varName] as never)],
      varName,
      x0: 0,
      ics: [ce.Zero, ce.One],
    };
  }
  if (expr.operator === "Arctan" && ops.length === 1 && isSymbol(ops[0]!) && ops[0]!.symbol === varName) {
    // (1+x^2) y'' + 2x y' == 0, y(0) = 0, y'(0) = 1
    return {
      order: 2,
      coeffs: [ce.Zero, ce.box(["Multiply", 2, varName] as never), ce.box(["Add", 1, ["Power", varName, 2]] as never)],
      varName,
      x0: 0,
      ics: [ce.Zero, ce.One],
    };
  }
  if (expr.operator === "Erf" && ops.length === 1 && isSymbol(ops[0]!) && ops[0]!.symbol === varName) {
    // y'' + 2x y' == 0, y(0) = 0, y'(0) = 2/sqrt(pi)
    return {
      order: 2,
      coeffs: [ce.Zero, ce.box(["Multiply", 2, varName] as never), ce.One],
      varName,
      x0: 0,
      ics: [ce.Zero, ce.box(["Divide", 2, ["Sqrt", "Pi"]] as never).N()],
    };
  }
  if (expr.operator === "AiryAi" || expr.operator === "AiryBi") {
    if (ops.length !== 1 || !isSymbol(ops[0]!) || ops[0]!.symbol !== varName) return undefined;
    // y'' - x y == 0, y(0), y'(0) from the native functions themselves
    return {
      order: 2,
      coeffs: [ce.box(["Negate", varName] as never), ce.Zero, ce.One],
      varName,
      x0: 0,
      ics: [nativeAt(expr, varName, 0), nativeDerivAt(ce, expr, varName, 0, 1)],
    };
  }
  if (expr.operator === "BesselJ" && ops.length === 2) {
    const [nu, arg] = ops;
    if (nu === undefined || arg === undefined || !isSymbol(arg) || arg.symbol !== varName) return undefined;
    if (nu.freeVariables.includes(varName)) return undefined;
    // x^2 y'' + x y' + (x^2 - nu^2) y == 0. x = 0 is a singular point (unless nu = 0), so
    // anchor at x = 1 instead, matching Wolfram's own choice here.
    return {
      order: 2,
      coeffs: [
        ce.box(["Subtract", ["Power", varName, 2], ["Power", j(nu), 2]] as never),
        ce.box(varName as never),
        ce.box(["Power", varName, 2] as never),
      ],
      varName,
      x0: 1,
      ics: [nativeAt(expr, varName, 1), nativeDerivAt(ce, expr, varName, 1, 1)],
    };
  }
  if (expr.operator === "Divide" && ops.length === 2) {
    const [num, den] = ops;
    if (num === undefined || den === undefined || num.freeVariables.includes(varName)) return undefined;
    const a = linearRoot(ce, den, varName);
    if (a === undefined) return undefined;
    // y = A / (x - a): (x - a) y' + y == 0, at x0 = 0 provided a != 0 (an ordinary point).
    const x0 = isZeroExpr(a) ? 1 : 0; // avoid the pole itself as the expansion point
    return {
      order: 1,
      coeffs: [ce.One, ce.box(["Subtract", varName, j(a)] as never)],
      varName,
      x0,
      ics: [nativeAt(expr, varName, x0)],
    };
  }
  if (isPolynomialIn(expr)) {
    const degree = polynomialDegree(ce, expr, varName);
    if (degree === undefined) return undefined;
    const order = degree + 1;
    const coeffs = Array.from({ length: order + 1 }, (_, i) => (i === order ? ce.One : ce.Zero));
    const ics = Array.from({ length: order }, (_, i) => nativeDerivAt(ce, expr, varName, 0, i));
    return { order, coeffs, varName, x0: 0, ics };
  }
  return undefined;
}

/** Whether `expr` is a polynomial (in whichever symbol the caller cares about) with exact
 * (possibly symbolic) coefficients. */
function isPolynomialIn(expr: BoxedExpression): boolean {
  if (isSymbol(expr)) return true;
  if (isExactNumber(expr)) return true;
  const ops = operandsOf(expr);
  switch (expr.operator) {
    case "Add":
    case "Multiply":
    case "Subtract":
      return ops.length > 0 && ops.every((o) => isPolynomialIn(o));
    case "Negate":
      return ops.length === 1 && isPolynomialIn(ops[0]!);
    case "Power": {
      const [base, exp] = ops;
      const k = base === undefined || exp === undefined ? undefined : intLiteral(exp);
      return base !== undefined && k !== undefined && k >= 0 && isPolynomialIn(base);
    }
    default:
      return false;
  }
}

/** The degree of a (confirmed) polynomial, found by probing `D` until it settles at 0. Caps at
 * 8 as a sanity bound — nothing in this package's scope needs more. */
function polynomialDegree(ce: ComputeEngine, expr: BoxedExpression, varName: string): number | undefined {
  let d: BoxedExpression = expr;
  for (let deg = 0; deg <= 8; deg++) {
    const at0 = d.subs({ [varName]: 0 } as never).evaluate();
    const isConst = !d.freeVariables.includes(varName);
    if (isConst) return isZeroExpr(d) && deg === 0 ? 0 : deg;
    void at0;
    d = ce.box(["D", j(d), varName] as never).evaluate();
    if (d.operator === "D") return undefined; // compute-engine declined
  }
  return undefined;
}

/** `D^k(f)(x0)` — used only at reduction time to build initial conditions from the ORIGINAL
 * expression, never at `Apply` evaluation time (see series-coefficient.ts for the pattern). */
function nativeDerivAt(ce: ComputeEngine, expr: BoxedExpression, varName: string, x0: number, k = 0): BoxedExpression {
  let d = expr;
  for (let i = 0; i < k; i++) d = ce.box(["D", j(d), varName] as never).evaluate();
  return d.subs({ [varName]: x0 } as never).evaluate();
}

function nativeAt(expr: BoxedExpression, varName: string, x0: number): BoxedExpression {
  return expr.subs({ [varName]: x0 } as never).evaluate();
}

/** `Apply(Derivative(y, k), x)` for k ≥ 1, bare `y(x)` for k = 0 — see the module header. */
/** `y⁽ᵏ⁾(at)` — `at` is the symbolic bound variable in the ODE equation itself, or a literal
 * expansion point in an initial condition (see the module header for the two shapes). */
const yDeriv = (yName: string, at: Json, k: number): Json =>
  k === 0 ? [yName, at] : ["Apply", ["Derivative", yName, k], at];

function buildFunction(ce: ComputeEngine, ode: LinearOde, yName: string): BoxedExpression {
  const terms: Json[] = [];
  for (let i = 0; i <= ode.order; i++) {
    if (isZeroExpr(ode.coeffs[i]!)) continue;
    terms.push(["Multiply", j(ode.coeffs[i]!), yDeriv(yName, ode.varName, i)]);
  }
  const odeEq: Json = ["Equal", ["Add", ...terms], 0];
  const icEqs: Json[] = ode.ics.map((value, i) => ["Equal", yDeriv(yName, ode.x0, i), j(value)]);
  return ce.box(["Function", ["List", odeEq, ...icEqs], yName, ode.varName] as never);
}

export function declareDifferentialRoot(ce: ComputeEngine): void {
  ce.declare("DifferentialRoot", { signature: "(any) -> any" }); // inert data carrier

  ce.declare("DifferentialRootReduce", {
    signature: "(any, symbol) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [expr, varExpr] = ops;
      if (expr === undefined || varExpr === undefined || !isSymbol(varExpr)) return undefined;
      const varName = varExpr.symbol!;
      const boundVar = freshSymbol(expr, "x");
      const renamed = boundVar === varName ? expr : expr.subs({ [varName]: boundVar } as never);
      const ode = reduceOde(ce, renamed, boundVar);
      if (ode === undefined) return undefined;
      const yName = freshSymbol(renamed, "y");
      const fn = buildFunction(ce, ode, yName);
      const root = ce.box(["DifferentialRoot", j(fn)] as never);
      return ce.box([j(root), j(varExpr)] as never);
    },
  });

  attachDifferentialRootApply(ce);
}

// --- evaluation: DifferentialRoot(fn)(x0), attached onto the native `Apply` operator ------

function classifyEquation(
  eq: BoxedExpression,
  yName: string,
  varName: string,
):
  | { kind: "ic"; order: number; point: number; value: BoxedExpression }
  | { kind: "ode"; lhs: BoxedExpression }
  | undefined {
  const [lhs, rhs] = operandsOf(eq);
  if (eq.operator !== "Equal" || lhs === undefined || rhs === undefined) return undefined;
  if (lhs.freeVariables.includes(varName)) return { kind: "ode", lhs };
  if (lhs.operator === yName) {
    // y(x0) == value
    const point = intLiteral(operandsOf(lhs)[0]!);
    return point === undefined ? undefined : { kind: "ic", order: 0, point, value: rhs };
  }
  if (lhs.operator === "Apply") {
    const [derivHead, pointExpr] = operandsOf(lhs);
    const point = pointExpr === undefined ? undefined : intLiteral(pointExpr);
    if (derivHead?.operator === "Derivative" && point !== undefined) {
      const [dy, k] = operandsOf(derivHead);
      const order = dy !== undefined && isSymbol(dy) && dy.symbol === yName ? intLiteral(k!) : undefined;
      if (order !== undefined) return { kind: "ic", order, point, value: rhs };
    }
  }
  return undefined;
}

/** Pull `coeffs[]` back out of the ODE equation's LHS (`== 0`), scanning its additive terms —
 * see difference-root.ts's `parseRecurrence` for why this doesn't assume term order/shape. */
function parseOde(ce: ComputeEngine, lhs: BoxedExpression, yName: string): Map<number, BoxedExpression> | undefined {
  const terms = lhs.operator === "Add" ? operandsOf(lhs) : [lhs];
  const coeffs = new Map<number, BoxedExpression>();
  const addCoeff = (order: number, c: BoxedExpression) => {
    const prev = coeffs.get(order);
    coeffs.set(order, prev === undefined ? c : ce.box(["Add", j(prev), j(c)] as never).evaluate());
  };
  /** the derivative order of a `y(x)` / `Apply(Derivative(y,k),x)` call, or undefined. */
  const orderOf = (call: BoxedExpression): number | undefined => {
    if (call.operator === yName) return 0;
    if (call.operator === "Apply") {
      const [derivHead] = operandsOf(call);
      if (derivHead?.operator === "Derivative") {
        const [dy, k] = operandsOf(derivHead);
        if (dy !== undefined && isSymbol(dy) && dy.symbol === yName) return intLiteral(k!);
      }
    }
    return undefined;
  };
  const decomposeTerm = (term: BoxedExpression): { order: number | undefined; coeff: BoxedExpression } => {
    if (term.operator === "Negate") {
      const inner = decomposeTerm(operandsOf(term)[0]!);
      return { order: inner.order, coeff: ce.box(["Negate", j(inner.coeff)] as never).evaluate() };
    }
    const factors = term.operator === "Multiply" ? operandsOf(term) : [term];
    let order: number | undefined;
    const rest: BoxedExpression[] = [];
    for (const f of factors) {
      const o = orderOf(f);
      if (o !== undefined) order = o;
      else rest.push(f);
    }
    const coeff = rest.length === 0 ? ce.One : ce.box(["Multiply", ...rest.map(j)] as never).evaluate();
    return { order, coeff };
  };
  for (const term of terms) {
    const { order, coeff } = decomposeTerm(term);
    if (order === undefined) return undefined; // a constant term -- every case in our scope is homogeneous
    addCoeff(order, coeff);
  }
  if (coeffs.size === 0) return undefined;
  const order = Math.max(...coeffs.keys());
  for (let i = 0; i <= order; i++) if (!coeffs.has(i)) coeffs.set(i, ce.Zero);
  return coeffs;
}

/** `poly`'s first `count` Taylor coefficients about `x0` — `poly(x0+t) = Σ a_k t^k` — via
 * `count` calls to `D` (our scope's coefficients are all degree ≤ 2, so this terminates in a
 * couple of steps once it hits the zero polynomial). Numeric (`.N()`), not exact: the ODE
 * evaluator is the one numeric-only path in this package. */
function taylorCoeffsOf(
  ce: ComputeEngine,
  poly: BoxedExpression,
  varName: string,
  x0: number,
  count: number,
): number[] {
  const out: number[] = [];
  let d = poly;
  let fact = 1;
  for (let k = 0; k < count; k++) {
    const at = d.subs({ [varName]: x0 } as never).N();
    out.push(at.re / fact);
    d = ce.box(["D", j(d), varName] as never).evaluate();
    fact *= k + 1;
  }
  return out;
}

const fallingFactorial = (n: number, k: number): number => {
  let r = 1;
  for (let t = 0; t < k; t++) r *= n - t;
  return r;
};

const COEFF_DEGREE_CAP = 4; // every coefficient polynomial in this package's scope has degree <= 2
// A term budget generous enough for a target close to the radius of convergence (e.g.
// arctan/log(1+x) at |t| = 0.9, radius 1: |t|^m needs m in the high hundreds to reach
// `CONVERGED`) while still cheap in plain double arithmetic.
const MAX_TAYLOR_TERMS = 2000;
const CONVERGED = 1e-14;

/** Sum the ODE's Taylor series at `target`, expanded about `x0`. Declines (undefined) when the
 * leading coefficient vanishes at `x0` (not an ordinary point there) or the series doesn't
 * settle within the term budget (likely outside the radius of convergence, or `target` isn't a
 * plain real number). */
function evaluateOde(
  ce: ComputeEngine,
  order: number,
  coeffs: Map<number, BoxedExpression>,
  varName: string,
  x0: number,
  ics: readonly BoxedExpression[],
  target: number,
): number | undefined {
  const shifted = Array.from({ length: order + 1 }, (_, i) =>
    taylorCoeffsOf(ce, coeffs.get(i) ?? ce.Zero, varName, x0, COEFF_DEGREE_CAP),
  );
  const leading0 = shifted[order]![0]!;
  if (Math.abs(leading0) < 1e-300) return undefined; // not an ordinary point

  const a: number[] = [];
  for (let i = 0; i < order; i++) {
    const v = ics[i]?.N();
    if (v === undefined || !Number.isFinite(v.re)) return undefined;
    let fact = 1;
    for (let f = 2; f <= i; f++) fact *= f;
    a[i] = v.re / fact;
  }

  const t = target - x0;
  let sum = 0;
  for (let i = 0; i < order; i++) sum += a[i]! * t ** i;
  // A window of recent term magnitudes, not just the immediately preceding one: several of
  // this package's series (sin, cos, arctan, erf, …) are odd or even in `t` and so have exact
  // zero coefficients at every other index, which would otherwise look like convergence one
  // step early.
  const WINDOW = 6;
  const recent: number[] = Array.from({ length: WINDOW }, () => Number.POSITIVE_INFINITY);

  for (let m = order; m < MAX_TAYLOR_TERMS; m++) {
    let rhs = 0;
    for (let i = 0; i <= order; i++) {
      const poly = shifted[i]!;
      for (let jj = 0; jj < poly.length; jj++) {
        if (i === order && jj === 0) continue;
        const aIndex = m - order + i - jj; // always < m for (i, jj) != (order, 0) -- see the header derivation
        if (aIndex < 0) continue;
        const av = a[aIndex];
        if (av === undefined) continue;
        // the term `p_i[jj]·t^jj · (aIndex)_i·a_{aIndex}·t^{aIndex-i}` contributes to t^m — the
        // falling factorial's argument is `aIndex` itself (`aIndex = m - order + i - jj`), not
        // `m - order + i`: it's the power-series index being brought down by differentiation,
        // and `jj` shifts which one that is.
        rhs += poly[jj]! * fallingFactorial(aIndex, i) * av;
      }
    }
    const am = -rhs / (leading0 * fallingFactorial(m, order));
    a[m] = am;
    const term = am * t ** m;
    sum += term;
    recent[m % WINDOW] = Math.abs(term);
    if (m > order + WINDOW && recent.every((r) => r < CONVERGED * (1 + Math.abs(sum)))) return sum;
    if (!Number.isFinite(sum) || Math.abs(sum) > 1e12) return undefined; // diverging -- outside the radius
  }
  return undefined; // did not settle within the term budget
}

function attachDifferentialRootApply(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Apply");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) return;
  const native: NativeEval = operator.evaluate;
  operator.evaluate = (ops: readonly BoxedExpression[], options: EvalOptions): BoxedExpression | undefined => {
    const [target, arg] = ops;
    if (ops.length === 2 && target !== undefined && target.operator === "DifferentialRoot" && arg !== undefined) {
      const fn = operandsOf(target)[0];
      const xt = arg.evaluate();
      if (fn === undefined || !isNumber(xt) || xt.im !== 0 || !Number.isFinite(xt.re)) return undefined;
      const fnOps = operandsOf(fn);
      const block: BoxedExpression | undefined = fnOps[0];
      const ySym: BoxedExpression | undefined = fnOps[1];
      const varSym: BoxedExpression | undefined = fnOps[2];
      const body = block?.operator === "Block" ? operandsOf(block)[0] : block;
      if (body?.operator !== "List" || !isSymbol(ySym) || !isSymbol(varSym)) return undefined;
      const yName = ySym.symbol;
      const varName = varSym.symbol;
      if (yName === undefined || varName === undefined) return undefined;
      const ics = new Map<number, BoxedExpression>();
      let odeLhs: BoxedExpression | undefined;
      let x0: number | undefined;
      for (const eq of operandsOf(body)) {
        const c = classifyEquation(eq, yName, varName);
        if (c === undefined) return undefined;
        if (c.kind === "ic") {
          ics.set(c.order, c.value);
          x0 = c.point; // every IC in a reduction of ours shares one expansion point
        } else odeLhs = c.lhs;
      }
      if (odeLhs === undefined || x0 === undefined) return undefined;
      const coeffs = parseOde(ce, odeLhs, yName);
      if (coeffs === undefined) return undefined;
      const order = Math.max(...coeffs.keys());
      const icArray: BoxedExpression[] = [];
      for (let i = 0; i < order; i++) {
        const v = ics.get(i);
        if (v === undefined) return undefined;
        icArray.push(v);
      }
      const result = evaluateOde(ce, order, coeffs, varName, x0, icArray, xt.re);
      return result === undefined ? undefined : ce.number(result);
    }
    return native?.(ops, options);
  };
}
