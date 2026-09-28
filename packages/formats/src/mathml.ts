// MathMLForm -- an expression printed as presentation MathML: its traditional notation as
// boxes (`makeBoxes`), and the boxes as MathML. Output only; a pure function of the
// MathJSON tree, so it can be golden-tested. See design/boxes.md.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { makeBoxes, type MathMLOptions, toMathML as boxesToMathML } from "@enumeratio/boxes";

export type { MathMLOptions };

/** Print `json` as presentation MathML. */
export const toMathML = (json: MathJsonExpression, options: MathMLOptions = {}): string =>
  boxesToMathML(makeBoxes(json), options);
