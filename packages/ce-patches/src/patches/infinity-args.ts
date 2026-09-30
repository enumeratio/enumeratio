import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import {
  evaluateArcsinArccosAtInfinity,
  evaluateArctanArccotAtComplexInfinity,
  evaluateHyperbolicInverseAtInfinity,
  evaluateReciprocalTrigAtInfinity,
} from "../compute-engine/library/trigonometry.ts";
import { evaluateLnAtNegativeInfinity } from "../compute-engine/library/arithmetic.ts";
import { evaluateErfcAtComplexInfinity } from "../compute-engine/library/distributions.ts";

// Wolfram docs sweep (#124): a batch of elementary/special-function heads that reject an
// infinity argument at BOXING time (`incompatible-type`) because their declared signature
// is `complex`/`real`/`number`, none of which admit compute-engine's infinities -- or that
// accept it but leave it unevaluated. One patch, several families sharing the same
// direction-dependence-at-ComplexInfinity reasoning (see each library file's own comment
// for the derivation): Arcsin/Arccos/Arctan/Arccot (DLMF 4.23), the hyperbolic inverses
// (DLMF 4.37), Ln, Erfc, and Tan/Cot/Sec/Csc. Arcsec/Arccsc and Sin/Cos already answer
// every infinity correctly (Sin/Cos's real-infinity case via @enumeratio/analytic's own
// trig-infinity.ts, which this patch's Sin/Cos ComplexInfinity fix piggybacks on rather
// than duplicating, to avoid two `widenSignature` calls racing for the same signature
// string -- see that file's own updated comment). Exp and Erfi are deliberately left out --
// see arithmetic.ts and distributions.ts's own comments for why.
export const infinityArgs: Patch = {
  id: "infinity-args",
  lands:
    "Arcsin/Arccos/Arctan/Arccot, Arsinh/Arcosh/Artanh/Arsech, Ln, Erfc and Tan/Cot/Sec/Csc answer every infinity argument",
  files: [
    "src/compute-engine/library/trigonometry.ts",
    "src/compute-engine/library/arithmetic.ts",
    "src/compute-engine/library/distributions.ts",
  ],
  heads: [
    "Arcsin",
    "Arccos",
    "Arctan",
    "Arccot",
    "Arsinh",
    "Arcosh",
    "Artanh",
    "Arsech",
    "Ln",
    "Erfc",
    "Tan",
    "Cot",
    "Sec",
    "Csc",
  ],

  fixed: () => {
    const ce = new ComputeEngine();
    const inf = (h: string, a: string) => ce.box([h, a]).evaluate();
    return (
      inf("Arcsin", "PositiveInfinity").operator === "DirectedInfinity" &&
      inf("Arccos", "ComplexInfinity").json === "Indeterminate" &&
      inf("Arctan", "ComplexInfinity").json === "Indeterminate" &&
      inf("Arccot", "ComplexInfinity").json === "Indeterminate" &&
      inf("Arcosh", "NegativeInfinity").json === "PositiveInfinity" &&
      inf("Arsinh", "ComplexInfinity").json === "Indeterminate" &&
      inf("Artanh", "ComplexInfinity").json === "Indeterminate" &&
      inf("Arsech", "ComplexInfinity").json === "Indeterminate" &&
      inf("Ln", "NegativeInfinity").json === "PositiveInfinity" &&
      inf("Erfc", "ComplexInfinity").json === "Indeterminate" &&
      inf("Tan", "PositiveInfinity").json === "Indeterminate" &&
      inf("Cot", "ComplexInfinity").json === "Indeterminate" &&
      inf("Sec", "NegativeInfinity").json === "Indeterminate" &&
      inf("Csc", "ComplexInfinity").json === "Indeterminate"
    );
  },

  apply: (ce) => {
    evaluateArcsinArccosAtInfinity(ce);
    evaluateArctanArccotAtComplexInfinity(ce);
    evaluateHyperbolicInverseAtInfinity(ce);
    evaluateReciprocalTrigAtInfinity(ce);
    evaluateLnAtNegativeInfinity(ce);
    evaluateErfcAtComplexInfinity(ce);
  },
};

export {
  evaluateArcsinArccosAtInfinity,
  evaluateArctanArccotAtComplexInfinity,
  evaluateHyperbolicInverseAtInfinity,
  evaluateReciprocalTrigAtInfinity,
} from "../compute-engine/library/trigonometry.ts";
export { evaluateLnAtNegativeInfinity } from "../compute-engine/library/arithmetic.ts";
export { evaluateErfcAtComplexInfinity } from "../compute-engine/library/distributions.ts";
