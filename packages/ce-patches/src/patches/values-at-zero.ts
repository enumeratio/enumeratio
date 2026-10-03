import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { evaluateInverseHyperbolicAtZero } from "../compute-engine/library/trigonometry.ts";
import { evaluateCompleteEllipticAtZero } from "../compute-engine/library/special-functions.ts";

// Exact values at 0 that compute-engine leaves unevaluated: Arcosh(0) = Arcoth(0) = iπ/2
// (trigonometry.ts) and EllipticK(0) = EllipticE(0) = π/2 (special-functions.ts).
export const valuesAtZero: Patch = {
  id: "values-at-zero",
  issue: "https://github.com/cortex-js/compute-engine/issues/409",
  lands: "Arcosh(0) = Arcoth(0) = iπ/2; EllipticK(0) = EllipticE(0) = π/2",
  files: ["src/compute-engine/library/trigonometry.ts", "src/compute-engine/library/special-functions.ts"],
  heads: ["Arcosh", "Arcoth", "EllipticK", "EllipticE"],

  fixed: () => {
    const ce = new ComputeEngine();
    return ["Arcosh", "Arcoth", "EllipticK", "EllipticE"].every(
      (head) => ce.box([head, 0]).evaluate().operator !== head,
    );
  },

  apply: (ce) => {
    evaluateInverseHyperbolicAtZero(ce);
    evaluateCompleteEllipticAtZero(ce);
  },
};
