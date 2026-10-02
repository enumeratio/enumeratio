import { parseEpsil } from "@cortex-js/compute-engine/epsil";
import type { Patch } from "../patch.ts";
import { canonicalAssignFunctionDefinition } from "../compute-engine/library/core.ts";

// See core.ts: `Assign(f(x), body)`, as Epsil's `f(x) := body` reads, binds nothing, where the
// LaTeX reader's `f(x)\coloneq body` defines `f` as a function. Upstream fixes this in the
// Epsil parser (`:=` reads as `=` does), not in `Assign`; see #400. This stays until it ships.
export const assignFunctionDefinition: Patch = {
  id: "assign-function-definition",
  issue: "https://github.com/cortex-js/compute-engine/issues/400",
  lands: "Assign with an application of symbols on the left defines a function, as the LaTeX reader's definition does",
  files: ["src/compute-engine/library/core.ts"],
  heads: ["Assign"],

  // Fixed once the parser reads `:=` as it reads `=`: the same function definition.
  fixed: () => {
    const strip = (key: string, value: unknown) => (key === "sourceOffsets" ? undefined : value);
    const read = (src: string) => JSON.stringify(parseEpsil(src)[0], strip);
    return read("f(x) := x^2 + 1") === read("f(x) = x^2 + 1");
  },

  apply: (ce) => canonicalAssignFunctionDefinition(ce),
};

export { canonicalAssignFunctionDefinition } from "../compute-engine/library/core.ts";
