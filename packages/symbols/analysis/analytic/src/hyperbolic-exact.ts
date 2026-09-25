import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigRationalAt, operandsOf, wrapOperator } from "@enumeratio/boxed";
import type { EvalOptions } from "./box.ts";

// Exact values compute-engine leaves symbolic for the hyperbolic functions, though it has
// them for the circular ones: the values at 0 (and arcosh 1 = 0), as Wolfram gives them.
//
// The hyperbolic functions of ln q, q a positive rational, are rational in q:
// sinh(ln q) = (q − 1/q)/2, cosh(ln q) = (q + 1/q)/2 and the rest by division. Wolfram
// folds these (Sinh[Log[2]] is 3/4); compute-engine leaves them symbolic. Sinh(−ln q) is
// already turned into −Sinh(ln q) by the parity rules in elementary-remaining.ts.

const finish = (expr: BoxedExpression, options: EvalOptions): BoxedExpression =>
  options.numericApproximation ? expr.N() : expr.evaluate();

type Rational = (q: BoxedExpression, inverse: BoxedExpression) => BoxedExpression;

const half = (ce: ComputeEngine, x: BoxedExpression): BoxedExpression =>
  ce.function("Divide", [x, ce.number(2)]);

const RULES: Readonly<Record<string, (ce: ComputeEngine) => Rational>> = {
  Sinh: (ce) => (q, p) => half(ce, ce.function("Subtract", [q, p])),
  Cosh: (ce) => (q, p) => half(ce, ce.function("Add", [q, p])),
  Tanh: (ce) => (q, p) =>
    ce.function("Divide", [ce.function("Subtract", [q, p]), ce.function("Add", [q, p])]),
  Coth: (ce) => (q, p) =>
    ce.function("Divide", [ce.function("Add", [q, p]), ce.function("Subtract", [q, p])]),
  Sech: (ce) => (q, p) => ce.function("Divide", [ce.number(2), ce.function("Add", [q, p])]),
  Csch: (ce) => (q, p) => ce.function("Divide", [ce.number(2), ce.function("Subtract", [q, p])]),
};

/** The q of `Ln(q)`, for a positive exact rational q other than 1. */
function logArgument(op: BoxedExpression | undefined): readonly [bigint, bigint] | undefined {
  const args = operandsOf(op);
  if (op?.operator !== "Ln" || args.length !== 1) return undefined;
  const q = bigRationalAt(args[0]);
  return q !== undefined && q[0] > 0n && q[0] !== q[1] ? q : undefined;
}

/** f(x0) for the exact x0 at which each head has a plain value. */
const SPECIAL: Readonly<Record<string, readonly [number, (ce: ComputeEngine) => BoxedExpression]>> =
  {
    Sinh: [0, (ce) => ce.Zero],
    Cosh: [0, (ce) => ce.One],
    Tanh: [0, (ce) => ce.Zero],
    Sech: [0, (ce) => ce.One],
    Csch: [0, (ce) => ce.ComplexInfinity],
    Coth: [0, (ce) => ce.ComplexInfinity],
    Arsinh: [0, (ce) => ce.Zero],
    Artanh: [0, (ce) => ce.Zero],
    Arcosh: [1, (ce) => ce.Zero],
  };

export function declareHyperbolicExact(ce: ComputeEngine): void {
  for (const [head, [at, value]] of Object.entries(SPECIAL)) {
    wrapOperator(
      ce,
      [head, 1],
      ([x]) => {
        const q = bigRationalAt(x);
        const exact = (x as { isExact?: boolean } | undefined)?.isExact !== false;
        return exact && q !== undefined && q[1] === 1n && q[0] === BigInt(at);
      },
      () => () => value(ce),
      1,
    );
  }

  for (const [head, rule] of Object.entries(RULES)) {
    const apply = rule(ce);
    wrapOperator(
      ce,
      [head, 1],
      (ops) => logArgument(ops[0]) !== undefined,
      () => (ops, options) => {
        const [n, d] = logArgument(ops[0])!;
        return finish(apply(ce.number([n, d]), ce.number([d, n])), options);
      },
      1,
    );
  }
}
