// AsciiMath (asciimath.org), in and out. Out is our StandardForm notation as boxes
// (`makeBoxes`), linearised in AsciiMath's spellings (`toAscii`: `x^2 <= pi`,
// `sqrt(x)`, `x in RR`). In goes through TeX, by asciimath2tex, and compute-engine reads
// that; reading it through boxes instead is MakeExpression's job (see the Roadmap).

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { makeBoxes } from "@enumeratio/boxes";
import { toAscii } from "@enumeratio/boxes/render";
// By path: the package's `module` field names a file it doesn't ship.
import asciimath2tex from "asciimath2tex/dist/asciimath2tex.js";

/** Print `json` as AsciiMath. */
export const toAsciiMath = (json: MathJsonExpression): string => toAscii(makeBoxes(json));

interface Parser {
  parse(text: string): string;
}
// The package is CommonJS whose own types call its class the default export; take whichever
// the loader hands over.
const AsciiMathParser = ((asciimath2tex as { default?: unknown }).default ?? asciimath2tex) as new () => Parser;

let parser: Parser | undefined;

/** AsciiMath as TeX, as asciimath2tex writes it. */
export const asciiMathToTeX = (text: string): string => (parser ??= new AsciiMathParser()).parse(text);

/** Read AsciiMath as an expression, through its TeX. */
export const fromAsciiMath = (text: string, ce: ComputeEngine): MathJsonExpression =>
  ce.parse(asciiMathToTeX(text)).json as MathJsonExpression;
