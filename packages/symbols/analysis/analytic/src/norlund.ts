import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, bigRationalAt } from "@enumeratio/boxed";
import { bernoulliRational, type Rat } from "./bernoulli.ts";
import { type EvalOptions, isFiniteNum, wantsNumber } from "./box.ts";

// NorlundB(n, a): the Nörlund polynomial B_n^(a), from (t/(e^t − 1))^a = Σ B_n^(a) tⁿ/n!.
// At a = 1 this is the ordinary Bernoulli number, already exact here as `bernoulliRational`;
// this file gets the rest of the family, as an exact polynomial in a (bigint-rational
// coefficients), by the standard power-series route: log the EGF of the Bernoulli numbers,
// scale by a, exponentiate back. Every step is exact bigint-rational arithmetic — no float
// touches it until the final `a` is a float or `N()` is asked for.

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};
const reduce = ([n, d]: readonly [bigint, bigint]): Rat => {
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1n;
  return [n / g, d / g];
};
const ZERO: Rat = [0n, 1n];
const rplus = (a: Rat, b: Rat): Rat => reduce([a[0] * b[1] + b[0] * a[1], a[1] * b[1]]);
const rminus = (a: Rat, b: Rat): Rat => rplus(a, [-b[0], b[1]]);
const rtimes = (a: Rat, b: Rat): Rat => reduce([a[0] * b[0], a[1] * b[1]]);
const rdiv = (a: Rat, b: Rat): Rat => reduce([a[0] * b[1], a[1] * b[0]]);
const rscale = (a: Rat, k: bigint): Rat => reduce([a[0] * k, a[1]]);
const factorial = (n: number): bigint => {
  let f = 1n;
  for (let i = 2; i <= n; i++) f *= BigInt(i);
  return f;
};

/** A polynomial in `a`, as its coefficients [c₀, c₁, c₂, …] (cᵢ is the coefficient of aⁱ). */
type Poly = Rat[];

const polyCache: Poly[] = []; // polyCache[n] = h_n(a), the coefficient of tⁿ in (t/(e^t−1))^a

/**
 * h_n(a), the degree-≤n polynomial with h_n(1) = B_n/n! (`bernoulliRational(n)/n!`), computed
 * by exponentiating a·g(t) where g = ln(t/(e^t − 1)) = Σ g_k tᵏ (g_0 = 0, since t/(e^t−1) → 1).
 * `g_k` itself comes from the standard power-series-logarithm recurrence against
 * f_k = B_k/k! (f_0 = 1): k·f_k = Σ_{j=1}^{k} j·g_j·f_{k−j}.
 * Then h = exp(a·g) via n·h_n = Σ_{k=1}^{n} k·(a·g_k)·h_{n−k}, which is a genuine polynomial
 * identity in the *coefficients* — each hit of "a·g_k" shifts a poly array up by one degree.
 */
function computeUpTo(N: number): void {
  if (polyCache.length > N) return;
  const f: Rat[] = [[1n, 1n]]; // f_0 = 1
  for (let k = 1; k <= N; k++) f[k] = rdiv(bernoulliRational(k), [factorial(k), 1n]);
  const g: Rat[] = [ZERO]; // g_0 = 0
  for (let k = 1; k <= N; k++) {
    let acc = ZERO;
    for (let j = 1; j < k; j++) acc = rplus(acc, rscale(rtimes(g[j], f[k - j]), BigInt(j)));
    g[k] = rdiv(rminus(rscale(f[k], BigInt(k)), acc), [BigInt(k), 1n]);
  }
  const h: Poly[] = [[[1n, 1n]]]; // h_0(a) = 1
  for (let n = 1; n <= N; n++) {
    // acc(a) = Σ_{k=1}^{n} k·g_k · a · h_{n-k}(a), as a coefficient array in a. Dense from
    // the start (every degree 0..n filled with ZERO) — a sparse array here would leave holes
    // that Array#map silently skips, corrupting every polynomial built on top of it.
    const acc: Rat[] = Array.from({ length: n + 1 }, () => ZERO);
    for (let k = 1; k <= n; k++) {
      const coeff = rscale(g[k], BigInt(k)); // k·g_k, a plain rational
      if (coeff[0] === 0n) continue;
      const shifted = h[n - k]; // multiplying by "a" bumps every coefficient's degree by 1
      for (let i = 0; i < shifted.length; i++) acc[i + 1] = rplus(acc[i + 1], rtimes(coeff, shifted[i]));
    }
    h[n] = acc.map((c) => rdiv(c, [BigInt(n), 1n]));
  }
  polyCache.length = 0;
  polyCache.push(...h);
}

/** B_n^(a)'s coefficients as a polynomial in a: n!·h_n(a). */
function norlundPoly(n: number): Poly {
  computeUpTo(n);
  const nFact = factorial(n);
  return polyCache[n].map((c) => rtimes(c, [nFact, 1n]));
}

/** Evaluate a rational-coefficient polynomial at an exact rational a. */
function evalPolyRational(poly: Poly, a: Rat): Rat {
  let sum = ZERO;
  let power: Rat = [1n, 1n];
  for (const c of poly) {
    sum = rplus(sum, rtimes(c, power));
    power = rtimes(power, a);
  }
  return sum;
}

/** Evaluate a rational-coefficient polynomial at a float a. */
function evalPolyFloat(poly: Poly, a: number): number {
  let sum = 0;
  let power = 1;
  for (const c of poly) {
    sum += (Number(c[0]) / Number(c[1])) * power;
    power *= a;
  }
  return sum;
}

/** A reduced [num, den] rational as a boxed number — compute-engine accepts a bigint pair
 * directly (see widened.ts), collapsing to a plain integer when den is 1. */
function ratExpr(ce: ComputeEngine, r: Rat): BoxedExpression {
  return ce.number(r as unknown as [number, number]);
}

/** Σ cᵢ·aⁱ as a MathJSON expression in the symbolic operand `aExpr`. */
function polyExpr(ce: ComputeEngine, poly: Poly, aExpr: BoxedExpression): BoxedExpression {
  const terms: BoxedExpression[] = [];
  poly.forEach((c, i) => {
    if (c[0] === 0n) return;
    const coeff = ratExpr(ce, c);
    const powerTerm = i === 0 ? undefined : i === 1 ? aExpr : ce.function("Power", [aExpr, i]);
    if (powerTerm === undefined) terms.push(coeff);
    else if (c[0] === 1n && c[1] === 1n) terms.push(powerTerm);
    else terms.push(ce.function("Multiply", [coeff, powerTerm]));
  });
  if (terms.length === 0) return ce.Zero;
  return terms.length === 1 ? terms[0] : ce.function("Add", terms).evaluate();
}

const MAX_N = 60; // plenty for a documented example or a plot; keeps the polynomial small

export function declareNorlundB(ce: ComputeEngine): void {
  ce.declare("NorlundB", {
    signature: "(integer, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [nExpr, aExpr] = ops;
      if (nExpr === undefined || aExpr === undefined) return undefined;
      const n = bigIntegerAt(nExpr);
      if (n === undefined || n < 0n || n > BigInt(MAX_N)) return undefined;
      const poly = norlundPoly(Number(n));

      const aRat = bigRationalAt(aExpr);
      if (aRat !== undefined) {
        const result = evalPolyRational(poly, aRat);
        const expr = ratExpr(ce, result);
        return wantsNumber(ops, options) ? expr.N() : expr;
      }
      if (isFiniteNum(aExpr) && aExpr.im === 0) {
        return ce.number(evalPolyFloat(poly, aExpr.re));
      }
      // Symbolic a: the polynomial itself, as a MathJSON expression in aExpr.
      const expr = polyExpr(ce, poly, aExpr);
      return options.numericApproximation ? expr.N() : expr;
    },
  });
}
