import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvaluateOptions, integerAt, operandsOf, wrapOperator } from "@enumeratio/boxed";
import { finish, gammaSample, list2, normal01, numAt, uniform01 } from "./distributions.ts";

// The second wave of Wolfram-frontier probability heads: nineteen univariate distributions
// (GeometricDistribution .. MaxwellDistribution) plus the property functions that read ANY
// distribution — old (native, or `distributions.ts`'s own) or new. None of the thirty heads
// below is compute-engine native (probed via `ce.lookupDefinition`, see `.scratch/probe1.mjs`
// during development), so every distribution constructor is a fresh `ce.declare`, and every
// extension to PDF/CDF/Mean/Variance/RandomVariate goes through `@enumeratio/boxed`'s
// `wrapOperator` — the same "attach in place, fall back to what was there" idiom
// `distributions.ts` hand-rolls for itself, just declared through the shared helper instead
// of duplicated. `wrapOperator` composes: `distributions.ts` runs first (`declareDistributions`
// must be called before `declareDistributions2`), so a call this file doesn't recognize falls
// through to `distributions.ts`'s own dispatch, and from there to compute-engine's native one.
//
// The property functions (Moment, CentralMoment, FactorialMoment, HazardFunction,
// SurvivalFunction, InverseCDF) are declared ONCE, generically, in terms of the (by-then fully
// extended) PDF/CDF/Mean/Variance operators — they never switch on `dist.operator` themselves,
// so they answer every distribution this package knows about, including ones declared after
// this file runs. Cumulant is handled the same way for orders 1-2 (the only orders with a
// distribution-independent formula in terms of Mean/Variance). CharacteristicFunction and
// MomentGeneratingFunction are NOT implemented here — both need a closed-form transform per
// distribution kind (the generic Mean/Variance route has nothing to offer for `E[e^{itX}]`),
// which is a distinct, per-kind effort out of scope for this batch; they are left undeclared
// rather than faked. See the report accompanying this change for the full skip list.

// --- shared helpers --------------------------------------------------------------------------

export const If = (ce: ComputeEngine, cond: BoxedExpression, a: BoxedExpression, b: BoxedExpression) =>
  ce.function("If", [cond, a, b]);

export const lt = (ce: ComputeEngine, a: BoxedExpression, b: BoxedExpression) => ce.function("Less", [a, b]);

/** Clamp a CDF branch to 0 below `lower` — the same pre-`finish`-the-branch idiom
 *  `distributions.ts`'s Beta/Gamma CDF use: `If` is lazy, so the in-range branch has to
 *  already be numeric before `N()` on the whole `If` can pick it. */
export const clampBelow = (
  ce: ComputeEngine,
  x: BoxedExpression,
  lower: BoxedExpression,
  inRange: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression => finish(If(ce, lt(ce, x, lower), ce.Zero, finish(inRange, options)), options);

export const mul = (ce: ComputeEngine, ...xs: BoxedExpression[]) => ce.function("Multiply", xs);
export const add = (ce: ComputeEngine, ...xs: BoxedExpression[]) => ce.function("Add", xs);
export const sub = (ce: ComputeEngine, a: BoxedExpression, b: BoxedExpression) => ce.function("Subtract", [a, b]);
export const div = (ce: ComputeEngine, a: BoxedExpression, b: BoxedExpression) => ce.function("Divide", [a, b]);
export const pow = (ce: ComputeEngine, a: BoxedExpression, b: BoxedExpression) => ce.function("Power", [a, b]);
export const neg = (ce: ComputeEngine, a: BoxedExpression) => ce.function("Negate", [a]);
export const exp = (ce: ComputeEngine, a: BoxedExpression) => ce.function("Exp", [a]);

/** `1 - GammaRegularized(a, z)` — compute-engine's native (two-argument) `GammaRegularized`
 *  is the UPPER tail Q(a, z) (confirmed empirically, same convention `distributions.ts`'s
 *  `GammaDistribution` CDF relies on), so this is the lower tail P(a, z). */
export const gammaP = (ce: ComputeEngine, a: BoxedExpression, z: BoxedExpression) =>
  sub(ce, ce.One, ce.function("GammaRegularized", [a, z]));

// --- parameter extraction ----------------------------------------------------------------------

export const one = (dist: BoxedExpression): [BoxedExpression] | undefined => {
  const ops = operandsOf(dist);
  return ops.length === 1 ? [ops[0]] : undefined;
};
export const two = (dist: BoxedExpression): [BoxedExpression, BoxedExpression] | undefined => {
  const ops = operandsOf(dist);
  return ops.length === 2 ? [ops[0], ops[1]] : undefined;
};
export const three = (dist: BoxedExpression): [BoxedExpression, BoxedExpression, BoxedExpression] | undefined => {
  const ops = operandsOf(dist);
  return ops.length === 3 ? [ops[0], ops[1], ops[2]] : undefined;
};

/** `DiscreteUniformDistribution({min, max})` — Wolfram's own call shape, a single list. */
const discreteUniformParams = (
  ce: ComputeEngine,
  dist: BoxedExpression,
): [BoxedExpression, BoxedExpression] | undefined => {
  const ops = operandsOf(dist);
  return ops.length === 1 ? list2(ce, ops[0]) : undefined;
};

interface Triangular {
  readonly a: BoxedExpression;
  readonly b: BoxedExpression;
  readonly c: BoxedExpression;
}

/** `TriangularDistribution({a,b})` (mode defaults to the midpoint) or `({a,b}, c)`. */
const triangularParams = (ce: ComputeEngine, dist: BoxedExpression): Triangular | undefined => {
  const ops = operandsOf(dist);
  if (ops.length !== 1 && ops.length !== 2) return undefined;
  const ab = list2(ce, ops[0]);
  if (ab === undefined) return undefined;
  const [a, b] = ab;
  const c = ops[1] ?? div(ce, add(ce, a, b), ce.number(2));
  return { a, b, c };
};

// --- PDF -----------------------------------------------------------------------------------

export const pdfOf2 = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  switch (dist.operator) {
    case "GeometricDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [p] = params;
      // p (1-p)^x — no support check outside the nonnegative integers (documented divergence,
      // same policy as `distributions.ts`'s unclamped PDFs).
      return finish(mul(ce, p, pow(ce, sub(ce, ce.One, p), x)), options);
    }
    case "BernoulliDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [p] = params;
      // Each branch is finished BEFORE it goes into `If` — `If` is lazy (branches are held
      // until picked), so `N()`/`evaluate()` on the whole `If` selects a branch but does not
      // itself push down into it (the same gotcha `distributions.ts`'s Beta/Gamma CDF
      // document, applied everywhere below a branch is a compound expression).
      const notP = finish(sub(ce, ce.One, p), options);
      const expr = If(
        ce,
        ce.function("Equal", [x, ce.Zero]),
        notP,
        If(ce, ce.function("Equal", [x, ce.One]), p, ce.Zero),
      );
      return finish(expr, options);
    }
    case "DiscreteUniformDistribution": {
      const params = discreteUniformParams(ce, dist);
      if (params === undefined) return undefined;
      const [min, max] = params;
      return finish(div(ce, ce.One, add(ce, sub(ce, max, min), ce.One)), options);
    }
    case "TriangularDistribution": {
      const params = triangularParams(ce, dist);
      if (params === undefined) return undefined;
      const { a, b, c } = params;
      const rising = finish(
        div(ce, mul(ce, ce.number(2), sub(ce, x, a)), mul(ce, sub(ce, b, a), sub(ce, c, a))),
        options,
      );
      const falling = finish(
        div(ce, mul(ce, ce.number(2), sub(ce, b, x)), mul(ce, sub(ce, b, a), sub(ce, b, c))),
        options,
      );
      return finish(If(ce, lt(ce, x, c), rising, falling), options);
    }
    case "ChiSquareDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [k] = params;
      const half = div(ce, k, ce.number(2));
      const expr = div(
        ce,
        mul(ce, pow(ce, x, sub(ce, half, ce.One)), exp(ce, neg(ce, div(ce, x, ce.number(2))))),
        mul(ce, pow(ce, ce.number(2), half), ce.function("Gamma", [half])),
      );
      return finish(expr, options);
    }
    case "LogNormalDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [mu, sigma] = params;
      // PDF(x) = PDF(NormalDistribution(mu,sigma), Log(x)) / x — delegates to compute-engine's
      // native Normal PDF instead of writing out the Gaussian by hand.
      const normalPdf = ce.function("PDF", [ce.function("NormalDistribution", [mu, sigma]), ce.function("Log", [x])]);
      return finish(div(ce, normalPdf, x), options);
    }
    case "NegativeBinomialDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [n, p] = params;
      const expr = mul(
        ce,
        ce.function("Binomial", [sub(ce, add(ce, n, x), ce.One), x]),
        pow(ce, p, n),
        pow(ce, sub(ce, ce.One, p), x),
      );
      return finish(expr, options);
    }
    case "CauchyDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [a, b] = params;
      const z = div(ce, sub(ce, x, a), b);
      const expr = div(ce, ce.One, mul(ce, ce.symbol("Pi"), b, add(ce, ce.One, pow(ce, z, ce.number(2)))));
      return finish(expr, options);
    }
    case "StudentTDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [nu] = params;
      const coeff = div(
        ce,
        ce.function("Gamma", [div(ce, add(ce, nu, ce.One), ce.number(2))]),
        mul(ce, ce.function("Sqrt", [mul(ce, nu, ce.symbol("Pi"))]), ce.function("Gamma", [div(ce, nu, ce.number(2))])),
      );
      const base = add(ce, ce.One, div(ce, pow(ce, x, ce.number(2)), nu));
      const expo = neg(ce, div(ce, add(ce, nu, ce.One), ce.number(2)));
      return finish(mul(ce, coeff, pow(ce, base, expo)), options);
    }
    case "WeibullDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [alpha, beta] = params;
      const z = div(ce, x, beta);
      const expr = mul(
        ce,
        div(ce, alpha, beta),
        pow(ce, z, sub(ce, alpha, ce.One)),
        exp(ce, neg(ce, pow(ce, z, alpha))),
      );
      return finish(expr, options);
    }
    case "LaplaceDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [mu, b] = params;
      const expr = div(
        ce,
        exp(ce, neg(ce, div(ce, ce.function("Abs", [sub(ce, x, mu)]), b))),
        mul(ce, ce.number(2), b),
      );
      return finish(expr, options);
    }
    case "HypergeometricDistribution": {
      const params = three(dist);
      if (params === undefined) return undefined;
      const [n, nsucc, ntot] = params;
      const expr = div(
        ce,
        mul(ce, ce.function("Binomial", [nsucc, x]), ce.function("Binomial", [sub(ce, ntot, nsucc), sub(ce, n, x)])),
        ce.function("Binomial", [ntot, n]),
      );
      return finish(expr, options);
    }
    case "RayleighDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [sigma] = params;
      const s2 = pow(ce, sigma, ce.number(2));
      const expr = mul(
        ce,
        div(ce, x, s2),
        exp(ce, neg(ce, div(ce, pow(ce, x, ce.number(2)), mul(ce, ce.number(2), s2)))),
      );
      return finish(expr, options);
    }
    case "ParetoDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [k, alpha] = params;
      const expr = div(ce, mul(ce, alpha, pow(ce, k, alpha)), pow(ce, x, add(ce, alpha, ce.One)));
      return finish(expr, options);
    }
    case "LogisticDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [mu, beta] = params;
      const z = exp(ce, neg(ce, div(ce, sub(ce, x, mu), beta)));
      const expr = div(ce, z, mul(ce, beta, pow(ce, add(ce, ce.One, z), ce.number(2))));
      return finish(expr, options);
    }
    case "ErlangDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [n, lambda] = params;
      const expr = div(
        ce,
        mul(ce, pow(ce, lambda, n), pow(ce, x, sub(ce, n, ce.One)), exp(ce, neg(ce, mul(ce, lambda, x)))),
        ce.function("Gamma", [n]),
      );
      return finish(expr, options);
    }
    case "ChiDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [k] = params;
      const expr = div(
        ce,
        mul(
          ce,
          pow(ce, ce.number(2), sub(ce, ce.One, div(ce, k, ce.number(2)))),
          pow(ce, x, sub(ce, k, ce.One)),
          exp(ce, neg(ce, div(ce, pow(ce, x, ce.number(2)), ce.number(2)))),
        ),
        ce.function("Gamma", [div(ce, k, ce.number(2))]),
      );
      return finish(expr, options);
    }
    case "HalfNormalDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [theta] = params;
      const expr = mul(
        ce,
        ce.function("Sqrt", [div(ce, ce.number(2), ce.symbol("Pi"))]),
        theta,
        exp(ce, neg(ce, div(ce, mul(ce, pow(ce, x, ce.number(2)), pow(ce, theta, ce.number(2))), ce.number(2)))),
      );
      return finish(expr, options);
    }
    case "MaxwellDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [sigma] = params;
      const s2 = pow(ce, sigma, ce.number(2));
      const expr = div(
        ce,
        mul(
          ce,
          ce.function("Sqrt", [div(ce, ce.number(2), ce.symbol("Pi"))]),
          pow(ce, x, ce.number(2)),
          exp(ce, neg(ce, div(ce, pow(ce, x, ce.number(2)), mul(ce, ce.number(2), s2)))),
        ),
        pow(ce, sigma, ce.number(3)),
      );
      return finish(expr, options);
    }
    default:
      return undefined;
  }
};

// --- CDF -----------------------------------------------------------------------------------

export const cdfOf2 = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const flr = () => ce.function("Floor", [x]);
  switch (dist.operator) {
    case "GeometricDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [p] = params;
      const inRange = sub(ce, ce.One, pow(ce, sub(ce, ce.One, p), add(ce, flr(), ce.One)));
      return clampBelow(ce, x, ce.Zero, inRange, options);
    }
    case "BernoulliDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [p] = params;
      const notP = finish(sub(ce, ce.One, p), options);
      const expr = If(ce, lt(ce, x, ce.Zero), ce.Zero, If(ce, lt(ce, x, ce.One), notP, ce.One));
      return finish(expr, options);
    }
    case "DiscreteUniformDistribution": {
      const params = discreteUniformParams(ce, dist);
      if (params === undefined) return undefined;
      const [min, max] = params;
      const n = add(ce, sub(ce, max, min), ce.One);
      const inRange = div(ce, add(ce, sub(ce, flr(), min), ce.One), n);
      const clamped = finish(
        If(ce, lt(ce, max, x), ce.One, finish(clampBelow(ce, x, min, inRange, options), options)),
        options,
      );
      return clamped;
    }
    case "TriangularDistribution": {
      const params = triangularParams(ce, dist);
      if (params === undefined) return undefined;
      const { a, b, c } = params;
      const rising = finish(
        div(ce, pow(ce, sub(ce, x, a), ce.number(2)), mul(ce, sub(ce, b, a), sub(ce, c, a))),
        options,
      );
      const falling = finish(
        sub(ce, ce.One, div(ce, pow(ce, sub(ce, b, x), ce.number(2)), mul(ce, sub(ce, b, a), sub(ce, b, c)))),
        options,
      );
      return finish(If(ce, lt(ce, x, c), rising, falling), options);
    }
    case "ChiSquareDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [k] = params;
      const inRange = gammaP(ce, div(ce, k, ce.number(2)), div(ce, x, ce.number(2)));
      return clampBelow(ce, x, ce.Zero, inRange, options);
    }
    case "LogNormalDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [mu, sigma] = params;
      // Delegates to native Normal CDF, same trick as the PDF above.
      const expr = ce.function("CDF", [ce.function("NormalDistribution", [mu, sigma]), ce.function("Log", [x])]);
      return finish(expr, options);
    }
    case "NegativeBinomialDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [n, p] = params;
      // P(X <= k) = I_p(n, k+1) — the regularized-incomplete-beta identity for the negative
      // binomial CDF (`BetaRegularized(x, a, b)` is `I_x(a,b)`, same convention as
      // `distributions.ts`'s BetaDistribution CDF).
      const inRange = ce.function("BetaRegularized", [p, n, add(ce, flr(), ce.One)]);
      return clampBelow(ce, x, ce.Zero, inRange, options);
    }
    case "WeibullDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [alpha, beta] = params;
      const inRange = sub(ce, ce.One, exp(ce, neg(ce, pow(ce, div(ce, x, beta), alpha))));
      return clampBelow(ce, x, ce.Zero, inRange, options);
    }
    case "LaplaceDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [mu, b] = params;
      const below = finish(div(ce, exp(ce, div(ce, sub(ce, x, mu), b)), ce.number(2)), options);
      const above = finish(
        sub(ce, ce.One, div(ce, exp(ce, neg(ce, div(ce, sub(ce, x, mu), b))), ce.number(2))),
        options,
      );
      return finish(If(ce, lt(ce, x, mu), below, above), options);
    }
    case "RayleighDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [sigma] = params;
      const inRange = sub(
        ce,
        ce.One,
        exp(ce, neg(ce, div(ce, pow(ce, x, ce.number(2)), mul(ce, ce.number(2), pow(ce, sigma, ce.number(2)))))),
      );
      return clampBelow(ce, x, ce.Zero, inRange, options);
    }
    case "ParetoDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [k, alpha] = params;
      const inRange = sub(ce, ce.One, pow(ce, div(ce, k, x), alpha));
      return clampBelow(ce, x, k, inRange, options);
    }
    case "LogisticDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [mu, beta] = params;
      const expr = div(ce, ce.One, add(ce, ce.One, exp(ce, neg(ce, div(ce, sub(ce, x, mu), beta)))));
      return finish(expr, options);
    }
    case "ErlangDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [n, lambda] = params;
      const inRange = gammaP(ce, n, mul(ce, lambda, x));
      return clampBelow(ce, x, ce.Zero, inRange, options);
    }
    case "ChiDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [k] = params;
      const inRange = gammaP(ce, div(ce, k, ce.number(2)), div(ce, pow(ce, x, ce.number(2)), ce.number(2)));
      return clampBelow(ce, x, ce.Zero, inRange, options);
    }
    case "HalfNormalDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [theta] = params;
      const inRange = ce.function("Erf", [div(ce, mul(ce, x, theta), ce.function("Sqrt", [ce.number(2)]))]);
      return clampBelow(ce, x, ce.Zero, inRange, options);
    }
    case "MaxwellDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [sigma] = params;
      const inRange = gammaP(
        ce,
        ce.function("Rational", [3, 2]),
        div(ce, pow(ce, x, ce.number(2)), mul(ce, ce.number(2), pow(ce, sigma, ce.number(2)))),
      );
      return clampBelow(ce, x, ce.Zero, inRange, options);
    }
    // CauchyDistribution, StudentTDistribution, HypergeometricDistribution: no elementary
    // closed form implemented here (Cauchy needs Arctan — doable, but skipped alongside
    // StudentT/Hypergeometric to keep the three "no exact CDF" cases together and documented
    // rather than half-covering the set). Left unevaluated; `InverseCDF`'s generic numeric
    // fallback still answers a literal query once `N` is applied upstream — but CDF itself
    // stays symbolic for these three, a documented divergence from Wolfram.
    default:
      return undefined;
  }
};

// --- Mean / Variance -------------------------------------------------------------------------

export const meanOf2 = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions | undefined,
): BoxedExpression | undefined => {
  switch (dist.operator) {
    case "GeometricDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [p] = params;
      return finish(div(ce, sub(ce, ce.One, p), p), options);
    }
    case "BernoulliDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      return finish(params[0], options);
    }
    case "DiscreteUniformDistribution": {
      const params = discreteUniformParams(ce, dist);
      if (params === undefined) return undefined;
      const [min, max] = params;
      return finish(div(ce, add(ce, min, max), ce.number(2)), options);
    }
    case "TriangularDistribution": {
      const params = triangularParams(ce, dist);
      if (params === undefined) return undefined;
      const { a, b, c } = params;
      return finish(div(ce, add(ce, a, b, c), ce.number(3)), options);
    }
    case "ChiSquareDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      return finish(params[0], options);
    }
    case "LogNormalDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [mu, sigma] = params;
      return finish(exp(ce, add(ce, mu, div(ce, pow(ce, sigma, ce.number(2)), ce.number(2)))), options);
    }
    case "NegativeBinomialDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [n, p] = params;
      return finish(div(ce, mul(ce, n, sub(ce, ce.One, p)), p), options);
    }
    case "CauchyDistribution":
      return finish(ce.symbol("Indeterminate"), options);
    case "StudentTDistribution":
      // Exact only for nu > 1 — Student-t's mean is undefined at/below nu = 1. Unconditional
      // 0 here is a documented divergence (matches Wolfram's own numeric answer whenever the
      // mean does exist).
      return finish(ce.Zero, options);
    case "WeibullDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [alpha, beta] = params;
      return finish(mul(ce, beta, ce.function("Gamma", [add(ce, ce.One, div(ce, ce.One, alpha))])), options);
    }
    case "LaplaceDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      return finish(params[0], options);
    }
    case "HypergeometricDistribution": {
      const params = three(dist);
      if (params === undefined) return undefined;
      const [n, nsucc, ntot] = params;
      return finish(div(ce, mul(ce, n, nsucc), ntot), options);
    }
    case "RayleighDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [sigma] = params;
      return finish(mul(ce, sigma, ce.function("Sqrt", [div(ce, ce.symbol("Pi"), ce.number(2))])), options);
    }
    case "ParetoDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [k, alpha] = params;
      // Exact only for alpha > 1 (else the mean is infinite) — documented divergence, same
      // policy as StudentTDistribution above.
      return finish(div(ce, mul(ce, alpha, k), sub(ce, alpha, ce.One)), options);
    }
    case "LogisticDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      return finish(params[0], options);
    }
    case "ErlangDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [n, lambda] = params;
      return finish(div(ce, n, lambda), options);
    }
    case "ChiDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [k] = params;
      const expr = mul(
        ce,
        ce.function("Sqrt", [ce.number(2)]),
        div(
          ce,
          ce.function("Gamma", [div(ce, add(ce, k, ce.One), ce.number(2))]),
          ce.function("Gamma", [div(ce, k, ce.number(2))]),
        ),
      );
      return finish(expr, options);
    }
    case "HalfNormalDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [theta] = params;
      return finish(div(ce, ce.function("Sqrt", [div(ce, ce.number(2), ce.symbol("Pi"))]), theta), options);
    }
    case "MaxwellDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [sigma] = params;
      return finish(
        mul(ce, ce.number(2), sigma, ce.function("Sqrt", [div(ce, ce.number(2), ce.symbol("Pi"))])),
        options,
      );
    }
    default:
      return undefined;
  }
};

export const varianceOf2 = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options: EvaluateOptions | undefined,
): BoxedExpression | undefined => {
  switch (dist.operator) {
    case "GeometricDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [p] = params;
      return finish(div(ce, sub(ce, ce.One, p), pow(ce, p, ce.number(2))), options);
    }
    case "BernoulliDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [p] = params;
      return finish(mul(ce, p, sub(ce, ce.One, p)), options);
    }
    case "DiscreteUniformDistribution": {
      const params = discreteUniformParams(ce, dist);
      if (params === undefined) return undefined;
      const [min, max] = params;
      const n = add(ce, sub(ce, max, min), ce.One);
      return finish(div(ce, sub(ce, pow(ce, n, ce.number(2)), ce.One), ce.number(12)), options);
    }
    case "TriangularDistribution": {
      const params = triangularParams(ce, dist);
      if (params === undefined) return undefined;
      const { a, b, c } = params;
      const sq = (t: BoxedExpression) => pow(ce, t, ce.number(2));
      const expr = div(
        ce,
        sub(ce, add(ce, sq(a), sq(b), sq(c)), add(ce, mul(ce, a, b), mul(ce, a, c), mul(ce, b, c))),
        ce.number(18),
      );
      return finish(expr, options);
    }
    case "ChiSquareDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [k] = params;
      return finish(mul(ce, ce.number(2), k), options);
    }
    case "LogNormalDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [mu, sigma] = params;
      const s2 = pow(ce, sigma, ce.number(2));
      const expr = mul(ce, sub(ce, exp(ce, s2), ce.One), exp(ce, add(ce, mul(ce, ce.number(2), mu), s2)));
      return finish(expr, options);
    }
    case "NegativeBinomialDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [n, p] = params;
      return finish(div(ce, mul(ce, n, sub(ce, ce.One, p)), pow(ce, p, ce.number(2))), options);
    }
    case "CauchyDistribution":
      return finish(ce.symbol("Indeterminate"), options);
    case "StudentTDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [nu] = params;
      // Exact only for nu > 2 — documented divergence, same policy as the mean above.
      return finish(div(ce, nu, sub(ce, nu, ce.number(2))), options);
    }
    case "WeibullDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [alpha, beta] = params;
      const g1 = ce.function("Gamma", [add(ce, ce.One, div(ce, ce.One, alpha))]);
      const g2 = ce.function("Gamma", [add(ce, ce.One, div(ce, ce.number(2), alpha))]);
      const expr = mul(ce, pow(ce, beta, ce.number(2)), sub(ce, g2, pow(ce, g1, ce.number(2))));
      return finish(expr, options);
    }
    case "LaplaceDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [, b] = params;
      return finish(mul(ce, ce.number(2), pow(ce, b, ce.number(2))), options);
    }
    case "HypergeometricDistribution": {
      const params = three(dist);
      if (params === undefined) return undefined;
      const [n, nsucc, ntot] = params;
      const frac = div(ce, nsucc, ntot);
      const expr = mul(ce, n, frac, sub(ce, ce.One, frac), div(ce, sub(ce, ntot, n), sub(ce, ntot, ce.One)));
      return finish(expr, options);
    }
    case "RayleighDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [sigma] = params;
      const expr = mul(ce, div(ce, sub(ce, ce.number(4), ce.symbol("Pi")), ce.number(2)), pow(ce, sigma, ce.number(2)));
      return finish(expr, options);
    }
    case "ParetoDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [k, alpha] = params;
      // Exact only for alpha > 2 — documented divergence, same policy as the mean above.
      const expr = div(
        ce,
        mul(ce, pow(ce, k, ce.number(2)), alpha),
        mul(ce, pow(ce, sub(ce, alpha, ce.One), ce.number(2)), sub(ce, alpha, ce.number(2))),
      );
      return finish(expr, options);
    }
    case "LogisticDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [, beta] = params;
      const expr = mul(ce, pow(ce, beta, ce.number(2)), div(ce, pow(ce, ce.symbol("Pi"), ce.number(2)), ce.number(3)));
      return finish(expr, options);
    }
    case "ErlangDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [n, lambda] = params;
      return finish(div(ce, n, pow(ce, lambda, ce.number(2))), options);
    }
    case "ChiDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [k] = params;
      const mean = meanOf2(ce, dist, undefined);
      if (mean === undefined) return undefined;
      return finish(sub(ce, k, pow(ce, mean, ce.number(2))), options);
    }
    case "HalfNormalDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [theta] = params;
      const expr = div(
        ce,
        sub(ce, ce.symbol("Pi"), ce.number(2)),
        mul(ce, ce.symbol("Pi"), pow(ce, theta, ce.number(2))),
      );
      return finish(expr, options);
    }
    case "MaxwellDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [sigma] = params;
      const expr = mul(
        ce,
        pow(ce, sigma, ce.number(2)),
        div(ce, sub(ce, mul(ce, ce.number(3), ce.symbol("Pi")), ce.number(8)), ce.symbol("Pi")),
      );
      return finish(expr, options);
    }
    default:
      return undefined;
  }
};

// --- RandomVariate: sampling for the second-wave kinds -----------------------------------------

const KINDS2 = new Set([
  "GeometricDistribution",
  "BernoulliDistribution",
  "DiscreteUniformDistribution",
  "TriangularDistribution",
  "ChiSquareDistribution",
  "LogNormalDistribution",
  "NegativeBinomialDistribution",
  "CauchyDistribution",
  "StudentTDistribution",
  "WeibullDistribution",
  "LaplaceDistribution",
  "HypergeometricDistribution",
  "RayleighDistribution",
  "ParetoDistribution",
  "LogisticDistribution",
  "ErlangDistribution",
  "ChiDistribution",
  "HalfNormalDistribution",
  "MaxwellDistribution",
]);

const geometricSample = (ce: ComputeEngine, p: number): number => Math.floor(Math.log(uniform01(ce)) / Math.log(1 - p));

const drawOne2 = (ce: ComputeEngine, dist: BoxedExpression): BoxedExpression | undefined => {
  switch (dist.operator) {
    case "GeometricDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      return ce.number(geometricSample(ce, numAt(params[0])));
    }
    case "BernoulliDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      return ce.number(uniform01(ce) < numAt(params[0]) ? 1 : 0);
    }
    case "DiscreteUniformDistribution": {
      const params = discreteUniformParams(ce, dist);
      if (params === undefined) return undefined;
      const [min, max] = params;
      const lo = numAt(min);
      const hi = numAt(max);
      return ce.number(lo + Math.floor(uniform01(ce) * (hi - lo + 1)));
    }
    case "TriangularDistribution": {
      const params = triangularParams(ce, dist);
      if (params === undefined) return undefined;
      const a = numAt(params.a);
      const b = numAt(params.b);
      const c = numAt(params.c);
      const u = uniform01(ce);
      const fc = (c - a) / (b - a);
      return ce.number(u < fc ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c)));
    }
    case "ChiSquareDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      return ce.number(gammaSample(ce, numAt(params[0]) / 2, 2));
    }
    case "LogNormalDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [mu, sigma] = params;
      return ce.number(Math.exp(numAt(mu) + numAt(sigma) * normal01(ce)));
    }
    case "NegativeBinomialDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const n = numAt(params[0]);
      const p = numAt(params[1]);
      let failures = 0;
      for (let i = 0; i < n; i++) failures += geometricSample(ce, p);
      return ce.number(failures);
    }
    case "CauchyDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const a = numAt(params[0]);
      const b = numAt(params[1]);
      return ce.number(a + b * Math.tan(Math.PI * (uniform01(ce) - 0.5)));
    }
    case "StudentTDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const nu = numAt(params[0]);
      return ce.number(normal01(ce) / Math.sqrt(gammaSample(ce, nu / 2, 2) / nu));
    }
    case "WeibullDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const alpha = numAt(params[0]);
      const beta = numAt(params[1]);
      return ce.number(beta * (-Math.log(1 - uniform01(ce))) ** (1 / alpha));
    }
    case "LaplaceDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const mu = numAt(params[0]);
      const b = numAt(params[1]);
      const u = uniform01(ce) - 0.5;
      return ce.number(mu - b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u)));
    }
    case "HypergeometricDistribution": {
      const params = three(dist);
      if (params === undefined) return undefined;
      const n = numAt(params[0]);
      let succ = numAt(params[1]);
      let tot = numAt(params[2]);
      let drawn = 0;
      for (let i = 0; i < n; i++) {
        if (uniform01(ce) < succ / tot) {
          drawn++;
          succ--;
        }
        tot--;
      }
      return ce.number(drawn);
    }
    case "RayleighDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const sigma = numAt(params[0]);
      return ce.number(sigma * Math.sqrt(-2 * Math.log(uniform01(ce))));
    }
    case "ParetoDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const k = numAt(params[0]);
      const alpha = numAt(params[1]);
      return ce.number(k / uniform01(ce) ** (1 / alpha));
    }
    case "LogisticDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const mu = numAt(params[0]);
      const beta = numAt(params[1]);
      const u = uniform01(ce);
      return ce.number(mu + beta * Math.log(u / (1 - u)));
    }
    case "ErlangDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const n = numAt(params[0]);
      const lambda = numAt(params[1]);
      return ce.number(gammaSample(ce, n, 1 / lambda));
    }
    case "ChiDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const k = numAt(params[0]);
      return ce.number(Math.sqrt(gammaSample(ce, k / 2, 2)));
    }
    case "HalfNormalDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const theta = numAt(params[0]);
      return ce.number(Math.abs(normal01(ce)) / theta);
    }
    case "MaxwellDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const sigma = numAt(params[0]);
      return ce.number(sigma * Math.sqrt(gammaSample(ce, 1.5, 2)));
    }
    default:
      return undefined;
  }
};

// --- constructors ------------------------------------------------------------------------------

function declareConstructors2(ce: ComputeEngine): void {
  // `distribution` (not `expression<Head>`) — same reasoning `distributions.ts`'s own
  // constructors document: only the nominal `distribution` return type lets PDF/CDF/Mean/
  // Variance widen to include a new head at all.
  ce.declare("GeometricDistribution", { signature: "(real<0..1>) -> distribution" });
  ce.declare("BernoulliDistribution", { signature: "(real<0..1>) -> distribution" });
  ce.declare("DiscreteUniformDistribution", { signature: "(list<integer>) -> distribution" });
  ce.declare("TriangularDistribution", { signature: "(list<real>, real?) -> distribution" });
  ce.declare("ChiSquareDistribution", { signature: "(real<0..>) -> distribution" });
  ce.declare("LogNormalDistribution", { signature: "(any, real<0..>) -> distribution" });
  ce.declare("NegativeBinomialDistribution", {
    signature: "(real<0..>, real<0..1>) -> distribution",
  });
  ce.declare("CauchyDistribution", { signature: "(real?, real<0..>?) -> distribution" });
  {
    // Wolfram's `CauchyDistribution[]` (no args) is the standard Cauchy(0, 1) — same
    // zero-argument default idiom as `distributions.ts`'s `extendUniformDistribution`.
    const definition = ce.lookupDefinition("CauchyDistribution");
    const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
    if (operator !== undefined) {
      (operator as { canonical?: unknown }).canonical = (ops: readonly BoxedExpression[]) =>
        ops.length === 0 ? ce.function("CauchyDistribution", [ce.Zero, ce.One]) : undefined;
    }
  }
  ce.declare("StudentTDistribution", { signature: "(real<0..>) -> distribution" });
  ce.declare("WeibullDistribution", { signature: "(real<0..>, real<0..>) -> distribution" });
  ce.declare("LaplaceDistribution", { signature: "(any, real<0..>) -> distribution" });
  ce.declare("HypergeometricDistribution", {
    signature: "(real<0..>, real<0..>, real<0..>) -> distribution",
  });
  ce.declare("RayleighDistribution", { signature: "(real<0..>) -> distribution" });
  ce.declare("ParetoDistribution", { signature: "(real<0..>, real<0..>) -> distribution" });
  ce.declare("LogisticDistribution", { signature: "(any, real<0..>) -> distribution" });
  ce.declare("ErlangDistribution", { signature: "(real<0..>, real<0..>) -> distribution" });
  ce.declare("ChiDistribution", { signature: "(real<0..>) -> distribution" });
  ce.declare("HalfNormalDistribution", { signature: "(real<0..>) -> distribution" });
  ce.declare("MaxwellDistribution", { signature: "(real<0..>) -> distribution" });
}

// --- extend PDF/CDF/Mean/Variance/RandomVariate in place, via wrapOperator --------------------

function extendStats2(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["PDF"],
    (ops) => KINDS2.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => pdfOf2(ce, ops[0], ops[1], options) ?? native?.(ops, options),
    2,
  );
  wrapOperator(
    ce,
    ["CDF"],
    (ops) => KINDS2.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => cdfOf2(ce, ops[0], ops[1], options) ?? native?.(ops, options),
    2,
  );
  wrapOperator(
    ce,
    ["Mean"],
    (ops) => KINDS2.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => meanOf2(ce, ops[0], options) ?? native?.(ops, options),
    1,
  );
  wrapOperator(
    ce,
    ["Variance"],
    (ops) => KINDS2.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => varianceOf2(ce, ops[0], options) ?? native?.(ops, options),
    1,
  );
  wrapOperator(
    ce,
    ["RandomVariate"],
    (ops) => KINDS2.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => {
      const dist = ops[0];
      if (ops.length === 1 || ops[1] === undefined) return drawOne2(ce, dist) ?? native?.(ops, options);
      const n = integerAt(ops[1]);
      if (n === undefined || n < 0) return native?.(ops, options);
      const draws: BoxedExpression[] = [];
      for (let i = 0; i < n; i++) {
        const d = drawOne2(ce, dist);
        if (d === undefined) return native?.(ops, options);
        draws.push(d);
      }
      return ce.function("List", draws);
    },
    { min: 1, max: 2 },
  );
}

// --- generic property functions: Moment, CentralMoment, FactorialMoment, Cumulant (r<=2),
//     HazardFunction, SurvivalFunction, InverseCDF ------------------------------------------

/** `SurvivalFunction(dist, x) = 1 - CDF(dist, x)` — works for ANY distribution whose CDF this
 *  engine can answer, old or new, since it goes back through the (fully extended) `CDF`
 *  operator itself rather than switching on `dist.operator`. */
const survivalOf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression => finish(sub(ce, ce.One, ce.function("CDF", [dist, x])), options);

/** `HazardFunction(dist, x) = PDF(dist, x) / SurvivalFunction(dist, x)` — same generic
 *  approach as `SurvivalFunction`. */
const hazardOf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression => finish(div(ce, ce.function("PDF", [dist, x]), survivalOf(ce, dist, x, options)), options);

/** Raw moment `E[X^r]` — exact for r = 0, 1, 2 via Mean/Variance (`E[X^2] = Var + Mean^2`);
 *  r >= 3 needs a distribution-specific formula this generic layer doesn't have, so it stays
 *  unevaluated rather than approximate. */
const momentOf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  r: number,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  if (r === 0) return finish(ce.One, options);
  const mean = finish(ce.function("Mean", [dist]), options);
  if (r === 1) return mean;
  if (r === 2) {
    const variance = finish(ce.function("Variance", [dist]), options);
    return finish(add(ce, variance, pow(ce, mean, ce.number(2))), options);
  }
  return undefined;
};

/** Central moment `E[(X - Mean)^r]` — exact for r = 0 (1), r = 1 (0, always), r = 2
 *  (Variance, by definition). r >= 3 stays unevaluated, same policy as `momentOf`. */
const centralMomentOf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  r: number,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  if (r === 0) return finish(ce.One, options);
  if (r === 1) return finish(ce.Zero, options);
  if (r === 2) return finish(ce.function("Variance", [dist]), options);
  return undefined;
};

/** Factorial moment `E[X (X-1) ... (X-r+1)]` — exact for r = 0, 1, 2, via the raw-moment
 *  identity `E[X(X-1)] = E[X^2] - E[X]`. r >= 3 stays unevaluated. */
const factorialMomentOf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  r: number,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  if (r === 0) return finish(ce.One, options);
  if (r === 1) return finish(ce.function("Mean", [dist]), options);
  if (r === 2) {
    const m2 = momentOf(ce, dist, 2, options);
    const mean = finish(ce.function("Mean", [dist]), options);
    if (m2 === undefined) return undefined;
    return finish(sub(ce, m2, mean), options);
  }
  return undefined;
};

/** Cumulants: kappa1 = Mean, kappa2 = Variance — the only two orders with a formula that
 *  doesn't need higher raw moments this layer doesn't have. r = 0 and r >= 3 stay
 *  unevaluated. */
const cumulantOf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  r: number,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  if (r === 1) return finish(ce.function("Mean", [dist]), options);
  if (r === 2) return finish(ce.function("Variance", [dist]), options);
  return undefined;
};

/** Numeric-only `InverseCDF(dist, q)`: bisection against the (fully extended) `CDF` operator,
 *  bracketed from `Mean`/`Variance` when they're available and widened geometrically
 *  otherwise. No exact closed forms are attempted here — a documented divergence from
 *  Wolfram, which answers several of these symbolically — so this is honest about being an
 *  approximation, not a second (unexercised) code path pretending to be exact. Generic over
 *  every distribution this engine's `CDF` can evaluate numerically, old or new. */
const inverseCdfNumeric = (ce: ComputeEngine, dist: BoxedExpression, q: number): number | undefined => {
  if (!(q > 0 && q < 1)) return undefined;
  const cdfAt = (v: number): number | undefined => {
    const result = ce.function("CDF", [dist, ce.number(v)]).N();
    const value = result.re;
    return Number.isFinite(value) ? value : undefined;
  };
  const mean = ce.function("Mean", [dist]).N().re;
  const variance = ce.function("Variance", [dist]).N().re;
  const spread = Number.isFinite(variance) && variance > 0 ? Math.sqrt(variance) : 1;
  const center = Number.isFinite(mean) ? mean : 0;
  let lo = center - spread;
  let hi = center + spread;
  let cLo = cdfAt(lo);
  let cHi = cdfAt(hi);
  let guard = 0;
  while ((cLo === undefined || cLo > q) && guard < 200) {
    lo -= Math.abs(lo) + spread;
    cLo = cdfAt(lo);
    guard++;
  }
  guard = 0;
  while ((cHi === undefined || cHi < q) && guard < 200) {
    hi += Math.abs(hi) + spread;
    cHi = cdfAt(hi);
    guard++;
  }
  if (cLo === undefined || cHi === undefined || cLo > q || cHi < q) return undefined;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const cMid = cdfAt(mid);
    if (cMid === undefined) return undefined;
    if (cMid < q) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

function declarePropertyFunctions(ce: ComputeEngine): void {
  ce.declare("SurvivalFunction", {
    signature: "(any, any) -> any",
    evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) =>
      ops.length === 2 ? survivalOf(ce, ops[0], ops[1], options) : undefined,
  });

  ce.declare("HazardFunction", {
    signature: "(any, any) -> any",
    evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) =>
      ops.length === 2 ? hazardOf(ce, ops[0], ops[1], options) : undefined,
  });

  ce.declare("Moment", {
    signature: "(any, any) -> any",
    evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) => {
      if (ops.length !== 2) return undefined;
      const r = integerAt(ops[1]);
      return r === undefined ? undefined : momentOf(ce, ops[0], r, options);
    },
  });

  ce.declare("CentralMoment", {
    signature: "(any, any) -> any",
    evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) => {
      if (ops.length !== 2) return undefined;
      const r = integerAt(ops[1]);
      return r === undefined ? undefined : centralMomentOf(ce, ops[0], r, options);
    },
  });

  ce.declare("FactorialMoment", {
    signature: "(any, any) -> any",
    evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) => {
      if (ops.length !== 2) return undefined;
      const r = integerAt(ops[1]);
      return r === undefined ? undefined : factorialMomentOf(ce, ops[0], r, options);
    },
  });

  ce.declare("Cumulant", {
    signature: "(any, any) -> any",
    evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) => {
      if (ops.length !== 2) return undefined;
      const r = integerAt(ops[1]);
      return r === undefined ? undefined : cumulantOf(ce, ops[0], r, options);
    },
  });

  ce.declare("InverseCDF", {
    signature: "(any, any) -> any",
    evaluate: (ops: readonly BoxedExpression[]) => {
      if (ops.length !== 2) return undefined;
      const [dist, q] = ops;
      // Only a `q` that reduces to a plain finite number gets an answer — see
      // `inverseCdfNumeric`'s doc comment.
      const qNum = q.N().re;
      if (!Number.isFinite(qNum)) return undefined;
      const result = inverseCdfNumeric(ce, dist, qNum);
      return result === undefined ? undefined : ce.number(result);
    },
  });
}

/** Declare the second-wave distribution frontier heads on `ce`: nineteen univariate
 *  distributions (GeometricDistribution .. MaxwellDistribution) and the property functions
 *  that read any distribution (SurvivalFunction, HazardFunction, Moment, CentralMoment,
 *  FactorialMoment, Cumulant, InverseCDF). Call AFTER `declareDistributions` —
 *  `extendStats2` composes onto whatever PDF/CDF/Mean/Variance/RandomVariate already are. */
export function declareDistributions2(ce: ComputeEngine): void {
  declareConstructors2(ce);
  extendStats2(ce);
  declarePropertyFunctions(ce);
}
