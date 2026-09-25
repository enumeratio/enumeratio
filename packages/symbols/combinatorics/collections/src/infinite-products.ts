import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, symbolNameOf } from "@enumeratio/boxed";
import { dependsOn, limitsOf } from "./products.ts";

// Closed forms for ∏_{k=k0}^∞ P(k)/Q(k), a rational function of the index whose
// numerator and denominator have equal degree and equal leading coefficient (so the
// terms tend to 1). Compute-engine's own `Product` already answers the two cases its
// evaluate happens to reduce -- Σ(1/k²) and the telescoping Σ(1-1/k²) -- natively; this
// extends the SAME evaluate slot for the rational-function shape it leaves unevaluated,
// falling through to whatever compute-engine already produced everywhere else.
//
// Method (standard, see e.g. Whittaker & Watson §12.13): factor P(k) = c·∏(k−aᵢ) and
// Q(k) = c·∏(k−bⱼ) over ℂ (equal leading coefficient c cancels). The product converges
// iff Σaᵢ = Σbⱼ (otherwise the terms decay like a nonzero constant power of 1/k and the
// log-sum diverges). Then, via the Pochhammer identity ∏_{k=k0}^{N}(k−a) =
// Γ(N+1−a)/Γ(k0−a) and Σaᵢ = Σbⱼ cancelling the N-dependent tail as N → ∞:
//
//   ∏_{k=k0}^∞ P(k)/Q(k) = ∏ⱼ Γ(k0−bⱼ) / ∏ᵢ Γ(k0−aᵢ)
//
// Root-finding is restricted to the shape this repo's `Factor` already gives exactly:
// linear factors (rational roots) and irreducible quadratics (solved by hand, giving a
// Gaussian-integer or quadratic-surd root) -- a degree-3-or-higher irreducible factor
// declines. Each Γ(k0−root) then resolves one of two ways: a root with k0−root a
// positive integer closes on its own, straight to a factorial (any real integer root,
// regardless of whether the polynomial is even in the index); anything else must pair
// off with its negation within the same polynomial (P or Q) -- the shape the reflection
// step actually closes -- reducing Γ(k0−r)Γ(k0+r) via Pochhammer recursion down to
// Γ(1±r), then π/sin(π·(k0−r)) via reflection. An unpaired leftover root, or a root
// landing on a pole, declines rather than guessing.

/** Whether `expr` evaluates to the exact complex value 0. */
function isZero(expr: BoxedExpression): boolean {
  const v = expr.evaluate();
  return v.re === 0 && v.im === 0;
}

/** Whether `a` and `b` evaluate to the same exact value. */
function sameValue(ce: ComputeEngine, a: BoxedExpression, b: BoxedExpression): boolean {
  return symbolNameOf(ce.function("Equal", [a, b]).evaluate()) === "True";
}

/** `expr`, flattened one level through `Multiply` (recursively), as a list of factors. */
function multiplicands(expr: BoxedExpression): BoxedExpression[] {
  if (expr.operator !== "Multiply") return [expr];
  return operandsOf(expr).flatMap(multiplicands);
}

/** `term`'s degree and coefficient as a monomial in `sym` -- `undefined` when `term`
 * isn't one (`sym` under a non-integer power, inside a quotient, …). */
function monomial(
  ce: ComputeEngine,
  term: BoxedExpression,
  sym: string,
): { degree: number; coefficient: BoxedExpression } | undefined {
  if (symbolNameOf(term) === sym) return { degree: 1, coefficient: ce.One };
  if (term.operator === "Negate") {
    const inner = monomial(ce, operandsOf(term)[0]!, sym);
    return inner === undefined
      ? undefined
      : {
          degree: inner.degree,
          coefficient: ce.function("Negate", [inner.coefficient]).evaluate(),
        };
  }
  if (term.operator === "Power") {
    const [base, exponent] = operandsOf(term);
    if (symbolNameOf(base!) === sym) {
      const e = integerAt(exponent!.evaluate());
      return e === undefined || e < 0 ? undefined : { degree: e, coefficient: ce.One };
    }
    return dependsOn(term, sym) ? undefined : { degree: 0, coefficient: term };
  }
  if (term.operator === "Multiply") {
    let degree = 0;
    let coefficient = ce.One;
    for (const factor of operandsOf(term)) {
      const m = monomial(ce, factor, sym);
      if (m === undefined) return undefined;
      degree += m.degree;
      coefficient = ce.function("Multiply", [coefficient, m.coefficient]).evaluate();
    }
    return { degree, coefficient };
  }
  return dependsOn(term, sym) ? undefined : { degree: 0, coefficient: term };
}

/** `expr`'s coefficients as a polynomial in `sym`, indexed by degree up to `maxDegree` --
 * `undefined` when `expr` isn't a polynomial in `sym` of degree ≤ `maxDegree` this way. */
function polynomialCoefficients(
  ce: ComputeEngine,
  expr: BoxedExpression,
  sym: string,
  maxDegree: number,
): BoxedExpression[] | undefined {
  const expanded = ce.function("Expand", [expr]).evaluate();
  const terms = expanded.operator === "Add" ? operandsOf(expanded) : [expanded];
  const coefficients: BoxedExpression[] = Array.from({ length: maxDegree + 1 }, () => ce.Zero);
  for (const term of terms) {
    const m = monomial(ce, term, sym);
    if (m === undefined || m.degree > maxDegree) return undefined;
    coefficients[m.degree] = ce
      .function("Add", [coefficients[m.degree]!, m.coefficient])
      .evaluate();
  }
  return coefficients;
}

/** A polynomial's leading coefficient and roots, from `ce`'s own `Factor` -- every
 * factor must be linear or an irreducible quadratic (solved directly); anything else,
 * including a degree ≥ 3 irreducible factor, declines. */
function rootsOf(
  ce: ComputeEngine,
  poly: BoxedExpression,
  sym: string,
): { leading: BoxedExpression; roots: BoxedExpression[] } | undefined {
  const expanded = ce.function("Expand", [poly]).evaluate();
  const factored = ce.function("Factor", [expanded]).evaluate();
  let leading = ce.One;
  const roots: BoxedExpression[] = [];
  for (const factor of multiplicands(factored)) {
    if (!dependsOn(factor, sym)) {
      leading = ce.function("Multiply", [leading, factor]).evaluate();
      continue;
    }
    // A bare power of the index (c·k^n, degree n unbounded): root 0, n times over.
    if (factor.operator === "Power") {
      const [base, exponent] = operandsOf(factor);
      const e = symbolNameOf(base!) === sym ? integerAt(exponent!.evaluate()) : undefined;
      if (e === undefined || e < 1) return undefined;
      for (let i = 0; i < e; i++) roots.push(ce.Zero);
      continue;
    }
    const coefficients = polynomialCoefficients(ce, factor, sym, 2);
    if (coefficients === undefined) return undefined;
    let degree = coefficients.length - 1;
    while (degree >= 0 && isZero(coefficients[degree]!)) degree--;
    if (degree <= 0) return undefined; // shouldn't happen once `dependsOn` gated above
    leading = ce.function("Multiply", [leading, coefficients[degree]!]).evaluate();
    if (degree === 1) {
      const [c0, c1] = coefficients;
      roots.push(ce.function("Divide", [ce.function("Negate", [c0!]), c1!]).evaluate());
    } else {
      // degree === 2: the quadratic formula, exact for a rational, Gaussian, or
      // quadratic-surd discriminant -- `Sqrt` leaves anything else unevaluated, which
      // the pairing step below then declines rather than treat as closed-form.
      const [c0, c1, c2] = coefficients;
      const discriminant = ce
        .function("Subtract", [
          ce.function("Power", [c1!, 2]),
          ce.function("Multiply", [4, c2!, c0!]),
        ])
        .evaluate();
      const root = ce.function("Sqrt", [discriminant]).evaluate();
      const twiceA = ce.function("Multiply", [2, c2!]).evaluate();
      roots.push(
        ce
          .function("Divide", [ce.function("Add", [ce.function("Negate", [c1!]), root]), twiceA])
          .evaluate(),
      );
      roots.push(
        ce
          .function("Divide", [
            ce.function("Subtract", [ce.function("Negate", [c1!]), root]),
            twiceA,
          ])
          .evaluate(),
      );
    }
  }
  return { leading, roots };
}

/** `roots` grouped into `{r, −r}` pairs (one representative per pair) -- `undefined`
 * when some root has no partner, the only shape the Gamma-ratio step below closes. */
function pairByNegation(
  ce: ComputeEngine,
  roots: readonly BoxedExpression[],
): BoxedExpression[] | undefined {
  const remaining = [...roots];
  const representatives: BoxedExpression[] = [];
  while (remaining.length > 0) {
    const r = remaining.shift()!;
    const negated = ce.function("Negate", [r]).evaluate();
    const partnerIndex = remaining.findIndex((candidate) => sameValue(ce, candidate, negated));
    if (partnerIndex === -1) return undefined;
    remaining.splice(partnerIndex, 1);
    representatives.push(r);
  }
  return representatives;
}

/** sin(π·x), cos(π·x), sinh(π·x) or cosh(π·x) for real `x`, keeping the trig call's own
 * argument non-negative (parity applied by hand) -- compute-engine doesn't fold e.g.
 * `Sinh(-Pi)` back to `-Sinh(Pi)` once it sits inside a larger sum, so built the naive
 * way the final answer stays an unsimplified tangle of negated hyperbolics. */
function signedPiTrig(
  ce: ComputeEngine,
  kind: "Sin" | "Cos" | "Sinh" | "Cosh",
  x: BoxedExpression,
): BoxedExpression {
  if (isZero(x)) return kind === "Cos" || kind === "Cosh" ? ce.One : ce.Zero;
  const negative = x.N().re < 0;
  const magnitude = negative ? ce.function("Negate", [x]).evaluate() : x;
  const odd = kind === "Sin" || kind === "Sinh";
  const value = ce
    .function(kind, [ce.function("Multiply", [ce.symbol("Pi"), magnitude])])
    .evaluate();
  return negative && odd ? ce.function("Negate", [value]).evaluate() : value;
}

/** sin(π·u) for a general complex `u = p + qi`, via the addition formula -- so a
 * purely (or partly) imaginary `u` comes back as a closed hyperbolic term instead of an
 * un-simplified `Sin` of a complex argument, which compute-engine leaves alone. */
function sinOfPiTimes(ce: ComputeEngine, u: BoxedExpression): BoxedExpression {
  const p = ce.function("Re", [u]).evaluate();
  const q = ce.function("Im", [u]).evaluate();
  const real = ce
    .function("Multiply", [signedPiTrig(ce, "Sin", p), signedPiTrig(ce, "Cosh", q)])
    .evaluate();
  const imaginary = ce
    .function("Multiply", [signedPiTrig(ce, "Cos", p), signedPiTrig(ce, "Sinh", q)])
    .evaluate();
  return ce
    .function("Add", [real, ce.function("Multiply", [ce.I, imaginary]).evaluate()])
    .evaluate();
}

/** Γ(k0−r1)·Γ(k0−r2) in closed form, for `k0` a positive integer and `{r1, r2}` a
 * `{r, −r}` pair whose Gamma arguments are NOT individually integers (those are
 * resolved directly by `gammaProductOfRoots`, below, without pairing) -- `undefined`
 * when the reflection step's `Sqrt`/`Sin` left a discriminant or angle unresolved. */
function gammaReflectedPair(
  ce: ComputeEngine,
  k0: number,
  r: BoxedExpression,
): BoxedExpression | undefined {
  const u = ce.function("Subtract", [k0, r]).evaluate();
  // Γ(k0+r) = Γ(1−u + (2k0−1))·… -- recursion down to Γ(1−u), then reflection:
  // Γ(1−u) = Γ(k0+r)/∏_{t=1}^{2k0−1}(t−u), and Γ(u)Γ(1−u) = π/sin(πu), so
  // Γ(u)Γ(k0+r) = Γ(u)Γ(1−u)·∏_{t=1}^{2k0−1}(t−u) = [π/sin(πu)]·∏_{t=1}^{2k0−1}(t−u).
  let prefactor = ce.One;
  for (let t = 1; t <= 2 * k0 - 1; t++) {
    prefactor = ce.function("Multiply", [prefactor, ce.function("Subtract", [t, u])]).evaluate();
  }
  const sine = sinOfPiTimes(ce, u);
  if (isZero(sine)) return undefined; // u landed on a pole this decomposition didn't catch
  const reflection = ce.function("Divide", [ce.symbol("Pi"), sine]).evaluate();
  return ce.function("Multiply", [prefactor, reflection]).evaluate();
}

/** ∏ᵢ Γ(k0−rootᵢ) in closed form. A root whose Gamma argument `k0−root` is itself a
 * positive integer resolves on its own, straight to a factorial -- no pairing needed,
 * so this covers any polynomial's real integer roots regardless of shape (they don't
 * have to come in `{r, −r}` pairs). Whatever is left over must pair off by negation
 * (the shape `gammaReflectedPair`'s reflection step closes); `undefined` on a pole, an
 * unpaired leftover root, or a reflection `gammaReflectedPair` can't resolve. */
function gammaProductOfRoots(
  ce: ComputeEngine,
  k0: number,
  roots: readonly BoxedExpression[],
): BoxedExpression | undefined {
  let product = ce.One;
  const remaining: BoxedExpression[] = [];
  for (const root of roots) {
    const argument = integerAt(ce.function("Subtract", [k0, root]).evaluate());
    if (argument === undefined) {
      remaining.push(root);
      continue;
    }
    if (argument < 1) return undefined; // a pole in [k0, ∞)
    product = ce
      .function("Multiply", [product, ce.function("Factorial", [argument - 1])])
      .evaluate();
  }
  const pairs = pairByNegation(ce, remaining);
  if (pairs === undefined) return undefined;
  for (const r of pairs) {
    const g = gammaReflectedPair(ce, k0, r);
    if (g === undefined) return undefined;
    product = ce.function("Multiply", [product, g]).evaluate();
  }
  return product;
}

/** The closed form of `∏_{k=lo}^∞ body(k)`, for `body` a rational function of `idxName`
 * -- `undefined` when the shape, roots, convergence check, or pairing don't work out
 * (see the module comment); the caller falls back to whatever it already had. */
function closedFormInfiniteProduct(
  ce: ComputeEngine,
  body: BoxedExpression,
  idxName: string,
  lo: BoxedExpression,
): BoxedExpression | undefined {
  const k0 = integerAt(lo.evaluate());
  if (k0 === undefined || k0 < 1) return undefined;

  const together = ce.function("Together", [body]).evaluate();
  const [numerator, denominator] =
    together.operator === "Divide" ? operandsOf(together) : [together, ce.One];

  const numeratorRoots = rootsOf(ce, numerator!, idxName);
  const denominatorRoots = rootsOf(ce, denominator!, idxName);
  if (numeratorRoots === undefined || denominatorRoots === undefined) return undefined;
  if (numeratorRoots.roots.length !== denominatorRoots.roots.length) return undefined;
  if (!sameValue(ce, numeratorRoots.leading, denominatorRoots.leading)) return undefined;

  const numeratorSum = ce
    .function("Add", numeratorRoots.roots.length > 0 ? numeratorRoots.roots : [ce.Zero])
    .evaluate();
  const denominatorSum = ce
    .function("Add", denominatorRoots.roots.length > 0 ? denominatorRoots.roots : [ce.Zero])
    .evaluate();
  if (!sameValue(ce, numeratorSum, denominatorSum)) return undefined; // wouldn't converge

  // ∏ⱼ Γ(k0−bⱼ) / ∏ᵢ Γ(k0−aᵢ): P's roots (aᵢ) land in the denominator, Q's (bⱼ) in the
  // numerator -- see the module comment's derivation.
  const finalNumerator = gammaProductOfRoots(ce, k0, denominatorRoots.roots);
  const finalDenominator = gammaProductOfRoots(ce, k0, numeratorRoots.roots);
  if (finalNumerator === undefined || finalDenominator === undefined) return undefined;
  return ce.function("Divide", [finalNumerator, finalDenominator]).evaluate();
}

export function declareInfiniteProducts(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Product");
  const operator =
    definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) return;
  const native = operator.evaluate;
  operator.evaluate = (ops, options) => {
    const result = native?.(ops, options);
    // Compute-engine's own evaluate already answers a `PositiveInfinity`-bound Product
    // whenever it can (e.g. Σ1/k² and the telescoping Σ(1−1/k²)); only reach for the
    // Gamma-ratio method below when it leaves the call unanswered -- either `undefined`
    // (its usual "no change" signal) or an unevaluated `Product` handed back as-is.
    if (result !== undefined && result.operator !== "Product") return result;
    if (ops.length !== 2) return result;
    const limits = limitsOf(ops[1]!);
    if (limits === undefined) return result;
    if (limits.hi.re !== Infinity || limits.hi.im !== 0) return result;
    if (limits.step !== undefined && integerAt(limits.step.evaluate()) !== 1) return result;
    const closedForm = closedFormInfiniteProduct(ce, ops[0]!, limits.index, limits.lo);
    return closedForm ?? result;
  };
}
