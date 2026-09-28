import { declareLibrary, type Patch } from "../patch.ts";
import { polylogOrderLibrary } from "../compute-engine/library/special-functions.ts";

export const polylogOrder: Patch = {
  id: "polylog-order",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "PolyLog widened to a non-integer or complex order s",
  files: ["src/compute-engine/numerics/polylog.ts", "src/compute-engine/library/special-functions.ts"],
  library: polylogOrderLibrary,
  heads: ["PolyLog"],

  fixed: (ce) => {
    const r = ce.box(["PolyLog", 0.5, 0.3]).N();
    return Number.isFinite(r.re) && Number.isFinite(r.im);
  },

  apply: (ce) => declareLibrary(ce, polylogOrderLibrary(ce)),
};

export { evaluatePolyLog, polyLog, polyLogReal } from "../compute-engine/library/special-functions.ts";
