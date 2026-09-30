import { wrapOperator } from "@enumeratio/engine";
import type { Patch } from "../patch.ts";
import { evaluatePolygamma } from "../compute-engine/library/special-functions.ts";

// compute-engine evaluates PolyGamma natively since 0.141, but not at order −1, which
// Wolfram and mpmath read as ln Γ(z). This answers what native leaves unevaluated.
export const polygammaLogGamma: Patch = {
  id: "polygamma-log-gamma",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "PolyGamma(−1, z) = ln Γ(z)",
  files: ["src/compute-engine/numerics/polygamma.ts", "src/compute-engine/library/special-functions.ts"],
  heads: ["PolyGamma"],

  fixed: (ce) => ce.box(["PolyGamma", -1, 2]).evaluate().is(0),

  apply: (ce) =>
    wrapOperator(
      ce,
      ["PolyGamma"],
      () => true,
      (native) => (ops, options) => evaluatePolygamma(ce, native, ops, options),
    ),
};
