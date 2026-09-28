import { type Patch } from "../patch.ts";
import { answersAtZero, HYPERBOLIC_ZERO, hyperbolicZeroLibrary } from "../compute-engine/library/trigonometry.ts";

// compute-engine 0.139 has shipped this fix -- `fixed` below already reports it landed, so
// this patch is a no-op on a current engine. Kept for engines pinned to the peer range this
// package still supports (^0.134.0).

export const hyperbolicZero: Patch = {
  id: "hyperbolic-zero",
  issue: "https://github.com/cortex-js/compute-engine/issues/341",
  pr: "https://github.com/cortex-js/compute-engine/pull/342",
  lands: "the SPECIAL-value tables for Sinh/Cosh/Tanh/Sech/Csch/Coth/Arsinh/Artanh",
  files: ["src/compute-engine/library/trigonometry.ts"],
  library: hyperbolicZeroLibrary,
  heads: Object.keys(HYPERBOLIC_ZERO),

  fixed: (ce) => Object.entries(HYPERBOLIC_ZERO).every(([head, value]) => answersAtZero(ce, head, value(ce))),

  apply: (ce) => {
    hyperbolicZeroLibrary(ce);
  },
};
