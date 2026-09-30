import type { Patch } from "../patch.ts";
import { simplifyLogCombinationOnProvablePositivity } from "../compute-engine/symbolic/simplify-rules.ts";

// See simplify-rules.ts: simplify's `Ln(a) + Ln(b) -> Ln(a*b)` / `Ln(b) - Ln(a) -> Ln(b/a)`
// rule applies regardless of the arguments' signs, which is unsound off the positive reals.
export const logCombinationSign: Patch = {
  id: "log-combination-sign",
  lands: "Add's log-combination simplify rule applies only when every argument is provably positive",
  files: ["src/compute-engine/symbolic/simplify-rules.ts"],
  heads: ["Add"],

  fixed: (ce) => {
    // Scoped: boxing a bare `x` would otherwise declare it as a free symbol on `ce` itself --
    // harmless numerically, but it leaks into anything that inspects what a library declares
    // (e.g. `collect-declarers.ts`, which reads exactly that).
    ce.pushScope();
    try {
      // At x = 3: -Ln(2 - x) is -Ln(-1) = -(i*pi); Ln(2 + x) is Ln(5). The unsound rewrite,
      // Ln((x + 2) / (2 - x)) = Ln(-5) = ln(5) + i*pi, has the opposite sign on the imaginary part.
      const x = 3;
      const direct = ce.box(["Add", ["Negate", ["Ln", ["Subtract", 2, x]]], ["Ln", ["Add", 2, x]]] as never).N();
      const symbolic = ce.box(["Add", ["Negate", ["Ln", ["Subtract", 2, "x"]]], ["Ln", ["Add", 2, "x"]]] as never);
      const simplified = symbolic
        .simplify()
        .subs({ x: ce.number(x) })
        .N();
      return simplified.isEqual(direct) === true;
    } finally {
      ce.popScope();
    }
  },

  apply: (ce) => simplifyLogCombinationOnProvablePositivity(ce),
};

export { simplifyLogCombinationOnProvablePositivity } from "../compute-engine/symbolic/simplify-rules.ts";
