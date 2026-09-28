import { declareLibrary, type Patch } from "../patch.ts";
import { polygammaComplexLibrary } from "../compute-engine/library/special-functions.ts";

export const polygammaComplex: Patch = {
  id: "polygamma-complex",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "PolyGamma widened to a complex z",
  files: ["src/compute-engine/numerics/polygamma.ts", "src/compute-engine/library/special-functions.ts"],
  library: polygammaComplexLibrary,
  heads: ["PolyGamma"],

  fixed: (ce) => {
    const r = ce.box(["PolyGamma", 1, ce.complex(2, 1)]).N();
    return Number.isFinite(r.re) && Number.isFinite(r.im);
  },

  apply: (ce) => declareLibrary(ce, polygammaComplexLibrary(ce)),
};

export { evaluatePolygamma, digamma, polygamma, polygammaReal } from "../compute-engine/library/special-functions.ts";
