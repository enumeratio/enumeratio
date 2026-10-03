import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { integrateOscillatoryEndpoint } from "../compute-engine/library/calculus.ts";

// See oscillatory-quadrature.ts: the lobe sum for ∫ₐ^∞ of an oscillatory integrand that
// isn't finite at a starts at a + 1e-8 and drops that sliver, so ∫₀^∞ sin t/t dt answers
// π/2 − 1.0e-8, forty times outside its own error bar.
export const oscillatoryEndpoint: Patch = {
  id: "oscillatory-endpoint",
  lands: "∫ₐ^∞ of an oscillatory integrand singular at a includes the sliver next to a",
  files: ["src/compute-engine/numerics/oscillatory-quadrature.ts", "src/compute-engine/library/calculus.ts"],
  heads: ["Integrate", "NIntegrate"],

  fixed: () => {
    const ce = new ComputeEngine();
    const value = ce.box(["Integrate", ["Divide", ["Sin", "t"], "t"], ["Limits", "t", 0, "PositiveInfinity"]]).N().re;
    return Math.abs(value - Math.PI / 2) < 1e-11;
  },

  apply: (ce) => integrateOscillatoryEndpoint(ce),
};

export { integrateOscillatoryEndpoint } from "../compute-engine/library/calculus.ts";
