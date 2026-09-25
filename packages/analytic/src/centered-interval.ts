import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import type { Resolver } from "./tagged-arithmetic.ts";

// CenteredInterval(c, r) — Wolfram's center-radius form of an interval, c ± r. Unlike
// `Interval`, this is a head compute-engine has no notion of at all, so it is declared here
// from scratch. Only the operations the backlog examples use: constructing one from an
// `Interval`, and the arithmetic that falls out of `Negate` and `Add` (see interval.ts for
// why `Subtract` itself is never the head arithmetic actually runs through) plus a scalar
// `Multiply`.
//
// Wolfram additionally rounds outward for a rigorous (interval-arithmetic) radius; that
// rounding needs a kernel to pin (see backlog.json's note, and enumeratio/enumeratio#113
// §2), so it stays out of scope here — every example this covers uses exact endpoints, where
// there is nothing to round.
//
// The arithmetic resolvers are merged with Interval's and Around's and registered once per
// head by `declare-tagged-arithmetic.ts` — see tagged-arithmetic.ts for why this doesn't
// call `wrapOperator` itself.

const isCenteredInterval = (e: BoxedExpression): boolean =>
  e.operator === "CenteredInterval" && operandsOf(e).length === 2;

const center = (e: BoxedExpression): BoxedExpression => operandsOf(e)[0];
const radius = (e: BoxedExpression): BoxedExpression => operandsOf(e)[1];

/** This module's resolvers — see the file header. */
export function centeredIntervalResolvers(ce: ComputeEngine): Readonly<Record<string, Resolver>> {
  const add = (a: BoxedExpression, b: BoxedExpression) => ce.function("Add", [a, b]).evaluate();
  const neg = (a: BoxedExpression) => ce.function("Negate", [a]).evaluate();
  const mul = (a: BoxedExpression, b: BoxedExpression) =>
    ce.function("Multiply", [a, b]).evaluate();
  const abs = (a: BoxedExpression) => ce.function("Abs", [a]).evaluate();
  const centeredInterval = (c: BoxedExpression | number, r: BoxedExpression | number) =>
    ce.function("CenteredInterval", [c, r]).evaluate();
  /** `e` as a `CenteredInterval`, degenerate `(e, 0)` if it is a plain number. */
  const asCentered = (e: BoxedExpression) => (isCenteredInterval(e) ? e : centeredInterval(e, 0));

  const centeredNegate = (a: BoxedExpression): BoxedExpression => {
    const A = asCentered(a);
    return centeredInterval(neg(center(A)), radius(A));
  };
  /** Centers add, and — since `Subtract(a, b)` canonicalizes to `Add(a, Negate(b))` before
   * any operator hook runs, and `Negate` above leaves the radius alone — radii always add
   * too, on both sides: this reproduces Wolfram's "radii add under subtraction too". */
  const centeredAdd = (a: BoxedExpression, b: BoxedExpression): BoxedExpression => {
    const A = asCentered(a);
    const B = asCentered(b);
    return centeredInterval(add(center(A), center(B)), add(radius(A), radius(B)));
  };
  /** A scalar times a `CenteredInterval`: the center scales by the factor, the radius by its
   * absolute value. Only exactly one `CenteredInterval` operand among plain scalars is
   * handled — two centered intervals multiplied has no example and no simple exact rule. */
  const centeredScale = (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
    const centered = ops.filter(isCenteredInterval);
    if (centered.length !== 1) return undefined;
    const A = centered[0];
    const scalars = ops.filter((o) => o !== A);
    const k = scalars.reduce((acc, e) => mul(acc, e), ce.One as BoxedExpression);
    return centeredInterval(mul(k, center(A)), mul(abs(k), radius(A)));
  };

  return {
    Negate: ([a]) => (a !== undefined && isCenteredInterval(a) ? centeredNegate(a) : undefined),
    Add: (ops) =>
      ops.some(isCenteredInterval) ? ops.reduce((acc, e) => centeredAdd(acc, e)) : undefined,
    Multiply: (ops) => (ops.some(isCenteredInterval) ? centeredScale(ops) : undefined),
  };
}

/**
 * Declare `CenteredInterval(c, r)` itself. One argument (an `Interval`) converts to
 * center-radius form; two arguments are the tag, extended with `centeredIntervalResolvers`'s
 * arithmetic (registered separately — see the file header).
 */
export function declareCenteredInterval(ce: ComputeEngine): void {
  ce.declare("CenteredInterval", {
    signature: "(value, number?) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const single = ops[0];
      if (ops.length === 1 && single !== undefined && single.operator === "Interval") {
        const [a, b] = operandsOf(single);
        const c = ce.function("Divide", [ce.function("Add", [a, b]), 2]).evaluate();
        const r = ce.function("Divide", [ce.function("Subtract", [b, a]), 2]).evaluate();
        return ce.function("CenteredInterval", [c, r]).evaluate();
      }
      return undefined;
    },
  });
}
