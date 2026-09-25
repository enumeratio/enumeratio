import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";

// FourierSeries(f, x, n) / FourierCoefficient(f, x, n): the order-n complex exponential
// Fourier series of `f` on [-pi, pi], `Sum_{k=-n}^{n} c_k Exp(i k x)`, and its individual
// coefficient `c_k = (1/2pi) Integrate(f * Exp(-i k x), {x, -pi, pi})` -- confirmed
// against wolframscript for every atom handled below.
//
// Deliberately NOT built on compute-engine's own `Integrate`: probing found it both too
// weak to reach most of these forms (declines `x^2 * Cos(2x)` outright) and, worse,
// silently WRONG on one that does return an answer -- `Integrate(Abs(x) * Exp(-i x),
// {x, -pi, pi})` comes back exactly half the value an independent numeric quadrature
// gives. So every case here is instead a closed form, individually checked against
// Wolfram's FourierCoefficient/FourierSeries and, for the one above, against numeric
// integration too.
//
// What's covered, combined by linearity (Add, Negate, a constant factor free of x):
//   - a trig monomial `cos(x)^p * sin(x)^q` (nonnegative integer p, q; a single Cos(x)
//     or Sin(x) is p=1,q=0 or p=0,q=1) via the exponential binomial expansion --
//     `(E+1/E)^p (E-1/E)^q / (2i)^q` -- which covers Wolfram's own "sin/cos polynomial"
//     examples (Cos(x)^2 checked directly) without approximating anything.
//   - Cos(m x) / Sin(m x) for a nonzero integer m -- a single resonant pair of terms.
//   - x, x^2, Abs(x): the standard closed forms for the sawtooth, the parabola, and the
//     triangle wave.
//   - Exp(a x) for a nonzero real constant a.
// Everything else declines (undefined) rather than guess: a general Piecewise formula
// for symbolic n, higher powers of x, a period other than 2pi, mixed polynomial-times-
// trig products (x * Cos(x)), and any function outside this list.

const opAt = (expr: BoxedExpression, i: number): BoxedExpression => operandsOf(expr)[i];
const isSym = (x: BoxedExpression, name: string): boolean => symbolNameOf(x) === name;
const hasVar = (expr: BoxedExpression, name: string): boolean => expr.has(name);

/** `expr` as `coeff * x` with no additive offset, `coeff` free of x -- Cos/Sin/Exp's
 * linear argument. Undefined if not that shape. */
function pureLinearCoeff(ce: ComputeEngine, expr: BoxedExpression, name: string): BoxedExpression | undefined {
  if (isSym(expr, name)) return ce.One;
  if (expr.operator === "Negate") {
    const inner = pureLinearCoeff(ce, opAt(expr, 0), name);
    return inner === undefined ? undefined : ce.function("Negate", [inner]);
  }
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    const xFactors = ops.filter((o) => isSym(o, name));
    const rest = ops.filter((o) => !isSym(o, name));
    if (xFactors.length !== 1 || rest.some((o) => hasVar(o, name))) return undefined;
    return rest.length === 1 ? rest[0] : ce.function("Multiply", rest);
  }
  return undefined;
}

const binomial = (n: number, k: number): number => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
};

/**
 * The coefficient of `Exp(i k x)` in `cos(x)^P sin(x)^Q`, exactly. `cos(x) = (E+1/E)/2`
 * and `sin(x) = (E-1/E)/(2i)` (E = Exp(i x)) expand by the binomial theorem into Laurent
 * polynomials in E; multiplying them out and reading off the E^k term gives this
 * directly, with no approximation anywhere. The magnitude is always the plain rational
 * `sum / 2^(P+Q)`; the `1/(2i)^Q = (1/2^Q)(-i)^Q` factor contributes a unit that only
 * depends on `Q mod 4`.
 */
function trigMonomialCoeff(ce: ComputeEngine, P: number, Q: number, k: number): BoxedExpression {
  let sum = 0;
  for (let j = 0; j <= P; j++) {
    const mCos = P - 2 * j;
    const l = (Q - (k - mCos)) / 2;
    if (!Number.isInteger(l) || l < 0 || l > Q) continue;
    sum += binomial(P, j) * binomial(Q, l) * (l % 2 === 0 ? 1 : -1);
  }
  const rational = ce.function("Divide", [ce.number(sum), ce.number(2 ** (P + Q))]).evaluate();
  switch (((Q % 4) + 4) % 4) {
    case 0:
      return rational;
    case 1:
      return ce.function("Multiply", [ce.function("Negate", [ce.I]), rational]).evaluate();
    case 2:
      return ce.function("Negate", [rational]).evaluate();
    default:
      return ce.function("Multiply", [ce.I, rational]).evaluate();
  }
}

/** Every factor a nonnegative integer power of `Cos(x)` or `Sin(x)` (argument exactly
 * the series variable) -- the total cos/sin degree, or undefined if any factor doesn't
 * fit that shape. */
function trigPowers(factors: readonly BoxedExpression[], xName: string): { P: number; Q: number } | undefined {
  let P = 0;
  let Q = 0;
  for (const f of factors) {
    let base = f;
    let p = 1;
    if (f.operator === "Power") {
      const [b, e] = operandsOf(f);
      if (b === undefined || e === undefined || e.im !== 0 || !Number.isInteger(e.re) || e.re < 0) return undefined;
      base = b;
      p = e.re;
    }
    if (base.operator === "Cos" && isSym(opAt(base, 0), xName)) P += p;
    else if (base.operator === "Sin" && isSym(opAt(base, 0), xName)) Q += p;
    else return undefined;
  }
  return { P, Q };
}

/** The atoms this file knows a closed form for: `factors` is a Multiply's x-dependent
 * operands (a single element for everything but a trig monomial). */
function atomCoefficient(
  ce: ComputeEngine,
  factors: readonly BoxedExpression[],
  xName: string,
  k: number,
): BoxedExpression | undefined {
  const trig = trigPowers(factors, xName);
  if (trig !== undefined) return trigMonomialCoeff(ce, trig.P, trig.Q, k);
  if (factors.length !== 1) return undefined;
  const f = factors[0];

  if (isSym(f, xName)) {
    // x = sum_{k != 0} i(-1)^k/k * Exp(ikx)
    if (k === 0) return ce.Zero;
    return ce.function("Divide", [ce.function("Multiply", [ce.I, ce.number((-1) ** k)]), ce.number(k)]).evaluate();
  }
  if (f.operator === "Power" && isSym(opAt(f, 0), xName) && opAt(f, 1).im === 0 && opAt(f, 1).re === 2) {
    if (k === 0) return ce.function("Divide", [ce.function("Power", [ce.Pi, 2]), ce.number(3)]).evaluate();
    return ce.function("Divide", [ce.number(2 * (-1) ** k), ce.function("Power", [ce.number(k), 2])]).evaluate();
  }
  // Exp(a x) canonicalises to Power(ExponentialE, a x), never to an "Exp" operator.
  if (f.operator === "Power" && isSym(opAt(f, 0), "ExponentialE")) {
    const a = pureLinearCoeff(ce, opAt(f, 1), xName);
    if (a === undefined || a.im !== 0 || a.re === 0) return undefined;
    const sinh = ce.function("Sinh", [ce.function("Multiply", [a, ce.Pi])]);
    const denom = ce.function("Multiply", [
      ce.Pi,
      ce.function("Subtract", [a, ce.function("Multiply", [ce.I, ce.number(k)])]),
    ]);
    return ce.function("Multiply", [ce.number((-1) ** k), ce.function("Divide", [sinh, denom])]).evaluate();
  }
  if (f.operator === "Abs" && isSym(opAt(f, 0), xName)) {
    if (k === 0) return ce.function("Divide", [ce.Pi, ce.number(2)]).evaluate();
    return ce
      .function("Divide", [
        ce.number((-1) ** k - 1),
        ce.function("Multiply", [ce.Pi, ce.function("Power", [ce.number(k), 2])]),
      ])
      .evaluate();
  }
  if (f.operator === "Cos" || f.operator === "Sin") {
    // A non-unit frequency: Cos(mx)/Sin(mx) for a nonzero integer m (a Cos(x)/Sin(x)
    // with m = 1 is caught by trigPowers above instead).
    const m = pureLinearCoeff(ce, opAt(f, 0), xName);
    if (m === undefined || m.im !== 0 || !Number.isInteger(m.re) || m.re === 0) return undefined;
    if (k !== m.re && k !== -m.re) return ce.Zero;
    const half = ce.function("Divide", [ce.One, ce.number(2)]);
    if (f.operator === "Cos") return half.evaluate();
    return ce.function("Multiply", [ce.number(k === m.re ? -1 : 1), ce.I, half]).evaluate();
  }
  return undefined;
}

/** `c_k`, the coefficient of `Exp(i k x)` in the Fourier series of `f` -- by linearity
 * over Add/Negate/a constant factor, down to `atomCoefficient` at the leaves. */
function coefficientOf(ce: ComputeEngine, f: BoxedExpression, xName: string, k: number): BoxedExpression | undefined {
  if (!hasVar(f, xName)) return k === 0 ? f : ce.Zero;
  if (f.operator === "Add") {
    const parts = operandsOf(f).map((term) => coefficientOf(ce, term, xName, k));
    if (parts.some((p) => p === undefined)) return undefined;
    return ce.function("Add", parts as BoxedExpression[]).evaluate();
  }
  if (f.operator === "Negate") {
    const inner = coefficientOf(ce, opAt(f, 0), xName, k);
    return inner === undefined ? undefined : ce.function("Negate", [inner]).evaluate();
  }
  if (f.operator === "Multiply") {
    const ops = operandsOf(f);
    const consts = ops.filter((o) => !hasVar(o, xName));
    const rest = ops.filter((o) => hasVar(o, xName));
    const core = atomCoefficient(ce, rest, xName, k);
    if (core === undefined) return undefined;
    return consts.length === 0 ? core : ce.function("Multiply", [...consts, core]).evaluate();
  }
  return atomCoefficient(ce, [f], xName, k);
}

const asInt = (n: BoxedExpression): number | undefined => (n.im === 0 && Number.isInteger(n.re) ? n.re : undefined);

export function declareFourierSeries(ce: ComputeEngine): void {
  ce.declare("FourierCoefficient", {
    signature: "(value, value, value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [f, xExpr, nExpr] = ops;
      if (f === undefined || xExpr === undefined || nExpr === undefined) return undefined;
      const xName = symbolNameOf(xExpr);
      const k = asInt(nExpr);
      if (xName === undefined || k === undefined) return undefined; // symbolic n: not cheap, declined
      return coefficientOf(ce, f, xName, k);
    },
  });

  ce.declare("FourierSeries", {
    signature: "(value, value, value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [f, xExpr, nExpr] = ops;
      if (f === undefined || xExpr === undefined || nExpr === undefined) return undefined;
      const xName = symbolNameOf(xExpr);
      const n = asInt(nExpr);
      if (xName === undefined || n === undefined || n < 0) return undefined;
      const terms: BoxedExpression[] = [];
      for (let k = -n; k <= n; k++) {
        const c = coefficientOf(ce, f, xName, k);
        if (c === undefined) return undefined;
        terms.push(
          k === 0
            ? c
            : ce.function("Multiply", [c, ce.function("Exp", [ce.function("Multiply", [ce.I, ce.number(k), xExpr])])]),
        );
      }
      return ce.function("Add", terms).evaluate();
    },
  });
}
