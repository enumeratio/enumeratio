import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";

// HankelTransform(f, r, s[, n]) = ∫_0^∞ f(r) J_n(s r) r dr, matching Wolfram's own
// normalisation exactly (no extra prefactor — confirmed directly against
// `wolframscript`, e.g. `HankelTransform[1/r, r, s]` is `1/s`, not `1/s` times some
// constant). `n` defaults to Wolfram's own default order 0 when omitted.
//
// Order-0 table (f(r) -> F(s), each confirmed with `GenerateConditions -> True`; every
// strip below also needs `s >= 0`, the transform's own domain, left as a documentation
// note rather than a runtime check since `s` is the free output variable, exactly like
// this file's Laplace/Fourier/Mellin siblings):
//   e^(-a*r)          -> a/(a^2+s^2)^(3/2)              Re(a) > 0
//   e^(-a*r^2)        -> 1/(2a) * e^(-s^2/(4a))          Re(a) > 0 (no strip beyond it)
//   1/r               -> 1/s                             (no strip beyond it)
//   1/sqrt(r^2+a^2)   -> e^(-a*s)/s                       Re(a) > 0 (`a` read off a literal
//                                                          a^2 term, so `a > 0` is required,
//                                                          not just `a^2 > 0`)
// Two further orders Wolfram's own examples state explicitly (verified the same way):
//   n = 1: e^(-a*r) -> s/(a^2+s^2)^(3/2)                 Re(a) > 0
//   any n: 1/r -> 1/s (n-independent identity)            n > -1/2
//
// Declined: any other function, any other stated order (Wolfram's own closed forms for
// e^(-a*r)/e^(-a*r^2) at a general order `n` involve `Hypergeometric2F1Regularized` /
// `Hypergeometric1F1Regularized` — not elementary, not chased), and an unknown-sign `a`.

const opAt = (expr: BoxedExpression, i: number): BoxedExpression => operandsOf(expr)[i];
const isSym = (x: BoxedExpression, name: string): boolean => symbolNameOf(x) === name;
const isE = (x: BoxedExpression): boolean => isSym(x, "ExponentialE");
const hasVar = (expr: BoxedExpression, name: string): boolean => expr.has(name);

/** `expr` as `a*x` (any sign; `Negate` folds through, mirroring `mellin-transform.ts`'s
 * `linearCoeff`) — bare `x` gives `a = 1`. */
function linearCoeffSigned(ce: ComputeEngine, expr: BoxedExpression, name: string): BoxedExpression | undefined {
  if (isSym(expr, name)) return ce.One;
  if (expr.operator === "Negate") {
    const inner = linearCoeffSigned(ce, opAt(expr, 0), name);
    return inner === undefined ? undefined : ce.function("Negate", [inner]).evaluate();
  }
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    const xFactors = ops.filter((o) => isSym(o, name));
    const rest = ops.filter((o) => !isSym(o, name));
    if (xFactors.length !== 1 || rest.some((o) => hasVar(o, name))) return undefined;
    return rest.length === 1 ? rest[0] : ce.function("Multiply", rest).evaluate();
  }
  return undefined;
}

/** `expr` as `b*x^2` (any sign — mirrors `mellin-transform.ts`'s `quadraticCoeffSigned`). */
function quadraticCoeffSigned(ce: ComputeEngine, expr: BoxedExpression, name: string): BoxedExpression | undefined {
  const isXSq = (o: BoxedExpression) => o.operator === "Power" && isSym(opAt(o, 0), name) && opAt(o, 1).re === 2;
  if (isXSq(expr)) return ce.One;
  if (expr.operator === "Negate") {
    const inner = quadraticCoeffSigned(ce, opAt(expr, 0), name);
    return inner === undefined ? undefined : ce.function("Negate", [inner]).evaluate();
  }
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    const sqFactors = ops.filter(isXSq);
    const rest = ops.filter((o) => !isXSq(o));
    if (sqFactors.length !== 1 || rest.some((o) => hasVar(o, name))) return undefined;
    return rest.length === 1 ? rest[0] : ce.function("Multiply", rest).evaluate();
  }
  return undefined;
}

/** `1/sqrt(r^2 + a^2)`: `Divide[1, Sqrt[Add[Power[r,2], Power[X,2]]]]` (either order in
 * the `Add`), reading `a = X` (requires `X` to be a LITERAL square, and `isPositive`). */
function radialInverseDistance(ce: ComputeEngine, expr: BoxedExpression, r: string): BoxedExpression | undefined {
  if (expr.operator !== "Divide" || !(opAt(expr, 0).re === 1 && opAt(expr, 0).im === 0)) return undefined;
  const den = opAt(expr, 1);
  if (den.operator !== "Sqrt") return undefined;
  const radicand = opAt(den, 0);
  if (radicand.operator !== "Add") return undefined;
  const ops = operandsOf(radicand);
  if (ops.length !== 2) return undefined;
  const isRSq = (o: BoxedExpression) => o.operator === "Power" && isSym(opAt(o, 0), r) && opAt(o, 1).re === 2;
  const rTerm = ops.find(isRSq);
  const aTerm = ops.find((o) => o !== rTerm);
  if (rTerm === undefined || aTerm === undefined) return undefined;
  if (aTerm.operator !== "Power" || opAt(aTerm, 1).re !== 2 || hasVar(opAt(aTerm, 0), r)) return undefined;
  return opAt(aTerm, 0);
}

/** `1/r` exactly (`Divide[1, r]`). */
const isReciprocalOfR = (expr: BoxedExpression, r: string): boolean =>
  expr.operator === "Divide" && opAt(expr, 0).re === 1 && opAt(expr, 0).im === 0 && isSym(opAt(expr, 1), r);

function atomicHankelOrder0(
  ce: ComputeEngine,
  expr: BoxedExpression,
  r: string,
  s: BoxedExpression,
): BoxedExpression | undefined {
  if (isReciprocalOfR(expr, r)) return ce.function("Power", [s, -1]).evaluate();
  if (expr.operator === "Power" && isE(opAt(expr, 0))) {
    const exponent = opAt(expr, 1);
    const k = linearCoeffSigned(ce, exponent, r);
    if (k !== undefined && k.isNegative === true) {
      const a = ce.function("Negate", [k]).evaluate();
      const denom = ce.function("Power", [
        ce.function("Add", [ce.function("Power", [a, 2]), ce.function("Power", [s, 2])]),
        ce.number([3, 2]),
      ]);
      return ce.function("Divide", [a, denom]).evaluate();
    }
    const m = quadraticCoeffSigned(ce, exponent, r);
    if (m !== undefined && m.isNegative === true) {
      const a = ce.function("Negate", [m]).evaluate();
      const gaussExp = ce.function("Negate", [
        ce.function("Divide", [ce.function("Power", [s, 2]), ce.function("Multiply", [4, a])]),
      ]);
      return ce
        .function("Multiply", [
          ce.function("Divide", [1, ce.function("Multiply", [2, a])]),
          ce.function("Exp", [gaussExp]),
        ])
        .evaluate();
    }
    return undefined;
  }
  const a = radialInverseDistance(ce, expr, r);
  if (a !== undefined && a.isPositive === true) {
    return ce
      .function("Divide", [ce.function("Exp", [ce.function("Negate", [ce.function("Multiply", [a, s])])]), s])
      .evaluate();
  }
  return undefined;
}

/** Order 1's one stated closed form: `e^(-a*r) -> s/(a^2+s^2)^(3/2)`. */
function atomicHankelOrder1(
  ce: ComputeEngine,
  expr: BoxedExpression,
  r: string,
  s: BoxedExpression,
): BoxedExpression | undefined {
  if (expr.operator !== "Power" || !isE(opAt(expr, 0))) return undefined;
  const k = linearCoeffSigned(ce, opAt(expr, 1), r);
  if (k === undefined || k.isNegative !== true) return undefined;
  const a = ce.function("Negate", [k]).evaluate();
  const denom = ce.function("Power", [
    ce.function("Add", [ce.function("Power", [a, 2]), ce.function("Power", [s, 2])]),
    ce.number([3, 2]),
  ]);
  return ce.function("Divide", [s, denom]).evaluate();
}

export function matchHankel(
  ce: ComputeEngine,
  expr: BoxedExpression,
  r: BoxedExpression,
  s: BoxedExpression,
  order: BoxedExpression | undefined,
): BoxedExpression | undefined {
  const rName = symbolNameOf(r);
  if (rName === undefined || !hasVar(expr, rName)) return undefined;
  if (order === undefined || (order.re === 0 && order.im === 0)) return atomicHankelOrder0(ce, expr, rName, s);
  if (order.re === 1 && order.im === 0) return atomicHankelOrder1(ce, expr, rName, s);
  // Any other order: only the n-independent `1/r -> 1/s` identity is elementary
  // (needs n > -1/2 for convergence — checked when `order` carries enough sign
  // information; a fully unconstrained symbolic order declines).
  if (isReciprocalOfR(expr, rName) && (order.isPositive === true || order.isNonNegative === true)) {
    return ce.function("Power", [s, -1]).evaluate();
  }
  return undefined;
}

export function declareHankelTransform(ce: ComputeEngine): void {
  ce.declare("HankelTransform", {
    signature: "(value, value, value, value?) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [f, r, s, n] = ops;
      if (f === undefined || r === undefined || s === undefined || ops.length > 4) return undefined;
      return matchHankel(ce, f, r, s, n);
    },
  });
}
