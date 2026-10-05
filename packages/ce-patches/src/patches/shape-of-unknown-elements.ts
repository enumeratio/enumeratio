import type { Patch } from "../patch.ts";
import { evaluateShapeOfUnknownElements } from "../compute-engine/library/linear-algebra.ts";

// See linear-algebra.ts: `Shape` of a nested list whose elements have no known type is empty;
// Wolfram's `Dimensions` reads the list's structure.
export const shapeOfUnknownElements: Patch = {
  id: "shape-of-unknown-elements",
  lands: "Shape of a nested list falls back to its structure when the elements' type carries no dimensions",
  files: ["src/compute-engine/library/linear-algebra.ts"],
  heads: ["Shape"],

  fixed: (ce) => {
    const shape = ce.box(["Shape", ["List", ["List", ["a", 1], ["a", 2]]]]).evaluate();
    return shape.isSame(ce.tuple(1, 2));
  },

  apply: (ce) => evaluateShapeOfUnknownElements(ce),
};

export { evaluateShapeOfUnknownElements } from "../compute-engine/library/linear-algebra.ts";
