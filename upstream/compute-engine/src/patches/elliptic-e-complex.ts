import { type Patch } from "../patch.ts";
import { ellipticEComplexLibrary, ellipticEComplexRepro } from "../compute-engine/library/special-functions.ts";

// compute-engine 0.139 has shipped this fix -- `fixed` below already reports it landed, so
// this patch is a no-op on a current engine. Kept for engines pinned to the peer range this
// package still supports (^0.134.0).

export const ellipticEComplex: Patch = {
  id: "elliptic-e-complex",
  issue: "https://github.com/cortex-js/compute-engine/issues/346",
  pr: "https://github.com/cortex-js/compute-engine/pull/348",
  lands: "EllipticE's one-argument (complete) reduction, at a complex modulus",
  files: ["src/compute-engine/library/special-functions.ts"],
  library: ellipticEComplexLibrary,
  heads: ["EllipticE"],

  fixed: (ce) => {
    const r = ce.box(["EllipticE", ce.complex(...ellipticEComplexRepro.m)]).N();
    return (
      Math.abs(r.re - ellipticEComplexRepro.answer[0]) < 1e-9 && Math.abs(r.im - ellipticEComplexRepro.answer[1]) < 1e-9
    );
  },

  apply: (ce) => {
    ellipticEComplexLibrary(ce);
  },
};
