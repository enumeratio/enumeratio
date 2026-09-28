import { bigIntegerAt } from "@enumeratio/boxed";
import { type Patch } from "../patch.ts";
import { modularInverseLibrary, modularInverseRepro } from "../compute-engine/library/number-theory.ts";

// compute-engine 0.139 has shipped this fix -- `fixed` below already reports it landed, so
// this patch is a no-op on a current engine. Kept for engines pinned to the peer range this
// package still supports (^0.134.0).

export const numberTheoryLargeIntegers: Patch = {
  id: "number-theory-large-integers",
  issue: "https://github.com/cortex-js/compute-engine/issues/339",
  pr: "https://github.com/cortex-js/compute-engine/pull/347",
  lands: "ModularInverse's handling of a negative modulus (the sign-taking convention only)",
  files: ["src/compute-engine/numerics/modular-inverse.ts", "src/compute-engine/library/number-theory.ts"],
  library: modularInverseLibrary,
  heads: ["ModularInverse"],

  fixed: (ce) =>
    bigIntegerAt(ce.box(["ModularInverse", modularInverseRepro.a, modularInverseRepro.m]).evaluate()) ===
    modularInverseRepro.answer,

  apply: (ce) => {
    modularInverseLibrary(ce);
  },
};
