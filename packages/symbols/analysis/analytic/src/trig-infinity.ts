import { type BoxedExpression, type ComputeEngine, isNumber } from "@cortex-js/compute-engine";
import { widenSignature, wrapOperator } from "@enumeratio/engine";

// sin(±∞) and cos(±∞): no limit, but every value in [−1, 1] is approached, and Wolfram
// answers with that range, Interval[{-1, 1}]. compute-engine rejects a signed infinity
// twice: against its `(complex) -> number` signature while boxing, and in its evaluate.
//
// At the undirected ComplexInfinity, Sin/Cos don't even stay bounded -- off the real axis
// (along the imaginary directions) they grow like exp(|z|), so Interval(-1, 1) would be
// wrong there, not just imprecise. Same "no single answer, in any sense" case as the
// Wolfram docs sweep's other infinity-argument gaps (#124, @enumeratio/ce-patches'
// infinity-args patch) -- Indeterminate. Kept here rather than in that patch: this file
// already owns Sin/Cos's `widenSignature` call for the real infinities, and a second,
// separate `widenSignature` on the same head from another file would just overwrite this
// one's signature string (last write wins), not compose with it.

const isSignedInfinity = (x: BoxedExpression | undefined): boolean =>
  x !== undefined &&
  isNumber(x) &&
  x.isFinite === false &&
  x.isNaN !== true &&
  (x.isPositive === true || x.isNegative === true);

const isComplexInfinity = (x: BoxedExpression | undefined): boolean => x !== undefined && x.json === "ComplexInfinity";

export function declareTrigInfinity(ce: ComputeEngine): void {
  for (const head of ["Sin", "Cos"]) {
    widenSignature(ce, head, "(complex | infinity | ~oo) -> number | Indeterminate");
    wrapOperator(
      ce,
      [head, 1],
      ([x]) => isSignedInfinity(x),
      () => () => ce.function("Interval", [ce.number(-1), ce.One]),
      1,
    );
    wrapOperator(
      ce,
      [head, 1],
      ([x]) => isComplexInfinity(x),
      () => () => ce.symbol("Indeterminate"),
      1,
    );
  }
}
