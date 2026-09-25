import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvaluateOptions, integerAt, operandsOf, symbolNameOf } from "@enumeratio/boxed";

// The Wolfram-frontier distribution heads: Distributed, RandomVariate, EmpiricalDistribution,
// BetaDistribution, GammaDistribution, BinormalDistribution, Expectation, Probability — plus
// the siblings PDF/CDF/Mean/Variance/NormalDistribution/UniformDistribution/
// PoissonDistribution/BinomialDistribution need to answer distribution arguments. compute-engine
// already declares PDF, CDF, Mean, Variance, NormalDistribution, PoissonDistribution and
// BinomialDistribution natively (see probes in `.scratch/`), so those are EXTENDED in place —
// each new distribution kind is a branch `wrapOperator` adds ahead of the native handler,
// never a redeclaration. UniformDistribution is native too, but only accepts the bare
// `(min, max)` call; Wolfram's actual signature, `UniformDistribution[{min, max}]`, and the
// zero-argument default both error inside the native PDF/CDF/Mean — fixed once, at the
// constructor, by normalizing to the two-argument form the native handlers already answer
// correctly (see `extendUniformDistribution`).
//
// A distribution is an inert head carrying its parameters — declared with a signature and no
// `evaluate` (or, for the ones needing a default filled in, an `evaluate` that only
// normalizes the call shape and returns itself), the same pattern `@enumeratio/domains`'
// carrier constructors use. PDF/CDF/Mean/Variance are exact wherever a closed form exists;
// Expectation/Probability recognize a handful of closed-form shapes (linear/quadratic
// polynomials in the bound variable; simple and chained relational conditions) and otherwise
// stay unevaluated rather than approximate. RandomVariate is the only head that reaches
// outside pure evaluation, into a small deterministic PRNG seeded by SeedRandom.

// --- shared numeric helpers -----------------------------------------------------------------

const finish = (expr: BoxedExpression, options: EvaluateOptions | undefined): BoxedExpression =>
  options?.numericApproximation ? expr.N() : expr.evaluate();

/** Whether `expr`'s JSON mentions the symbol `name` — the same substring test
 *  `generalized-special.ts`'s `stillMentions` uses for a head, applied to a bound variable. */
const mentions = (expr: BoxedExpression, name: string): boolean =>
  JSON.stringify(expr.json).includes(`"${name}"`);

const isConstantOf = (expr: BoxedExpression, varName: string): boolean => !mentions(expr, varName);

const list2 = (
  ce: ComputeEngine,
  expr: BoxedExpression,
): [BoxedExpression, BoxedExpression] | undefined => {
  if (expr.operator !== "List") return undefined;
  const ops = operandsOf(expr);
  return ops.length === 2 ? [ops[0], ops[1]] : undefined;
};

// --- distribution kinds ----------------------------------------------------------------------

const DISCRETE_KINDS = new Set([
  "PoissonDistribution",
  "BinomialDistribution",
  "EmpiricalDistribution",
]);

const isDistribution = (expr: BoxedExpression | undefined): boolean =>
  expr !== undefined &&
  [
    "NormalDistribution",
    "UniformDistribution",
    "PoissonDistribution",
    "BinomialDistribution",
    "BetaDistribution",
    "GammaDistribution",
    "BinormalDistribution",
    "EmpiricalDistribution",
  ].includes(expr.operator);

// Only the kinds this file itself adds go through the `wrapOperator` branches below — Normal/
// Uniform/Poisson/Binomial are answered by compute-engine's own native handlers (after
// `extendUniformDistribution` below fixes its call-shape gap).
const OWN_KINDS = new Set([
  "BetaDistribution",
  "GammaDistribution",
  "BinormalDistribution",
  "EmpiricalDistribution",
]);

// --- parameter extraction ---------------------------------------------------------------------

const betaParams = (dist: BoxedExpression): [BoxedExpression, BoxedExpression] | undefined => {
  const ops = operandsOf(dist);
  return ops.length === 2 ? [ops[0], ops[1]] : undefined;
};

/** GammaDistribution(shape) defaults scale to 1; GammaDistribution(shape, scale) both given. */
const gammaParams = (
  ce: ComputeEngine,
  dist: BoxedExpression,
): [BoxedExpression, BoxedExpression] | undefined => {
  const ops = operandsOf(dist);
  if (ops.length === 1) return [ops[0], ce.One];
  if (ops.length === 2) return [ops[0], ops[1]];
  return undefined;
};

interface Binormal {
  readonly mu1: BoxedExpression;
  readonly mu2: BoxedExpression;
  readonly sigma1: BoxedExpression;
  readonly sigma2: BoxedExpression;
  readonly rho: BoxedExpression;
}

/** The three call forms Wolfram's BinormalDistribution takes: `(rho)`, `({s1,s2}, rho)`, and
 *  `({mu1,mu2}, {s1,s2}, rho)` — parsed lazily rather than normalized at construction, since
 *  none of the three shapes is more canonical than the others. */
const binormalParams = (ce: ComputeEngine, dist: BoxedExpression): Binormal | undefined => {
  const ops = operandsOf(dist);
  if (ops.length === 1) {
    return { mu1: ce.Zero, mu2: ce.Zero, sigma1: ce.One, sigma2: ce.One, rho: ops[0] };
  }
  if (ops.length === 2) {
    const sigmas = list2(ce, ops[0]);
    if (sigmas === undefined) return undefined;
    return { mu1: ce.Zero, mu2: ce.Zero, sigma1: sigmas[0], sigma2: sigmas[1], rho: ops[1] };
  }
  if (ops.length === 3) {
    const mus = list2(ce, ops[0]);
    const sigmas = list2(ce, ops[1]);
    if (mus === undefined || sigmas === undefined) return undefined;
    return { mu1: mus[0], mu2: mus[1], sigma1: sigmas[0], sigma2: sigmas[1], rho: ops[2] };
  }
  return undefined;
};

const empiricalData = (dist: BoxedExpression): readonly BoxedExpression[] | undefined => {
  const ops = operandsOf(dist);
  if (ops.length !== 1 || ops[0].operator !== "List") return undefined;
  return operandsOf(ops[0]);
};

// --- UniformDistribution: fix the native call-shape gap ---------------------------------------

/**
 * compute-engine's native `UniformDistribution` only accepts `(min, max)` — Wolfram's actual
 * call, `UniformDistribution[{min, max}]`, and the zero-argument default (`{0, 1}`) both throw
 * inside the native PDF/CDF/Mean (`Error 'missing'`, confirmed empirically). Normalizing both
 * to the two-argument form here, at the constructor, fixes PDF/CDF/Mean/Variance for free —
 * their own native handlers are untouched and already correct once they see two reals.
 */
function extendUniformDistribution(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("UniformDistribution");
  const operator =
    definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) return;
  (operator as { signature: unknown }).signature = ce.type(
    "((list<real> | real)?, real?) -> expression<UniformDistribution>",
  );
  // A pass-through `evaluate` never runs for this constructor — same gotcha `list-stats.ts`
  // hit with Take/Tabulate (both answered through a protocol other than `evaluate`): the
  // fix there, and here, is `canonical`, which DOES get called for every construction.
  const nativeCanonical = (
    operator as {
      canonical?: (
        ops: readonly BoxedExpression[],
        options: unknown,
      ) => BoxedExpression | undefined | null;
    }
  ).canonical;
  const nativeOperator = Object.create(operator) as typeof operator;
  (nativeOperator as { canonical?: unknown }).canonical = nativeCanonical;
  (operator as { canonical?: unknown }).canonical = (
    ops: readonly BoxedExpression[],
    options: unknown,
  ) => {
    if (ops.length === 0) return ce.function("UniformDistribution", [ce.Zero, ce.One]).canonical;
    if (ops.length === 1 && ops[0].operator === "List") {
      const bounds = list2(ce, ops[0]);
      if (bounds !== undefined) {
        return ce.function("UniformDistribution", [...bounds]).canonical;
      }
    }
    return nativeCanonical?.call(nativeOperator, ops, options);
  };
}

// --- PDF ---------------------------------------------------------------------------------------

const pdfOf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  switch (dist.operator) {
    case "BetaDistribution": {
      const params = betaParams(dist);
      if (params === undefined) return undefined;
      const [a, b] = params;
      // x^(a-1) (1-x)^(b-1) / B(a,b) — no domain clamp outside [0,1] (a documented divergence).
      const expr = ce.function("Divide", [
        ce.function("Multiply", [
          ce.function("Power", [x, ce.function("Subtract", [a, ce.One])]),
          ce.function("Power", [
            ce.function("Subtract", [ce.One, x]),
            ce.function("Subtract", [b, ce.One]),
          ]),
        ]),
        ce.function("Beta", [a, b]),
      ]);
      return finish(expr, options);
    }
    case "GammaDistribution": {
      const params = gammaParams(ce, dist);
      if (params === undefined) return undefined;
      const [k, theta] = params;
      // x^(k-1) e^(-x/theta) / (theta^k Gamma(k)) — no domain clamp outside x >= 0.
      const expr = ce.function("Divide", [
        ce.function("Multiply", [
          ce.function("Power", [x, ce.function("Subtract", [k, ce.One])]),
          ce.function("Exp", [ce.function("Negate", [ce.function("Divide", [x, theta])])]),
        ]),
        ce.function("Multiply", [ce.function("Power", [theta, k]), ce.function("Gamma", [k])]),
      ]);
      return finish(expr, options);
    }
    case "BinormalDistribution": {
      const params = binormalParams(ce, dist);
      const point = list2(ce, x);
      if (params === undefined || point === undefined) return undefined;
      const { mu1, mu2, sigma1, sigma2, rho } = params;
      const [x1, x2] = point;
      const dx1 = ce.function("Divide", [ce.function("Subtract", [x1, mu1]), sigma1]);
      const dx2 = ce.function("Divide", [ce.function("Subtract", [x2, mu2]), sigma2]);
      const oneMinusRho2 = ce.function("Subtract", [
        ce.One,
        ce.function("Power", [rho, ce.number(2)]),
      ]);
      const quadratic = ce.function("Subtract", [
        ce.function("Add", [
          ce.function("Power", [dx1, ce.number(2)]),
          ce.function("Power", [dx2, ce.number(2)]),
        ]),
        ce.function("Multiply", [ce.number(2), rho, dx1, dx2]),
      ]);
      const exponent = ce.function("Negate", [
        ce.function("Divide", [quadratic, ce.function("Multiply", [ce.number(2), oneMinusRho2])]),
      ]);
      const norm = ce.function("Multiply", [
        ce.number(2),
        ce.symbol("Pi"),
        sigma1,
        sigma2,
        ce.function("Sqrt", [oneMinusRho2]),
      ]);
      const expr = ce.function("Divide", [ce.function("Exp", [exponent]), norm]);
      return finish(expr, options);
    }
    case "EmpiricalDistribution": {
      const data = empiricalData(dist);
      if (data === undefined) return undefined;
      // The proportion of observations equal to x — a discrete empirical measure, not
      // Wolfram's smoothed/continuous kernel estimate (a documented divergence).
      const count = data.filter((d) => d.isEqual(x) === true).length;
      return ce.number([count, data.length]);
    }
    default:
      return undefined;
  }
};

// --- CDF -----------------------------------------------------------------------------------

const cdfOf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  x: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  switch (dist.operator) {
    case "BetaDistribution": {
      const params = betaParams(dist);
      if (params === undefined) return undefined;
      const [a, b] = params;
      // I_x(a,b), clamped to [0,1] at the support boundary. The in-range branch is
      // `finish`ed BEFORE going into `If` — `If` is lazy (branches are held until picked),
      // so `N()` on the whole `If` selects a branch but does not itself push down into it;
      // the branch has to already be numeric.
      const inRange = finish(ce.function("BetaRegularized", [x, a, b]), options);
      const expr = ce.function("If", [
        ce.function("Less", [x, ce.Zero]),
        ce.Zero,
        ce.function("If", [ce.function("Less", [ce.One, x]), ce.One, inRange]),
      ]);
      return finish(expr, options);
    }
    case "GammaDistribution": {
      const params = gammaParams(ce, dist);
      if (params === undefined) return undefined;
      const [k, theta] = params;
      // P(k, x/theta) = 1 - Q(k, x/theta), compute-engine's native (two-argument)
      // `GammaRegularized` already being the upper tail Q — no need for the three-argument
      // generalized form `@enumeratio/analytic` adds, so this has no dependency on that
      // package having been declared. Clamped below x = 0 (same pre-`finish`-the-branch
      // reasoning as `BetaDistribution` above).
      const inRange = finish(
        ce.function("Subtract", [
          ce.One,
          ce.function("GammaRegularized", [k, ce.function("Divide", [x, theta])]),
        ]),
        options,
      );
      const expr = ce.function("If", [ce.function("Less", [x, ce.Zero]), ce.Zero, inRange]);
      return finish(expr, options);
    }
    case "EmpiricalDistribution": {
      const data = empiricalData(dist);
      if (data === undefined) return undefined;
      const count = data.filter((d) => d.isLessEqual(x) === true).length;
      return ce.number([count, data.length]);
    }
    // BinormalDistribution's CDF has no elementary closed form (Owen's T / a 2D integral) —
    // left unevaluated, per the "stays unevaluated" policy.
    default:
      return undefined;
  }
};

// --- Mean / Variance -------------------------------------------------------------------------

const meanOf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options?: EvaluateOptions,
): BoxedExpression | undefined => {
  switch (dist.operator) {
    case "BetaDistribution": {
      const params = betaParams(dist);
      if (params === undefined) return undefined;
      const [a, b] = params;
      return finish(ce.function("Divide", [a, ce.function("Add", [a, b])]), options);
    }
    case "GammaDistribution": {
      const params = gammaParams(ce, dist);
      if (params === undefined) return undefined;
      const [k, theta] = params;
      return finish(ce.function("Multiply", [k, theta]), options);
    }
    case "BinormalDistribution": {
      const params = binormalParams(ce, dist);
      if (params === undefined) return undefined;
      return finish(ce.function("List", [params.mu1, params.mu2]), options);
    }
    case "EmpiricalDistribution": {
      const data = empiricalData(dist);
      if (data === undefined) return undefined;
      return finish(ce.function("Mean", [ce.function("List", [...data])]), options);
    }
    default:
      return undefined;
  }
};

const varianceOf = (
  ce: ComputeEngine,
  dist: BoxedExpression,
  options?: EvaluateOptions,
): BoxedExpression | undefined => {
  switch (dist.operator) {
    case "BetaDistribution": {
      const params = betaParams(dist);
      if (params === undefined) return undefined;
      const [a, b] = params;
      const sum = ce.function("Add", [a, b]);
      const expr = ce.function("Divide", [
        ce.function("Multiply", [a, b]),
        ce.function("Multiply", [
          ce.function("Power", [sum, ce.number(2)]),
          ce.function("Add", [sum, ce.One]),
        ]),
      ]);
      return finish(expr, options);
    }
    case "GammaDistribution": {
      const params = gammaParams(ce, dist);
      if (params === undefined) return undefined;
      const [k, theta] = params;
      return finish(
        ce.function("Multiply", [k, ce.function("Power", [theta, ce.number(2)])]),
        options,
      );
    }
    case "BinormalDistribution": {
      const params = binormalParams(ce, dist);
      if (params === undefined) return undefined;
      const { sigma1, sigma2, rho } = params;
      const cov = ce.function("Multiply", [rho, sigma1, sigma2]);
      // The covariance matrix {{sigma1^2, cov}, {cov, sigma2^2}}.
      const expr = ce.function("List", [
        ce.function("List", [ce.function("Power", [sigma1, ce.number(2)]), cov]),
        ce.function("List", [cov, ce.function("Power", [sigma2, ce.number(2)])]),
      ]);
      return finish(expr, options);
    }
    case "EmpiricalDistribution": {
      const data = empiricalData(dist);
      if (data === undefined) return undefined;
      // Sample variance (n-1), matching compute-engine's own list Variance — and Wolfram's
      // own convention that Variance(EmpiricalDistribution(data)) = Variance(data).
      return finish(ce.function("Variance", [ce.function("List", [...data])]), options);
    }
    default:
      return undefined;
  }
};

/** Extend PDF/CDF/Mean/Variance in place with a branch for each distribution kind this file
 *  adds, ahead of whatever native (or collections' list/matrix) handler runs otherwise. */
function extendDistributionStats(ce: ComputeEngine): void {
  const attach = (
    name: "PDF" | "CDF" | "Mean" | "Variance",
    handler: (
      ops: readonly BoxedExpression[],
      options: EvaluateOptions,
    ) => BoxedExpression | undefined,
    arity: number,
  ): void => {
    const definition = ce.lookupDefinition(name);
    const operator =
      definition !== undefined && "operator" in definition ? definition.operator : undefined;
    if (operator === undefined) return;
    const native = operator.evaluate;
    operator.evaluate = (ops: readonly BoxedExpression[], options: EvaluateOptions) => {
      if (ops.length !== arity || !OWN_KINDS.has(ops[0]?.operator ?? ""))
        return native?.(ops, options);
      return handler(ops, options) ?? native?.(ops, options);
    };
  };

  // Widen PDF/CDF's second parameter to also take a point (`list<real>`), the shape
  // `BinormalDistribution`'s PDF needs — native only typed a scalar, since every native
  // distribution is univariate.
  for (const name of ["PDF", "CDF"] as const) {
    const definition = ce.lookupDefinition(name);
    const operator =
      definition !== undefined && "operator" in definition ? definition.operator : undefined;
    if (operator === undefined) continue;
    const returnType = name === "PDF" ? "nan | real<0..>" : "nan | real<0..1>";
    (operator as { signature: unknown }).signature = ce.type(
      `(distribution, real | signed_infinity | list<real>) -> ${returnType}`,
    );
  }

  attach("PDF", (ops, options) => pdfOf(ce, ops[0], ops[1], options), 2);
  attach("CDF", (ops, options) => cdfOf(ce, ops[0], ops[1], options), 2);
  attach("Mean", (ops, options) => meanOf(ce, ops[0], options), 1);
  attach("Variance", (ops, options) => varianceOf(ce, ops[0], options), 1);
}

// --- Distributed / Expectation / Probability --------------------------------------------------

interface Binding {
  readonly varName: string;
  readonly dist: BoxedExpression;
}

const bindingOf = (expr: BoxedExpression): Binding | undefined => {
  if (expr.operator !== "Distributed") return undefined;
  const ops = operandsOf(expr);
  if (ops.length !== 2) return undefined;
  const varName = symbolNameOf(ops[0]);
  if (varName === undefined) return undefined;
  return { varName, dist: ops[1] };
};

/** `Expectation(f, Distributed(x, D))`: exact for `f` linear or quadratic in `x` — `E[c] = c`,
 *  `E[x] = Mean(D)`, `E[x^2] = Variance(D) + Mean(D)^2`, extended over `Add`/`Multiply-by-
 *  constant` by linearity. Anything else stays unevaluated — no numeric approximation unless
 *  `N` is applied. */
const expectationOf = (
  ce: ComputeEngine,
  f: BoxedExpression,
  varName: string,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  if (isConstantOf(f, varName)) return finish(f, options);
  if (symbolNameOf(f) === varName) {
    return meanOf(ce, dist, options) ?? finish(ce.function("Mean", [dist]), options);
  }
  if (f.operator === "Power") {
    const [base, exp] = operandsOf(f);
    if (symbolNameOf(base) === varName && integerAt(exp) === 2) {
      const mean = meanOf(ce, dist, options) ?? finish(ce.function("Mean", [dist]), options);
      const variance =
        varianceOf(ce, dist, options) ?? finish(ce.function("Variance", [dist]), options);
      if (mean === undefined || variance === undefined) return undefined;
      const expr = ce.function("Add", [variance, ce.function("Power", [mean, ce.number(2)])]);
      return finish(expr, options);
    }
    return undefined;
  }
  if (f.operator === "Add") {
    const parts = operandsOf(f).map((term) => expectationOf(ce, term, varName, dist, options));
    if (parts.some((p) => p === undefined)) return undefined;
    return finish(ce.function("Add", parts as BoxedExpression[]), options);
  }
  if (f.operator === "Multiply") {
    const ops = operandsOf(f);
    const varTerms = ops.filter((o) => mentions(o, varName));
    const constTerms = ops.filter((o) => !mentions(o, varName));
    if (varTerms.length !== 1) return undefined;
    const inner = expectationOf(ce, varTerms[0], varName, dist, options);
    if (inner === undefined) return undefined;
    const expr = ce.function("Multiply", [...constTerms, inner]);
    return finish(expr, options);
  }
  if (f.operator === "Negate") {
    const [inner] = operandsOf(f);
    const e = expectationOf(ce, inner, varName, dist, options);
    return e === undefined ? undefined : finish(ce.function("Negate", [e]), options);
  }
  return undefined;
};

/** `Probability(cond, Distributed(x, D))`, exact for `Equal`/`Less`/`LessEqual` (2- or 3-
 *  operand chain) conditions on `x` against constants, and `And` of two such conditions.
 *  `Greater`/`GreaterEqual` need no separate case — compute-engine's own canonicalization
 *  rewrites `x > k` to `Less(k, x)` before this ever sees it. */
const probabilityOf = (
  ce: ComputeEngine,
  cond: BoxedExpression,
  varName: string,
  dist: BoxedExpression,
  options: EvaluateOptions,
): BoxedExpression | undefined => {
  const discrete = DISCRETE_KINDS.has(dist.operator) || OWN_KINDS.has(dist.operator);
  const cdf = (k: BoxedExpression) =>
    cdfOf(ce, dist, k, options) ?? finish(ce.function("CDF", [dist, k]), options);
  const pdf = (k: BoxedExpression) =>
    pdfOf(ce, dist, k, options) ?? finish(ce.function("PDF", [dist, k]), options);

  // P(X <= k)
  const le = (k: BoxedExpression): BoxedExpression | undefined => cdf(k);
  // P(X < k) = P(X <= k) - P(X = k), the latter only nonzero for a discrete distribution.
  const lt = (k: BoxedExpression): BoxedExpression | undefined => {
    const F = cdf(k);
    if (F === undefined) return undefined;
    if (!discrete) return F;
    const p = pdf(k);
    return p === undefined ? undefined : finish(ce.function("Subtract", [F, p]), options);
  };

  const asBound = (
    a: BoxedExpression,
    b: BoxedExpression,
  ): { k: BoxedExpression; varOnLeft: boolean } | undefined => {
    if (symbolNameOf(a) === varName && isConstantOf(b, varName)) return { k: b, varOnLeft: true };
    if (symbolNameOf(b) === varName && isConstantOf(a, varName)) return { k: a, varOnLeft: false };
    return undefined;
  };

  const simple = (
    op: "Less" | "LessEqual",
    a: BoxedExpression,
    b: BoxedExpression,
  ): BoxedExpression | undefined => {
    const bound = asBound(a, b);
    if (bound === undefined) return undefined;
    const { k, varOnLeft } = bound;
    if (varOnLeft) return op === "LessEqual" ? le(k) : lt(k);
    // k REL x: complement of "x REL' k" — P(k <= x) = 1 - P(x < k); P(k < x) = 1 - P(x <= k).
    const comp = op === "LessEqual" ? lt(k) : le(k);
    return comp === undefined
      ? undefined
      : finish(ce.function("Subtract", [ce.One, comp]), options);
  };

  switch (cond.operator) {
    case "Equal": {
      const [a, b] = operandsOf(cond);
      const bound = asBound(a, b);
      if (bound === undefined) return undefined;
      return discrete ? pdf(bound.k) : ce.Zero;
    }
    case "Less":
    case "LessEqual": {
      const ops = operandsOf(cond);
      if (ops.length === 2) return simple(cond.operator, ops[0], ops[1]);
      if (ops.length === 3) {
        const [a, xVar, b] = ops;
        if (
          symbolNameOf(xVar) !== varName ||
          !isConstantOf(a, varName) ||
          !isConstantOf(b, varName)
        ) {
          return undefined;
        }
        const upper = cond.operator === "LessEqual" ? le(b) : lt(b);
        const excludedLower = cond.operator === "LessEqual" ? lt(a) : le(a);
        if (upper === undefined || excludedLower === undefined) return undefined;
        return finish(ce.function("Subtract", [upper, excludedLower]), options);
      }
      return undefined;
    }
    case "And": {
      const parts = operandsOf(cond);
      if (parts.length !== 2) return undefined;
      const [c1, c2] = parts;
      const bound1 = c1.operator === "Less" || c1.operator === "LessEqual" ? c1 : undefined;
      const bound2 = c2.operator === "Less" || c2.operator === "LessEqual" ? c2 : undefined;
      if (bound1 === undefined || bound2 === undefined) return undefined;
      // Whichever relation puts the constant on the left is the lower bound; the other, upper.
      const [lo, hi] =
        asBound(...(operandsOf(bound1) as [BoxedExpression, BoxedExpression]))?.varOnLeft === false
          ? [bound1, bound2]
          : [bound2, bound1];
      const loOps = operandsOf(lo);
      const hiOps = operandsOf(hi);
      const a = loOps[0];
      const b = hiOps[1];
      if (symbolNameOf(loOps[1]) !== varName || symbolNameOf(hiOps[0]) !== varName)
        return undefined;
      const upper = hi.operator === "LessEqual" ? le(b) : lt(b);
      const excludedLower = lo.operator === "LessEqual" ? lt(a) : le(a);
      if (upper === undefined || excludedLower === undefined) return undefined;
      return finish(ce.function("Subtract", [upper, excludedLower]), options);
    }
    default:
      return undefined;
  }
};

function declareRelations(ce: ComputeEngine): void {
  // `any`, not `symbol`, for the bound-variable parameter: compute-engine's type inference
  // PINS a `symbol`-typed parameter's actual type onto that symbol GLOBALLY, in the engine's
  // lexical scope — the same gotcha `declare.ts`'s `applyDefinition` documents for its own
  // free wildcard (confirmed empirically: a first `Distributed("x", …)` call made every
  // later `Power("x", 2)` boxing fail as `incompatible-type 'number' 'symbol'`). `bindingOf`
  // already checks `symbolNameOf` itself at runtime, so the type system doesn't need to.
  ce.declare("Distributed", { signature: "(any, any) -> expression<Distributed>" });

  ce.declare("Expectation", {
    signature: "(any, any) -> any",
    evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) => {
      if (ops.length !== 2) return undefined;
      const binding = bindingOf(ops[1]);
      if (binding === undefined) return undefined;
      return expectationOf(ce, ops[0], binding.varName, binding.dist, options);
    },
  });

  ce.declare("Probability", {
    signature: "(any, any) -> any",
    evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) => {
      if (ops.length !== 2) return undefined;
      const binding = bindingOf(ops[1]);
      if (binding === undefined) return undefined;
      return probabilityOf(ce, ops[0], binding.varName, binding.dist, options);
    },
  });
}

// --- RandomVariate: a small deterministic PRNG, seeded via SeedRandom -------------------------

/** mulberry32 — the same generator `@enumeratio/collections`' (unlanded, #185) seeded
 *  `RandomInteger` uses, so the two agree on algorithm even though each keeps its own stream
 *  (this file's `RandomVariate` draws are independent of `RandomInteger`'s, even after the
 *  same `SeedRandom(n)` call — a documented divergence, and a follow-up once #185 lands: unify
 *  both under one engine-level RNG registry rather than two separate `WeakMap`s). NOT
 *  Wolfram's own generator either way — only the declared distribution's shape is guaranteed
 *  to match, never the exact sequence of numbers. */
const mulberry32 = (seed: number): (() => number) => {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const DEFAULT_SEED = 42;
const rngState = new WeakMap<ComputeEngine, { next: () => number }>();

const rngFor = (ce: ComputeEngine): (() => number) => {
  let entry = rngState.get(ce);
  if (entry === undefined) {
    entry = { next: mulberry32(DEFAULT_SEED) };
    rngState.set(ce, entry);
  }
  return entry.next;
};

const uniform01 = (ce: ComputeEngine): number => rngFor(ce)();

/** Reseed this file's own RNG stream. Wired into `SeedRandom` — declaring it fresh if nothing
 *  else has (the common case today), or, once collections' own seeded `RandomInteger` lands,
 *  reseeding alongside whatever that already does (attached in place, same idiom
 *  `wrapOperator` uses) rather than a second, colliding declaration. */
function wireSeedRandom(ce: ComputeEngine): void {
  const reseed = (seed: number) => rngState.set(ce, { next: mulberry32(seed) });
  const definition = ce.lookupDefinition("SeedRandom");
  const operator =
    definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) {
    ce.declare("SeedRandom", {
      signature: "(integer?) -> any",
      evaluate: (ops: readonly BoxedExpression[]) => {
        reseed(ops[0] !== undefined ? (integerAt(ops[0]) ?? DEFAULT_SEED) : DEFAULT_SEED);
        return ce.symbol("Nothing");
      },
    });
    return;
  }
  const native = operator.evaluate;
  operator.evaluate = (ops: readonly BoxedExpression[], options: EvaluateOptions) => {
    reseed(ops[0] !== undefined ? (integerAt(ops[0]) ?? DEFAULT_SEED) : DEFAULT_SEED);
    return native?.(ops, options);
  };
}

const normal01 = (ce: ComputeEngine): number => {
  // Box-Muller.
  const u1 = Math.max(uniform01(ce), Number.EPSILON);
  const u2 = uniform01(ce);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

const uniformSample = (ce: ComputeEngine, min: number, max: number): number =>
  min + (max - min) * uniform01(ce);

const poissonSample = (ce: ComputeEngine, lambda: number): number => {
  // Knuth's algorithm — a standard inverse-transform-flavored method, fine at the (small to
  // moderate) rates a reference example or a statistical check draws.
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= uniform01(ce);
  } while (p > L);
  return k - 1;
};

const binomialSample = (ce: ComputeEngine, n: number, p: number): number => {
  let count = 0;
  for (let i = 0; i < n; i++) if (uniform01(ce) < p) count++;
  return count;
};

/** Marsaglia–Tsang, `shape >= 1`; `shape < 1` boosts via `Gamma(shape+1)` scaled by `U^(1/shape)`
 *  (the standard trick — see Marsaglia & Tsang 2000, §"shape < 1"). */
const gammaSample = (ce: ComputeEngine, shape: number, scale: number): number => {
  if (shape < 1) {
    const boosted = gammaSample(ce, shape + 1, 1);
    return boosted * uniform01(ce) ** (1 / shape) * scale;
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normal01(ce);
      v = (1 + c * x) ** 3;
    } while (v <= 0);
    const u = uniform01(ce);
    if (u < 1 - 0.0331 * x ** 4) return d * v * scale;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
  }
};

const betaSample = (ce: ComputeEngine, a: number, b: number): number => {
  const x = gammaSample(ce, a, 1);
  const y = gammaSample(ce, b, 1);
  return x / (x + y);
};

const binormalSample = (
  ce: ComputeEngine,
  mu1: number,
  mu2: number,
  sigma1: number,
  sigma2: number,
  rho: number,
): [number, number] => {
  const z1 = normal01(ce);
  const z2 = normal01(ce);
  const x1 = mu1 + sigma1 * z1;
  const x2 = mu2 + sigma2 * (rho * z1 + Math.sqrt(1 - rho * rho) * z2);
  return [x1, x2];
};

const numAt = (expr: BoxedExpression): number => expr.N().re;

/** One draw from `dist`, or `undefined` if its shape/kind isn't one this file (or
 *  compute-engine's own Normal/Uniform/Poisson/Binomial params) samples. */
const drawOne = (ce: ComputeEngine, dist: BoxedExpression): BoxedExpression | undefined => {
  const ops = operandsOf(dist);
  switch (dist.operator) {
    case "NormalDistribution": {
      const [mu, sigma] = ops.length === 0 ? [ce.Zero, ce.One] : ops;
      if (mu === undefined || sigma === undefined) return undefined;
      return ce.number(numAt(mu) + numAt(sigma) * normal01(ce));
    }
    case "UniformDistribution": {
      if (ops.length !== 2) return undefined;
      return ce.number(uniformSample(ce, numAt(ops[0]), numAt(ops[1])));
    }
    case "PoissonDistribution": {
      if (ops.length !== 1) return undefined;
      return ce.number(poissonSample(ce, numAt(ops[0])));
    }
    case "BinomialDistribution": {
      if (ops.length !== 2) return undefined;
      return ce.number(binomialSample(ce, numAt(ops[0]), numAt(ops[1])));
    }
    case "BetaDistribution": {
      const params = betaParams(dist);
      if (params === undefined) return undefined;
      return ce.number(betaSample(ce, numAt(params[0]), numAt(params[1])));
    }
    case "GammaDistribution": {
      const params = gammaParams(ce, dist);
      if (params === undefined) return undefined;
      return ce.number(gammaSample(ce, numAt(params[0]), numAt(params[1])));
    }
    case "BinormalDistribution": {
      const params = binormalParams(ce, dist);
      if (params === undefined) return undefined;
      const [x1, x2] = binormalSample(
        ce,
        numAt(params.mu1),
        numAt(params.mu2),
        numAt(params.sigma1),
        numAt(params.sigma2),
        numAt(params.rho),
      );
      return ce.function("List", [ce.number(x1), ce.number(x2)]);
    }
    case "EmpiricalDistribution": {
      const data = empiricalData(dist);
      if (data === undefined || data.length === 0) return undefined;
      const idx = Math.min(data.length - 1, Math.floor(uniform01(ce) * data.length));
      return data[idx];
    }
    default:
      return undefined;
  }
};

function declareRandomVariate(ce: ComputeEngine): void {
  wireSeedRandom(ce);

  ce.declare("RandomVariate", {
    signature: "(any, integer?) -> any",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const dist = ops[0];
      if (dist === undefined || !isDistribution(dist)) return undefined;
      if (ops[1] === undefined) return drawOne(ce, dist);
      const n = integerAt(ops[1]);
      if (n === undefined || n < 0) return undefined;
      const draws: BoxedExpression[] = [];
      for (let i = 0; i < n; i++) {
        const d = drawOne(ce, dist);
        if (d === undefined) return undefined;
        draws.push(d);
      }
      return ce.function("List", draws);
    },
  });
}

// --- constructors for the distribution kinds this file adds ------------------------------------

function declareDistributionConstructors(ce: ComputeEngine): void {
  // Return type `distribution` (not `expression<BetaDistribution>`): compute-engine's own
  // PDF/CDF/Mean/Variance type their first parameter as the nominal `distribution` type, and
  // only the head names it declares natively (Normal/Uniform/Poisson/Binomial/…) are known
  // members of it — an `expression<Head>` for any other head does NOT match, confirmed
  // empirically (`.scratch/probe14.mjs`). Declaring the return type as `distribution` itself
  // is what lets a new distribution head reach PDF/CDF/Mean/Variance at all.
  ce.declare("BetaDistribution", {
    signature: "(real<0..>, real<0..>) -> distribution",
  });

  ce.declare("GammaDistribution", {
    signature: "(real<0..>, real<0..>?) -> distribution",
  });
  // `canonical` isn't one of `ce.declare`'s own options (a held constructor's `evaluate`
  // never runs — same `list-stats.ts` Take/Tabulate gotcha `extendUniformDistribution`
  // above hits), so it's attached in place, right after declaring. Only the one-argument
  // default gets a custom rule — returning `undefined` for every other shape (the
  // two-argument call) hands back to compute-engine's own generic canonicalization instead
  // of re-entering this hook, which is what avoids recursing forever on the very expression
  // this just built.
  {
    const definition = ce.lookupDefinition("GammaDistribution");
    const operator =
      definition !== undefined && "operator" in definition ? definition.operator : undefined;
    if (operator !== undefined) {
      (operator as { canonical?: unknown }).canonical = (ops: readonly BoxedExpression[]) =>
        ops.length === 1 ? ce.function("GammaDistribution", [ops[0], ce.One]) : undefined;
    }
  }

  ce.declare("BinormalDistribution", {
    signature: "(any, any?, any?) -> distribution",
  });

  ce.declare("EmpiricalDistribution", {
    signature: "(list<any>) -> distribution",
  });
}

/** Declare the distribution frontier heads on `ce`: `Distributed`, `RandomVariate`,
 *  `EmpiricalDistribution`, `BetaDistribution`, `GammaDistribution`, `BinormalDistribution`,
 *  `Expectation`, `Probability` — plus extending PDF/CDF/Mean/Variance and (a call-shape fix)
 *  UniformDistribution in place. NormalDistribution/PoissonDistribution/BinomialDistribution
 *  need no changes: compute-engine's native PDF/CDF/Mean/Variance already answer them. */
export function declareDistributions(ce: ComputeEngine): void {
  extendUniformDistribution(ce);
  declareDistributionConstructors(ce);
  extendDistributionStats(ce);
  declareRelations(ce);
  declareRandomVariate(ce);
}
