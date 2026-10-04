import type { Patch } from "../patch.ts";
import { evaluatePolyLogHugeOrder } from "../compute-engine/library/special-functions.ts";

// See special-functions.ts: native `PolyLog(s, z)` at |z| > 1 and a large order answers
// wrongly past s = 170 (Li_250(4) = -0.25, not 4) and never returns by s ~ 5000
// (`PolyLog(2500000, 4).N()`). The truncated series with its Lerch-integral remainder bound
// answers there, and the call stays unevaluated where that bound does not hold.
export const polyLogLargeOrder: Patch = {
  id: "polylog-huge-order",
  lands: "PolyLog at |z| > 1 and a large order: correct (or unevaluated) instead of wrong or non-terminating",
  files: ["src/compute-engine/numerics/polylog-huge-order.ts", "src/compute-engine/library/special-functions.ts"],
  heads: ["PolyLog"],

  // Li_250(4) = 4 + 4²/2²⁵⁰ + ...; a fresh engine answers -0.25. (The hang itself is not probed.)
  fixed: (ce) => Math.abs(ce.box(["PolyLog", 250, 4]).N().re - 4) < 1e-9,

  apply: (ce) => evaluatePolyLogHugeOrder(ce),
};

export { evaluatePolyLogHugeOrder } from "../compute-engine/library/special-functions.ts";
