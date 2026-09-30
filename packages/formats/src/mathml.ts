// MathMLForm -- an expression printed as presentation MathML: its traditional notation as
// boxes (`makeBoxes`), and the boxes as MathML; a pure function of the MathJSON tree, so it
// can be golden-tested. Read back, MathML is boxes (`parseMathML`), and boxes become an
// expression through their LaTeX until MakeExpression reads them directly (see the Roadmap).
// See https://github.com/enumeratio/enumeratio/wiki/Boxes.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { type Box, makeBoxes } from "@enumeratio/boxes";
import { type MathMLOptions, parseMathML, toLatex, toMathML as boxesToMathML } from "@enumeratio/boxes/render";

export type { MathMLOptions };

/** Print `json` as presentation MathML. */
export const toMathML = (json: MathJsonExpression, options: MathMLOptions = {}): string =>
  boxesToMathML(makeBoxes(json), options);

/** Boxes read as an expression: through their LaTeX, for now. */
export const boxesToExpression = (boxes: Box, ce: ComputeEngine): MathJsonExpression =>
  ce.parse(toLatex(boxes)).json as MathJsonExpression;

/** Read presentation MathML as an expression. */
export const fromMathML = (xml: string, ce: ComputeEngine): MathJsonExpression =>
  boxesToExpression(parseMathML(xml), ce);
