import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareLibrary, type Patch } from "../patch.ts";
import { algebraicNumbersLibrary } from "../compute-engine/library/algebraic-numbers.ts";

// Wolfram's algebraic-number heads, which compute-engine doesn't have: Root (as PolynomialRoot,
// since compute-engine's Root is the n-th root), MinimalPolynomial, AlgebraicIntegerQ,
// AlgebraicNumberNorm and AlgebraicNumberTrace, and NumberFieldDiscriminant,
// NumberFieldIntegralBasis and NumberFieldSignature for the field a number generates.
export const algebraicNumbers: Patch = {
  id: "algebraic-numbers",
  lands: "Algebraic numbers: minimal polynomials, and the ring of integers of the field one generates",
  files: ["src/compute-engine/numerics/number-field.ts", "src/compute-engine/library/algebraic-numbers.ts"],
  library: algebraicNumbersLibrary,

  fixed: () => {
    const ce = new ComputeEngine();
    const answer = ce.box(["MinimalPolynomial", ["Root", 2, 3], "x"] as never).evaluate();
    return answer.operator !== "MinimalPolynomial";
  },

  apply: (ce) => declareLibrary(ce, algebraicNumbersLibrary),
};

export { readAlgebraic } from "../compute-engine/library/algebraic-numbers.ts";
export * as numberField from "../compute-engine/numerics/number-field.ts";
