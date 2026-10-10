import { isNumber, type BoxedExpression, type ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/engine";
import { isRealInt } from "@enumeratio/ce-patches";
import { powerSeriesCoefficient } from "./power-orders.ts";
import { fractionFactors } from "./transforms.ts";

// SeriesCoefficient(f, {x, x0, n}) — the coefficient of (x − x0)^n in the Taylor series of
// f about x0, via the classical formula coeff = D^n(f)(x0) / n!. This is exact and correct
// whenever f is analytic at x0 (an ORDINARY point: no pole, no branch point) and n is a
// nonnegative integer — which is the shape the overwhelming majority of Wolfram's own
// `SeriesCoefficient` examples use.
//
// What's declined, on purpose (each would need machinery this file doesn't have):
//   - n negative or non-integer: a Laurent (pole) or Puiseux (branch-point/fractional-power)
//     coefficient. The derivative formula doesn't apply at all past an ordinary point —
//     `SeriesCoefficient(1/x, {x,0,-1})` needs a residue, not D(1/x).
//   - f singular AT x0 (the "removable singularity" case, e.g. Sin(x)/x at x=0): the
//     derivative-at-a-point formula hits the same singularity the series expansion would
//     have removed by taking a limit, so it can't be trusted; this is the one case
//     `computeSeries` (compute-engine's own Laurent/limit-aware expander) handles and a bare
//     `D` does not, but it isn't exposed on the public engine surface this package can import,
//     so it's simply declined here.
// Every accepted case is checked twice before being trusted: the result must fully evaluate
// (no leftover reference to `x`) to a finite value — a symbolic leftover or
// ComplexInfinity/NaN means f wasn't actually analytic at x0, and the call is declined rather
// than risk a wrong closed form.

function isDeclinedResult(r: BoxedExpression, xName: string): boolean {
  // A concrete numeric literal is bad exactly when it's not finite — NaN (0/0, an
  // indeterminate form) or an infinite magnitude (ComplexInfinity, a pole at x0). Both are
  // represented as number literals with a non-finite re/im here, not as named symbols, so
  // `isNumberLiteral` gates a `.re`/`.im` finiteness check rather than a symbol-name check.
  if (isNumber(r)) {
    return !Number.isFinite(r.re) || !Number.isFinite(r.im);
  }
  // A symbolic-but-exact result (e.g. `Pi/4`, `E/2`) is fine; what's NOT fine is a leftover
  // free occurrence of the expansion variable, meaning `D`/`subs` didn't fully collapse it.
  const json = JSON.stringify(r.json);
  return new RegExp(`(^|[^A-Za-z0-9_])${xName}([^A-Za-z0-9_]|$)`).test(json);
}

function seriesCoefficient(
  ce: ComputeEngine,
  f: BoxedExpression,
  xName: string,
  x0: BoxedExpression,
  n: number,
): BoxedExpression | undefined {
  if (!Number.isInteger(n) || n < 0) return undefined; // Laurent/Puiseux — declined, see header
  let d: BoxedExpression = f;
  for (let k = 0; k < n; k++) {
    d = ce.box(["D", d.json, xName] as never).evaluate();
    if (d.operator === "D") return undefined; // compute-engine's own D declined
  }
  const atPoint = d.subs({ [xName]: x0.json as never }).evaluate();
  const coeff = n === 0 ? atPoint : ce.box(["Divide", atPoint.json, ["Factorial", n]] as never).evaluate();
  if (isDeclinedResult(coeff, xName)) return undefined;
  return coeff;
}

/**
 * The coefficient of x^n (n symbolic, an integer) in c·x^m·I_ν(kx) or c·x^m·J_ν(kx) about 0, ν a
 * nonnegative integer, from the power series I_ν(z) = Σ_j (z/2)^{2j+ν}/(j!(j+ν)!) (J_ν: (-1)^j too):
 * x^n needs j = (n-m-ν)/2 to be a nonnegative integer, so the answer is a Piecewise, 0 elsewhere.
 */
function besselCoefficient(
  ce: ComputeEngine,
  f: BoxedExpression,
  xName: string,
  x0: BoxedExpression,
  n: BoxedExpression,
): BoxedExpression | undefined {
  if (!(x0.re === 0 && x0.im === 0)) return undefined;
  const consts: BoxedExpression[] = [];
  let m = 0;
  let bessel: BoxedExpression | undefined;
  const { numer, denom } = fractionFactors(f);
  for (const [factors, sign] of [
    [numer, 1],
    [denom, -1],
  ] as const) {
    for (const { base, power } of factors) {
      if (!base.has(xName)) consts.push(ce.function("Power", [base, sign * power]));
      else if (symbolNameOf(base) === xName) m += sign * power;
      else if (
        sign === 1 &&
        power === 1 &&
        bessel === undefined &&
        (base.operator === "BesselI" || base.operator === "BesselJ")
      )
        bessel = base;
      else return undefined;
    }
  }
  if (bessel === undefined) return undefined;
  const [nu, arg] = operandsOf(bessel);
  if (nu === undefined || arg === undefined || !isRealInt(nu) || nu.re < 0) return undefined;
  const k = linearInX(ce, arg, xName);
  if (k === undefined) return undefined;
  const j = ce.function("Divide", [ce.function("Subtract", [n, m + nu.re]), 2]);
  const terms = [
    ...consts,
    ce.function("Power", [ce.function("Divide", [k, 2]), ce.function("Subtract", [n, m])]),
    ce.function("Power", [
      ce.function("Multiply", [
        ce.function("Gamma", [ce.function("Add", [j, 1])]),
        ce.function("Gamma", [ce.function("Add", [j, nu.re + 1])]),
      ]),
      -1,
    ]),
  ];
  if (bessel.operator === "BesselJ") terms.push(ce.function("Power", [-1, j]));
  const parity = (((m + nu.re) % 2) + 2) % 2;
  const condition = ce.function("And", [
    ce.function("Equal", [ce.function("Mod", [n, 2]), parity]),
    ce.function("GreaterEqual", [n, m + nu.re]),
  ]);
  return ce
    .box(["Piecewise", ["List", ["List", ce.function("Multiply", terms).evaluate().json, condition.json]], 0] as never)
    .evaluate();
}

/** `arg` as `k·x` with `k` free of x (bare `x` gives 1). */
function linearInX(ce: ComputeEngine, arg: BoxedExpression, xName: string): BoxedExpression | undefined {
  if (symbolNameOf(arg) === xName) return ce.One;
  const { numer, denom } = fractionFactors(arg);
  const k: BoxedExpression[] = [];
  let seen = false;
  for (const [factors, sign] of [
    [numer, 1],
    [denom, -1],
  ] as const) {
    for (const { base, power } of factors) {
      if (!base.has(xName)) k.push(ce.function("Power", [base, sign * power]));
      else if (symbolNameOf(base) === xName && sign === 1 && power === 1 && !seen) seen = true;
      else return undefined;
    }
  }
  return seen ? ce.function("Multiply", k).evaluate() : undefined;
}

export function declareSeriesCoefficient(ce: ComputeEngine): void {
  ce.declare("SeriesCoefficient", {
    signature: "(expression, list<any^3>) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [f, triple] = ops;
      if (!f || !triple || triple.operator !== "List") return undefined;
      const [xSym, x0, nExpr] = operandsOf(triple);
      const xName = xSym && symbolNameOf(xSym);
      if (!xName || !x0 || !nExpr) return undefined;
      const bessel = besselCoefficient(ce, f, xName, x0, nExpr);
      if (bessel !== undefined) return bessel;
      if (!isRealInt(nExpr)) return powerSeriesCoefficient(ce, f, xName, x0, nExpr);
      return seriesCoefficient(ce, f, xName, x0, nExpr.re);
    },
  });
}
