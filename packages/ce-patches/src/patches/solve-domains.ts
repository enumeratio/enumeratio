import type { Patch } from "../patch.ts";
import { evaluateSolveDomains } from "../compute-engine/library/solve.ts";

// See solve.ts: `Solve` keeps a symbolic root whose membership in the unknown's domain is
// undecided (`±sqrt(a)` over the reals), and leaves a system with domains unevaluated. Every
// solution is tested against its domain; an undecided one makes the `Solve` decline.
export const solveDomains: Patch = {
  id: "solve-domains",
  lands: "Solve filters every solution by its unknown's domain, a system included, and declines when it can't decide",
  files: ["src/compute-engine/library/solve.ts"],
  heads: ["Solve"],

  fixed: (ce) => {
    // Scoped, as in solve-declines: boxing a bare symbol would declare it on `ce`.
    ce.pushScope();
    try {
      const symbolic = ce
        .box(["Solve", ["Equal", ["Power", "x", 2], "a"], ["Element", "x", "RealNumbers"]] as never)
        .evaluate();
      const system = ce
        .box([
          "Solve",
          ["List", ["Equal", ["Add", "x", "y"], 2], ["Equal", ["Subtract", "x", "y"], 1]],
          ["Element", "x", "Integers"],
          ["Element", "y", "Integers"],
        ] as never)
        .evaluate();
      return symbolic.operator === "Solve" && system.operator === "List";
    } finally {
      ce.popScope();
    }
  },

  apply: (ce) => evaluateSolveDomains(ce),
};

export { evaluateSolveDomains } from "../compute-engine/library/solve.ts";
