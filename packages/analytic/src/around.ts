import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, wrapOperator } from "@enumeratio/boxed";

// Around(x, dx) — Wolfram's number-with-uncertainty, propagated to first order: `f(Around(x,
// dx))` is `Around(f(x), |f'(x)| dx)`, and several independent uncertainties combine in
// quadrature, `sqrt(Σ dxᵢ²)`. This is the same "first-order error propagation" every physics
// lab does by hand; Wolfram's `Around` just automates it.
//
// Wired onto the heads the backlog examples actually push an `Around` through: `Add`
// (n-ary quadrature sum — this also covers `Subtract`, which canonicalizes to `Add` +
// `Negate`; see interval.ts), `Multiply` (an exact scalar factor scales linearly; several
// `Around` factors combine their RELATIVE uncertainties in quadrature, which is the same
// quadrature rule after factoring out the center), `Power` with a concrete exponent, `Power`
// with base `E` (`Exp`, which canonicalizes to `E^x` — the same reason `Negate` stands in for
// `Subtract`), and `Sqrt`/`Erf` via compute-engine's own symbolic derivative (`D`), so no
// derivative table has to be kept by hand for those.
//
// `Multinomial(Around(x, dx), k)` — one of the backlog's own examples — is NOT covered:
// `Multinomial` is declared over integers only, so there is no nearby point to take a
// derivative at without first widening it to the Gamma-based real domain, which is out of
// scope for `Around` itself. That example stays aspirational.

const isAround = (e: BoxedExpression): boolean =>
  e.operator === "Around" && operandsOf(e).length === 2;

const centerOf = (e: BoxedExpression): BoxedExpression => operandsOf(e)[0];
const deltaOf = (e: BoxedExpression): BoxedExpression => operandsOf(e)[1];

/** A numeric (double) view of a boxed expression's value. */
const numOf = (e: BoxedExpression): number => e.N().re;

/** Build `Around(c, d)` from plain numbers. */
const around = (ce: ComputeEngine, c: number, d: number): BoxedExpression =>
  ce.function("Around", [ce.number(c), ce.number(d)]).evaluate();

/** `e` as an `Around`, degenerate `(e, 0)` (no uncertainty) if it is a plain number. */
const asAround = (ce: ComputeEngine, e: BoxedExpression): BoxedExpression =>
  isAround(e) ? e : ce.function("Around", [e, 0]).evaluate();

/** Σ dxᵢ² summed in quadrature for independent `Around` operands of `Add`; a plain scalar
 * operand contributes 0. */
function aroundAdd(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression {
  const parts = ops.map((o) => asAround(ce, o));
  const c = parts.reduce((acc, p) => acc + numOf(centerOf(p)), 0);
  const d = Math.sqrt(parts.reduce((acc, p) => acc + numOf(deltaOf(p)) ** 2, 0));
  return around(ce, c, d);
}

/** A product of `Around`s: relative uncertainties combine in quadrature — equivalent to the
 * chain rule `d(∏xᵢ) = Σⱼ (∏_{i≠j} xᵢ) dxⱼ`, taken in quadrature, divided back out by the
 * product's own value. A single `Around` times exact scalars is the same formula with every
 * scalar's relative uncertainty at 0, which reduces to plain linear scaling. */
function aroundMultiply(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression {
  const parts = ops.map((o) => asAround(ce, o));
  const c = parts.reduce((acc, p) => acc * numOf(centerOf(p)), 1);
  const relSquared = parts.reduce((acc, p) => {
    const pc = numOf(centerOf(p));
    const pd = numOf(deltaOf(p));
    return pd === 0 ? acc : acc + (pd / pc) ** 2;
  }, 0);
  return around(ce, c, Math.abs(c) * Math.sqrt(relSquared));
}

/** `Around(x, dx)^n` for a concrete exponent `n`: `Around(x^n, |n·x^(n-1)|·dx)`. */
function aroundPower(ce: ComputeEngine, a: BoxedExpression, n: BoxedExpression): BoxedExpression {
  const A = asAround(ce, a);
  const c = numOf(centerOf(A));
  const nn = n.re;
  return around(ce, c ** nn, Math.abs(nn * c ** (nn - 1)) * numOf(deltaOf(A)));
}

/** `E^Around(x, dx)` (Wolfram's `Exp`, which canonicalizes to a `Power` with base `E`):
 * `Around(e^x, e^x·dx)`. */
function aroundExpBase(ce: ComputeEngine, x: BoxedExpression): BoxedExpression {
  const X = asAround(ce, x);
  const value = Math.exp(numOf(centerOf(X)));
  return around(ce, value, value * numOf(deltaOf(X)));
}

/** `f(Around(x, dx))` for a unary `head` with a compute-engine-known symbolic derivative:
 * `Around(f(x), |f'(x)|·dx)`, `f'` taken via `D` and evaluated numerically at the center. */
function aroundUnary(ce: ComputeEngine, head: string, a: BoxedExpression): BoxedExpression {
  const A = asAround(ce, a);
  const c = numOf(centerOf(A));
  const value = numOf(ce.function(head, [ce.number(c)]));
  const derivative = ce
    .function("D", [ce.function(head, [ce.symbol("_around_t")]), ce.symbol("_around_t")])
    .evaluate()
    .subs({ _around_t: c })
    .N().re;
  return around(ce, value, Math.abs(derivative) * numOf(deltaOf(A)));
}

const UNARY_HEADS = ["Sqrt", "Erf"] as const;

/**
 * Declare `Around(x, dx)` and its first-order propagation through `Add`, `Multiply`,
 * `Power`, `Exp` and a few unary special functions — see the file header for scope and the
 * one example (`Multinomial`) left aspirational.
 */
export function declareAround(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Add", 2],
    (ops) => ops.some(isAround),
    () => (ops) => aroundAdd(ce, ops),
  );
  wrapOperator(
    ce,
    ["Multiply", 2],
    (ops) => ops.some(isAround),
    () => (ops) => aroundMultiply(ce, ops),
  );
  wrapOperator(
    ce,
    ["Power", 2],
    (ops) => isAround(ops[0]) || (ops[0].isSame(ce.E) && isAround(ops[1])),
    () =>
      ([a, n]) =>
        isAround(a) ? aroundPower(ce, a, n) : aroundExpBase(ce, n),
  );
  for (const head of UNARY_HEADS) {
    wrapOperator(
      ce,
      [head, 1],
      (ops) => isAround(ops[0]),
      () =>
        ([a]) =>
          aroundUnary(ce, head, a),
    );
  }
}
