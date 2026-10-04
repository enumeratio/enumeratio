import type { Patch } from "../patch.ts";
import { evaluateSolveDeclines } from "../compute-engine/library/solve.ts";
import { operandsOf } from "@enumeratio/engine";

// See solve.ts: `Solve` answers lists that are wrong by omission -- `List()` for an equation with
// complex solutions (or declining where it is provably empty), principal trig solutions alone, a polynomial with fewer roots than its
// degree over the complexes. These stay unevaluated.
export const solveDeclines: Patch = {
  id: "solve-declines",
  lands: "Solve stays unevaluated rather than answering a list that omits solutions",
  files: ["src/compute-engine/library/solve.ts"],
  heads: ["Solve"],

  fixed: (ce) => {
    // Scoped: boxing a bare `x` would otherwise declare it as a free symbol on `ce` itself --
    // harmless numerically, but it leaks into anything that inspects what a library declares
    // (e.g. a library's `declares.json`, which reads exactly that).
    ce.pushScope();
    try {
      const solve = (equation: unknown) => ce.box(["Solve", equation, "x"] as never).evaluate();
      const power = (exponent: number) => ["Power", "x", exponent];
      const noneForComplex = solve(["Equal", ["Sin", "x"], 2]);
      const principalOnly = solve(["Equal", ["Sin", "x"], ["Rational", 1, 3]]);
      const neverZero = solve(["Equal", ["Power", ["Add", power(2), 1], -2], 0]);
      const fewerRoots = solve(["Equal", ["Subtract", power(4), 1], 0]);
      return (
        noneForComplex.operator === "Solve" &&
        principalOnly.operator === "Solve" &&
        operandsOf(neverZero).length === 0 &&
        (fewerRoots.operator === "Solve" || operandsOf(fewerRoots).length >= 4)
      );
    } finally {
      ce.popScope();
    }
  },

  apply: (ce) => evaluateSolveDeclines(ce),
};

export { evaluateSolveDeclines } from "../compute-engine/library/solve.ts";
