import type { Patch } from "../patch.ts";
import { evaluateLnOfNegativeInfinity } from "../compute-engine/library/arithmetic.ts";

// See arithmetic.ts: Ln(-oo) and Log(-oo) are left unevaluated, where Wolfram, Sage and SymPy answer +oo.
// Upstream this is `Ln`'s `evaluate` in library/arithmetic.ts handling the infinite operand.
export const lnOfNegativeInfinity: Patch = {
  id: "ln-of-negative-infinity",
  lands: "Ln(-oo) evaluates to +oo, as Ln(+oo) does, and so does Log(-oo, b) for a real b > 1",
  files: ["src/compute-engine/library/arithmetic.ts"],
  heads: ["Ln", "Log"],

  fixed: (ce) => ce.box(["Ln", "NegativeInfinity"] as never).evaluate().json === "PositiveInfinity",

  apply: (ce) => evaluateLnOfNegativeInfinity(ce),
};

export { evaluateLnOfNegativeInfinity } from "../compute-engine/library/arithmetic.ts";
