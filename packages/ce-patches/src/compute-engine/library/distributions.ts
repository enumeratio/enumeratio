import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { widenSignature, wrapOperator } from "@enumeratio/engine";

// erf(z) is entire and grows like exp(z^2)/z off the real axis while staying bounded
// (+-1) along it, so -- exactly like exp(z) itself -- it has no limit as |z| -> Infinity
// from an unspecified direction: Indeterminate. Erf(ComplexInfinity) already answers this
// (through @enumeratio/analytic's own Erf redeclaration, generalized-special.ts -- not
// compute-engine natively, which still rejects it at boxing on a bare engine). Erfc = 1 -
// Erf inherits the same direction-dependence but rejects the undirected infinity at boxing
// instead (`complex | signed_infinity`, no `~oo`) -- widened to match.
export function evaluateErfcAtComplexInfinity(ce: ComputeEngine): void {
  widenSignature(ce, "Erfc", "(complex | signed_infinity | ~oo) -> complex | Indeterminate", () => true);
  wrapOperator(
    ce,
    ["Erfc"],
    (ops: readonly BoxedExpression[]) => ops[0]?.json === "ComplexInfinity",
    () => () => ce.symbol("Indeterminate"),
    1,
  );
}

// Erfi(z) = -i*erf(iz): the identical direction-dependence as Erf/Erfc above, off the real
// axis -- but unlike Erfc, Erfi's native signature already carries `signed_infinity` in its
// return type (Erfi(+-Infinity) answers +-Infinity natively, unbounded rather than
// saturating), so the widened return type keeps it alongside the new `Indeterminate`.
export function evaluateErfiAtComplexInfinity(ce: ComputeEngine): void {
  widenSignature(
    ce,
    "Erfi",
    "(complex | signed_infinity | ~oo) -> complex | signed_infinity | Indeterminate",
    () => true,
  );
  wrapOperator(
    ce,
    ["Erfi"],
    (ops: readonly BoxedExpression[]) => ops[0]?.json === "ComplexInfinity",
    () => () => ce.symbol("Indeterminate"),
    1,
  );
}
