// `Cycles` (groupalgebra) and `CycleDecomposition` are two carriers for one permutation: Wolfram's
// `Cycles` drops fixed points and so doesn't know its size, `CycleDecomposition` keeps them. The
// conversions are constructor overloads, one on each side, each naming the other by head since
// groupalgebra can't import us:
//   Cycles(CycleDecomposition(…))     forgets the fixed points;
//   CycleDecomposition(Cycles(…), n)  needs n to put them back (as Wolfram's PermutationList(c, n)).
// combinatorics extends groupalgebra (its `package.json`) for this, so `Cycles` is declared first. The
// guard is only for a bare host, a package test declaring combinatorics alone.
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/engine";
import { attachConversion, evaluateEpsil } from "@enumeratio/structures";
import {
  cycleDecompositionOfCyclesBody,
  cycleDecompositionOfCyclesGuard,
  cyclesOfCycleDecompositionBody,
} from "./cycle-decomposition.ts";

/** The list of cycles `Cycles(…)` or `CycleDecomposition(…)` holds, as MathJSON. */
const cyclesOf = (subject: BoxedExpression): unknown => operandsOf(subject)[0]?.json;

export function declareCycleConversions(ce: ComputeEngine): void {
  if (ce.lookupDefinition("Cycles") === undefined) return;

  attachConversion(
    ce,
    "CycleDecomposition",
    "Cycles",
    "expression<Cycles>",
    "cycle_decomposition",
    (subject, n) => {
      const bindings = { _raw: cyclesOf(subject), _n: n?.json };
      if (evaluateEpsil(ce, cycleDecompositionOfCyclesGuard, bindings) !== "True") return undefined;
      const cycles = evaluateEpsil(ce, cycleDecompositionOfCyclesBody, bindings);
      return ce.function("CycleDecomposition", [ce.box(cycles as never)]);
    },
    ["integer"],
  );

  attachConversion(ce, "Cycles", "CycleDecomposition", "cycle_decomposition", "expression<Cycles>", (subject) => {
    const cycles = evaluateEpsil(ce, cyclesOfCycleDecompositionBody, { _raw: cyclesOf(subject) });
    return ce.function("Cycles", [ce.box(cycles as never)]);
  });
}
