import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvaluateOptions, integerAt, operandsOf, symbolNameOf, wrapOperator } from "@enumeratio/boxed";
import { bindingOf, finish, mentions, numAt, uniform01 } from "./distributions.ts";
import { add, div, exp, If, lt, mul, neg, pow, sub } from "./distributions-2.ts";

// The fourth wave of Wolfram-frontier probability heads, on top of `distributions.ts` (#200),
// `distributions-2.ts` (#218) and `distributions-3.ts` (#236): the COMPOUND distribution
// constructors that combine other distributions rather than declaring a new elementary one —
// TruncatedDistribution, MixtureDistribution, ProductDistribution, TransformedDistribution
// (affine, plus the `x^2` of a standard normal), MarginalDistribution and
// DirichletDistribution. Each is declared the same way every wave before it does: an inert
// constructor with signature `distribution`, extended into PDF/CDF/Mean/Variance/RandomVariate
// via `wrapOperator`, going back through the (fully extended) PDF/CDF/Mean/Variance/
// RandomVariate operators themselves for the inner distribution(s) — so a compound head
// composes with ANY distribution kind the engine already knows, old or new, including another
// compound one (a `MixtureDistribution` of `TruncatedDistribution`s, say).
//
// Left out of scope for this file, per the accompanying batch: NProbability/NExpectation,
// Conditioned (priority 7 — not reached), and Estimated/Histogram/SmoothKernel/Copula/
// Multinormal/Multinomial/fitting (out of scope for the whole batch).

// --- shared helpers ----------------------------------------------------------------------------

/** Every discrete distribution kind this package (waves 1-3) declares or extends — needed here
 *  only for the half-open-interval convention `TruncatedDistribution` uses, and the sign-flip
 *  correction `TransformedDistribution`'s CDF needs for `a < 0`. Not a general "is this
 *  distribution discrete" oracle (a future discrete kind added elsewhere won't automatically
 *  appear here) — a documented, narrow use, same spirit as `distributions.ts`'s own
 *  `DISCRETE_KINDS`. */
const DISCRETE_KINDS4 = new Set([
  "PoissonDistribution",
  "BinomialDistribution",
  "EmpiricalDistribution",
  "GeometricDistribution",
  "BernoulliDistribution",
  "DiscreteUniformDistribution",
  "NegativeBinomialDistribution",
  "HypergeometricDistribution",
]);

const isDiscreteKind = (dist: BoxedExpression): boolean => DISCRETE_KINDS4.has(dist.operator);

const KINDS4 = new Set([
  "TruncatedDistribution",
  "MixtureDistribution",
  "ProductDistribution",
  "TransformedDistribution",
  "DirichletDistribution",
]);

const pdf = (ce: ComputeEngine, dist: BoxedExpression, x: BoxedExpression) => ce.function("PDF", [dist, x]);
const cdf = (ce: ComputeEngine, dist: BoxedExpression, x: BoxedExpression) => ce.function("CDF", [dist, x]);
const mean = (ce: ComputeEngine, dist: BoxedExpression) => ce.function("Mean", [dist]);
const variance = (ce: ComputeEngine, dist: BoxedExpression) => ce.function("Variance", [dist]);
const randomVariate = (ce: ComputeEngine, dist: BoxedExpression) => ce.function("RandomVariate", [dist]);

// --- 1. TruncatedDistribution({a, b}, dist) -----------------------------------------------------
//
// Wolfram restricts a continuous base to the CLOSED interval `[a, b]`; a discrete base is
// restricted to the right-HALF-OPEN interval `(a, b]` (its own docs' convention for e.g.
// `TruncatedDistribution[{2, 5}, PoissonDistribution[3]]` — support `{3, 4, 5}`, not `{2, ...,
// 5}`). Both conventions share the SAME normalizer, `Z = CDF(b) - CDF(a)`, since `CDF(x) = P(X
// <= x)` either way — only where the truncated PDF is nonzero differs.

interface TruncatedParams {
  readonly a: BoxedExpression;
  readonly b: BoxedExpression;
  readonly inner: BoxedExpression;
}

const truncatedParams = (ce: ComputeEngine, dist: BoxedExpression): TruncatedParams | undefined => {
  const ops = operandsOf(dist);
  if (ops.length !== 2 || ops[0].operator !== "List") return undefined;
  const bounds = operandsOf(ops[0]);
  if (bounds.length !== 2) return undefined;
  return { a: bounds[0], b: bounds[1], inner: ops[1] };
};

const normalParams4 = (ce: ComputeEngine, dist: BoxedExpression): [BoxedExpression, BoxedExpression] | undefined => {
  const ops = operandsOf(dist);
  if (ops.length === 0) return [ce.Zero, ce.One];
  if (ops.length === 2) return [ops[0], ops[1]];
  return undefined;
};

/** `TruncatedDistribution`'s `Mean`, exact only where the base distribution has a closed-form
 *  partial expectation this file knows: Uniform (trivially — the truncated uniform IS
 *  `Uniform(a, b)`, whatever the original support), Normal (the standard truncated-normal-mean
 *  identity via the standard normal's own PDF/CDF), Exponential (memoryless-shift identity).
 *  Anything else returns `undefined` — stays unevaluated. */
const truncatedMean = (
  ce: ComputeEngine,
  inner: BoxedExpression,
  a: BoxedExpression,
  b: BoxedExpression,
  z: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  switch (inner.operator) {
    case "UniformDistribution":
      return finish(div(ce, add(ce, a, b), ce.number(2)), options);
    case "NormalDistribution": {
      const params = normalParams4(ce, inner);
      if (params === undefined) return undefined;
      const [mu, sigma] = params;
      const alpha = div(ce, sub(ce, a, mu), sigma);
      const beta = div(ce, sub(ce, b, mu), sigma);
      const std = ce.function("NormalDistribution", [ce.Zero, ce.One]);
      const phiAlpha = pdf(ce, std, alpha);
      const phiBeta = pdf(ce, std, beta);
      return finish(add(ce, mu, div(ce, mul(ce, sigma, sub(ce, phiAlpha, phiBeta)), z)), options);
    }
    case "ExponentialDistribution": {
      const ops = operandsOf(inner);
      const lambda = ops.length === 0 ? ce.One : ops.length === 1 ? ops[0] : undefined;
      if (lambda === undefined) return undefined;
      const c = sub(ce, b, a);
      const decay = exp(ce, neg(ce, mul(ce, lambda, c)));
      const expr = add(ce, a, sub(ce, div(ce, ce.One, lambda), div(ce, mul(ce, c, decay), sub(ce, ce.One, decay))));
      return finish(expr, options);
    }
    default:
      return undefined;
  }
};

const truncatedPdf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = truncatedParams(ce, dist);
  if (params === undefined) return undefined;
  const { a, b, inner } = params;
  const z = finish(sub(ce, cdf(ce, inner, b), cdf(ce, inner, a)), options);
  const inRange = finish(div(ce, pdf(ce, inner, x), z), options);
  const discrete = isDiscreteKind(inner);
  // Nested `If`, each branch pre-`finish`ed before it's nested — the same idiom
  // `clampBelow`/`TriangularDistribution`'s piecewise PDF use: `If` is lazy, so a branch has to
  // already be numeric before `N()` on the whole thing can pick it. Continuous: support is the
  // CLOSED `[a, b]`. Discrete: support is the right-HALF-OPEN `(a, b]` — `x <= a` is excluded.
  const lowerCond = discrete ? ce.function("LessEqual", [x, a]) : lt(ce, x, a);
  const upperExcluded = finish(If(ce, lt(ce, b, x), ce.Zero, inRange), options);
  return finish(If(ce, lowerCond, ce.Zero, upperExcluded), options);
};

const truncatedCdf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = truncatedParams(ce, dist);
  if (params === undefined) return undefined;
  const { a, b, inner } = params;
  const discrete = isDiscreteKind(inner);
  const z = finish(sub(ce, cdf(ce, inner, b), cdf(ce, inner, a)), options);
  const inRange = finish(div(ce, sub(ce, cdf(ce, inner, x), cdf(ce, inner, a)), z), options);
  const lowerCond = discrete ? ce.function("LessEqual", [x, a]) : lt(ce, x, a);
  return finish(If(ce, lowerCond, ce.Zero, finish(If(ce, lt(ce, b, x), ce.One, inRange), options)), options);
};

const truncatedMeanEntry = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const params = truncatedParams(ce, dist);
  if (params === undefined) return undefined;
  const { a, b, inner } = params;
  const z = finish(sub(ce, cdf(ce, inner, b), cdf(ce, inner, a)), options);
  return truncatedMean(ce, inner, a, b, z, options);
};

// --- 2. MixtureDistribution({w1, ..., wn}, {d1, ..., dn}) ---------------------------------------

interface MixtureParams {
  readonly weights: readonly BoxedExpression[];
  readonly dists: readonly BoxedExpression[];
}

const mixtureParams = (ce: ComputeEngine, dist: BoxedExpression): MixtureParams | undefined => {
  const ops = operandsOf(dist);
  if (ops.length !== 2 || ops[0].operator !== "List" || ops[1].operator !== "List") return undefined;
  const weights = operandsOf(ops[0]);
  const dists = operandsOf(ops[1]);
  if (weights.length === 0 || weights.length !== dists.length) return undefined;
  return { weights, dists };
};

const weightSum = (ce: ComputeEngine, weights: readonly BoxedExpression[]) =>
  weights.length === 1 ? weights[0] : add(ce, ...weights);

/** `sum_i (w_i / sum(w)) * f(d_i)` — the shared reduction `PDF`, `CDF` and `Mean` all use,
 *  parameterised over which per-component operator (`f`) to weight and sum. */
const weightedSum = (
  ce: ComputeEngine,
  params: MixtureParams,
  perComponent: (d: BoxedExpression) => BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression => {
  const { weights, dists } = params;
  const total = weightSum(ce, weights);
  const terms = dists.map((d, i) => mul(ce, div(ce, weights[i], total), perComponent(d)));
  return finish(terms.length === 1 ? terms[0] : add(ce, ...terms), options);
};

/** Law of total variance: `Var(Y) = E[Var(Y|component)] + Var(E[Y|component])`, expanded as
 *  `sum_i w_i Var(d_i) + sum_i w_i (Mean(d_i) - Mean(Y))^2` — exact given each component's own
 *  Mean/Variance (whatever those are, old or new distribution kind, via the generic `Mean`/
 *  `Variance` operators). */
const mixtureVariance = (ce: ComputeEngine, params: MixtureParams, options: EvaluateOptions): BoxedExpression => {
  const { weights, dists } = params;
  const total = weightSum(ce, weights);
  const normW = weights.map((w) => div(ce, w, total));
  const overallMean = finish(add(ce, ...dists.map((d, i) => mul(ce, normW[i], mean(ce, d)))), options);
  const withinTerms = dists.map((d, i) => mul(ce, normW[i], variance(ce, d)));
  const betweenTerms = dists.map((d, i) => mul(ce, normW[i], pow(ce, sub(ce, mean(ce, d), overallMean), ce.number(2))));
  return finish(add(ce, ...withinTerms, ...betweenTerms), options);
};

/** One draw: pick a component by its (normalized) weight against a single `uniform01` draw,
 *  then delegate the actual sampling to `RandomVariate` on that component — reusing whatever
 *  per-kind sampler already exists (native, wave 1-3, or another compound distribution)
 *  instead of re-implementing sampling here. */
const mixtureDraw = (ce: ComputeEngine, dist: BoxedExpression): BoxedExpression | undefined => {
  const params = mixtureParams(ce, dist);
  if (params === undefined) return undefined;
  const { weights, dists } = params;
  const nums = weights.map((w) => numAt(w));
  const total = nums.reduce((acc, n) => acc + n, 0);
  if (!(total > 0)) return undefined;
  let r = uniform01(ce) * total;
  let idx = dists.length - 1;
  for (let i = 0; i < nums.length; i++) {
    if (r < nums[i]) {
      idx = i;
      break;
    }
    r -= nums[i];
  }
  return finish(randomVariate(ce, dists[idx]), undefined);
};

// --- 3. ProductDistribution(d1, ..., dn) and ProductDistribution({d, n}) -----------------------

/** `ProductDistribution({d, n})` -> `ProductDistribution(d, d, ..., d)` (n copies) — a
 *  construction-time rewrite, same idiom as `distributions.ts`'s `GammaDistribution` one-
 *  argument default: attached as `canonical` (not `evaluate`) since a held constructor's
 *  `evaluate` never runs, and returning `undefined` for every other call shape hands back to
 *  compute-engine's own generic canonicalization instead of recursing on the expression this
 *  just built. */
const productCanonical = (ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
  if (ops.length !== 1 || ops[0].operator !== "List") return undefined;
  const inner = operandsOf(ops[0]);
  if (inner.length !== 2) return undefined;
  const n = integerAt(inner[1]);
  if (n === undefined || n < 1) return undefined;
  return ce.function(
    "ProductDistribution",
    Array.from({ length: n }, () => inner[0]),
  );
};

const productPdf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const factors = operandsOf(dist);
  if (x.operator !== "List") return undefined;
  const xs = operandsOf(x);
  if (xs.length !== factors.length) return undefined;
  const terms = factors.map((f, i) => pdf(ce, f, xs[i]));
  return finish(terms.length === 1 ? terms[0] : mul(ce, ...terms), options);
};

const productCdf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const factors = operandsOf(dist);
  if (x.operator !== "List") return undefined;
  const xs = operandsOf(x);
  if (xs.length !== factors.length) return undefined;
  const terms = factors.map((f, i) => cdf(ce, f, xs[i]));
  return finish(terms.length === 1 ? terms[0] : mul(ce, ...terms), options);
};

const productMean = (ce: ComputeEngine, dist: BoxedExpression, options: EvaluateOptions): BoxedExpression =>
  finish(
    ce.function(
      "List",
      operandsOf(dist).map((f) => mean(ce, f)),
    ),
    options,
  );

const productVariance = (ce: ComputeEngine, dist: BoxedExpression, options: EvaluateOptions): BoxedExpression =>
  finish(
    ce.function(
      "List",
      operandsOf(dist).map((f) => variance(ce, f)),
    ),
    options,
  );

const productDraw = (ce: ComputeEngine, dist: BoxedExpression): BoxedExpression | undefined => {
  const draws = operandsOf(dist).map((f) => randomVariate(ce, f));
  return finish(ce.function("List", draws), undefined);
};

// --- 4. TransformedDistribution(expr, Distributed(x, dist)) -------------------------------------

interface Affine {
  readonly a: BoxedExpression;
  readonly b: BoxedExpression;
}

/** `expr = a*x + b` — the same linear-decomposition recursion `distributions.ts`'s
 *  `expectationOf` uses for its `Add`/`Multiply`/`Negate` cases, generalized to also thread
 *  through `Subtract` and to accept `Multiply` by an affine (not just a bare `x`) subterm.
 *  Anything else (a genuine nonlinearity `expectationOf` doesn't need to handle) returns
 *  `undefined`. */
const affineOf = (ce: ComputeEngine, expr: BoxedExpression, varName: string): Affine | undefined => {
  if (!mentions(expr, varName)) return { a: ce.Zero, b: expr };
  if (symbolNameOf(expr) === varName) return { a: ce.One, b: ce.Zero };
  switch (expr.operator) {
    case "Negate": {
      const inner = affineOf(ce, operandsOf(expr)[0], varName);
      return inner === undefined ? undefined : { a: neg(ce, inner.a), b: neg(ce, inner.b) };
    }
    case "Add": {
      let aSum = ce.Zero;
      let bSum = ce.Zero;
      for (const term of operandsOf(expr)) {
        const inner = affineOf(ce, term, varName);
        if (inner === undefined) return undefined;
        aSum = add(ce, aSum, inner.a);
        bSum = add(ce, bSum, inner.b);
      }
      return { a: aSum, b: bSum };
    }
    case "Subtract": {
      const [l, r] = operandsOf(expr);
      const il = affineOf(ce, l, varName);
      const ir = affineOf(ce, r, varName);
      if (il === undefined || ir === undefined) return undefined;
      return { a: sub(ce, il.a, ir.a), b: sub(ce, il.b, ir.b) };
    }
    case "Multiply": {
      const ops = operandsOf(expr);
      const varTerms = ops.filter((o) => mentions(o, varName));
      const constTerms = ops.filter((o) => !mentions(o, varName));
      if (varTerms.length !== 1) return undefined;
      const inner = affineOf(ce, varTerms[0], varName);
      if (inner === undefined) return undefined;
      const k = constTerms.length === 0 ? ce.One : constTerms.length === 1 ? constTerms[0] : mul(ce, ...constTerms);
      return { a: mul(ce, k, inner.a), b: mul(ce, k, inner.b) };
    }
    default:
      return undefined;
  }
};

type TransformInfo =
  | {
      readonly kind: "affine";
      readonly a: BoxedExpression;
      readonly aNum: number;
      readonly b: BoxedExpression;
      readonly inner: BoxedExpression;
    }
  | { readonly kind: "chisq1" };

const isStandardNormal = (ce: ComputeEngine, dist: BoxedExpression): boolean => {
  if (dist.operator !== "NormalDistribution") return false;
  const ops = operandsOf(dist);
  if (ops.length === 0) return true;
  if (ops.length !== 2) return false;
  return numAt(ops[0]) === 0 && numAt(ops[1]) === 1;
};

/** Recognizes the two `TransformedDistribution` shapes this file answers: `a*x + b` for any
 *  `a != 0` (affine change of variable), and `x^2` for `x ~ NormalDistribution(0, 1)` — which
 *  is `ChiSquareDistribution(1)` by definition. Anything else returns `undefined`, so PDF/CDF/
 *  Mean/Variance/RandomVariate all stay unevaluated for it. */
const transformedInfo = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): TransformInfo | undefined => {
  const ops = operandsOf(dist);
  if (ops.length !== 2) return undefined;
  const [expr, distributed] = ops;
  const binding = bindingOf(distributed);
  if (binding === undefined) return undefined;
  const { varName, dist: inner } = binding;

  if (expr.operator === "Power") {
    const [base, exponent] = operandsOf(expr);
    if (symbolNameOf(base) === varName && integerAt(exponent) === 2 && isStandardNormal(ce, inner)) {
      return { kind: "chisq1" };
    }
  }

  const coeffs = affineOf(ce, expr, varName);
  if (coeffs === undefined) return undefined;
  const a = finish(coeffs.a, options);
  const aNum = a.N().re;
  if (!Number.isFinite(aNum) || aNum === 0) return undefined;
  return { kind: "affine", a, aNum, b: finish(coeffs.b, options), inner };
};

const transformedPdf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const info = transformedInfo(ce, dist, options);
  if (info === undefined) return undefined;
  if (info.kind === "chisq1") return finish(pdf(ce, ce.function("ChiSquareDistribution", [ce.One]), x), options);
  const { a, b, inner } = info;
  const invArg = div(ce, sub(ce, x, b), a);
  return finish(div(ce, pdf(ce, inner, invArg), ce.function("Abs", [a])), options);
};

const transformedCdf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const info = transformedInfo(ce, dist, options);
  if (info === undefined) return undefined;
  if (info.kind === "chisq1") return finish(cdf(ce, ce.function("ChiSquareDistribution", [ce.One]), x), options);
  const { a, aNum, b, inner } = info;
  const invArg = div(ce, sub(ce, x, b), a);
  if (aNum > 0) return finish(cdf(ce, inner, invArg), options);
  // a < 0 flips the inequality: P(aX+b <= x) = P(X >= (x-b)/a) = 1 - CDF(invArg) + P(X =
  // invArg) — the correction term only nonzero (and only needed) for a discrete base.
  const complement = sub(ce, ce.One, cdf(ce, inner, invArg));
  const correction = isDiscreteKind(inner) ? pdf(ce, inner, invArg) : ce.Zero;
  return finish(add(ce, complement, correction), options);
};

const transformedMean = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const info = transformedInfo(ce, dist, options);
  if (info === undefined) return undefined;
  if (info.kind === "chisq1") return finish(mean(ce, ce.function("ChiSquareDistribution", [ce.One])), options);
  const { a, b, inner } = info;
  return finish(add(ce, mul(ce, a, mean(ce, inner)), b), options);
};

const transformedVariance = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const info = transformedInfo(ce, dist, options);
  if (info === undefined) return undefined;
  if (info.kind === "chisq1") return finish(variance(ce, ce.function("ChiSquareDistribution", [ce.One])), options);
  const { a, inner } = info;
  return finish(mul(ce, pow(ce, a, ce.number(2)), variance(ce, inner)), options);
};

const transformedDraw = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const info = transformedInfo(ce, dist, options);
  if (info === undefined) return undefined;
  if (info.kind === "chisq1") return finish(randomVariate(ce, ce.function("ChiSquareDistribution", [ce.One])), options);
  const { a, b, inner } = info;
  return finish(add(ce, mul(ce, a, randomVariate(ce, inner)), b), options);
};

// --- 5. MarginalDistribution(ProductDistribution(...), k | {k1, k2, ...}) ----------------------
//
// Reduces away entirely at `evaluate` time into a plain `ProductDistribution` factor (or a
// `ProductDistribution` of several) — it never needs its own PDF/CDF/Mean/Variance branch,
// since by the time any of those run, `ops[0]` (a non-lazy operator's operands are evaluated
// first) is already the reduced factor.

const marginalOf = (
  ce: ComputeEngine,
  productDist: BoxedExpression,
  index: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  if (productDist.operator !== "ProductDistribution") return undefined;
  const factors = operandsOf(productDist);
  if (index.operator === "List") {
    const indices = operandsOf(index).map((i) => integerAt(i));
    if (indices.some((i) => i === undefined || i < 1 || i > factors.length)) return undefined;
    const selected = indices.map((i) => factors[(i as number) - 1]);
    return finish(ce.function("ProductDistribution", selected), options);
  }
  const k = integerAt(index);
  if (k === undefined || k < 1 || k > factors.length) return undefined;
  return finish(factors[k - 1], options);
};

// --- 6. DirichletDistribution({alpha1, ..., alphak}) --------------------------------------------
//
// Wolfram's own parameterisation is over the FIRST k-1 coordinates: `PDF` takes a `(k-1)`-list
// `{x1, ..., x_{k-1}}`, with `x_k := 1 - sum(x1..x_{k-1})` implicit, and `Mean`/`Variance` are
// each `(k-1)`-lists too — `alpha_k`'s own coordinate is never reported directly (confirmed
// from Wolfram's `DirichletDistribution` reference page: "EntropyExpr"/"Mean" examples for
// `DirichletDistribution[{a1, a2, a3}]` return length-2 lists). Documented here since it is
// easy to expect a length-`k` answer instead.

const dirichletAlphas = (dist: BoxedExpression): readonly BoxedExpression[] | undefined => {
  const ops = operandsOf(dist);
  if (ops.length !== 1 || ops[0].operator !== "List") return undefined;
  const alphas = operandsOf(ops[0]);
  return alphas.length >= 2 ? alphas : undefined;
};

const dirichletPdf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const alphas = dirichletAlphas(dist);
  if (alphas === undefined || x.operator !== "List") return undefined;
  const xs = operandsOf(x);
  if (xs.length !== alphas.length - 1) return undefined;
  const xk = sub(ce, ce.One, xs.length === 1 ? xs[0] : add(ce, ...xs));
  const allX = [...xs, xk];
  const numerator = mul(ce, ...allX.map((xi, i) => pow(ce, xi, sub(ce, alphas[i], ce.One))));
  const alphaSum = alphas.length === 1 ? alphas[0] : add(ce, ...alphas);
  const beta = div(ce, mul(ce, ...alphas.map((a) => ce.function("Gamma", [a]))), ce.function("Gamma", [alphaSum]));
  return finish(div(ce, numerator, beta), options);
};

const dirichletMean = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const alphas = dirichletAlphas(dist);
  if (alphas === undefined) return undefined;
  const alphaSum = alphas.length === 1 ? alphas[0] : add(ce, ...alphas);
  const components = alphas.slice(0, -1).map((a) => div(ce, a, alphaSum));
  return finish(ce.function("List", components), options);
};

const dirichletVariance = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const alphas = dirichletAlphas(dist);
  if (alphas === undefined) return undefined;
  const alphaSum = alphas.length === 1 ? alphas[0] : add(ce, ...alphas);
  const denom = mul(ce, pow(ce, alphaSum, ce.number(2)), add(ce, alphaSum, ce.One));
  const components = alphas.slice(0, -1).map((a) => div(ce, mul(ce, a, sub(ce, alphaSum, a)), denom));
  return finish(ce.function("List", components), options);
};

// --- declare constructors ------------------------------------------------------------------

function declareConstructors4(ce: ComputeEngine): void {
  ce.declare("TruncatedDistribution", { signature: "(any, any) -> distribution" });
  ce.declare("MixtureDistribution", { signature: "(any, any) -> distribution" });
  ce.declare("ProductDistribution", { signature: "(any*) -> distribution" });
  {
    const definition = ce.lookupDefinition("ProductDistribution");
    const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
    if (operator !== undefined) {
      (operator as { canonical?: unknown }).canonical = (ops: readonly BoxedExpression[]) => productCanonical(ce, ops);
    }
  }
  ce.declare("TransformedDistribution", { signature: "(any, any) -> distribution" });
  ce.declare("MarginalDistribution", {
    signature: "(any, any) -> distribution",
    evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) =>
      ops.length === 2 ? marginalOf(ce, ops[0], ops[1], options) : undefined,
  });
  ce.declare("DirichletDistribution", { signature: "(list<any>) -> distribution" });
}

// --- extend PDF/CDF/Mean/Variance/RandomVariate in place, via wrapOperator ----------------------

function extendStats4(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["PDF"],
    (ops) => KINDS4.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => {
      const [dist, x] = ops;
      const result =
        dist.operator === "TruncatedDistribution"
          ? truncatedPdf(ce, dist, x, options)
          : dist.operator === "MixtureDistribution"
            ? weightedSum(ce, mixtureParams(ce, dist)!, (d) => pdf(ce, d, x), options)
            : dist.operator === "ProductDistribution"
              ? productPdf(ce, dist, x, options)
              : dist.operator === "TransformedDistribution"
                ? transformedPdf(ce, dist, x, options)
                : dist.operator === "DirichletDistribution"
                  ? dirichletPdf(ce, dist, x, options)
                  : undefined;
      return result ?? native?.(ops, options);
    },
    2,
  );

  wrapOperator(
    ce,
    ["CDF"],
    (ops) => KINDS4.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => {
      const [dist, x] = ops;
      const result =
        dist.operator === "TruncatedDistribution"
          ? truncatedCdf(ce, dist, x, options)
          : dist.operator === "MixtureDistribution"
            ? weightedSum(ce, mixtureParams(ce, dist)!, (d) => cdf(ce, d, x), options)
            : dist.operator === "ProductDistribution"
              ? productCdf(ce, dist, x, options)
              : dist.operator === "TransformedDistribution"
                ? transformedCdf(ce, dist, x, options)
                : undefined;
      return result ?? native?.(ops, options);
    },
    2,
  );

  wrapOperator(
    ce,
    ["Mean"],
    (ops) => KINDS4.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => {
      const dist = ops[0];
      const result =
        dist.operator === "TruncatedDistribution"
          ? truncatedMeanEntry(ce, dist, options)
          : dist.operator === "MixtureDistribution"
            ? weightedSum(ce, mixtureParams(ce, dist)!, (d) => mean(ce, d), options)
            : dist.operator === "ProductDistribution"
              ? productMean(ce, dist, options)
              : dist.operator === "TransformedDistribution"
                ? transformedMean(ce, dist, options)
                : dist.operator === "DirichletDistribution"
                  ? dirichletMean(ce, dist, options)
                  : undefined;
      return result ?? native?.(ops, options);
    },
    1,
  );

  wrapOperator(
    ce,
    ["Variance"],
    (ops) => KINDS4.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => {
      const dist = ops[0];
      const result =
        dist.operator === "MixtureDistribution"
          ? mixtureVariance(ce, mixtureParams(ce, dist)!, options)
          : dist.operator === "ProductDistribution"
            ? productVariance(ce, dist, options)
            : dist.operator === "TransformedDistribution"
              ? transformedVariance(ce, dist, options)
              : dist.operator === "DirichletDistribution"
                ? dirichletVariance(ce, dist, options)
                : undefined;
      return result ?? native?.(ops, options);
    },
    1,
  );

  wrapOperator(
    ce,
    ["RandomVariate"],
    (ops) => KINDS4.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => {
      const dist = ops[0];
      if (ops.length !== 1) return native?.(ops, options);
      const result =
        dist.operator === "MixtureDistribution"
          ? mixtureDraw(ce, dist)
          : dist.operator === "ProductDistribution"
            ? productDraw(ce, dist)
            : dist.operator === "TransformedDistribution"
              ? transformedDraw(ce, dist, options)
              : undefined;
      return result ?? native?.(ops, options);
    },
    { min: 1, max: 2 },
  );
}

/** Declare the fourth-wave (compound) distribution frontier heads on `ce`: `TruncatedDistribution`,
 *  `MixtureDistribution`, `ProductDistribution`, `TransformedDistribution`, `MarginalDistribution`,
 *  `DirichletDistribution` — plus extending `PDF`/`CDF`/`Mean`/`Variance`/`RandomVariate` in
 *  place. Call AFTER `declareDistributions`, `declareDistributions2` and `declareDistributions3`
 *  — every case here reaches the inner distribution(s) through those (fully extended) operators. */
export function declareDistributions4(ce: ComputeEngine): void {
  declareConstructors4(ce);
  extendStats4(ce);
}
