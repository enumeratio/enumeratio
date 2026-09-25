import type { ComputeEngine } from "@cortex-js/compute-engine";
import { aroundResolvers } from "./around.ts";
import { centeredIntervalResolvers, declareCenteredInterval } from "./centered-interval.ts";
import { intervalResolvers } from "./interval.ts";
import { registerTaggedHeads } from "./tagged-arithmetic.ts";

// Ties together the three tagged-value arithmetic extensions — Interval, CenteredInterval
// and Around — with exactly one `operator.evaluate` override per head they collectively
// touch, via `registerTaggedHeads`. See tagged-arithmetic.ts for why this matters: three
// separate per-type `wrapOperator` calls on the same head (the shape each of those three
// files used before) each re-evaluate every operand before checking anything, so Add alone
// would pay for that three times over on EVERY Add in the engine, tagged or not.
export function declareTaggedArithmetic(ce: ComputeEngine): void {
  declareCenteredInterval(ce); // declares the CenteredInterval head itself
  const interval = intervalResolvers(ce);
  const centered = centeredIntervalResolvers(ce);
  const around = aroundResolvers(ce);
  registerTaggedHeads(
    ce,
    ["Negate", "Add", "Multiply", "Divide", "Power", "Abs", "Sin", "Sqrt", "Erf"],
    interval,
    centered,
    around,
  );
}
