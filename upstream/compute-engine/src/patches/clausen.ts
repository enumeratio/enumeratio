import { declareLibrary, type Patch } from "../patch.ts";
import { clausenLibrary } from "../compute-engine/library/special-functions.ts";

export const clausenPatch: Patch = {
  id: "clausen",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "ClausenCl(n, theta), the Clausen functions",
  files: ["src/compute-engine/numerics/clausen.ts", "src/compute-engine/library/special-functions.ts"],
  library: clausenLibrary,

  fixed: (ce) => ce.lookupDefinition("ClausenCl") !== undefined,

  apply: (ce) => declareLibrary(ce, clausenLibrary),
};

export { evaluateClausen, clausen } from "../compute-engine/library/special-functions.ts";
