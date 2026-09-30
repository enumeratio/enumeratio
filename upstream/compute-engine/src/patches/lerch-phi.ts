import { wrapOperator } from "@enumeratio/engine";
import type { Patch } from "../patch.ts";
import { evaluateLerch } from "../compute-engine/library/special-functions.ts";
import { wantsNumber } from "../support/box.ts";
import { answersPastDouble } from "../support/precise.ts";

// compute-engine evaluates LerchPhi natively since 0.141, in doubles, and leaves a few
// closed forms on the unit circle unevaluated (Φ(−1, −1, ½) = 0). This answers real
// arguments to the engine's precision and those forms, and leaves the rest to the native
// handler, which also covers the continuation past |z| = 1 where ours declines.
export const lerchPhiPatch: Patch = {
  id: "lerch-phi",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "LerchPhi(z, s, a) to the engine's precision at real arguments, and on the unit circle",
  files: ["src/compute-engine/numerics/lerch-phi-big.ts", "src/compute-engine/library/special-functions.ts"],
  heads: ["LerchPhi"],

  fixed: (ce) =>
    ce
      .box(["LerchPhi", -1, -1, ["Rational", 1, 2]])
      .N()
      .is(0) && answersPastDouble(ce, ["LerchPhi", ["Rational", 1, 2], 2, 1]),

  apply: (ce) =>
    wrapOperator(
      ce,
      ["LerchPhi"],
      () => true,
      (native) => (ops, options) => evaluateLerch(ce, ops, wantsNumber(ops, options)) ?? native?.(ops, options),
    ),
};

export {
  evaluateLerch,
  lerchPhi,
  lerchPhiReal,
  lerchContinued,
  lerchPhiBig,
  lerchPhiBall,
} from "../compute-engine/library/special-functions.ts";
