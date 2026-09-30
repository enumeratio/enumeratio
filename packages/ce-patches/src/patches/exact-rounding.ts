import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { evaluateRoundingOnExactRationals } from "../compute-engine/library/arithmetic.ts";

// See arithmetic.ts: Floor/Ceil/Round/Truncate of an exact rational go through a double, so
// Floor((25! − 1)/24!) is 25 instead of 24.
export const exactRounding: Patch = {
  id: "exact-rounding",
  issue: "https://github.com/cortex-js/compute-engine/issues/382",
  lands: "Floor, Ceil, Round and Truncate of an exact rational, exactly",
  files: ["src/compute-engine/library/arithmetic.ts"],
  heads: ["Floor", "Ceil", "Round", "Truncate"],

  fixed: () => {
    const ce = new ComputeEngine();
    const q = ["Divide", { num: "15511210043330985983999999" }, ["Factorial", 24]]; // (25! − 1)/24!
    return (
      ce.box(["Floor", q] as never).evaluate().json === 24 && ce.box(["Truncate", q] as never).evaluate().json === 24
    );
  },

  apply: (ce) => evaluateRoundingOnExactRationals(ce),
};

export { evaluateRoundingOnExactRationals, roundExactRational } from "../compute-engine/library/arithmetic.ts";
