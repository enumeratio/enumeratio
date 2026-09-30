import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { evaluateCeilFloorAtComplexInfinity } from "../compute-engine/library/arithmetic.ts";

// See arithmetic.ts: Ceil(ComplexInfinity)/Floor(ComplexInfinity) should be ComplexInfinity,
// not left symbolic — the same undirected value in, the same value out.
export const ceilFloorInfinity: Patch = {
  id: "ceil-floor-infinity",
  lands: "Ceil(ComplexInfinity) = Floor(ComplexInfinity) = ComplexInfinity",
  files: ["src/compute-engine/library/arithmetic.ts"],
  heads: ["Ceil", "Floor"],

  fixed: () => {
    const ce = new ComputeEngine();
    return (
      ce.box(["Ceil", "ComplexInfinity"]).evaluate().json === "ComplexInfinity" &&
      ce.box(["Floor", "ComplexInfinity"]).evaluate().json === "ComplexInfinity"
    );
  },

  apply: (ce) => evaluateCeilFloorAtComplexInfinity(ce),
};

export { evaluateCeilFloorAtComplexInfinity } from "../compute-engine/library/arithmetic.ts";
