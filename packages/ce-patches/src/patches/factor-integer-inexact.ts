import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { declineInexactFactorInteger } from "../compute-engine/library/number-theory.ts";

// `FactorInteger(12.0)` factors the float. compute-engine's own signature takes an integer, and
// its rule that `12.0` is a float on every route makes it inexact; Wolfram leaves
// `FactorInteger[12.]` unevaluated with `FactorInteger::exact`. The call stays as written.
export const factorIntegerInexact: Patch = {
  id: "factor-integer-inexact",
  lands: "FactorInteger of an inexact number stays unevaluated, as its (integer) signature says",
  files: ["src/compute-engine/library/number-theory.ts"],
  heads: ["FactorInteger"],

  fixed: () => new ComputeEngine().box(["FactorInteger", { num: "12.0" }]).evaluate().operator === "FactorInteger",

  apply: declineInexactFactorInteger,
};
