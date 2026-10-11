import { wrapOperator } from "@enumeratio/engine";
import type { Patch } from "../patch.ts";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { evaluateLerch, principalAtZero } from "../compute-engine/library/special-functions.ts";
import { wantsNumber } from "../support/box.ts";

// compute-engine evaluates LerchPhi natively, exactly for rational arguments and to the engine's
// precision at real ones, but declines a result it can't vouch for relative digits of, which
// leaves the exact zeros on the unit circle unevaluated at a float argument (Φ(−1, −1, 0.5) = 0).
// The native handler answers first and this answers where it declines, except Φ(0, s, a) at a
// negative or complex a and a non-integer s: native reads that as a real root, so this answers
// first, with the principal branch.
/** The engine's default `precision`, which a double-based kernel is allowed to answer at. */
let defaultPrecision: number | undefined;
const defaultDigits = (): number => (defaultPrecision ??= new ComputeEngine().precision);

export const lerchPhiPatch: Patch = {
  id: "lerch-phi",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands:
    "LerchPhi(z, s, a) on the unit circle where it is exactly 0, and Φ(0, s, a) at a negative a on the principal branch",
  files: ["src/compute-engine/numerics/lerch-phi-big.ts", "src/compute-engine/library/special-functions.ts"],
  heads: ["LerchPhi"],

  fixed: (ce) =>
    ce
      .box(["LerchPhi", -1, -1, ["Rational", 1, 2]])
      .N()
      .is(0) &&
    ce.box(["LerchPhi", -1, -1, 0.5]).N().is(0) &&
    ce.box(["LerchPhi", 0, 2.976, -2.664]).N().im !== 0,

  // No compile stance: at those zeros this gives 0 where the built-in lowering gives its own limit.
  apply: (ce) =>
    wrapOperator(
      ce,
      ["LerchPhi"],
      () => true,
      (native) => (ops, options) => {
        // Native reads a negative base to a float power as a real root.
        if (principalAtZero(ops, wantsNumber(ops, options)))
          // The kernel is a double's worth: past the engine's default digits, stay unevaluated.
          return ce.precision > defaultDigits() ? undefined : evaluateLerch(ce, ops, true);
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
