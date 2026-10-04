import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { evaluateInverseHyperbolicAtZero } from "../compute-engine/library/trigonometry.ts";
import { evaluateCompleteEllipticAtZero, evaluateZetaAtZero } from "../compute-engine/library/special-functions.ts";

// Exact values at 0 that compute-engine leaves unevaluated: Arcosh(0) = Arcoth(0) = iπ/2
// (trigonometry.ts), EllipticK(0) = EllipticE(0) = π/2 and Zeta(0, a) = 1/2 − a with no term
// dropped at a = 0, −1, … (special-functions.ts).
export const valuesAtZero: Patch = {
  id: "values-at-zero",
  issue: "https://github.com/cortex-js/compute-engine/issues/409",
  lands: "Arcosh(0) = Arcoth(0) = iπ/2; EllipticK(0) = EllipticE(0) = π/2; Zeta(0, a) = 1/2 − a",
  files: ["src/compute-engine/library/trigonometry.ts", "src/compute-engine/library/special-functions.ts"],
  heads: ["Arcosh", "Arcoth", "EllipticK", "EllipticE", "Zeta"],

  fixed: () => {
    const ce = new ComputeEngine();
    return (
      ["Arcosh", "Arcoth", "EllipticK", "EllipticE"].every((head) => ce.box([head, 0]).evaluate().operator !== head) &&
      ce.box(["Zeta", 0, 0]).evaluate().re === 0.5
    );
  },

  apply: (ce) => {
    evaluateInverseHyperbolicAtZero(ce);
    evaluateCompleteEllipticAtZero(ce);
    evaluateZetaAtZero(ce);
  },
};
