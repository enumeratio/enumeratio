import { ComputeEngine } from "@cortex-js/compute-engine";
import { wrapOperator } from "@enumeratio/engine";
import type { Patch } from "../patch.ts";
import { evaluateGammaAtInfinity } from "../compute-engine/library/special-functions.ts";

// compute-engine evaluates Gamma at +Infinity, -Infinity and ComplexInfinity correctly
// since 0.141 (+oo, Indeterminate, Indeterminate); it just doesn't recognize the
// pure-imaginary directed infinity i*Infinity (DirectedInfinity(I)) and leaves it
// unevaluated instead of the exact 0 DLMF/Wolfram give.
export const gammaInfinity: Patch = {
  id: "gamma-infinity",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "Gamma(DirectedInfinity(±i)) = 0",
  files: ["src/compute-engine/library/special-functions.ts"],
  heads: ["Gamma"],

  // A scratch engine, not `ce`: boxing a symbol compute-engine has no definition for
  // (DirectedInfinity isn't one) auto-declares a stub for it in whichever engine runs the
  // box -- on the real, shared `ce` this runs against (declareAnalytic's engine), that stub
  // would misreport DirectedInfinity as something we declare (census's frontier.test.ts and
  // alignment.test.ts both check the engine's own bindings).
  fixed: () =>
    new ComputeEngine()
      .box(["Gamma", ["DirectedInfinity", "ImaginaryUnit"]])
      .evaluate()
      .is(0),

  apply: (ce) =>
    wrapOperator(
      ce,
      ["Gamma"],
      () => true,
      (native) => (ops, options) => evaluateGammaAtInfinity(ce, native, ops, options),
      1,
    ),
};

export { evaluateGammaAtInfinity } from "../compute-engine/library/special-functions.ts";
