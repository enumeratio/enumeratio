import { type BoxedExpression, type ComputeEngine, isNumber, isSymbol } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import type { EvalOptions, NativeEval } from "./box.ts";

// DifferenceRootReduce(f(n), n) / DifferenceRoot(...)[n]: Wolfram's holonomic (P-recursive)
// representation of a sequence — DifferenceRoot[Function[{y, n}, {recurrence == 0, y[i] ==
// a, …}]][n], a linear recurrence with polynomial(n) coefficients plus enough initial values
// to pin down the sequence. Confirmed against a local wolframscript for every case below
// (Fibonacci, Binomial, CatalanNumber, a^n, HarmonicNumber): same recurrence up to the
// arbitrary anchor point Wolfram's own algorithm happens to pick.
//
// SCOPE (correctness over coverage — everything else declines, leaving the call symbolic):
//   - order-1 "hypergeometric" terms: Factorial(n), a^n, CatalanNumber(n), polynomials in n,
//     Binomial(n, k) for k a concrete non-negative integer, and products/quotients of these.
//   - order-2 constant-coefficient: Fibonacci(n), LucasL(n).
//   - order-1 with a constant inhomogeneous term: HarmonicNumber(n) — Wolfram's own reduction
//     is (n+1)(y(n+1) − y(n)) = 1, not the order-2 homogeneous form a naive derivation gives;
//     probing beat guessing here.
//   - sum of two order-1 hypergeometric terms, order ≤ 2, via the classical cross-product
//     elimination (Petkovšek's sum rule for two hypergeometric terms).
//
// REPRESENTATION: `Function([recurrenceEq, ic...], y, n)`, y/n named to avoid colliding with
// the input's own free variables (see `freshSymbol`). The recurrence is
// `Σ coeffs[i](n)·y(n+i) + rhsConst(n) == 0`, `i` from 0 to `order`; the leading coefficient
// `coeffs[order]` is Wolfram's own convention (dividing through would introduce a spurious
// pole in the *coefficients* at exactly the points the unsolved form still evaluates
// correctly, see `evaluateAt` below on Binomial(n, k)'s anchor pair).
//
// EVALUATION: `DifferenceRoot(fn)(n0)` is attached in place onto the native `Apply` operator
// (never re-declared — see derivatives.ts) and runs the recurrence forward from whichever
// initial condition anchor is closest below `n0`, in exact rational arithmetic via `ce`'s own
// arithmetic. It declines (stays symbolic) rather than divide by a leading coefficient that
// evaluates to exactly 0 with no anchor to jump to.

// Self-contained (not tied to compute-engine's own recursive `ExpressionInput` union, whose
// variance doesn't play well with array literals mixing plain numbers/strings and nested
// `Json` — see bernoulli.ts for the same convention); `ce.box(x as never)` at every
// construction site is the boundary back into compute-engine's own types.
type Json = number | string | boolean | { num: string } | readonly Json[];

const j = (expr: BoxedExpression): Json => expr.json as unknown as Json;

/** A name not among `expr`'s free variables, so the reduction's own `Function` scope can't
 * shadow something the input actually uses (e.g. `Binomial(n, y)` with `y` a free parameter). */
function freshSymbol(expr: BoxedExpression, base: string): string {
  const used = new Set(expr.freeVariables);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}${i}`)) return `${base}${i}`;
}

const isExactNumber = (x: BoxedExpression): boolean => isNumber(x) && x.isExact;

/** The integer an exact numeric literal names, or undefined (declines non-integers). */
function intLiteral(x: BoxedExpression): number | undefined {
  if (!isExactNumber(x) || x.im !== 0 || !Number.isInteger(x.re)) return undefined;
  return x.re;
}

const isZeroExpr = (x: BoxedExpression): boolean => isExactNumber(x) && x.re === 0 && x.im === 0;

/** Whether `expr` is built only from symbols (the reduction's own variable or any other,
 * treated as a symbolic constant), exact numeric literals, and +, −, ×, and integer powers —
 * i.e. a polynomial with possibly-symbolic coefficients, in whichever symbol the caller cares
 * about. */
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
      return ops.length === 1 && isPolynomialIn(ops[0]);
    case "Power": {
      const [base, exp] = ops;
      return (
        base !== undefined &&
        exp !== undefined &&
        intLiteral(exp) !== undefined &&
        intLiteral(exp)! >= 0 &&
        isPolynomialIn(base)
      );
    }
    default:
      return false;
  }
}

/** A hypergeometric term's ratio t(n+1)/t(n) = num(n)/den(n), both in terms of `varName`. */
interface Ratio {
  readonly num: BoxedExpression;
  readonly den: BoxedExpression;
}

const ONE = (ce: ComputeEngine) => ce.One;

/** Decompose a hypergeometric-term expression into its ratio, or decline (undefined). Handles
 * Factorial(n), a^n, CatalanNumber(n), polynomials in n, and Multiply/Divide/Negate/Power
 * combinations of these. Binomial(n, k) is handled only as the WHOLE expression (see
 * `reduceOrder1`) because its anchor pair isn't a plain ratio. */
function decomposeRatio(ce: ComputeEngine, expr: BoxedExpression, varName: string): Ratio | undefined {
  const ops = operandsOf(expr);
  const shiftUp = (e: BoxedExpression) => e.subs({ [varName]: ["Add", varName, 1] as never }).evaluate();

  if (!expr.freeVariables.includes(varName)) return { num: expr, den: ONE(ce) }; // constant factor

  if (expr.operator === "Multiply") {
    let num = ONE(ce);
    let den = ONE(ce);
    for (const f of ops) {
      const r = decomposeRatio(ce, f, varName);
      if (r === undefined) return undefined;
      num = ce.box(["Multiply", j(num), j(r.num)] as never).evaluate();
      den = ce.box(["Multiply", j(den), j(r.den)] as never).evaluate();
    }
    return { num, den };
  }
  if (expr.operator === "Divide" && ops.length === 2) {
    const [a, b] = ops;
    const ra = decomposeRatio(ce, a, varName);
    const rb = decomposeRatio(ce, b, varName);
    if (ra === undefined || rb === undefined) return undefined;
    return {
      num: ce.box(["Multiply", j(ra.num), j(rb.den)] as never).evaluate(),
      den: ce.box(["Multiply", j(ra.den), j(rb.num)] as never).evaluate(),
    };
  }
  if (expr.operator === "Negate" && ops.length === 1) return decomposeRatio(ce, ops[0], varName); // sign cancels in a ratio

  if (expr.operator === "Factorial" && ops.length === 1 && isSymbol(ops[0]) && ops[0].symbol === varName) {
    return { num: ce.box(["Add", varName, 1] as never), den: ONE(ce) };
  }
  if (expr.operator === "CatalanNumber" && ops.length === 1 && isSymbol(ops[0]) && ops[0].symbol === varName) {
    return {
      num: ce.box(["Multiply", 2, ["Add", ["Multiply", 2, varName], 1]] as never),
      den: ce.box(["Add", varName, 2] as never),
    };
  }
  if (expr.operator === "Power" && ops.length === 2) {
    const [base, exp] = ops;
    if (!base.freeVariables.includes(varName) && isSymbol(exp) && exp.symbol === varName) {
      if (isZeroExpr(base)) return undefined; // 0^n, declined
      return { num: base, den: ONE(ce) }; // a^n
    }
    const k = intLiteral(exp);
    if (base.freeVariables.includes(varName) && k !== undefined && k >= 0) {
      const r = decomposeRatio(ce, base, varName);
      if (r === undefined) return undefined;
      return {
        num: ce.box(["Power", j(r.num), k] as never).evaluate(),
        den: ce.box(["Power", j(r.den), k] as never).evaluate(),
      };
    }
    return undefined;
  }
  if (isPolynomialIn(expr)) return { num: shiftUp(expr), den: expr };
  return undefined;
}

/** Native evaluation of the original expression at a concrete index — used only to build
 * initial-condition anchors at reduction time, never at `Apply` evaluation time. */
function nativeAt(expr: BoxedExpression, varName: string, index: number): BoxedExpression {
  return expr.subs({ [varName]: index }).evaluate();
}

/** The reduction's internal, order-agnostic shape: `Σ coeffs[i](n)·y(n+i) + rhsConst(n) == 0`
 * plus enough `(index, value)` anchors to bootstrap forward stepping past every point where
 * `coeffs[order]` vanishes (see `evaluateAt`). */
interface LinearRec {
  readonly order: number;
  readonly coeffs: readonly BoxedExpression[]; // length order + 1, functions of varName
  readonly rhsConst: BoxedExpression; // function of varName; 0 for every homogeneous case
  readonly varName: string;
  readonly anchors: ReadonlyMap<number, BoxedExpression>;
}

/** Order-1 reduction: Binomial(n, k) as a whole (its own anchor pair), else the general
 * hypergeometric-ratio decomposition, with an extra anchor at n = 1 when the ratio's own
 * denominator vanishes at n = 0 (a monomial n^k, say) so forward stepping never needs it. */
function reduceOrder1(ce: ComputeEngine, expr: BoxedExpression, varName: string): LinearRec | undefined {
  const ops = operandsOf(expr);
  if (expr.operator === "Binomial" && ops.length === 2 && isSymbol(ops[0]) && ops[0].symbol === varName) {
    const k = intLiteral(ops[1]);
    if (k === undefined || k < 0 || ops[1].freeVariables.includes(varName)) return undefined;
    const A = ce.box(["Add", varName, 1] as never); // n + 1
    const B = ce.box(["Subtract", A.json as never, k] as never).evaluate(); // n + 1 - k
    const anchors = new Map<number, BoxedExpression>([
      [-1, nativeAt(expr, varName, -1)],
      [k, ce.One],
    ]);
    return {
      order: 1,
      coeffs: [ce.box(["Negate", A.json as never] as never).evaluate(), B],
      rhsConst: ce.Zero,
      varName,
      anchors,
    };
  }

  const ratio = decomposeRatio(ce, expr, varName);
  if (ratio === undefined) return undefined;
  const anchors = new Map<number, BoxedExpression>([[0, nativeAt(expr, varName, 0)]]);
  const denAt0 = ratio.den.subs({ [varName]: 0 }).evaluate();
  if (isZeroExpr(denAt0)) {
    const v1 = nativeAt(expr, varName, 1);
    if (!isNumber(v1) || !Number.isFinite(v1.re) || !Number.isFinite(v1.im)) return undefined;
    anchors.set(1, v1);
  }
  return {
    order: 1,
    coeffs: [ce.box(["Negate", j(ratio.num)] as never).evaluate(), ratio.den],
    rhsConst: ce.Zero,
    varName,
    anchors,
  };
}

/** Fibonacci(n) / LucasL(n): constant-coefficient order 2. */
function reduceConstOrder2(ce: ComputeEngine, expr: BoxedExpression, varName: string): LinearRec | undefined {
  const ops = operandsOf(expr);
  if (ops.length !== 1 || !isSymbol(ops[0]) || ops[0].symbol !== varName) return undefined;
  const seed: readonly [number, number] | undefined =
    expr.operator === "Fibonacci" ? [0, 1] : expr.operator === "LucasL" ? [2, 1] : undefined;
  if (seed === undefined) return undefined;
  const [y0, y1] = seed;
  return {
    order: 2,
    coeffs: [ce.NegativeOne, ce.NegativeOne, ce.One], // y(n+2) - y(n+1) - y(n) == 0
    rhsConst: ce.Zero,
    varName,
    anchors: new Map([
      [0, ce.box(y0 as never)],
      [1, ce.box(y1 as never)],
    ]),
  };
}

/** HarmonicNumber(n): order 1, (n+1)(y(n+1) − y(n)) = 1 — Wolfram's own reduction, an
 * inhomogeneous constant rather than the order-2 homogeneous form the recurrence for H_n
 * would otherwise suggest. */
function reduceHarmonic(ce: ComputeEngine, expr: BoxedExpression, varName: string): LinearRec | undefined {
  const ops = operandsOf(expr);
  if (expr.operator !== "HarmonicNumber" || ops.length !== 1 || !isSymbol(ops[0]) || ops[0].symbol !== varName) {
    return undefined;
  }
  const A = ce.box(["Add", varName, 1] as never); // n + 1
  return {
    order: 1,
    coeffs: [ce.box(["Negate", A.json as never] as never).evaluate(), A],
    rhsConst: ce.NegativeOne,
    varName,
    anchors: new Map([[0, ce.Zero]]),
  };
}

/** Sum of two order-1 hypergeometric terms t1 + t2, ratios r1, r2: order ≤ 2 via the
 * classical elimination (a 2D cross-product on the vectors (1,1), (r1(n),r2(n)),
 * (r1(n)r1(n+1), r2(n)r2(n+1))). Declines when the two ratios coincide (degenerate: the
 * elimination collapses to 0 == 0, not a genuine order-2 recurrence). */
function reduceSum(ce: ComputeEngine, expr: BoxedExpression, varName: string): LinearRec | undefined {
  const parts = operandsOf(expr);
  if (expr.operator !== "Add" || parts.length !== 2) return undefined;
  const r1 = decomposeRatio(ce, parts[0], varName);
  const r2 = decomposeRatio(ce, parts[1], varName);
  if (r1 === undefined || r2 === undefined) return undefined;

  const shiftUp = (e: BoxedExpression) => e.subs({ [varName]: ["Add", varName, 1] as never }).evaluate();
  const r = (ratio: Ratio) => ce.box(["Divide", j(ratio.num), j(ratio.den)] as never).evaluate();
  const r1n = r(r1);
  const r2n = r(r2);
  const r1n1 = shiftUp(r1n);
  const r2n1 = shiftUp(r2n);
  const mul = (a: BoxedExpression, b: BoxedExpression) => ce.box(["Multiply", j(a), j(b)] as never).evaluate();
  const sub = (a: BoxedExpression, b: BoxedExpression) => ce.box(["Subtract", j(a), j(b)] as never).evaluate();

  const c2 = sub(r2n, r1n); // v0 x v1
  const c1 = sub(mul(r1n, r1n1), mul(r2n, r2n1)); // v2 x v0
  const c0 = sub(mul(r1n, mul(r2n, r2n1)), mul(r2n, mul(r1n, r1n1))); // v1 x v2

  const probe = (c: BoxedExpression) => c.subs({ [varName]: 7 }).evaluate();
  if (isZeroExpr(probe(c2)) && isZeroExpr(probe(c1)) && isZeroExpr(probe(c0))) return undefined; // degenerate

  return {
    order: 2,
    coeffs: [c0, c1, c2],
    rhsConst: ce.Zero,
    varName,
    anchors: new Map([
      [0, nativeAt(expr, varName, 0)],
      [1, nativeAt(expr, varName, 1)],
    ]),
  };
}

function reduce(ce: ComputeEngine, expr: BoxedExpression, varName: string): LinearRec | undefined {
  return (
    reduceConstOrder2(ce, expr, varName) ??
    reduceHarmonic(ce, expr, varName) ??
    reduceOrder1(ce, expr, varName) ??
    reduceSum(ce, expr, varName)
  );
}

/** `y(n+shift)`, `shift` a non-negative integer — the `y(n)` bare-call convention CE
 * canonicalizes a symbol-headed call to (see difference-root.ts header). */
const yCall = (yName: string, varName: string, shift: number): Json =>
  shift === 0 ? [yName, varName] : [yName, ["Add", varName, shift]];

/** Build `Function([recurrence == 0, ic...], y, n)` from a `LinearRec`. */
function buildFunction(ce: ComputeEngine, rec: LinearRec, yName: string): BoxedExpression {
  const terms: Json[] = [];
  for (let i = 0; i <= rec.order; i++) {
    if (isZeroExpr(rec.coeffs[i])) continue;
    terms.push(["Multiply", j(rec.coeffs[i]), yCall(yName, rec.varName, i)]);
  }
  if (!isZeroExpr(rec.rhsConst)) terms.push(j(rec.rhsConst));
  const recurrenceEq: Json = ["Equal", ["Add", ...terms], 0];
  const icEqs: Json[] = [...rec.anchors.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, value]) => ["Equal", [yName, index], j(value)]);
  return ce.box(["Function", ["List", recurrenceEq, ...icEqs], yName, rec.varName] as never);
}

export function declareDifferenceRoot(ce: ComputeEngine): void {
  ce.declare("DifferenceRoot", { signature: "(any) -> any" }); // inert data carrier, never evaluated directly

  ce.declare("DifferenceRootReduce", {
    signature: "(any, symbol) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [expr, varExpr] = ops;
      if (expr === undefined || varExpr === undefined || !isSymbol(varExpr)) return undefined;
      const varName = varExpr.symbol!;
      // The Function's own bound parameter must NOT be spelled the same as the outer variable:
      // `.subs()` isn't scope-aware, so `Apply(DifferenceRoot(fn), n).subs({n: 5})` would
      // otherwise rewrite the parameter declaration itself, not just the outer application's
      // argument. Rename the input to a fresh name up front and build the whole reduction in
      // terms of that name instead.
      const boundVar = freshSymbol(expr, "n");
      const renamed = boundVar === varName ? expr : expr.subs({ [varName]: boundVar } as never);
      const rec = reduce(ce, renamed, boundVar);
      if (rec === undefined) return undefined;
      const yName = freshSymbol(renamed, "y");
      const fn = buildFunction(ce, rec, yName);
      const dr = ce.box(["DifferenceRoot", j(fn)] as never);
      return ce.box([j(dr), j(varExpr)] as never);
    },
  });

  attachDifferenceRootApply(ce);
}

// --- evaluation: DifferenceRoot(fn)(n0), attached onto the native `Apply` operator --------

/** `y(literal)` (an initial condition) vs `y(n + shift)` (the recurrence) — the recurrence is
 * the one equation whose argument to `y` mentions the bound variable symbolically. */
function classifyEquation(
  eq: BoxedExpression,
  yName: string,
  varName: string,
): { kind: "ic"; index: number; value: BoxedExpression } | { kind: "rec"; lhs: BoxedExpression } | undefined {
  const [lhs, rhs] = operandsOf(eq);
  if (eq.operator !== "Equal" || lhs === undefined || rhs === undefined) return undefined;
  if (lhs.freeVariables.includes(varName)) return { kind: "rec", lhs };
  // an IC's LHS is `[yName, literalIndex]`
  if (lhs.operator === yName) {
    const idx = intLiteral(operandsOf(lhs)[0]!);
    if (idx !== undefined) return { kind: "ic", index: idx, value: rhs };
  }
  return undefined;
}

/** Pull `coeffs[]` / `rhsConst` back out of the recurrence equation's LHS (already `== 0`),
 * by scanning its (possibly reordered, possibly flattened) additive terms — see the header
 * for why this is more robust than assuming the shape we emitted survives canonicalization
 * unchanged. */
function parseRecurrence(
  ce: ComputeEngine,
  lhs: BoxedExpression,
  yName: string,
  varName: string,
): { order: number; coeffs: Map<number, BoxedExpression>; rhsConst: BoxedExpression } | undefined {
  const terms = lhs.operator === "Add" ? operandsOf(lhs) : [lhs];
  const coeffs = new Map<number, BoxedExpression>();
  let rhsConst = ce.Zero;
  const addConst = (c: BoxedExpression) => {
    rhsConst = ce.box(["Add", j(rhsConst), j(c)] as never).evaluate();
  };
  const addCoeff = (shift: number, c: BoxedExpression) => {
    const prev = coeffs.get(shift);
    coeffs.set(shift, prev === undefined ? c : ce.box(["Add", j(prev), j(c)] as never).evaluate());
  };
  /** shift of `y(expr)`/`Derivative`-free call `[yName, idxExpr]`, or undefined if not one. */
  const shiftOf = (call: BoxedExpression): number | undefined => {
    if (call.operator !== yName) return undefined;
    const idx = operandsOf(call)[0];
    if (idx === undefined) return undefined;
    if (isSymbol(idx) && idx.symbol === varName) return 0;
    if (idx.operator === "Add") {
      const idxOps = operandsOf(idx);
      const varPart = idxOps.filter((o) => isSymbol(o) && o.symbol === varName);
      const restPart = idxOps.filter((o) => !(isSymbol(o) && o.symbol === varName));
      if (varPart.length !== 1) return undefined;
      const rest = restPart.length === 1 ? restPart[0]! : ce.box(["Add", ...restPart.map(j)] as never);
      return intLiteral(rest.evaluate());
    }
    return undefined;
  };
  /** Split one additive `term` into its (at most one) `y`-call shift and the remaining
   * coefficient factor, recursing through `Negate` so a negated constant or a negated
   * `Multiply(coeff, y(...))` are both handled the same way as the un-negated cases. */
  const decomposeTerm = (term: BoxedExpression): { shift: number | undefined; coeff: BoxedExpression } => {
    if (term.operator === "Negate") {
      const inner = decomposeTerm(operandsOf(term)[0]!);
      return { shift: inner.shift, coeff: ce.box(["Negate", j(inner.coeff)] as never).evaluate() };
    }
    const factors = term.operator === "Multiply" ? operandsOf(term) : [term];
    let shift: number | undefined;
    const rest: BoxedExpression[] = [];
    for (const f of factors) {
      const s = shiftOf(f);
      if (s !== undefined) shift = s;
      else rest.push(f);
    }
    const coeff = rest.length === 0 ? ce.One : ce.box(["Multiply", ...rest.map(j)] as never).evaluate();
    return { shift, coeff };
  };
  for (const term of terms) {
    const { shift, coeff } = decomposeTerm(term);
    if (shift !== undefined) addCoeff(shift, coeff);
    else addConst(coeff);
  }
  if (coeffs.size === 0) return undefined;
  const order = Math.max(...coeffs.keys());
  for (let i = 0; i <= order; i++) if (!coeffs.has(i)) coeffs.set(i, ce.Zero);
  return { order, coeffs, rhsConst };
}

/** Run the recurrence forward from the nearest anchor at or below `target`, in exact
 * arithmetic. Declines (undefined) below the lowest anchor, or at a step whose leading
 * coefficient is exactly 0 with no anchor to jump to instead. */
function evaluateAt(
  ce: ComputeEngine,
  rec: { order: number; coeffs: Map<number, BoxedExpression>; rhsConst: BoxedExpression },
  varName: string,
  anchors: ReadonlyMap<number, BoxedExpression>,
  target: number,
): BoxedExpression | undefined {
  if (anchors.has(target)) return anchors.get(target);
  const known = new Map(anchors);
  const below = [...known.keys()].filter((i) => i <= target).sort((a, b) => a - b);
  if (below.length === 0) return undefined;
  const base = below[below.length - 1]!;
  for (let m = base + 1; m <= target; m++) {
    const n0 = m - rec.order;
    const at = (c: BoxedExpression) => c.subs({ [varName]: n0 } as never).evaluate();
    const top = at(rec.coeffs.get(rec.order)!);
    if (isZeroExpr(top)) {
      if (known.has(m)) continue;
      return undefined; // singular step, no anchor here — decline rather than guess
    }
    let sum = at(rec.rhsConst);
    for (let i = 0; i < rec.order; i++) {
      const yi = known.get(n0 + i);
      if (yi === undefined) return undefined;
      sum = ce.box(["Add", j(sum), ["Multiply", j(at(rec.coeffs.get(i)!)), j(yi)]] as never).evaluate();
    }
    known.set(m, ce.box(["Divide", ["Negate", j(sum)], j(top)] as never).evaluate());
  }
  return known.get(target);
}

function attachDifferenceRootApply(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Apply");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) return;
  const native: NativeEval = operator.evaluate;
  operator.evaluate = (ops: readonly BoxedExpression[], options: EvalOptions): BoxedExpression | undefined => {
    const [target, arg] = ops;
    if (ops.length === 2 && target !== undefined && target.operator === "DifferenceRoot" && arg !== undefined) {
      const fn = operandsOf(target)[0];
      const n0 = arg.evaluate();
      const index = intLiteral(n0);
      if (fn === undefined || index === undefined || index < 0) return undefined; // stays symbolic
      const fnOps = operandsOf(fn);
      const block: BoxedExpression | undefined = fnOps[0];
      const ySym: BoxedExpression | undefined = fnOps[1];
      const varSym: BoxedExpression | undefined = fnOps[2];
      // `Function`'s body is canonicalized to a `Block` wrapping our `List` of equations
      // (see the header of function-utils.d.ts, quoted in derivatives.ts).
      const body = block?.operator === "Block" ? operandsOf(block)[0] : block;
      if (body?.operator !== "List" || !isSymbol(ySym) || !isSymbol(varSym)) return undefined;
      const yName = ySym.symbol;
      const varName = varSym.symbol;
      if (yName === undefined || varName === undefined) return undefined;
      const anchors = new Map<number, BoxedExpression>();
      let recLhs: BoxedExpression | undefined;
      for (const eq of operandsOf(body)) {
        const c = classifyEquation(eq, yName, varName);
        if (c === undefined) return undefined;
        if (c.kind === "ic") anchors.set(c.index, c.value);
        else recLhs = c.lhs;
      }
      if (recLhs === undefined) return undefined;
      const parsed = parseRecurrence(ce, recLhs, yName, varName);
      if (parsed === undefined) return undefined;
      return evaluateAt(ce, parsed, varName, anchors, index);
    }
    return native?.(ops, options);
  };
}
