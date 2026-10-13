import { isFunction } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { evaluateRootsOfNumbers } from "../compute-engine/library/arithmetic.ts";

// See arithmetic.ts: a Power of numbers returns the canonical Root it rewrote to without
// folding it, so threading over an exponent list leaves Root(-8, 3) where the scalar gives -2.
// Upstream this is `pow()` in boxed-expression/arithmetic-power.ts evaluating a non-Power
// `canonicalPower` result; the files list the handler's home.
export const powerOfNumbersFoldsRoots: Patch = {
  id: "power-of-numbers-folds-roots",
  lands: "Power(8, 1/3) evaluates to 2 as Root(8, 3) does, so Power(-8, [1/3, 5]) is [-2, -32768]",
  files: ["src/compute-engine/library/arithmetic.ts"],
  heads: ["Power"],

  fixed: (ce) => {
    const cubes = ce.box(["Power", -8, ["List", ["Rational", 1, 3], 5]] as never).evaluate();
    return isFunction(cubes) && cubes.ops[0]?.isSame(-2) === true;
  },

  apply: (ce) => evaluateRootsOfNumbers(ce),
};

export { evaluateRootsOfNumbers } from "../compute-engine/library/arithmetic.ts";
