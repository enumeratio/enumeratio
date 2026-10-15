import type { Patch } from "../patch.ts";
import { evaluateArgumentDigits } from "../compute-engine/library/complex.ts";

// See complex.ts: `Argument` of a complex literal with bignum parts is computed in doubles,
// so past 15 digits `N(Argument(e + i pi), 20)` is wrong from the 18th. Upstream this is the
// numeric branch of `Argument`'s `evaluate` in library/complex.ts.
export const argumentDigits: Patch = {
  id: "argument-digits",
  lands: "N(Argument(z), d) for a complex z is correct to d digits, as Arctan2(Im z, Re z) is",
  files: ["src/compute-engine/library/complex.ts"],
  heads: ["Argument"],

  fixed: (ce) => {
    const z = ce.box(["Add", "ExponentialE", ["Multiply", ["Complex", 0, 1], "Pi"]] as never);
    const arg = ce.box(["N", ["Argument", z.json], 25] as never).evaluate();
    return arg.toString().startsWith("0.857511786355846265006867");
  },

  apply: (ce) => evaluateArgumentDigits(ce),
};

export { evaluateArgumentDigits } from "../compute-engine/library/complex.ts";
