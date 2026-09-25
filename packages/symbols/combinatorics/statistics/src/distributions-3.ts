import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvaluateOptions, integerAt, operandsOf, wrapOperator } from "@enumeratio/boxed";
import { finish, gammaParams } from "./distributions.ts";
import { add, div, exp, If, lt, mul, neg, one, pdfOf2, pow, sub, three, two } from "./distributions-2.ts";

// The third wave of Wolfram-frontier probability heads, on top of `distributions.ts` (PR
// #200) and `distributions-2.ts` (PR #218):
//
//   1. gaps left open by #218 — CharacteristicFunction/MomentGeneratingFunction (not
//      implemented at all previously: both need a per-distribution closed form the generic
//      Mean/Variance route has nothing to offer for `E[e^{itX}]`/`E[e^{tX}]`), plus the CDF
//      of CauchyDistribution/StudentTDistribution/HypergeometricDistribution (documented gap
//      in their own reference entries — "no elementary closed form implemented HERE", not a
//      mathematical impossibility), plus Moment/Cumulant beyond order 2 for the couple of
//      distributions with an order-independent formula.
//
// CharacteristicFunction/MomentGeneratingFunction are declared for a deliberately scoped
// subset of the distributions this package knows: every one where the transform has a short,
// standard closed form (Normal, Uniform, DiscreteUniform, Bernoulli, Binomial, Geometric,
// Poisson, Gamma, ChiSquare, Erlang, NegativeBinomial, Laplace, Logistic — MGF only, plus
// Cauchy for CF only, whose MGF does not exist, diverges to infinity for any t != 0). Beta
// (needs confluent hypergeometric ₁F₁, not available as a head here), StudentT (MGF doesn't
// exist either; CF is a Bessel-K form), Weibull/LogNormal/Rayleigh/Pareto/Chi/HalfNormal/
// Maxwell/Triangular/Hypergeometric/Binormal/Empirical are left UNDECLARED for both heads —
// skipped rather than faked, per this batch's priority order.
//
// Compound-distribution heads (TruncatedDistribution, MixtureDistribution,
// ProductDistribution, TransformedDistribution, MarginalDistribution, DirichletDistribution,
// Conditioned, NProbability/NExpectation) are OUT OF SCOPE for this file — see the report
// accompanying this change. They are priority 2 in the batch and were not reached.

// --- shared helpers --------------------------------------------------------------------------

const I = (ce: ComputeEngine) => ce.symbol("ImaginaryUnit");
const eq = (ce: ComputeEngine, a: BoxedExpression, b: BoxedExpression) => ce.function("Equal", [a, b]);

/** `f(0) = 1` for every transform here (CF/MGF at the origin is always 1) — special-cased
 *  ahead of a formula that would otherwise divide by `t`. */
const atZeroElse = (
  ce: ComputeEngine,
  t: BoxedExpression,
  formula: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression => finish(If(ce, eq(ce, t, ce.Zero), ce.One, finish(formula, options)), options);

// --- CharacteristicFunction(dist, t) = E[e^{i t X}] --------------------------------------------

const cfOf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  t: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const i = I(ce);
  switch (dist.operator) {
    case "NormalDistribution": {
      const ops = operandsOf(dist);
      const [mu, sigma] = ops.length === 0 ? [ce.Zero, ce.One] : ops;
      if (mu === undefined || sigma === undefined) return undefined;
      const expo = sub(
        ce,
        mul(ce, i, mu, t),
        div(ce, mul(ce, pow(ce, sigma, ce.number(2)), pow(ce, t, ce.number(2))), ce.number(2)),
      );
      return finish(exp(ce, expo), options);
    }
    case "UniformDistribution": {
      const ops = operandsOf(dist);
      if (ops.length !== 2) return undefined;
      const [a, b] = ops;
      const formula = div(
        ce,
        sub(ce, exp(ce, mul(ce, i, t, b)), exp(ce, mul(ce, i, t, a))),
        mul(ce, i, t, sub(ce, b, a)),
      );
      return atZeroElse(ce, t, formula, options);
    }
    case "DiscreteUniformDistribution": {
      const ops = operandsOf(dist);
      if (ops.length !== 1 || ops[0].operator !== "List") return undefined;
      const bounds = operandsOf(ops[0]);
      if (bounds.length !== 2) return undefined;
      const [min, max] = bounds;
      const n = add(ce, sub(ce, max, min), ce.One);
      const formula = div(
        ce,
        sub(ce, exp(ce, mul(ce, i, t, min)), exp(ce, mul(ce, i, t, add(ce, max, ce.One)))),
        mul(ce, n, sub(ce, ce.One, exp(ce, mul(ce, i, t)))),
      );
      return atZeroElse(ce, t, formula, options);
    }
    case "BernoulliDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [p] = params;
      return finish(add(ce, sub(ce, ce.One, p), mul(ce, p, exp(ce, mul(ce, i, t)))), options);
    }
    case "BinomialDistribution": {
      const ops = operandsOf(dist);
      if (ops.length !== 2) return undefined;
      const [n, p] = ops;
      const base = add(ce, sub(ce, ce.One, p), mul(ce, p, exp(ce, mul(ce, i, t))));
      return finish(pow(ce, base, n), options);
    }
    case "GeometricDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [p] = params;
      return finish(div(ce, p, sub(ce, ce.One, mul(ce, sub(ce, ce.One, p), exp(ce, mul(ce, i, t))))), options);
    }
    case "NegativeBinomialDistribution": {
      const ops = operandsOf(dist);
      if (ops.length !== 2) return undefined;
      const [n, p] = ops;
      const base = div(ce, p, sub(ce, ce.One, mul(ce, sub(ce, ce.One, p), exp(ce, mul(ce, i, t)))));
      return finish(pow(ce, base, n), options);
    }
    case "PoissonDistribution": {
      const ops = operandsOf(dist);
      if (ops.length !== 1) return undefined;
      const [lambda] = ops;
      return finish(exp(ce, mul(ce, lambda, sub(ce, exp(ce, mul(ce, i, t)), ce.One))), options);
    }
    case "GammaDistribution": {
      const params = gammaParams(ce, dist);
      if (params === undefined) return undefined;
      const [k, theta] = params;
      const base = sub(ce, ce.One, mul(ce, i, theta, t));
      return finish(pow(ce, base, neg(ce, k)), options);
    }
    case "ChiSquareDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [k] = params;
      const base = sub(ce, ce.One, mul(ce, ce.number(2), i, t));
      return finish(pow(ce, base, neg(ce, div(ce, k, ce.number(2)))), options);
    }
    case "ErlangDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [n, lambda] = params;
      const base = sub(ce, ce.One, div(ce, mul(ce, i, t), lambda));
      return finish(pow(ce, base, neg(ce, n)), options);
    }
    case "LaplaceDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [mu, b] = params;
      const denom = add(ce, ce.One, mul(ce, pow(ce, b, ce.number(2)), pow(ce, t, ce.number(2))));
      return finish(div(ce, exp(ce, mul(ce, i, mu, t)), denom), options);
    }
    case "CauchyDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [a, b] = params;
      const expo = sub(ce, mul(ce, i, a, t), mul(ce, b, ce.function("Abs", [t])));
      return finish(exp(ce, expo), options);
    }
    case "LogisticDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [mu, beta] = params;
      const arg = mul(ce, ce.symbol("Pi"), beta, t);
      const formula = mul(ce, exp(ce, mul(ce, i, mu, t)), div(ce, arg, ce.function("Sinh", [arg])));
      return atZeroElse(ce, t, formula, options);
    }
    default:
      return undefined;
  }
};

// --- MomentGeneratingFunction(dist, t) = E[e^{t X}] --------------------------------------------
//
// Same distribution kinds as `cfOf` above, `i t` -> `t` throughout, EXCEPT CauchyDistribution
// (no MGF: `E[e^{tX}]` diverges for any `t != 0`, a genuine mathematical fact, not a gap) and
// LogisticDistribution, whose MGF is `Exp(mu t) Beta(1 - beta t, 1 + beta t)` — a different
// (still elementary, via the Beta function) closed form from its CF, not the naive `i -> 1`
// substitution of the formula above.

const mgfOf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  t: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  switch (dist.operator) {
    case "NormalDistribution": {
      const ops = operandsOf(dist);
      const [mu, sigma] = ops.length === 0 ? [ce.Zero, ce.One] : ops;
      if (mu === undefined || sigma === undefined) return undefined;
      const expo = add(
        ce,
        mul(ce, mu, t),
        div(ce, mul(ce, pow(ce, sigma, ce.number(2)), pow(ce, t, ce.number(2))), ce.number(2)),
      );
      return finish(exp(ce, expo), options);
    }
    case "UniformDistribution": {
      const ops = operandsOf(dist);
      if (ops.length !== 2) return undefined;
      const [a, b] = ops;
      const formula = div(ce, sub(ce, exp(ce, mul(ce, t, b)), exp(ce, mul(ce, t, a))), mul(ce, t, sub(ce, b, a)));
      return atZeroElse(ce, t, formula, options);
    }
    case "DiscreteUniformDistribution": {
      const ops = operandsOf(dist);
      if (ops.length !== 1 || ops[0].operator !== "List") return undefined;
      const bounds = operandsOf(ops[0]);
      if (bounds.length !== 2) return undefined;
      const [min, max] = bounds;
      const n = add(ce, sub(ce, max, min), ce.One);
      const formula = div(
        ce,
        sub(ce, exp(ce, mul(ce, t, min)), exp(ce, mul(ce, t, add(ce, max, ce.One)))),
        mul(ce, n, sub(ce, ce.One, exp(ce, t))),
      );
      return atZeroElse(ce, t, formula, options);
    }
    case "BernoulliDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [p] = params;
      return finish(add(ce, sub(ce, ce.One, p), mul(ce, p, exp(ce, t))), options);
    }
    case "BinomialDistribution": {
      const ops = operandsOf(dist);
      if (ops.length !== 2) return undefined;
      const [n, p] = ops;
      return finish(pow(ce, add(ce, sub(ce, ce.One, p), mul(ce, p, exp(ce, t))), n), options);
    }
    case "GeometricDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [p] = params;
      return finish(div(ce, p, sub(ce, ce.One, mul(ce, sub(ce, ce.One, p), exp(ce, t)))), options);
    }
    case "NegativeBinomialDistribution": {
      const ops = operandsOf(dist);
      if (ops.length !== 2) return undefined;
      const [n, p] = ops;
      const base = div(ce, p, sub(ce, ce.One, mul(ce, sub(ce, ce.One, p), exp(ce, t))));
      return finish(pow(ce, base, n), options);
    }
    case "PoissonDistribution": {
      const ops = operandsOf(dist);
      if (ops.length !== 1) return undefined;
      const [lambda] = ops;
      return finish(exp(ce, mul(ce, lambda, sub(ce, exp(ce, t), ce.One))), options);
    }
    case "GammaDistribution": {
      const params = gammaParams(ce, dist);
      if (params === undefined) return undefined;
      const [k, theta] = params;
      return finish(pow(ce, sub(ce, ce.One, mul(ce, theta, t)), neg(ce, k)), options);
    }
    case "ChiSquareDistribution": {
      const params = one(dist);
      if (params === undefined) return undefined;
      const [k] = params;
      return finish(pow(ce, sub(ce, ce.One, mul(ce, ce.number(2), t)), neg(ce, div(ce, k, ce.number(2)))), options);
    }
    case "ErlangDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [n, lambda] = params;
      return finish(pow(ce, sub(ce, ce.One, div(ce, t, lambda)), neg(ce, n)), options);
    }
    case "LaplaceDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [mu, b] = params;
      const denom = sub(ce, ce.One, mul(ce, pow(ce, b, ce.number(2)), pow(ce, t, ce.number(2))));
      return finish(div(ce, exp(ce, mul(ce, mu, t)), denom), options);
    }
    case "LogisticDistribution": {
      const params = two(dist);
      if (params === undefined) return undefined;
      const [mu, beta] = params;
      const bt = mul(ce, beta, t);
      const expr = mul(ce, exp(ce, mul(ce, mu, t)), ce.function("Beta", [sub(ce, ce.One, bt), add(ce, ce.One, bt)]));
      return finish(expr, options);
    }
    // CauchyDistribution: no MGF (diverges for t != 0) — deliberately absent, not a gap.
    default:
      return undefined;
  }
};

function declareTransforms(ce: ComputeEngine): void {
  ce.declare("CharacteristicFunction", {
    signature: "(any, any) -> any",
    evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) =>
      ops.length === 2 ? cfOf(ce, ops[0], ops[1], options) : undefined,
  });

  ce.declare("MomentGeneratingFunction", {
    signature: "(any, any) -> any",
    evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) =>
      ops.length === 2 ? mgfOf(ce, ops[0], ops[1], options) : undefined,
  });
}

// --- CDF gaps: CauchyDistribution, StudentTDistribution, HypergeometricDistribution -----------

const CDF_GAP_KINDS = new Set(["CauchyDistribution", "StudentTDistribution", "HypergeometricDistribution"]);

const cauchyCdf = (ce: ComputeEngine, dist: BoxedExpression, x: BoxedExpression, options: EvaluateOptions) => {
  const params = two(dist);
  if (params === undefined) return undefined;
  const [a, b] = params;
  const expr = add(
    ce,
    div(ce, ce.One, ce.number(2)),
    div(ce, ce.function("Arctan", [div(ce, sub(ce, x, a), b)]), ce.symbol("Pi")),
  );
  return finish(expr, options);
};

/** `F(x) = 1 - (1/2) I_{nu/(nu+x^2)}(nu/2, 1/2)` for `x >= 0`, `= (1/2) I_{nu/(nu+x^2)}(nu/2,
 *  1/2)` for `x < 0` — the regularized-incomplete-beta form of the Student-t CDF (Abramowitz
 *  & Stegun 26.7.1). Both branches share the same `I_z(nu/2, 1/2)` term. */
const studentTCdf = (ce: ComputeEngine, dist: BoxedExpression, x: BoxedExpression, options: EvaluateOptions) => {
  const params = one(dist);
  if (params === undefined) return undefined;
  const [nu] = params;
  const z = div(ce, nu, add(ce, nu, pow(ce, x, ce.number(2))));
  const ib = finish(
    ce.function("BetaRegularized", [z, div(ce, nu, ce.number(2)), div(ce, ce.One, ce.number(2))]),
    options,
  );
  const negBranch = finish(div(ce, ib, ce.number(2)), options);
  const posBranch = finish(sub(ce, ce.One, div(ce, ib, ce.number(2))), options);
  return finish(If(ce, lt(ce, x, ce.Zero), negBranch, posBranch), options);
};

/** `P(X <= floor(x)) = sum_{k=0}^{floor(x)} PDF(k)` — a finite, exact sum (reusing
 *  `distributions-2.ts`'s own `pdfOf2`), not an approximation. Only answers when `floor(x)`
 *  resolves to a concrete integer; otherwise stays unevaluated rather than build an unbounded
 *  symbolic `Sum`. */
const hypergeometricCdf = (ce: ComputeEngine, dist: BoxedExpression, x: BoxedExpression, options: EvaluateOptions) => {
  const params = three(dist);
  if (params === undefined) return undefined;
  const floorX = integerAt(finish(ce.function("Floor", [x]), options));
  if (floorX === undefined) return undefined;
  if (floorX < 0) return ce.Zero;
  const [n] = params;
  const nMax = integerAt(n) ?? integerAt(finish(n, options));
  const top = nMax === undefined ? floorX : Math.min(floorX, nMax);
  const terms: BoxedExpression[] = [];
  for (let k = 0; k <= top; k++) {
    const term = pdfOf2(ce, dist, ce.number(k), options);
    if (term === undefined) return undefined;
    terms.push(term);
  }
  if (terms.length === 0) return ce.Zero;
  return finish(terms.length === 1 ? terms[0] : add(ce, ...terms), options);
};

function extendCdfGaps(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["CDF"],
    (ops) => CDF_GAP_KINDS.has(ops[0]?.operator ?? ""),
    (native) => (ops, options) => {
      const [dist, x] = ops;
      const result =
        dist.operator === "CauchyDistribution"
          ? cauchyCdf(ce, dist, x, options)
          : dist.operator === "StudentTDistribution"
            ? studentTCdf(ce, dist, x, options)
            : hypergeometricCdf(ce, dist, x, options);
      return result ?? native?.(ops, options);
    },
    2,
  );
}

// --- Moment/Cumulant beyond order 2, distribution-specific -------------------------------------

/** `Moment(BernoulliDistribution(p), r) = p` for every `r >= 1`: `X in {0,1}` so `X^r = X`
 *  identically, for any positive `r` (not just the `r <= 2` the generic layer in
 *  `distributions-2.ts` already covers). */
function extendBernoulliMoment(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Moment"],
    (ops) => {
      if (ops[0]?.operator !== "BernoulliDistribution") return false;
      const r = integerAt(ops[1]);
      return r !== undefined && r >= 1;
    },
    () => (ops, options) => {
      const params = one(ops[0]);
      return params === undefined ? undefined : finish(params[0], options);
    },
    2,
  );
}

/** `Cumulant(PoissonDistribution(lambda), r) = lambda` for every `r >= 1` — every cumulant of
 *  a Poisson distribution equals its rate (a standard identity: `log E[e^{tX}] = lambda(e^t -
 *  1)`, whose Taylor coefficients are all `lambda`). */
function extendPoissonCumulant(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Cumulant"],
    (ops) => {
      if (ops[0]?.operator !== "PoissonDistribution") return false;
      const r = integerAt(ops[1]);
      return r !== undefined && r >= 1;
    },
    () => (ops, options) => {
      const dist = ops[0];
      const params = operandsOf(dist);
      return params.length === 1 ? finish(params[0], options) : undefined;
    },
    2,
  );
}

/** Declare the third-wave distribution frontier heads on `ce`: `CharacteristicFunction`,
 *  `MomentGeneratingFunction` (new), plus extending `CDF` (three named gaps) and `Moment`/
 *  `Cumulant` (two named distribution-specific identities beyond order 2) in place. Call
 *  AFTER `declareDistributions` and `declareDistributions2` — every extension here composes
 *  onto operators those two already declared. */
export function declareDistributions3(ce: ComputeEngine): void {
  declareTransforms(ce);
  extendCdfGaps(ce);
  extendBernoulliMoment(ce);
  extendPoissonCumulant(ce);
}
