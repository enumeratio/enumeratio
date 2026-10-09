import {
  bigIntegerAt,
  bigRationalAt,
  type Engine,
  type EvaluateOptions,
  type Expr,
  operandsOf,
  widenSignature,
  wrapOperator,
} from "@enumeratio/engine";
import { finish } from "./distributions.ts";

// `Median(dist)`, as Wolfram defines it: the exact quantile at 1/2 for a continuous law, and the
// smallest x with CDF(x) >= 1/2 for a discrete one. Continuous laws answer where the quantile has a
// closed form. Discrete laws answer for exact (rational) parameters, by walking the support and
// deciding every comparison with 1/2 in exact arithmetic — never in floats. Anything else stays
// unevaluated.

// --- exact rational arithmetic (BigInt fractions, denominator > 0) -----------------------------

type Q = readonly [bigint, bigint];

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};
const frac = (n: bigint, d: bigint): Q => {
  const g = gcd(n, d) || 1n;
  return d < 0n ? [-n / g, -d / g] : [n / g, d / g];
};
const add = ([a, b]: Q, [c, d]: Q): Q => frac(a * d + c * b, b * d);
const mul = ([a, b]: Q, [c, d]: Q): Q => frac(a * c, b * d);
const cmp = ([a, b]: Q, [c, d]: Q): -1 | 0 | 1 => {
  const l = a * d;
  const r = c * b;
  return l < r ? -1 : l > r ? 1 : 0;
};

/** Caps on the support walked and the series summed, so an extreme parameter declines rather than hangs. */
const SUPPORT_LIMIT = 2_000;
const SERIES_LIMIT = 20_000;

// --- discrete laws -----------------------------------------------------------------------------

const binomialMedian = (n: bigint, p: Q): bigint | undefined => {
  if (n < 0n || n > BigInt(SUPPORT_LIMIT) || p[0] < 0n || p[0] > p[1]) return undefined;
  const [a, q] = p;
  // 2 * sum_{j<=k} C(n,j) a^j (q-a)^(n-j) >= q^n, all integers.
  const total = q ** n;
  let choose = 1n;
  let cumulative = 0n;
  for (let j = 0n; j <= n; j++) {
    cumulative += choose * a ** j * (q - a) ** (n - j);
    if (2n * cumulative >= total) return j;
    choose = (choose * (n - j)) / (j + 1n);
  }
  return undefined;
};

const geometricMedian = (p: Q): bigint | undefined => {
  const [a, q] = p;
  if (a <= 0n || a > q) return undefined;
  // CDF(k) = 1 - (1-p)^(k+1) >= 1/2  <=>  2 (q-a)^(k+1) <= q^(k+1).
  let lhs = 2n * (q - a);
  let rhs = q;
  for (let k = 0n; k < BigInt(SUPPORT_LIMIT); k++) {
    if (lhs <= rhs) return k;
    lhs *= q - a;
    rhs *= q;
  }
  return undefined;
};

/** Rational bounds `(lo, hi)` on `e^lambda` from the first `n` terms of its series: the tail is
 *  dominated by a geometric series, so `lo < e^lambda < hi`. */
const expBounds = (lambda: Q, n: number): readonly [Q, Q] => {
  let term: Q = [1n, 1n];
  let sum: Q = [1n, 1n];
  for (let j = 1; j <= n; j++) {
    term = mul(term, frac(lambda[0], lambda[1] * BigInt(j)));
    sum = add(sum, term);
  }
  const next = mul(term, frac(lambda[0], lambda[1] * BigInt(n + 1)));
  const spread = frac(BigInt(n + 2) * lambda[1], BigInt(n + 2) * lambda[1] - lambda[0]);
  return [sum, add(sum, mul(next, spread))];
};

const poissonMedian = (lambda: Q): bigint | undefined => {
  if (lambda[0] <= 0n || lambda[0] > 500n * lambda[1]) return undefined;
  // CDF(k) = e^-lambda S_k >= 1/2  <=>  2 S_k >= e^lambda, S_k being the partial sum of e^lambda.
  // e^lambda is irrational, so 2 S_k never equals it and enough terms always separate the two.
  const start = Math.max(0, Math.floor(Number(lambda[0]) / Number(lambda[1])) - 1);
  let n = Math.max(64, 4 * start);
  let [lo, hi] = expBounds(lambda, n);
  let term: Q = [1n, 1n];
  let partial: Q = [1n, 1n];
  for (let k = 0; k <= SERIES_LIMIT; k++) {
    if (k > 0) {
      term = mul(term, frac(lambda[0], lambda[1] * BigInt(k)));
      partial = add(partial, term);
    }
    if (k < start) continue;
    const x = mul([2n, 1n], partial);
    while (cmp(x, lo) > 0 && cmp(x, hi) < 0) {
      n *= 2;
      if (n > SERIES_LIMIT) return undefined;
      [lo, hi] = expBounds(lambda, n);
    }
    if (cmp(x, hi) >= 0) return BigInt(k);
  }
  return undefined;
};

// --- the handler -------------------------------------------------------------------------------

const rational = (e: Expr | undefined): Q | undefined => {
  const q = bigRationalAt(e);
  return q === undefined ? undefined : frac(q[0], q[1]);
};

const medianOf = (ce: Engine, dist: Expr, options: EvaluateOptions): Expr | undefined => {
  const ops = operandsOf(dist);
  const ln2 = ce.function("Ln", [ce.number(2)]);
  const exact = (n: bigint | undefined): Expr | undefined => (n === undefined ? undefined : ce.number(Number(n)));
  switch (dist.operator) {
    // Closed-form quantiles at 1/2, symbolic parameters allowed.
    case "NormalDistribution":
    case "CauchyDistribution":
      return finish(ops[0] ?? ce.Zero, options);
    case "LaplaceDistribution":
    case "LogisticDistribution":
      return ops.length === 2 ? finish(ops[0], options) : undefined;
    case "StudentTDistribution":
      return ops.length === 1 ? ce.Zero : undefined;
    case "UniformDistribution":
      return ops.length === 2
        ? finish(ce.function("Divide", [ce.function("Add", [ops[0], ops[1]]), ce.number(2)]), options)
        : undefined;
    case "ExponentialDistribution":
      return ops.length === 1 ? finish(ce.function("Divide", [ln2, ops[0]]), options) : undefined;
    case "LogNormalDistribution":
      return ops.length === 2 ? finish(ce.function("Exp", [ops[0]]), options) : undefined;
    case "WeibullDistribution":
      return ops.length === 2
        ? finish(
            ce.function("Multiply", [ops[1], ce.function("Power", [ln2, ce.function("Divide", [ce.One, ops[0]])])]),
            options,
          )
        : undefined;
    case "RayleighDistribution":
      return ops.length === 1
        ? finish(
            ce.function("Multiply", [ops[0], ce.function("Sqrt", [ce.function("Multiply", [ce.number(2), ln2])])]),
            options,
          )
        : undefined;
    case "ParetoDistribution":
      return ops.length === 2
        ? finish(
            ce.function("Multiply", [
              ops[0],
              ce.function("Power", [ce.number(2), ce.function("Divide", [ce.One, ops[1]])]),
            ]),
            options,
          )
        : undefined;
    case "BetaDistribution":
      // I_x(a, a) = 1/2 at x = 1/2: the symmetric law's median is its midpoint.
      return ops.length === 2 && ops[0].isEqual(ops[1]) === true ? ce.number([1, 2]) : undefined;
    // Discrete laws, exact parameters.
    case "PoissonDistribution": {
      const lambda = rational(ops[0]);
      return ops.length === 1 && lambda !== undefined ? exact(poissonMedian(lambda)) : undefined;
    }
    case "BinomialDistribution": {
      const n = bigIntegerAt(ops[0]);
      const p = rational(ops[1]);
      return ops.length === 2 && n !== undefined && p !== undefined ? exact(binomialMedian(n, p)) : undefined;
    }
    case "GeometricDistribution": {
      const p = rational(ops[0]);
      return ops.length === 1 && p !== undefined ? exact(geometricMedian(p)) : undefined;
    }
    case "BernoulliDistribution": {
      const p = rational(ops[0]);
      if (ops.length !== 1 || p === undefined || p[0] < 0n || p[0] > p[1]) return undefined;
      // CDF(0) = 1 - p >= 1/2 exactly when p <= 1/2.
      return cmp(p, [1n, 2n]) <= 0 ? ce.Zero : ce.One;
    }
    case "DiscreteUniformDistribution": {
      const bounds = ops.length === 1 && ops[0].operator === "List" ? operandsOf(ops[0]) : [];
      const [lo, hi] = [bigIntegerAt(bounds[0]), bigIntegerAt(bounds[1])];
      if (bounds.length !== 2 || lo === undefined || hi === undefined || hi < lo) return undefined;
      // The least k with (k - lo + 1) / (hi - lo + 1) >= 1/2.
      return exact(lo + (hi - lo + 2n) / 2n - 1n);
    }
    default:
      return undefined;
  }
};

/** Declare `Median` over a distribution: widens the head's signature to take one, then answers it
 *  ahead of whatever handles `Median` of data. */
export function declareMedian(ce: Engine): void {
  const isLaw = (op: Expr): boolean => op.operator.endsWith("Distribution");
  widenSignature(ce, "Median", "(distribution+) -> number", (op) => !isLaw(op));
  wrapOperator(
    ce,
    ["Median"],
    (ops) => ops.length === 1 && isLaw(ops[0]),
    (native) => (ops, options) => medianOf(ce, ops[0], options) ?? native?.(ops, options),
    1,
  );
}
