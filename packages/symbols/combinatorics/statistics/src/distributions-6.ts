import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  type EvaluateOptions,
  integerAt,
  operandsOf,
  symbolNameOf,
  widenSignature,
  wrapOperator,
} from "@enumeratio/boxed";
import { bindingOf, finish, mentions, normal01, numAt, uniform01 } from "./distributions.ts";
import { add, div, exp, mul, neg, pow, sub } from "./distributions-2.ts";

// The sixth wave of Wolfram-frontier probability heads, deferred from earlier waves (see
// distributions-4.ts's and distributions-5.ts's own doc comments, both of which explicitly
// carve these six out): MultinomialDistribution, MultinormalDistribution,
// MultivariatePoissonDistribution, ProbabilityDistribution, ParameterMixtureDistribution,
// HistogramDistribution. Same pattern every wave before this one uses: an inert constructor
// with signature `distribution`, extended into PDF/CDF/Mean/Variance/RandomVariate (and, new
// this wave, Covariance) via `wrapOperator`, composing on top of whatever wave 1-5 already
// declared. Out of scope, per the accompanying batch: EstimatedDistribution, SmoothKernel,
// Copula, random processes.
//
// `Covariance` is compute-engine NATIVE, but only over two equal-length collections (or one
// collection of pairs) — never a single distribution. Its signature is widened once, in
// place, to also accept one of this file's three vector distributions (guarded by
// `widenSignature`'s `nativeAccepts`, so the native two-collection call is untouched), then
// `wrapOperator`ed the same way PDF/CDF/Mean/Variance are.

// --- shared: matrix helpers (numeric only, for RandomVariate's Cholesky draw) -------------------

/** Cholesky factor L (lower-triangular) of a symmetric positive-definite matrix, numeric only —
 *  there is no exact/symbolic Cholesky in this package, and none is needed: RandomVariate
 *  already draws plain numbers everywhere else in this file (see `distributions.ts`'s own
 *  `gammaSample`/`betaSample`/`binormalSample`). A non-PD input produces `NaN` entries rather
 *  than throwing — silently propagated into `ce.number(NaN)`, same as any other numeric edge
 *  case this package's RandomVariate hits. */
function choleskyNumeric(sigma: readonly (readonly number[])[]): number[][] {
  const k = sigma.length;
  const L: number[][] = Array.from({ length: k }, () => Array.from({ length: k }, () => 0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = sigma[i][j];
      for (let m = 0; m < j; m++) sum -= L[i][m] * L[j][m];
      L[i][j] = i === j ? Math.sqrt(sum) : sum / L[j][j];
    }
  }
  return L;
}

/** Sequential binomial draws — mirrors `distributions.ts`'s own (unexported) `binomialSample`,
 *  reimplemented locally since nothing beyond `uniform01`/`normal01`/`gammaSample`/`numAt` is
 *  exported from that file. */
const localBinomialSample = (ce: ComputeEngine, n: number, p: number): number => {
  let count = 0;
  for (let i = 0; i < n; i++) if (uniform01(ce) < p) count++;
  return count;
};

/** Knuth's algorithm — mirrors `distributions.ts`'s own (unexported) `poissonSample`. */
const localPoissonSample = (ce: ComputeEngine, lambda: number): number => {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= uniform01(ce);
  } while (p > L);
  return k - 1;
};

const listOf = (ce: ComputeEngine, xs: readonly BoxedExpression[]): BoxedExpression => ce.function("List", [...xs]);
const sumAll = (ce: ComputeEngine, xs: readonly BoxedExpression[]): BoxedExpression =>
  xs.length === 1 ? xs[0] : add(ce, ...xs);

// --- 1. MultinomialDistribution(n, {p1, ..., pk}) ------------------------------------------------

interface Multinomial {
  readonly n: BoxedExpression;
  readonly ps: readonly BoxedExpression[];
}

const multinomialParams = (dist: BoxedExpression): Multinomial | undefined => {
  const ops = operandsOf(dist);
  if (ops.length !== 2 || ops[1].operator !== "List") return undefined;
  const ps = operandsOf(ops[1]);
  return ps.length >= 2 ? { n: ops[0], ps } : undefined;
};

/** `Multinomial(x1, ..., xk)` (compute-engine native) IS `n! / (x1! ... xk!)` for `n = sum(xi)`
 *  — so it already computes the multinomial coefficient with no `n` of its own to pass in. The
 *  guard is what checks that sum against the DISTRIBUTION's own `n`: off that count, the
 *  probability is exactly 0 (not just an unrelated coefficient), and `If`'s branches must
 *  already be `finish`ed (same lazy-branch gotcha every `If`-building PDF in this package
 *  documents). */
const multinomialPdf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = multinomialParams(dist);
  if (params === undefined || x.operator !== "List") return undefined;
  const xs = operandsOf(x);
  if (xs.length !== params.ps.length) return undefined;
  const raw = finish(
    mul(ce, ce.function("Multinomial", [...xs]), ...xs.map((xi, i) => pow(ce, params.ps[i], xi))),
    options,
  );
  const cond = ce.function("Equal", [sumAll(ce, xs), params.n]);
  return finish(ce.function("If", [cond, raw, ce.Zero]), options);
};

const multinomialMean = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = multinomialParams(dist);
  if (params === undefined) return undefined;
  return finish(
    listOf(
      ce,
      params.ps.map((p) => mul(ce, params.n, p)),
    ),
    options,
  );
};

/** Componentwise `n * pi * (1 - pi)` — Wolfram's own `Variance` convention for
 *  `MultinomialDistribution` (a list, not the full covariance matrix; see `Covariance` below
 *  for that). */
const multinomialVariance = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = multinomialParams(dist);
  if (params === undefined) return undefined;
  return finish(
    listOf(
      ce,
      params.ps.map((p) => mul(ce, params.n, p, sub(ce, ce.One, p))),
    ),
    options,
  );
};

/** `Cov(Xi, Xj) = -n pi pj` (i != j), `Var(Xi) = n pi (1 - pi)` on the diagonal. */
const multinomialCovariance = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = multinomialParams(dist);
  if (params === undefined) return undefined;
  const { n, ps } = params;
  const rows = ps.map((pi, i) =>
    listOf(
      ce,
      ps.map((pj, j) => (i === j ? mul(ce, n, pi, sub(ce, ce.One, pi)) : neg(ce, mul(ce, n, pi, pj)))),
    ),
  );
  return finish(listOf(ce, rows), options);
};

/** Sequential-conditional-binomial draw: category `i` gets `Binomial(remainingN, pi /
 *  remainingP)` successes out of what's left, the last category takes the remainder exactly
 *  (so counts always sum to `n`, no rounding drift). Standard construction for an exact
 *  multinomial draw out of independent binomials. */
const multinomialDraw = (ce: ComputeEngine, dist: BoxedExpression): BoxedExpression | undefined => {
  const params = multinomialParams(dist);
  if (params === undefined) return undefined;
  const n = Math.round(numAt(params.n));
  const ps = params.ps.map((p) => numAt(p));
  const counts: number[] = [];
  let remainingN = n;
  let remainingP = 1;
  for (let i = 0; i < ps.length - 1; i++) {
    const pi = remainingP > 0 ? ps[i] / remainingP : 0;
    const xi = localBinomialSample(ce, remainingN, pi);
    counts.push(xi);
    remainingN -= xi;
    remainingP -= ps[i];
  }
  counts.push(remainingN);
  return listOf(
    ce,
    counts.map((c) => ce.number(c)),
  );
};

// --- 2. MultinormalDistribution(mu, Sigma) | MultinormalDistribution(Sigma) ----------------------

interface Multinormal {
  readonly mu: BoxedExpression;
  readonly sigma: BoxedExpression;
  readonly k: number;
}

/** `MultinormalDistribution(Sigma)` defaults `mu` to the zero vector; `(mu, Sigma)` gives both.
 *  `k` (dimension) is read off `mu`'s length either way. */
const multinormalParams = (ce: ComputeEngine, dist: BoxedExpression): Multinormal | undefined => {
  const ops = operandsOf(dist);
  if (ops.length === 1 && ops[0].operator === "List") {
    const sigma = ops[0];
    const k = operandsOf(sigma).length;
    return {
      mu: listOf(
        ce,
        Array.from({ length: k }, () => ce.Zero),
      ),
      sigma,
      k,
    };
  }
  if (ops.length === 2 && ops[0].operator === "List" && ops[1].operator === "List") {
    return { mu: ops[0], sigma: ops[1], k: operandsOf(ops[0]).length };
  }
  return undefined;
};

/** `(2 pi)^(-k/2) |Sigma|^(-1/2) exp(-1/2 (x-mu)^T Sigma^-1 (x-mu))` — exact whenever `Sigma`
 *  is rational (compute-engine's `Determinant`/`Inverse`/`Dot` all stay exact over rationals;
 *  confirmed empirically, `.scratch/probe3.mjs`). */
const multinormalPdf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = multinormalParams(ce, dist);
  if (params === undefined || x.operator !== "List") return undefined;
  const xs = operandsOf(x);
  const mus = operandsOf(params.mu);
  if (xs.length !== params.k) return undefined;
  const diff = listOf(
    ce,
    xs.map((xi, i) => sub(ce, xi, mus[i])),
  );
  const det = ce.function("Determinant", [params.sigma]);
  const inv = ce.function("Inverse", [params.sigma]);
  // `Dot`'s return type depends on its operands' SHAPES (vector.vector -> number, matrix.vector
  // -> vector), which it can't resolve statically the way `Determinant`/`Inverse` (always
  // "matrix") can — nesting an unevaluated `Dot` as another `Dot`'s operand fails boxing with
  // `incompatible-type ... "value"` (confirmed empirically, `.scratch/debug_dot2.mjs`), so
  // `invDiff` has to be evaluated before it's used to build the outer `Dot`.
  const invDiff = ce.function("Dot", [inv, diff]).evaluate();
  const quad = ce.function("Dot", [diff, invDiff]);
  const twoPiK = pow(ce, mul(ce, ce.number(2), ce.symbol("Pi")), ce.number(params.k));
  const norm = ce.function("Sqrt", [mul(ce, twoPiK, det)]);
  const expr = div(ce, exp(ce, neg(ce, div(ce, quad, ce.number(2)))), norm);
  return finish(expr, options);
};

const multinormalMean = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = multinormalParams(ce, dist);
  return params === undefined ? undefined : finish(params.mu, options);
};

/** The DIAGONAL of `Sigma` — Wolfram's own convention for `MultinormalDistribution`'s
 *  `Variance` (a length-k list of componentwise variances, not the full matrix; that's what
 *  `Covariance` answers — see below). */
const multinormalVariance = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = multinormalParams(ce, dist);
  if (params === undefined) return undefined;
  const rows = operandsOf(params.sigma).map(operandsOf);
  return finish(
    listOf(
      ce,
      rows.map((row, i) => row[i]),
    ),
    options,
  );
};

const multinormalCovariance = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = multinormalParams(ce, dist);
  return params === undefined ? undefined : finish(params.sigma, options);
};

/** `x = mu + L z`, `z` iid standard normal, `L` the (numeric) Cholesky factor of `Sigma`. */
const multinormalDraw = (ce: ComputeEngine, dist: BoxedExpression): BoxedExpression | undefined => {
  const params = multinormalParams(ce, dist);
  if (params === undefined) return undefined;
  const mus = operandsOf(params.mu).map(numAt);
  const sigmaRows = operandsOf(params.sigma).map((row) => operandsOf(row).map(numAt));
  const L = choleskyNumeric(sigmaRows);
  const z = mus.map(() => normal01(ce));
  const xs = mus.map((mu, i) => {
    let s = mu;
    for (let j = 0; j <= i; j++) s += L[i][j] * z[j];
    return s;
  });
  return listOf(
    ce,
    xs.map((v) => ce.number(v)),
  );
};

// --- 3. MultivariatePoissonDistribution(mu0, {mu1, ..., muk}) ------------------------------------
//
// Wolfram's common-shock model: `Xi = Y0 + Yi`, a shared `Y0 ~ Poisson(mu0)` plus an
// independent `Yi ~ Poisson(mui)` per coordinate — the standard construction giving every pair
// a positive covariance `mu0` (the shared shock) on top of each coordinate's own Poisson
// variance.

interface MultivariatePoisson {
  readonly mu0: BoxedExpression;
  readonly mus: readonly BoxedExpression[];
}

const multivariatePoissonParams = (dist: BoxedExpression): MultivariatePoisson | undefined => {
  const ops = operandsOf(dist);
  if (ops.length !== 2 || ops[1].operator !== "List") return undefined;
  const mus = operandsOf(ops[1]);
  return mus.length >= 2 ? { mu0: ops[0], mus } : undefined;
};

/** `P(X = x) = sum_{j=0}^{min(xi)} PDF(Poisson(mu0), j) * prod_i PDF(Poisson(mui), xi - j)` — a
 *  finite EXACT sum (built from compute-engine's own, already-exact, native Poisson `PDF`),
 *  needing each `xi` to resolve to a concrete nonnegative integer (the common case: a specific
 *  count vector). Symbolic `xi` stays unevaluated — there's no closed form for the sum itself. */
const multivariatePoissonPdf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = multivariatePoissonParams(dist);
  if (params === undefined || x.operator !== "List") return undefined;
  const xs = operandsOf(x);
  if (xs.length !== params.mus.length) return undefined;
  const xInts = xs.map((xi) => integerAt(xi));
  if (xInts.some((v) => v === undefined || v < 0)) return undefined;
  const ints = xInts as number[];
  const minX = Math.min(...ints);
  const terms: BoxedExpression[] = [];
  for (let j = 0; j <= minX; j++) {
    const shockPdf = ce.function("PDF", [ce.function("PoissonDistribution", [params.mu0]), ce.number(j)]);
    const factors = params.mus.map((mu, i) =>
      ce.function("PDF", [ce.function("PoissonDistribution", [mu]), ce.number(ints[i] - j)]),
    );
    terms.push(mul(ce, shockPdf, ...factors));
  }
  return finish(sumAll(ce, terms), options);
};

const multivariatePoissonMean = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = multivariatePoissonParams(dist);
  if (params === undefined) return undefined;
  return finish(
    listOf(
      ce,
      params.mus.map((mu) => add(ce, params.mu0, mu)),
    ),
    options,
  );
};

/** Each `Xi = Y0 + Yi` is itself Poisson-shaped (sum of independents), so `Var(Xi) = mu0 + mui`
 *  — the same formula as `Mean`, exactly Poisson's own mean-equals-variance identity. */
const multivariatePoissonVariance = multivariatePoissonMean;

/** `Cov(Xi, Xj) = mu0` (i != j, from the shared `Y0`), `Var(Xi) = mu0 + mui` on the diagonal. */
const multivariatePoissonCovariance = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = multivariatePoissonParams(dist);
  if (params === undefined) return undefined;
  const { mu0, mus } = params;
  const rows = mus.map((mui, i) =>
    listOf(
      ce,
      mus.map((_, j) => (i === j ? add(ce, mu0, mui) : mu0)),
    ),
  );
  return finish(listOf(ce, rows), options);
};

const multivariatePoissonDraw = (ce: ComputeEngine, dist: BoxedExpression): BoxedExpression | undefined => {
  const params = multivariatePoissonParams(dist);
  if (params === undefined) return undefined;
  const shock = localPoissonSample(ce, numAt(params.mu0));
  const xs = params.mus.map((mu) => shock + localPoissonSample(ce, numAt(mu)));
  return listOf(
    ce,
    xs.map((v) => ce.number(v)),
  );
};

// --- 4. ProbabilityDistribution(pdf, {x, min, max}) | (pdf, {x, min, max, 1}) --------------------
//
// Wolfram's user-supplied-density constructor. The continuous three-element spec `{x, min,
// max}` and the discrete four-element spec `{x, min, max, 1}` (step size pinned to 1 — an
// arbitrary step is out of scope, per the task) are the two forms handled; `pdf` is used
// as-is, un-normalized (Wolfram itself does NOT renormalize `ProbabilityDistribution`'s `pdf`
// argument either — it is the caller's responsibility that it already integrates/sums to 1).

interface ProbDist {
  readonly pdfExpr: BoxedExpression;
  readonly varName: string;
  readonly min: BoxedExpression;
  readonly max: BoxedExpression;
  readonly discrete: boolean;
}

const probabilityDistParams = (dist: BoxedExpression): ProbDist | undefined => {
  const ops = operandsOf(dist);
  if (ops.length !== 2 || ops[1].operator !== "List") return undefined;
  const spec = operandsOf(ops[1]);
  if (spec.length !== 3 && spec.length !== 4) return undefined;
  const varName = symbolNameOf(spec[0]);
  if (varName === undefined) return undefined;
  if (spec.length === 4 && integerAt(spec[3]) !== 1) return undefined;
  return { pdfExpr: ops[0], varName, min: spec[1], max: spec[2], discrete: spec.length === 4 };
};

/** `pdf` substituted at `x`, `0` outside `[min, max]` — the in-range branch pre-`finish`ed
 *  before `If` picks a branch (same lazy-`If` idiom every PDF above documents). */
const probabilityDistPdf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = probabilityDistParams(dist);
  if (params === undefined) return undefined;
  const inRange = ce.function("And", [
    ce.function("LessEqual", [params.min, x]),
    ce.function("LessEqual", [x, params.max]),
  ]);
  const value = finish(params.pdfExpr.subs({ [params.varName]: x }), options);
  return finish(ce.function("If", [inRange, value, ce.Zero]), options);
};

/** `Integrate`/`Sum` against the (already-extended) native heads — both stay as their own
 *  operator, unevaluated, when they have no closed form, which is exactly the signal used here
 *  to fall back to "stays unevaluated" rather than approximate (numeric approximation still
 *  reaches this through `N`, same as everywhere else in this package). `Limits`, not `List`,
 *  is the range head both `Integrate` and `Sum` actually recognize (confirmed empirically,
 *  `.scratch/probe6.mjs` — a `List` range is silently ignored). */
const limitsOf = (ce: ComputeEngine, varName: string, lo: BoxedExpression, hi: BoxedExpression): BoxedExpression =>
  ce.function("Limits", [ce.symbol(varName), lo, hi]);

const probabilityDistCdf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = probabilityDistParams(dist);
  if (params === undefined) return undefined;
  const head = params.discrete ? "Sum" : "Integrate";
  const raw = ce.function(head, [params.pdfExpr, limitsOf(ce, params.varName, params.min, x)]).evaluate();
  if (raw.operator === head) return undefined;
  return finish(raw, options);
};

const probabilityDistMean = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = probabilityDistParams(dist);
  if (params === undefined) return undefined;
  const head = params.discrete ? "Sum" : "Integrate";
  const integrand = mul(ce, ce.symbol(params.varName), params.pdfExpr);
  const raw = ce.function(head, [integrand, limitsOf(ce, params.varName, params.min, params.max)]).evaluate();
  if (raw.operator === head) return undefined;
  return finish(raw, options);
};

const probabilityDistVariance = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = probabilityDistParams(dist);
  if (params === undefined) return undefined;
  const mean = probabilityDistMean(ce, dist, options);
  if (mean === undefined) return undefined;
  const head = params.discrete ? "Sum" : "Integrate";
  const integrand = mul(ce, pow(ce, sub(ce, ce.symbol(params.varName), mean), ce.number(2)), params.pdfExpr);
  const raw = ce.function(head, [integrand, limitsOf(ce, params.varName, params.min, params.max)]).evaluate();
  if (raw.operator === head) return undefined;
  return finish(raw, options);
};

// --- 5. ParameterMixtureDistribution(dist(theta), Distributed(theta, prior)) ---------------------
//
// Two named conjugate closed forms (per the task's own scope): Poisson(theta) mixed over a
// Gamma(shape, scale) prior on theta is exactly NegativeBinomialDistribution(shape,
// 1/(1+scale)) (the standard Gamma-Poisson/negative-binomial identity — verified against the
// mean: E[X] = E[theta] = shape*scale on both sides); Binomial(n, theta) mixed over a
// Beta(a, b) prior is the Beta-Binomial, with its own closed-form PDF/Mean/Variance. Anything
// else falls back to the LAW OF TOTAL EXPECTATION/VARIANCE, built entirely out of the (already
// fully extended) Mean/Variance/Expectation operators — so it composes with any inner
// distribution/prior pair those three heads already answer, not just the two named cases.

interface ParamMixture {
  readonly inner: BoxedExpression;
  readonly varName: string;
  readonly prior: BoxedExpression;
}

const parameterMixtureParams = (dist: BoxedExpression): ParamMixture | undefined => {
  const ops = operandsOf(dist);
  if (ops.length !== 2) return undefined;
  const binding = bindingOf(ops[1]);
  if (binding === undefined) return undefined;
  return { inner: ops[0], varName: binding.varName, prior: binding.dist };
};

const isPoissonGamma = (p: ParamMixture): boolean => {
  const innerOps = operandsOf(p.inner);
  return (
    p.inner.operator === "PoissonDistribution" &&
    innerOps.length === 1 &&
    symbolNameOf(innerOps[0]) === p.varName &&
    p.prior.operator === "GammaDistribution"
  );
};

/** `p = 1/(1+scale)`, `r = shape` — the standard Gamma-Poisson identity. `GammaDistribution`'s
 *  own one-argument form (scale defaulting to 1, per `distributions.ts`'s `gammaParams`) is
 *  handled the same way here. */
const poissonGammaAsNegBinomial = (ce: ComputeEngine, prior: BoxedExpression): BoxedExpression => {
  const gammaOps = operandsOf(prior);
  const shape = gammaOps[0];
  const scale = gammaOps.length === 2 ? gammaOps[1] : ce.One;
  const p = div(ce, ce.One, add(ce, ce.One, scale));
  return ce.function("NegativeBinomialDistribution", [shape, p]);
};

const isBinomialBeta = (p: ParamMixture): boolean => {
  const innerOps = operandsOf(p.inner);
  return (
    p.inner.operator === "BinomialDistribution" &&
    innerOps.length === 2 &&
    symbolNameOf(innerOps[1]) === p.varName &&
    !mentions(innerOps[0], p.varName) &&
    p.prior.operator === "BetaDistribution"
  );
};

const betaBinomialShape = (p: ParamMixture): { n: BoxedExpression; a: BoxedExpression; b: BoxedExpression } => {
  const [n] = operandsOf(p.inner);
  const [a, b] = operandsOf(p.prior);
  return { n, a, b };
};

/** `C(n,x) B(x+a, n-x+b) / B(a,b)` — the Beta-Binomial PDF, a standard closed form (the
 *  Binomial's own coefficient times the ratio of two Beta functions). */
const betaBinomialPdf = (
  ce: ComputeEngine,
  p: ParamMixture,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression => {
  const { n, a, b } = betaBinomialShape(p);
  const coeff = ce.function("Binomial", [n, x]);
  const betaNum = ce.function("Beta", [add(ce, x, a), add(ce, sub(ce, n, x), b)]);
  const betaDenom = ce.function("Beta", [a, b]);
  return finish(mul(ce, coeff, div(ce, betaNum, betaDenom)), options);
};

const betaBinomialMean = (ce: ComputeEngine, p: ParamMixture, options: EvaluateOptions): BoxedExpression => {
  const { n, a, b } = betaBinomialShape(p);
  return finish(div(ce, mul(ce, n, a), add(ce, a, b)), options);
};

/** `n a b (a+b+n) / ((a+b)^2 (a+b+1))` — the standard Beta-Binomial variance, from the law of
 *  total variance applied to `Binomial(n, theta)` over `theta ~ Beta(a,b)`. */
const betaBinomialVariance = (ce: ComputeEngine, p: ParamMixture, options: EvaluateOptions): BoxedExpression => {
  const { n, a, b } = betaBinomialShape(p);
  const sum = add(ce, a, b);
  const numerator = mul(ce, n, a, b, add(ce, sum, n));
  const denominator = mul(ce, pow(ce, sum, ce.number(2)), add(ce, sum, ce.One));
  return finish(div(ce, numerator, denominator), options);
};

/** `E[X] = E_theta[Mean(dist(theta))]`, going back through the (already fully extended)
 *  `Expectation` operator — which resolves exactly when `Mean(dist(theta))`, as an expression
 *  IN `theta`, is one of `Expectation`'s own recognized linear/quadratic-in-`theta` shapes
 *  (`distributions.ts`'s `expectationOf`). This is what generically reproduces the Gamma-
 *  Poisson identity above with no distribution-specific code (both `Mean` and `Variance` of
 *  `PoissonDistribution(theta)` are exactly `theta`, linear) — kept as a fallback rather than
 *  the primary path only because `PDF` still needs the named closed form to answer anything at
 *  all, and because a non-linear `Mean(dist(theta))` (e.g. `Binomial`'s own `Variance`, `n
 *  theta (1-theta)`, un-expanded) does NOT resolve this way, which is why Binomial-Beta gets
 *  its own closed form above instead of relying on this. */
const totalExpectationMean = (
  ce: ComputeEngine,
  p: ParamMixture,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const meanTheta = ce.function("Mean", [p.inner]).evaluate();
  const distributed = ce.function("Distributed", [ce.symbol(p.varName), p.prior]);
  const result = ce.function("Expectation", [meanTheta, distributed]).evaluate();
  return result.operator === "Expectation" ? undefined : finish(result, options);
};

/** Law of total variance: `Var(X) = E_theta[Variance(dist(theta))] + Var_theta[Mean(dist(theta))]`,
 *  the second term as `E[Mean^2] - E[Mean]^2` — three `Expectation` calls, all through the same
 *  generic machinery `totalExpectationMean` uses, none resolved a priori. */
const totalExpectationVariance = (
  ce: ComputeEngine,
  p: ParamMixture,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const meanTheta = ce.function("Mean", [p.inner]).evaluate();
  const varTheta = ce.function("Variance", [p.inner]).evaluate();
  const distributed = ce.function("Distributed", [ce.symbol(p.varName), p.prior]);
  const eVar = ce.function("Expectation", [varTheta, distributed]).evaluate();
  const eMean = ce.function("Expectation", [meanTheta, distributed]).evaluate();
  const eMeanSq = ce.function("Expectation", [pow(ce, meanTheta, ce.number(2)), distributed]).evaluate();
  if (eVar.operator === "Expectation" || eMean.operator === "Expectation" || eMeanSq.operator === "Expectation") {
    return undefined;
  }
  const varOfMean = sub(ce, eMeanSq, pow(ce, eMean, ce.number(2)));
  return finish(add(ce, eVar, varOfMean), options);
};

const mixturePdf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const p = parameterMixtureParams(dist);
  if (p === undefined) return undefined;
  if (isPoissonGamma(p)) return finish(ce.function("PDF", [poissonGammaAsNegBinomial(ce, p.prior), x]), options);
  if (isBinomialBeta(p)) return betaBinomialPdf(ce, p, x, options);
  return undefined;
};

const mixtureMean = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const p = parameterMixtureParams(dist);
  if (p === undefined) return undefined;
  if (isPoissonGamma(p)) return finish(ce.function("Mean", [poissonGammaAsNegBinomial(ce, p.prior)]), options);
  if (isBinomialBeta(p)) return betaBinomialMean(ce, p, options);
  return totalExpectationMean(ce, p, options);
};

const mixtureVariance = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const p = parameterMixtureParams(dist);
  if (p === undefined) return undefined;
  if (isPoissonGamma(p)) return finish(ce.function("Variance", [poissonGammaAsNegBinomial(ce, p.prior)]), options);
  if (isBinomialBeta(p)) return betaBinomialVariance(ce, p, options);
  return totalExpectationVariance(ce, p, options);
};

// --- 6. HistogramDistribution(data, {dx}) | (data, {x0, x1, dx}) ---------------------------------
//
// Explicit bins only (per the task's scope — Wolfram's own automatic-binning rule is not
// pinned down here). `{dx}` picks `x0 = floor(min(data)/dx) * dx` as the first bin's left edge
// (a documented choice, not Wolfram's own automatic rule) and covers every data point up to
// `max(data)`; `{x0, x1, dx}` gives the range explicitly. Bin counts are exact integers; every
// PDF/CDF/Mean/Variance built from them stays exact (rational arithmetic throughout) even
// though the BINNING itself is computed in plain numbers (bin index is inherently a floor/
// division on a numeric position — there's no way around leaving that part numeric).

interface HistogramSpec {
  readonly data: readonly BoxedExpression[];
  readonly x0: BoxedExpression;
  readonly dx: BoxedExpression;
  readonly x1?: BoxedExpression;
}

const histogramParams = (dist: BoxedExpression): HistogramSpec | undefined => {
  const ops = operandsOf(dist);
  if (ops.length !== 2 || ops[0].operator !== "List" || ops[1].operator !== "List") return undefined;
  const data = operandsOf(ops[0]);
  const spec = operandsOf(ops[1]);
  if (data.length === 0) return undefined;
  if (spec.length === 1) return { data, x0: undefined as unknown as BoxedExpression, dx: spec[0] };
  if (spec.length === 3) return { data, x0: spec[0], dx: spec[2], x1: spec[1] };
  return undefined;
};

interface Bins {
  readonly x0n: number;
  readonly dxn: number;
  readonly n: number;
  readonly counts: readonly number[];
}

const buildBins = (spec: HistogramSpec): Bins => {
  const dxn = numAt(spec.dx);
  const dataNums = spec.data.map(numAt);
  const x0n = spec.x0 === undefined ? Math.floor(Math.min(...dataNums) / dxn) * dxn : numAt(spec.x0);
  const maxVal = spec.x1 !== undefined ? numAt(spec.x1) : Math.max(...dataNums);
  const nBins = Math.max(1, Math.round((maxVal - x0n) / dxn));
  const counts = Array.from({ length: nBins }, () => 0);
  for (const v of dataNums) {
    let idx = Math.floor((v - x0n) / dxn);
    if (idx < 0) idx = 0;
    if (idx >= nBins) idx = nBins - 1;
    counts[idx]++;
  }
  return { x0n, dxn, n: dataNums.length, counts };
};

/** `x0` as a BOXED expression — either the given one (explicit-range form) or, for the `{dx}`
 *  form, rebuilt from the numeric `bins.x0n` (still exact whenever `dx`/the data are, since
 *  `x0n` is an exact multiple of `dxn` by construction). */
const boxedX0 = (ce: ComputeEngine, spec: HistogramSpec, bins: Bins): BoxedExpression => spec.x0 ?? ce.number(bins.x0n);

const binBounds = (
  ce: ComputeEngine,
  spec: HistogramSpec,
  bins: Bins,
  index: number,
): { a: BoxedExpression; b: BoxedExpression } => {
  const a = add(ce, boxedX0(ce, spec, bins), mul(ce, ce.number(index), spec.dx));
  const b = add(ce, a, spec.dx);
  return { a, b };
};

const histogramPdf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const spec = histogramParams(dist);
  if (spec === undefined) return undefined;
  const bins = buildBins(spec);
  const xn = numAt(x);
  const idx = Math.floor((xn - bins.x0n) / bins.dxn);
  if (idx < 0 || idx >= bins.counts.length) return finish(ce.Zero, options);
  const height = div(ce, ce.number(bins.counts[idx]), mul(ce, ce.number(bins.n), spec.dx));
  return finish(height, options);
};

/** Piecewise-LINEAR (the piecewise-CONSTANT PDF's antiderivative): full bins below `x`'s bin
 *  contribute their whole count, `x`'s own bin contributes a fractional share. Built entirely
 *  from boxed arithmetic (add/mul/div/sub), so it stays exact wherever `x0`/`dx`/`x` are. */
const histogramCdf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const spec = histogramParams(dist);
  if (spec === undefined) return undefined;
  const bins = buildBins(spec);
  const xn = numAt(x);
  if (xn <= bins.x0n) return finish(ce.Zero, options);
  const maxX = bins.x0n + bins.counts.length * bins.dxn;
  if (xn >= maxX) return finish(ce.One, options);
  const idx = Math.floor((xn - bins.x0n) / bins.dxn);
  let cumCount = 0;
  for (let i = 0; i < idx; i++) cumCount += bins.counts[i];
  const { a } = binBounds(ce, spec, bins, idx);
  const frac = div(ce, sub(ce, x, a), spec.dx);
  const total = add(ce, ce.number(cumCount), mul(ce, ce.number(bins.counts[idx]), frac));
  return finish(div(ce, total, ce.number(bins.n)), options);
};

const histogramMean = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const spec = histogramParams(dist);
  if (spec === undefined) return undefined;
  const bins = buildBins(spec);
  const terms: BoxedExpression[] = [];
  for (let i = 0; i < bins.counts.length; i++) {
    if (bins.counts[i] === 0) continue;
    const { a, b } = binBounds(ce, spec, bins, i);
    const mid = div(ce, add(ce, a, b), ce.number(2));
    terms.push(mul(ce, ce.number(bins.counts[i]), mid));
  }
  const sum = terms.length === 0 ? ce.Zero : sumAll(ce, terms);
  return finish(div(ce, sum, ce.number(bins.n)), options);
};

/** `Var = E[X^2] - Mean^2`, with each bin's `E[X^2 | bin]` the standard uniform-on-`[a,b]`
 *  second moment `(a^2 + a b + b^2) / 3`. */
const histogramVariance = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const spec = histogramParams(dist);
  if (spec === undefined) return undefined;
  const mean = histogramMean(ce, dist, options);
  if (mean === undefined) return undefined;
  const bins = buildBins(spec);
  const terms: BoxedExpression[] = [];
  for (let i = 0; i < bins.counts.length; i++) {
    if (bins.counts[i] === 0) continue;
    const { a, b } = binBounds(ce, spec, bins, i);
    const secondMoment = div(
      ce,
      add(ce, add(ce, pow(ce, a, ce.number(2)), mul(ce, a, b)), pow(ce, b, ce.number(2))),
      ce.number(3),
    );
    terms.push(mul(ce, ce.number(bins.counts[i]), secondMoment));
  }
  const sum = terms.length === 0 ? ce.Zero : sumAll(ce, terms);
  const eX2 = div(ce, sum, ce.number(bins.n));
  return finish(sub(ce, eX2, pow(ce, mean, ce.number(2))), options);
};

// --- declarations --------------------------------------------------------------------------------

const KINDS6 = new Set([
  "MultinomialDistribution",
  "MultinormalDistribution",
  "MultivariatePoissonDistribution",
  "ProbabilityDistribution",
  "ParameterMixtureDistribution",
  "HistogramDistribution",
]);

/** The three kinds `Covariance` is widened for — never `ProbabilityDistribution`/
 *  `ParameterMixtureDistribution`/`HistogramDistribution`, which are univariate. */
const VECTOR_KINDS6 = new Set([
  "MultinomialDistribution",
  "MultinormalDistribution",
  "MultivariatePoissonDistribution",
]);

function declareConstructors6(ce: ComputeEngine): void {
  ce.declare("MultinomialDistribution", { signature: "(real<0..>, list<real>) -> distribution" });
  ce.declare("MultinormalDistribution", { signature: "(list<any>, list<any>?) -> distribution" });
  ce.declare("MultivariatePoissonDistribution", { signature: "(real<0..>, list<real>) -> distribution" });
  ce.declare("ProbabilityDistribution", { signature: "(any, list<any>) -> distribution" });
  ce.declare("ParameterMixtureDistribution", { signature: "(any, any) -> distribution" });
  ce.declare("HistogramDistribution", { signature: "(list<any>, list<any>) -> distribution" });
}

function extendStats6(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["PDF"],
    (ops) => KINDS6.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => {
      const [dist, x] = ops;
      const result =
        dist.operator === "MultinomialDistribution"
          ? multinomialPdf(ce, dist, x, options)
          : dist.operator === "MultinormalDistribution"
            ? multinormalPdf(ce, dist, x, options)
            : dist.operator === "MultivariatePoissonDistribution"
              ? multivariatePoissonPdf(ce, dist, x, options)
              : dist.operator === "ProbabilityDistribution"
                ? probabilityDistPdf(ce, dist, x, options)
                : dist.operator === "ParameterMixtureDistribution"
                  ? mixturePdf(ce, dist, x, options)
                  : dist.operator === "HistogramDistribution"
                    ? histogramPdf(ce, dist, x, options)
                    : undefined;
      return result ?? native?.(ops, options);
    },
    2,
  );

  wrapOperator(
    ce,
    ["CDF"],
    (ops) => KINDS6.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => {
      const [dist, x] = ops;
      const result =
        dist.operator === "ProbabilityDistribution"
          ? probabilityDistCdf(ce, dist, x, options)
          : dist.operator === "HistogramDistribution"
            ? histogramCdf(ce, dist, x, options)
            : undefined;
      return result ?? native?.(ops, options);
    },
    2,
  );

  wrapOperator(
    ce,
    ["Mean"],
    (ops) => KINDS6.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => {
      const dist = ops[0];
      const result =
        dist.operator === "MultinomialDistribution"
          ? multinomialMean(ce, dist, options)
          : dist.operator === "MultinormalDistribution"
            ? multinormalMean(ce, dist, options)
            : dist.operator === "MultivariatePoissonDistribution"
              ? multivariatePoissonMean(ce, dist, options)
              : dist.operator === "ProbabilityDistribution"
                ? probabilityDistMean(ce, dist, options)
                : dist.operator === "ParameterMixtureDistribution"
                  ? mixtureMean(ce, dist, options)
                  : dist.operator === "HistogramDistribution"
                    ? histogramMean(ce, dist, options)
                    : undefined;
      return result ?? native?.(ops, options);
    },
    1,
  );

  wrapOperator(
    ce,
    ["Variance"],
    (ops) => KINDS6.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => {
      const dist = ops[0];
      const result =
        dist.operator === "MultinomialDistribution"
          ? multinomialVariance(ce, dist, options)
          : dist.operator === "MultinormalDistribution"
            ? multinormalVariance(ce, dist, options)
            : dist.operator === "MultivariatePoissonDistribution"
              ? multivariatePoissonVariance(ce, dist, options)
              : dist.operator === "ProbabilityDistribution"
                ? probabilityDistVariance(ce, dist, options)
                : dist.operator === "ParameterMixtureDistribution"
                  ? mixtureVariance(ce, dist, options)
                  : dist.operator === "HistogramDistribution"
                    ? histogramVariance(ce, dist, options)
                    : undefined;
      return result ?? native?.(ops, options);
    },
    1,
  );

  wrapOperator(
    ce,
    ["RandomVariate"],
    (ops) => KINDS6.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => {
      const dist = ops[0];
      if (ops.length !== 1) return native?.(ops, options);
      const result =
        dist.operator === "MultinomialDistribution"
          ? multinomialDraw(ce, dist)
          : dist.operator === "MultinormalDistribution"
            ? multinormalDraw(ce, dist)
            : dist.operator === "MultivariatePoissonDistribution"
              ? multivariatePoissonDraw(ce, dist)
              : undefined;
      return result ?? native?.(ops, options);
    },
    { min: 1, max: 2 },
  );
}

/** `Covariance` is compute-engine native over two collections; widened once, in place, to also
 *  accept a single one of this file's three vector distributions (boxing otherwise rejects a
 *  `distribution`-typed argument outright — confirmed empirically, `.scratch/probe4.mjs`), then
 *  `wrapOperator`ed at arity 1 so the native two-collection (or one-collection-of-pairs) call
 *  is untouched. */
function extendCovariance6(ce: ComputeEngine): void {
  widenSignature(
    ce,
    "Covariance",
    "(collection<any> | distribution, collection<any>?) -> nan | real | list<list<real>>",
    (op) => !VECTOR_KINDS6.has(op.operator),
  );
  wrapOperator(
    ce,
    ["Covariance"],
    (ops) => VECTOR_KINDS6.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => {
      const dist = ops[0];
      const result =
        dist.operator === "MultinomialDistribution"
          ? multinomialCovariance(ce, dist, options)
          : dist.operator === "MultinormalDistribution"
            ? multinormalCovariance(ce, dist, options)
            : dist.operator === "MultivariatePoissonDistribution"
              ? multivariatePoissonCovariance(ce, dist, options)
              : undefined;
      return result ?? native?.(ops, options);
    },
    1,
  );
}

/** Declare the sixth-wave probability heads on `ce`: `MultinomialDistribution`,
 *  `MultinormalDistribution`, `MultivariatePoissonDistribution`, `ProbabilityDistribution`,
 *  `ParameterMixtureDistribution`, `HistogramDistribution` — plus extending
 *  `PDF`/`CDF`/`Mean`/`Variance`/`RandomVariate`/`Covariance` in place. Call AFTER
 *  `declareDistributions` (needs `Distributed`/`Mean`/`Variance`/`Expectation`/
 *  `NegativeBinomialDistribution` already declared — waves 1 and 2). */
export function declareDistributions6(ce: ComputeEngine): void {
  declareConstructors6(ce);
  extendStats6(ce);
  extendCovariance6(ce);
}
