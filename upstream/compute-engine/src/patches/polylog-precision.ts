import { threadOverLists, wrapOperator } from "@enumeratio/engine";
import type { Patch } from "../patch.ts";
import { polyLogPrecise } from "../compute-engine/library/special-functions.ts";
import { wantsNumber } from "../support/box.ts";
import { answersPastDouble } from "../support/precise.ts";

// compute-engine evaluates PolyLog at any order since 0.141, in doubles, and unlike its
// siblings (PolyGamma, Zeta, LerchPhi) it doesn't thread over a list or an Interval. This
// answers real s and z to the engine's precision, leaves everything else to the native
// handler, and makes PolyLog broadcastable.
export const polylogPrecision: Patch = {
  id: "polylog-precision",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "PolyLog(s, z) to the engine's precision at real arguments, and broadcastable",
  files: ["src/compute-engine/numerics/lerch-phi-big.ts", "src/compute-engine/library/special-functions.ts"],
  heads: ["PolyLog"],

  fixed: (ce) => {
    const definition = ce.lookupDefinition("PolyLog");
    const broadcastable = definition !== undefined && "operator" in definition && definition.operator.broadcastable;
    return broadcastable === true && answersPastDouble(ce, ["PolyLog", 2, ["Rational", 1, 3]]);
  },

  apply: (ce) => {
    threadOverLists(ce, ["PolyLog"]);
    wrapOperator(
      ce,
      ["PolyLog"],
      () => true,
      (native) => (ops, options) =>
        (wantsNumber(ops, options) ? polyLogPrecise(ce, ops) : undefined) ?? native?.(ops, options),
    );
  },
};

export { polyLogPrecise } from "../compute-engine/library/special-functions.ts";
