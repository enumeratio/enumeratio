import { declareLibrary, type Patch } from "../patch.ts";
import { hurwitzZetaLibrary, zetaLibrary } from "../compute-engine/library/special-functions.ts";

// compute-engine 0.139 has shipped this fix -- `fixed` below already reports it landed, so
// this patch is a no-op on a current engine. Kept for engines pinned to the peer range this
// package still supports (^0.134.0).

export const zetaHurwitz: Patch = {
  id: "zeta-hurwitz",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  pr: "https://github.com/cortex-js/compute-engine/pull/350",
  lands: "HurwitzZeta(s, a), and Zeta widened to a complex s and a two-argument (s, a) form",
  files: [
    "src/compute-engine/numerics/hurwitz-zeta.ts",
    "src/compute-engine/numerics/hurwitz-zeta-big.ts",
    "src/compute-engine/library/special-functions.ts",
  ],
  library: (ce) => ({ ...hurwitzZetaLibrary, ...zetaLibrary(ce) }),
  heads: ["HurwitzZeta", "Zeta"],

  fixed: (ce) => {
    // Zeta(s) at a concretely complex s is what native compute-engine declines today
    // (falls back to NaN/unevaluated); HurwitzZeta doesn't exist at all.
    if (ce.lookupDefinition("HurwitzZeta") === undefined) return false;
    const r = ce.box(["Zeta", ce.complex(0.5, 14.13)]).N();
    return Number.isFinite(r.re) && Number.isFinite(r.im);
  },

  apply: (ce) => {
    declareLibrary(ce, hurwitzZetaLibrary);
    declareLibrary(ce, zetaLibrary(ce));
  },
};

export {
  evaluateHurwitz,
  evaluateZeta,
  hurwitzZeta,
  hurwitzZetaReal,
  setZetaKernel,
  zetaGeneralized,
  zetaGeneralizedReal,
  type ZetaKernel,
} from "../compute-engine/library/special-functions.ts";
