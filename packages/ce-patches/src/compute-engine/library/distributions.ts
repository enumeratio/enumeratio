import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { widenSignature, wrapOperator } from "@enumeratio/engine";

// erf(z) is entire and grows like exp(z^2)/z off the real axis while staying bounded
// (+-1) along it, so -- exactly like exp(z) itself -- it has no limit as |z| -> Infinity
// from an unspecified direction: Indeterminate. Erf(ComplexInfinity) already answers this
// (through @enumeratio/analytic's own Erf redeclaration, generalized-special.ts -- not
// compute-engine natively, which still rejects it at boxing on a bare engine). Erfc = 1 -
// Erf inherits the same direction-dependence but rejects the undirected infinity at boxing
// instead (`complex | signed_infinity`, no `~oo`) -- widened to match.
//
// Erfi = -i*Erf(iz) has the identical answer for the identical reason, but is left out: it
// has no reference entry at all yet (unlike every other head this patch touches), and
// census's manifest check holds every signature-widening change to a record naming the
// exact printed type -- adding one from scratch is a bigger step than this patch's scope.
// Left for the coordinator.
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
