import type { Patch } from "../patch.ts";
import { evaluateSolveIdentity } from "../compute-engine/library/solve.ts";

// See solve.ts: `Solve(x == x, x)` answers `List()` (no solutions) instead of `List(List())`
// (one solution, no constraint -- Wolfram's `Solve[x == x, x] -> {{}}`), and an equation it
// can't solve answers `List()` instead of staying unevaluated.
export const solveIdentity: Patch = {
  id: "solve-identity",
  lands:
    "Solve answers one unconstrained solution for an identity, and stays unevaluated rather than answering none for an equation it cannot solve",
  files: ["src/compute-engine/library/solve.ts"],
  heads: ["Solve"],

  fixed: (ce) => {
    // Scoped: boxing a bare `x` would otherwise declare it as a free symbol on `ce` itself --
    // harmless numerically, but it leaks into anything that inspects what a library declares
    // (e.g. `collect-declarers.ts`, which reads exactly that).
    ce.pushScope();
    try {
      const identity = ce.box(["Solve", ["Equal", "x", "x"], "x"]).evaluate();
      const expected = ce.box(["List", ["List"]]);
      const unsatisfiable = ce.box(["Solve", ["Equal", 1, 0], "x"]).evaluate();
      const empty = ce.box(["List"]);
      const unsolved = ce
        .box(["Solve", ["Equal", ["Add", ["Multiply", "a", ["Power", "x", 5]], "x", 1], 0], "x"])
        .evaluate();
      return (
        identity.isEqual(expected) === true && unsatisfiable.isEqual(empty) === true && unsolved.operator === "Solve"
      );
    } finally {
      ce.popScope();
    }
  },

  apply: (ce) => evaluateSolveIdentity(ce),
};

export { evaluateSolveIdentity } from "../compute-engine/library/solve.ts";
