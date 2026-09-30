import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { wrapOperator } from "@enumeratio/engine";

// cortex-js/compute-engine: Sqrt(-Infinity) collapses to the undirected ComplexInfinity. The
// principal branch (Sqrt(-x) = i*Sqrt(x) for real x > 0, DLMF 4.2.2) gives an exact direction
// as x -> Infinity: Sqrt(-Infinity) = i*Infinity = DirectedInfinity(i), same as Wolfram.
export function evaluateSqrtAtInfinity(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Sqrt"],
    (ops: readonly BoxedExpression[]) => ops[0]?.json === "NegativeInfinity",
    () => () => ce.function("DirectedInfinity", [ce.symbol("ImaginaryUnit")]).evaluate(),
    1,
  );
}
