import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { evaluateInverseTrigAtRadicals } from "../compute-engine/library/trigonometry.ts";

// See trigonometry.ts: Arcsin/Arccos/Arctan of a radical that is sin, cos or tan of a
// multiple of π/10 fold to the angle, whichever way the radical is spelled.
export const inverseTrigRadicals: Patch = {
  id: "inverse-trig-radicals",
  lands: "Arcsin(√2/4·√(5 − √5)) = π/5, Arctan(√(1 − 2/√5)) = π/10",
  files: ["src/compute-engine/library/trigonometry.ts"],
  heads: ["Arcsin", "Arccos", "Arctan"],

  fixed: () =>
    new ComputeEngine()
      .box(["Arcsin", ["Multiply", ["Divide", ["Sqrt", 2], 4], ["Sqrt", ["Add", 5, ["Negate", ["Sqrt", 5]]]]]])
      .evaluate().operator !== "Arcsin",

  apply: (ce) => evaluateInverseTrigAtRadicals(ce),
};
