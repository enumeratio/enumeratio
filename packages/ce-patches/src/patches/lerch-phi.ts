import { wrapOperator } from "@enumeratio/engine";
import type { Patch } from "../patch.ts";
import { evaluateLerch } from "../compute-engine/library/special-functions.ts";
import { wantsNumber } from "../support/box.ts";

// compute-engine evaluates LerchPhi natively, exactly for rational arguments and to the engine's
// precision at real ones, but declines a result it can't vouch for relative digits of, which
// leaves the exact zeros on the unit circle unevaluated at a float argument (Φ(−1, −1, 0.5) = 0).
// The native handler answers first; this answers only where it declines.
export const lerchPhiPatch: Patch = {
  id: "lerch-phi",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "LerchPhi(z, s, a) on the unit circle where it is exactly 0",
  files: ["src/compute-engine/numerics/lerch-phi-big.ts", "src/compute-engine/library/special-functions.ts"],
  heads: ["LerchPhi"],

  fixed: (ce) =>
    ce
      .box(["LerchPhi", -1, -1, ["Rational", 1, 2]])
      .N()
      .is(0) && ce.box(["LerchPhi", -1, -1, 0.5]).N().is(0),

  // No compile stance: at those zeros this gives 0 where the built-in lowering gives its own limit.
  apply: (ce) =>
    wrapOperator(
      ce,
      ["LerchPhi"],
      () => true,
      (native) => (ops, options) => {
        const answer = native?.(ops, options);
        if (answer !== undefined && answer.operator !== "LerchPhi") return answer;
        return evaluateLerch(ce, ops, wantsNumber(ops, options)) ?? answer;
      },
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
