import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { evaluateSqrtAtInfinity } from "../compute-engine/library/arithmetic.ts";

// See arithmetic.ts: Sqrt(-Infinity) should be DirectedInfinity(i), the principal branchs
// direction, not the undirected ComplexInfinity native compute-engine gives.
export const sqrtInfinity: Patch = {
  id: "sqrt-infinity",
  lands: "Sqrt(-Infinity) = DirectedInfinity(i)",
  files: ["src/compute-engine/library/arithmetic.ts"],
  heads: ["Sqrt"],

  fixed: () => new ComputeEngine().box(["Sqrt", "NegativeInfinity"]).evaluate().json !== "ComplexInfinity",

  apply: (ce) => evaluateSqrtAtInfinity(ce),
};

export { evaluateSqrtAtInfinity } from "../compute-engine/library/arithmetic.ts";
