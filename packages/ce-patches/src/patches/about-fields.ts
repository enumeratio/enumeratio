import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Patch } from "../patch.ts";
import { evaluateAboutFields } from "../compute-engine/library/core.ts";

// See core.ts: `About` reports a definition's `examples` and `keywords`, its algebraic flags as
// a list, `lazy` among them.
export const aboutFields: Patch = {
  id: "about-fields",
  lands: "About reports a definition's examples and keywords, its attributes as a list, lazy among them",
  files: ["src/compute-engine/library/core.ts"],
  heads: ["About"],

  fixed: () => {
    const ce = new ComputeEngine();
    const about = (name: string) => ce.box(["About", name]).evaluate().json as { dict?: Record<string, unknown> };
    const sin = about("Sin").dict ?? {};
    const add = about("Add").dict ?? {};
    const hold = about("Hold").dict ?? {};
    return (
      Array.isArray(sin.examples) &&
      Array.isArray(add.attributes) &&
      Array.isArray(hold.attributes) &&
      (hold.attributes as unknown[]).includes("lazy")
    );
  },

  apply: (ce) => evaluateAboutFields(ce),
};

export { dictionaryOf, entriesOf, evaluateAboutFields } from "../compute-engine/library/core.ts";
