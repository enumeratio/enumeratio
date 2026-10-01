import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { evaluateNAccuracyGoal } from "../compute-engine/library/eval-options.ts";

// See eval-options.ts: N(x, {Infinity, a}) raises the working precision until the answer is
// good to an absolute error of 10^-a, instead of answering at machine precision.
export const nAccuracyGoal: Patch = {
  id: "n-accuracy-goal",
  issue: "https://github.com/cortex-js/compute-engine/issues/391",
  lands: "N(x, {Infinity, a}) meets an absolute accuracy goal of 10^-a",
  files: ["src/compute-engine/library/eval-options.ts"],
  heads: ["N"],

  // 10^10 (e^100 - e^99.9999999999) is about 2.7e43 and needs ~63 digits for a goal of 20.
  fixed: () => {
    const ce = new ComputeEngine();
    const x = [
      "Multiply",
      10000000000,
      [
        "Add",
        ["Negate", ["Power", "ExponentialE", ["Rational", 999999999999, 10000000000]]],
        ["Power", "ExponentialE", 100],
      ],
    ];
    return JSON.stringify(ce.box(["N", x, ["List", "PositiveInfinity", 20]] as never).evaluate().json).length > 40;
  },

  apply: (ce) => evaluateNAccuracyGoal(ce),
};

export { evaluateNAccuracyGoal } from "../compute-engine/library/eval-options.ts";
