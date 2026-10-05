import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { integrateExpandsPolynomials } from "../compute-engine/library/calculus.ts";

// See calculus.ts: `Integrate` leaves a power of a polynomial past linear unevaluated
// (`∫₋₁¹ (1 + x + x²)² dx`); the call is retried on the integrand's expansion.
export const integratePolynomialPowers: Patch = {
  id: "integrate-polynomial-powers",
  lands: "Integrate expands a polynomial integrand it can't integrate as written",
  files: ["src/compute-engine/library/calculus.ts"],
  heads: ["Integrate"],

  fixed: () => {
    const ce = new ComputeEngine();
    const integral = ce.box([
      "Integrate",
      ["Power", ["Add", 1, "x", ["Power", "x", 2]], 2],
      ["Limits", "x", -1, 1],
    ] as never);
    return integral.evaluate().operator !== "Integrate";
  },

  apply: (ce) => integrateExpandsPolynomials(ce),
};

export { integrateExpandsPolynomials } from "../compute-engine/library/calculus.ts";
