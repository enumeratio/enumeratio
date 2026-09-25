import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, symbolNameOf, wrapOperator } from "@enumeratio/boxed";

// General symbolic rules for `Product`, layered on top of compute-engine's native
// evaluate (which already handles a literal-bound product by unrolling it term by
// term, and recognises Product(i, i=1..n) as Factorial(n)). Everything here answers
// a case the native evaluate leaves unreduced: a symbolic bound where the body is a
// power of the index (a factorial power), a power WITH the index in the exponent
// (folds into a single power via a closed-form sum of the exponent), or more than one
// `Limits` clause (a nested product, folded inner-first into a single-clause Product
// at each level so the rules above -- and the native unroller, when a bound turns out
// concrete once the outer index substitutes in -- can reach every level in turn).

/** Whether `expr` contains the free symbol `name` anywhere in its tree. */
function dependsOn(expr: BoxedExpression, name: string): boolean {
  if (symbolNameOf(expr) === name) return true;
  const ops = operandsOf(expr);
  return ops.some((op) => dependsOn(op, name));
}

/**
 * The total exponent of `idxName` in `term`, for a `term` that is a MONOMIAL in
 * `idxName` (a product of `idxName`-powers and factors that don't mention it at
 * all) -- `undefined` when `term` isn't of that shape (`idxName` inside a `Sin`, a
 * non-integer or index-dependent exponent, a quotient, …), which the caller reads
 * as "give up, this Product isn't one of ours to answer."
 */
function monomialDegree(term: BoxedExpression, idxName: string): number | undefined {
  if (symbolNameOf(term) === idxName) return 1;
  if (term.operator === "Negate") return monomialDegree(operandsOf(term)[0]!, idxName);
  if (term.operator === "Power") {
    const [base, exponent] = operandsOf(term);
    if (symbolNameOf(base!) === idxName) {
      const e = integerAt(exponent);
      return e !== undefined && e >= 0 ? e : undefined;
    }
    return dependsOn(term, idxName) ? undefined : 0;
  }
  if (term.operator === "Multiply") {
    let total = 0;
    for (const factor of operandsOf(term)) {
      const d = monomialDegree(factor, idxName);
      if (d === undefined) return undefined;
      total += d;
    }
    return total;
  }
  return dependsOn(term, idxName) ? undefined : 0;
}

/** Bernoulli-number Faulhaber formula: Σ_{k=1}^{N} k^d, exact for any integer d ≥ 0. */
function faulhaberSum(ce: ComputeEngine, N: BoxedExpression, d: number): BoxedExpression {
  const terms: BoxedExpression[] = [];
  for (let j = 0; j <= d; j++) {
    const binomial = ce.function("Binomial", [d + 1, j]);
    const bernoulli = ce.function("BernoulliB", [j]);
    // The engine's BernoulliB uses the B_1 = -1/2 convention; the classic closed form
    // below expects B_1 = +1/2, so an odd j flips sign to convert between them.
    const sign = j % 2 === 0 ? 1 : -1;
    const power = ce.function("Power", [N, d + 1 - j]);
    terms.push(ce.function("Multiply", [binomial, ce.number(sign), bernoulli, power]));
  }
  return ce.function("Divide", [ce.function("Add", terms), ce.number(d + 1)]).evaluate();
}

/** Σ_{k=lo}^{hi} k^d = faulhaberSum(hi, d) − faulhaberSum(lo − 1, d). */
function polynomialPowerSum(
  ce: ComputeEngine,
  lo: BoxedExpression,
  hi: BoxedExpression,
  d: number,
): BoxedExpression {
  const upper = faulhaberSum(ce, hi, d);
  const lower = faulhaberSum(ce, ce.function("Subtract", [lo, 1]).evaluate(), d);
  return ce.function("Subtract", [upper, lower]).evaluate();
}

/**
 * `Factor`'s output can leave a repeated factor spelled out as a literal product
 * (`(p+1)*(p+1)`) rather than folded into a power -- combine same-shaped adjacent
 * factors of a top-level `Multiply` into a single `Power` so `p*(p+1)*(p+1)` reads as
 * `p*(p+1)^2`.
 */
function combineRepeatedFactors(ce: ComputeEngine, expr: BoxedExpression): BoxedExpression {
  if (expr.operator !== "Multiply") return expr;
  const groups = new Map<string, { factor: BoxedExpression; count: number }>();
  const order: string[] = [];
  for (const factor of operandsOf(expr)) {
    const key = JSON.stringify(factor.json);
    const existing = groups.get(key);
    if (existing !== undefined) existing.count++;
    else {
      groups.set(key, { factor, count: 1 });
      order.push(key);
    }
  }
  const factors = order.map((key) => {
    const { factor, count } = groups.get(key)!;
    return count === 1 ? factor : ce.function("Power", [factor, count]);
  });
  return ce.function("Multiply", factors).evaluate();
}

/**
 * `Σ f(k)`, factored into as compact a closed form as `Factor` + power-combining gives --
 * except when `sum` still mentions the bare symbol `i`, which compute-engine's `Factor`
 * silently folds into the imaginary unit (`i * i` comes back as the complex number -1,
 * not the symbol squared). That only happens on the way OUT of an inner reduction of a
 * nested product whose outer index is itself named `i` -- the outer level's own closed
 * form, over the OUTER index, never mentions the inner one any more by the time it gets
 * here, so it still gets factored.
 */
function closedForm(ce: ComputeEngine, sum: BoxedExpression): BoxedExpression {
  if (dependsOn(sum, "i")) return sum;
  const factored = ce.function("Factor", [sum]).evaluate();
  return combineRepeatedFactors(ce, factored);
}

/**
 * The closed form of Σ_{k=lo}^{hi} expr(k), for `expr` a polynomial in `idxName` --
 * expanded into monomials, each summed via `polynomialPowerSum`. `undefined` when
 * `expr` isn't a polynomial in `idxName` this way (see `monomialDegree`).
 */
function sumOverIndex(
  ce: ComputeEngine,
  expr: BoxedExpression,
  idxName: string,
  lo: BoxedExpression,
  hi: BoxedExpression,
): BoxedExpression | undefined {
  const expanded = ce.function("Expand", [expr]).evaluate();
  const terms = expanded.operator === "Add" ? operandsOf(expanded) : [expanded];
  const contributions: BoxedExpression[] = [];
  for (const term of terms) {
    const d = monomialDegree(term, idxName);
    if (d === undefined) return undefined;
    const coefficient =
      d === 0
        ? term
        : ce.function("Divide", [term, ce.function("Power", [ce.symbol(idxName), d])]).evaluate();
    if (dependsOn(coefficient, idxName)) return undefined;
    contributions.push(ce.function("Multiply", [coefficient, polynomialPowerSum(ce, lo, hi, d)]));
  }
  return closedForm(ce, ce.function("Add", contributions).evaluate());
}

/** A single `Limits(index, lo, hi[, step])` clause, decoded. */
interface Limits {
  readonly index: string;
  readonly lo: BoxedExpression;
  readonly hi: BoxedExpression;
  readonly step: BoxedExpression | undefined;
}

function limitsOf(expr: BoxedExpression): Limits | undefined {
  if (expr.operator !== "Limits" && expr.operator !== "Tuple") return undefined;
  const ops = operandsOf(expr);
  const index = ops[0] === undefined ? undefined : symbolNameOf(ops[0]);
  if (index === undefined || ops[1] === undefined || ops[2] === undefined) return undefined;
  return { index, lo: ops[1], hi: ops[2], step: ops[3] };
}

export function declareProducts(ce: ComputeEngine): void {
  // Nested products -- more than one Limits clause -- fold right, innermost first:
  // Product(body, L1, L2, …, Lk) becomes Product(Product(…Product(body, Lk)…, L2), L1).
  // Evaluating that lets a concrete outer index substitute into the inner Product's own
  // (possibly index-dependent) bound before that inner Product tries to reduce, so a
  // triangular product with a literal outer bound unrolls exactly the way compute-engine
  // already unrolls a single-clause literal-bound Product.
  wrapOperator(
    ce,
    ["Product", "body", ["Tuple", "i", 1, "n"], ["Tuple", "j", 1, "i"]],
    (ops) => ops.length > 2,
    () => (ops) => {
      const [body, ...limits] = ops;
      let nested = body!;
      for (let k = limits.length - 1; k >= 0; k--)
        nested = ce.function("Product", [nested, limits[k]!]);
      return nested.evaluate();
    },
  );

  wrapOperator(
    ce,
    ["Product", ["Power", "i", 2], ["Tuple", "i", 1, "n"]],
    (ops) => {
      if (ops.length !== 2 || ops[1]!.operator !== "Limits") return false;
      const body = ops[0]!;
      if (body.operator !== "Power") return false;
      const limits = limitsOf(ops[1]!)!;
      const [base, exponent] = operandsOf(body);
      // Index as the exponent's base (i^m, m free of the index): a factorial power.
      // Index as the base of the outer power isn't this rule's business when the
      // exponent ALSO depends on the index (i^i) -- leave that unevaluated.
      const baseIsIndex =
        symbolNameOf(base!) === limits.index && !dependsOn(exponent!, limits.index);
      const exponentDependsOnIndex =
        dependsOn(exponent!, limits.index) && !dependsOn(base!, limits.index);
      return baseIsIndex || exponentDependsOnIndex;
    },
    () => (ops) => {
      const limits = limitsOf(ops[1]!)!;
      if (limits.step !== undefined && integerAt(limits.step) !== 1) return undefined;
      const body = ops[0]!;
      const [base, exponent] = operandsOf(body);

      // i^m, m free of the index: Product(i^m) = Product(i)^m, deferring to whatever
      // compute-engine's own Product(i, lo..hi) already reduces to (Factorial(n), for
      // the common lo = 1 case).
      if (symbolNameOf(base!) === limits.index) {
        const indexProduct = ce.function("Product", [ce.symbol(limits.index), ops[1]!]).evaluate();
        return ce.function("Power", [indexProduct, exponent!]).evaluate();
      }

      // c^{f(i)}, c free of the index: Product(c^{f(i)}) = c^{Σ f(i)}.
      const summed = sumOverIndex(ce, exponent!, limits.index, limits.lo, limits.hi);
      return summed === undefined ? undefined : ce.function("Power", [base!, summed]).evaluate();
    },
  );
}
