import type { Patch } from "../patch.ts";
import { evaluateTakeDropNegativeCount } from "../compute-engine/library/collections.ts";

// See collections.ts: `Take`/`Drop`'s collection handlers clamp a negative count to zero
// instead of counting from the end of the source, as Wolfram's `Take`/`Drop` do -- and clamp
// a magnitude past the source's length to a full/empty list, instead of declining (leaving the
// call unevaluated) as Wolfram's `Take::take`/`Drop::drop` do.
export const takeDropNegativeCount: Patch = {
  id: "take-drop-negative-count",
  lands: "Take/Drop of a negative count reads from the end of the source, as Wolfram's Take/Drop do",
  files: ["src/compute-engine/library/collections.ts"],
  heads: ["Take", "Drop"],

  fixed: (ce) => {
    const list = ["List", 1, 2, 3, 4, 5] as const;
    const lastTwo = ce.box(["Take", list, -2]).evaluate();
    const allButLastTwo = ce.box(["Drop", list, -2]).evaluate();
    const takeOverflow = ce.box(["Take", list, -10]).evaluate();
    const dropOverflow = ce.box(["Drop", list, -10]).evaluate();
    return (
      lastTwo.isEqual(ce.box(["List", 4, 5])) === true &&
      allButLastTwo.isEqual(ce.box(["List", 1, 2, 3])) === true &&
      takeOverflow.count === undefined &&
      dropOverflow.count === undefined
    );
  },

  apply: (ce) => evaluateTakeDropNegativeCount(ce),
};

export { evaluateTakeDropNegativeCount } from "../compute-engine/library/collections.ts";
