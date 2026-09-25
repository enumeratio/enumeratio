import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, operandsOf, symbolNameOf } from "@enumeratio/boxed";
import type { EvalOptions } from "./box.ts";

// Dobinski's formula: Σ_{k≥0} kⁿ/k! = e·Bₙ, the n-th Bell number times e (Wolfram sums it
// the same way). The k = 0 term is 0ⁿ/0! -- 1 at n = 0 and 0 otherwise -- so a sum from
// k = 1 differs only there. compute-engine already sums 1/k! itself.
//
// Attached to `Sum` directly rather than through `wrapOperator`: Sum is lazy, and its
// operands hold a bound index that must not be evaluated ahead of the sum.

type Evaluate = (ops: ReadonlyArray<BoxedExpression>, options: EvalOptions) => BoxedExpression | undefined;

/** Largest n expanded; Bₙ is exact at any n, but the sum is rarely asked past this. */
const N_MAX = 200n;

const symbolOf = (x: BoxedExpression | undefined): string | undefined =>
  x === undefined ? undefined : symbolNameOf(x);

/** The n of kⁿ/k! over the index k, or undefined for any other summand. */
function dobinskiOrder(body: BoxedExpression, k: string): bigint | undefined {
  if (body.operator !== "Divide") return undefined;
  const [num, den] = operandsOf(body);
  if (den?.operator !== "Factorial" || symbolOf(operandsOf(den)[0]) !== k) return undefined;
  if (symbolOf(num) === k) return 1n;
  if (num?.operator !== "Power") return undefined;
  const [base, exponent] = operandsOf(num);
  const n = bigIntegerAt(exponent);
  return symbolOf(base) === k && n !== undefined && n >= 1n && n <= N_MAX ? n : undefined;
}

export function declareDobinski(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Sum");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  const native = operator?.evaluate as Evaluate | undefined;
  if (operator === undefined || native === undefined) return;
  operator.evaluate = ((ops: ReadonlyArray<BoxedExpression>, options: EvalOptions) => {
    const [body, limits] = ops;
    if (ops.length === 2 && body !== undefined && limits?.operator === "Limits") {
      const [index, lo, hi] = operandsOf(limits);
      const k = symbolOf(index);
      const start = bigIntegerAt(lo);
      const n = k === undefined ? undefined : dobinskiOrder(body, k);
      if (n !== undefined && (start === 0n || start === 1n) && hi?.isFinite === false && hi.isPositive === true) {
        const sum = ce.function("Multiply", [ce.function("BellNumber", [ce.number(n)]), ce.E]);
        return options.numericApproximation ? sum.N() : sum.evaluate();
      }
    }
    return native(ops, options);
  }) as typeof operator.evaluate;
}
