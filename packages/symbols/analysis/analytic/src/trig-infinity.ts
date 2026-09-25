import { type BoxedExpression, type ComputeEngine, isNumber } from "@cortex-js/compute-engine";
import { widenSignature, wrapOperator } from "@enumeratio/boxed";

// sin(±∞) and cos(±∞): no limit, but every value in [−1, 1] is approached, and Wolfram
// answers with that range, Interval[{-1, 1}]. compute-engine rejects a signed infinity
// twice: against its `(complex) -> number` signature while boxing, and in its evaluate.

const isSignedInfinity = (x: BoxedExpression | undefined): boolean =>
  x !== undefined &&
  isNumber(x) &&
  x.isFinite === false &&
  x.isNaN !== true &&
  (x.isPositive === true || x.isNegative === true);

export function declareTrigInfinity(ce: ComputeEngine): void {
  for (const head of ["Sin", "Cos"]) {
    widenSignature(ce, head, "(complex | infinity) -> number");
    wrapOperator(
      ce,
      [head, 1],
      ([x]) => isSignedInfinity(x),
      () => () => ce.function("Interval", [ce.number(-1), ce.One]),
      1,
    );
  }
}
