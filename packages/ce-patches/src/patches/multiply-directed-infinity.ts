import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { evaluateMultiplyDirectedInfinity } from "../compute-engine/library/arithmetic.ts";

// compute-engine's canonical Multiply, evaluating a finite nonzero complex number times a
// real infinity, folds straight to the undirected ComplexInfinity -- Wolfram keeps
// DirectedInfinity[c/Abs[c]]. That loses the direction our own DirectedInfinity-aware
// patches (gamma-infinity, sqrt-infinity) need: Gamma(I*Infinity) should reach
// Gamma(DirectedInfinity(I)) = 0 the same way Gamma(DirectedInfinity(I)) written by hand
// does, but never does because Multiply gets there first.
export const multiplyDirectedInfinity: Patch = {
  id: "multiply-directed-infinity",
  issue: "https://github.com/cortex-js/compute-engine/issues/396",
  lands: "Multiply(c, +-Infinity) = DirectedInfinity(c/Abs(c)) for finite nonzero complex c",
  files: ["src/compute-engine/library/arithmetic.ts"],
  heads: ["Multiply"],

  fixed: () =>
    new ComputeEngine().box(["Multiply", "ImaginaryUnit", "PositiveInfinity"]).evaluate().operator ===
    "DirectedInfinity",

  apply: (ce) => evaluateMultiplyDirectedInfinity(ce),
};

export { evaluateMultiplyDirectedInfinity } from "../compute-engine/library/arithmetic.ts";
