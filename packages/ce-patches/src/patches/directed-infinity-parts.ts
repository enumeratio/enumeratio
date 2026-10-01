import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { evaluateRealImaginaryOfDirectedInfinity } from "../compute-engine/library/arithmetic.ts";

// See arithmetic.ts: Re/Im of DirectedInfinity(d) is the infinity of the part's sign, or 0
// when the direction has none, and Abs of it is +Infinity. With multiply-directed-infinity,
// Re(I*Infinity) = 0.
export const directedInfinityParts: Patch = {
  id: "directed-infinity-parts",
  issue: "https://github.com/cortex-js/compute-engine/issues/396",
  lands: "Re and Im of DirectedInfinity(d) are the infinity of the part's sign, or 0; Abs is +Infinity",
  files: ["src/compute-engine/library/arithmetic.ts"],
  heads: ["Real", "Imaginary", "Abs"],

  fixed: () =>
    new ComputeEngine()
      .box(["Real", ["DirectedInfinity", "ImaginaryUnit"]])
      .evaluate()
      .is(0) &&
    new ComputeEngine().box(["Abs", ["DirectedInfinity", "ImaginaryUnit"]]).evaluate().json === "PositiveInfinity",

  apply: (ce) => evaluateRealImaginaryOfDirectedInfinity(ce),
};

export { evaluateRealImaginaryOfDirectedInfinity } from "../compute-engine/library/arithmetic.ts";
