import { wrapOperator } from "@enumeratio/engine";
import type { Patch } from "../patch.ts";
import { lerchPhiPrecise } from "../compute-engine/library/special-functions.ts";
import { wantsNumber } from "../support/box.ts";
import { answersPastDouble } from "../support/precise.ts";

// compute-engine evaluates LerchPhi natively since 0.141, in doubles. This answers real
// arguments to the engine's precision and leaves everything else to the native handler.
export const lerchPhiPatch: Patch = {
  id: "lerch-phi",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "LerchPhi(z, s, a) to the engine's precision at real arguments",
  files: ["src/compute-engine/numerics/lerch-phi-big.ts", "src/compute-engine/library/special-functions.ts"],
  heads: ["LerchPhi"],

  fixed: (ce) => answersPastDouble(ce, ["LerchPhi", ["Rational", 1, 2], 2, 1]),

  apply: (ce) =>
    wrapOperator(
      ce,
      ["LerchPhi"],
      () => true,
      (native) => (ops, options) =>
        (wantsNumber(ops, options) ? lerchPhiPrecise(ce, ops) : undefined) ?? native?.(ops, options),
    ),
};

export {
  evaluateLerch,
  lerchPhi,
  lerchPhiReal,
  lerchContinued,
  lerchPhiBig,
  lerchPhiBall,
  lerchPhiPrecise,
} from "../compute-engine/library/special-functions.ts";
