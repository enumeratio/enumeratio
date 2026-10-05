import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { evaluateZetaAtNonpositiveShift, evaluateZetaAtZero } from "../compute-engine/library/special-functions.ts";

// Hurwitz values compute-engine gets wrong or leaves unevaluated: Zeta(0, a) = 1/2 − a with no
// term dropped at a = 0, −1, … and Zeta(s, −n) = ζ(s) + Σ j^(−s) for an integer s ≥ 2.
export const valuesAtZero: Patch = {
  id: "values-at-zero",
  issue: "https://github.com/cortex-js/compute-engine/issues/409",
  lands: "Zeta(0, a) = 1/2 − a; Zeta(2, −1) = 1 + π²/6",
  files: ["src/compute-engine/library/special-functions.ts"],
  heads: ["Zeta"],

  fixed: () => {
    const ce = new ComputeEngine();
    return ce.box(["Zeta", 0, 0]).evaluate().re === 0.5 && ce.box(["Zeta", 2, -1]).evaluate().operator !== "Zeta";
  },

  apply: (ce) => {
    evaluateZetaAtZero(ce);
    evaluateZetaAtNonpositiveShift(ce);
  },
};
