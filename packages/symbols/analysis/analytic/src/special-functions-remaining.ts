import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, bigRationalAt, operandsOf, symbolNameOf, wrapOperator } from "@enumeratio/boxed";
import type { EvalOptions } from "./box.ts";

/** A concrete +oo operand -- `PositiveInfinity` boxes as an infinite NUMBER in
 * compute-engine 0.128 (its `.symbol` is undefined), not a symbol; matches q-series.ts's
 * own `n.isInfinity && n.re > 0` check for the same constant. */
const isPositiveInfinity = (x: BoxedExpression): boolean =>
  (x as Partial<{ isInfinity: boolean }>).isInfinity === true && x.re > 0;

/** A concrete ImaginaryUnit operand -- also a numeric constant (Complex(0,1)), not a symbol. */
const isImaginaryUnit = (x: BoxedExpression): boolean => x.re === 0 && x.im === 1;

// Lane B-26 (#113 aspirational sweep, special-functions.ts / analytic-special.ts): the
// remaining closed forms and limits that don't need Interval/Around/CenteredInterval
// arithmetic. Every wrapper here is a pre-check layered on top of whatever `evaluate`
// already exists for its head at the time `declareSpecialFunctionsRemaining` runs (the
// very end of `declareAnalytic`), so it composes with closed-forms-113.ts's own wrappers
// rather than replacing them. Each `wrapOperator` call's own `arity` argument filters the
// call before the predicate runs, per #141 -- predicates below don't re-check ops.length.

const finish = (expr: BoxedExpression, options: EvalOptions): BoxedExpression =>
  options.numericApproximation ? expr.N() : expr.evaluate();

export function declareSpecialFunctionsRemaining(ce: ComputeEngine): void {
  // --- Limits at +oo: every one of these heads is monotonically unbounded (or, for
  // DirichletEta/DirichletBeta, tends to 1 as the Dirichlet series' leading n=0 term
  // dominates) as its argument grows, so the limit is the same constant Wolfram's own
  // page states. None of these have a `Limit` machinery behind them; each is a single
  // pinned value at the single symbol PositiveInfinity, not a general limit-taking. ---
  for (const head of ["BarnesG", "LogBarnesG", "LogGamma", "HarmonicNumber"] as const) {
    wrapOperator(
      ce,
      [head, 1],
      (ops) => isPositiveInfinity(ops[0]),
      () => (_ops, options) => finish(ce.symbol("PositiveInfinity"), options),
      1,
    );
  }
  for (const head of ["DirichletEta", "DirichletBeta"] as const) {
    wrapOperator(
      ce,
      [head, 1],
      (ops) => isPositiveInfinity(ops[0]),
      () => (_ops, options) => finish(ce.number(1), options),
      1,
    );
  }
  // H_oo^(r) = zeta(r) for r > 1 (the Basel-sum generalisation); r <= 1 diverges and is
  // left alone (H_oo^(1) is the plain harmonic series above, already oo).
  wrapOperator(
    ce,
    ["HarmonicNumber", 2],
    (ops) => {
      if (!isPositiveInfinity(ops[0])) return false;
      const r = ops[1].re;
      return Number.isFinite(r) && r > 1;
    },
    () => (ops, options) => finish(ce.function("Zeta", [ops[1]]), options),
    2,
  );

  // --- zeta(s, 1/2) = (2^s - 1) zeta(s), reached through the *Zeta* head with a second
  // argument (Wolfram's Zeta[s, 1/2]) rather than HurwitzZeta directly. closed-forms-113.ts
  // already carries this identity for the HurwitzZeta head; Zeta(s, a>0) computes its
  // answer by calling the underlying `evaluateHurwitz` function directly rather than
  // through HurwitzZeta's own (wrapped) operator, so that wrapper never sees a `Zeta`
  // call and this needs its own attachment on the `Zeta` operator. Gated on a concrete
  // numeric s (not a bare symbol) so the separate symbolic-s identity is untouched. ---
  wrapOperator(
    ce,
    ["Zeta", 2],
    (ops) => {
      const a = bigRationalAt(ops[1]);
      return symbolNameOf(ops[0]) === undefined && a !== undefined && a[0] === 1n && a[1] === 2n;
    },
    () => (ops, options) =>
      finish(
        ce.function("Multiply", [
          ce.function("Subtract", [ce.function("Power", [2, ops[0]]), 1]),
          ce.function("Zeta", [ops[0]]),
        ]),
        options,
      ),
    2,
  );

  // --- LerchPhi(z, 1, 1) at z = 1/2: Phi(z,1,1) = -Ln(1-z)/z generally (sum z^n/(n+1) =
  // -ln(1-z)/z), pinned here at the one rational value the reference asks for since
  // compute-engine does not simplify Ln(1/2) into -Ln(2) on its own (the general formula
  // would answer -2*Ln(1/2), true but not the form Wolfram's FunctionExpand gives). ---
  wrapOperator(
    ce,
    ["LerchPhi", 3],
    (ops) => {
      const z = bigRationalAt(ops[0]);
      return (
        z !== undefined && z[0] === 1n && z[1] === 2n && bigIntegerAt(ops[1]) === 1n && bigIntegerAt(ops[2]) === 1n
      );
    },
    () => (_ops, options) => finish(ce.function("Multiply", [2, ce.function("Ln", [2])]), options),
    3,
  );

  // --- LerchPhi(-1, s, 1/2) = 2^s * DirichletBeta(s): at a = 1/2, (n+1/2)^-s = 2^s
  // (2n+1)^-s, so Phi(-1,s,1/2) = 2^s * sum (-1)^n (2n+1)^-s = 2^s * beta(s) exactly
  // (DirichletBeta's own defining series). General in s; at s=2 DirichletBeta(2) is
  // already Catalan's constant (dirichlet.ts), so this closes to 4*Catalan without any
  // extra step. ---
  wrapOperator(
    ce,
    ["LerchPhi", 3],
    (ops) => {
      const z = bigIntegerAt(ops[0]);
      const a = bigRationalAt(ops[2]);
      return z === -1n && a !== undefined && a[0] === 1n && a[1] === 2n;
    },
    () => (ops, options) =>
      finish(
        ce.function("Multiply", [ce.function("Power", [2, ops[1]]), ce.function("DirichletBeta", [ops[1]])]),
        options,
      ),
    3,
  );

  // --- PolyLog(n, -1) = (2^(1-n) - 1) zeta(n) for a symbolic order n: Li_n(-1) =
  // -DirichletEta(n) = -(1 - 2^(1-n)) zeta(n), the standard identity behind
  // DirichletEta's own FunctionExpand — valid for any n, so no restriction beyond n
  // being a free symbol (a concrete numeric n already has its own reductions). ---
  wrapOperator(
    ce,
    ["PolyLog", 2],
    (ops) => symbolNameOf(ops[0]) !== undefined && bigIntegerAt(ops[1]) === -1n,
    () => (ops, options) => {
      const n = ops[0];
      return finish(
        ce.function("Multiply", [
          ce.function("Add", [ce.function("Power", [2, ce.function("Add", [ce.function("Negate", [n]), 1])]), -1]),
          ce.function("Zeta", [n]),
        ]),
        options,
      );
    },
    2,
  );

  // --- PolyLog(-2, z) = z(1+z)/(1-z)^3: the standard negative-integer-order closed
  // form (only orders -1, 0, 1 reduce natively today). Valid for any z != 1. ---
  wrapOperator(
    ce,
    ["PolyLog", 2],
    (ops) => bigIntegerAt(ops[0]) === -2n,
    () => (ops, options) => {
      const z = ops[1];
      return finish(
        ce.function("Divide", [
          ce.function("Multiply", [z, ce.function("Add", [z, 1])]),
          ce.function("Power", [ce.function("Add", [ce.function("Negate", [z]), 1]), 3]),
        ]),
        options,
      );
    },
    2,
  );

  // --- Erf(i) = i * Erfi(1): the standard erf/erfi rotation erf(iy) = i*erfi(y),
  // pinned at y = 1 (the only value the reference needs; a general symbolic-argument
  // rotation is a broader change than this lane's scope). ---
  wrapOperator(
    ce,
    ["Erf", 1],
    (ops) => isImaginaryUnit(ops[0]),
    () => (_ops, options) => finish(ce.function("Multiply", ["ImaginaryUnit", ce.function("Erfi", [1])]), options),
    1,
  );

  // --- Erfc(-x) = 2 - Erfc(x): erfc is odd about erfc(0) = 1 (erfc(-x) = 1 + erf(x) =
  // 2 - erfc(x)), applied symbolically. Gated on a structural Negate (a symbolic -x),
  // not a negative numeric literal, which the native numeric kernel already handles. ---
  wrapOperator(
    ce,
    ["Erfc", 1],
    (ops) => ops[0].operator === "Negate",
    () => (ops, options) => {
      const x = operandsOf(ops[0])[0];
      return finish(ce.function("Subtract", [2, ce.function("Erfc", [x])]), options);
    },
    1,
  );

  // --- BetaRegularized(x, a, b) at a = 1 or b = 1: the standard finite-arity closed
  // forms I_x(a,1) = x^a and I_x(1,b) = 1-(1-x)^b (I_x(1,1) = x falls out of either).
  // Symbolic x, a, b all allowed -- these are algebraic identities, not numeric fits.
  // `plainX` excludes an Interval/CenteredInterval/Around x: those heads are another
  // lane's item, and x^a / 1-(1-x)^b would otherwise silently do real arithmetic on
  // one and read as an (accidental, wrong-owner) interval-arithmetic result. ---
  const plainX = (x: BoxedExpression): boolean =>
    x.operator !== "Interval" && x.operator !== "CenteredInterval" && x.operator !== "Around";
  wrapOperator(
    ce,
    ["BetaRegularized", 3],
    (ops) => plainX(ops[0]) && bigIntegerAt(ops[1]) === 1n && bigIntegerAt(ops[2]) === 1n,
    () => (ops, options) => finish(ops[0], options),
    3,
  );
  wrapOperator(
    ce,
    ["BetaRegularized", 3],
    (ops) => plainX(ops[0]) && bigIntegerAt(ops[2]) === 1n && bigIntegerAt(ops[1]) !== 1n,
    () => (ops, options) => finish(ce.function("Power", [ops[0], ops[1]]), options),
    3,
  );
  wrapOperator(
    ce,
    ["BetaRegularized", 3],
    (ops) => plainX(ops[0]) && bigIntegerAt(ops[1]) === 1n && bigIntegerAt(ops[2]) !== 1n,
    () => (ops, options) =>
      finish(
        ce.function("Subtract", [1, ce.function("Power", [ce.function("Subtract", [1, ops[0]]), ops[2]])]),
        options,
      ),
    3,
  );

  // --- Digamma / trigamma at 1/2, the last case of Gauss's digamma theorem this
  // reference needs beyond the 1/3 and 1/4 already in closed-forms-113.ts:
  // psi(1/2) = -gamma - 2 ln 2 (the sum term in the theorem is empty at q = 2, and
  // cot(pi/2) = 0, so this is the plain base case, not a special extra identity), and
  // psi'(1/2) = pi^2/2 from the trigamma reflection psi'(x) + psi'(1-x) = pi^2/sin^2(pi x)
  // at x = 1/2 (2 psi'(1/2) = pi^2). Both are layered on top of the routing that
  // already sends PolyGamma(0, z) through Digamma(z) (closed-forms-113.ts), so
  // PolyGamma(0, 1/2) and StieltjesGamma(0, 1/2) (which reduces to -PolyGamma(0, a))
  // close for free once Digamma(1/2) itself does. ---
  wrapOperator(
    ce,
    ["Digamma", 1],
    (ops) => {
      const q = bigRationalAt(ops[0]);
      return q !== undefined && q[0] === 1n && q[1] === 2n;
    },
    () => (_ops, options) =>
      finish(
        ce.function("Subtract", [
          ce.function("Negate", ["EulerGamma"]),
          ce.function("Multiply", [2, ce.function("Ln", [2])]),
        ]),
        options,
      ),
    1,
  );
  wrapOperator(
    ce,
    ["PolyGamma", 2],
    (ops) => {
      const q = bigRationalAt(ops[1]);
      return bigIntegerAt(ops[0]) === 1n && q !== undefined && q[0] === 1n && q[1] === 2n;
    },
    () => (_ops, options) =>
      finish(ce.function("Multiply", [ce.function("Rational", [1, 2]), ce.function("Power", ["Pi", 2])]), options),
    2,
  );

  // --- PolyGamma(m, n) at a positive integer order m and integer argument n:
  // psi^(m)(n) = (-1)^(m+1) m! (zeta(m+1) - sum_{k=1}^{n-1} k^-(m+1)), from iterating
  // the recurrence psi^(m)(z+1) = psi^(m)(z) + (-1)^m m! z^-(m+1) down from
  // psi^(m)(1) = (-1)^(m+1) m! zeta(m+1) -- the same shape as Digamma's own
  // exact-integer rule in widened.ts (m = 0: H_{n-1} - gamma). NOT applied generally,
  // though: special-functions.ts documents (under "Possible issues") PolyGamma(1, 1)
  // and PolyGamma(1, [1, 2]) staying deliberately unevaluated at small n, unlike
  // Wolfram's own bare kernel (wolframscript-checked: PolyGamma[1,1] there IS Pi^2/6)
  // -- a documented CE/Wolfram divergence this lane doesn't touch. Gated to n > 2 so
  // this only closes larger cases like PolyGamma(3, 5), leaving that divergence intact. ---
  wrapOperator(
    ce,
    ["PolyGamma", 2],
    (ops) => {
      const m = bigIntegerAt(ops[0]);
      const n = bigIntegerAt(ops[1]);
      return m !== undefined && m >= 1n && m <= 64n && n !== undefined && n > 2n && n <= 200n;
    },
    () => (ops, options) => {
      const m = bigIntegerAt(ops[0])!;
      const n = bigIntegerAt(ops[1])!;
      const mFactorial = ce.function("Factorial", [ce.number(m)]);
      const sign = m % 2n === 0n ? -1 : 1;
      const terms: BoxedExpression[] = [ce.function("Zeta", [ce.number(m + 1n)])];
      for (let k = 1n; k < n; k++) {
        terms.push(ce.function("Negate", [ce.function("Power", [ce.number(k), ce.number(-(m + 1n))])]));
      }
      const bracket = terms.length === 1 ? terms[0] : ce.function("Add", terms);
      return finish(ce.function("Multiply", [sign, mFactorial, bracket]), options);
    },
    2,
  );
}
