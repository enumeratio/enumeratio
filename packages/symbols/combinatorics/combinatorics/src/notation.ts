// @enumeratio/combinatorics' notation: each carrier's constructor in StandardForm,
// `\permutation(2, 3, 1)` both ways, and the MathLive macros that show those commands.

import type { PackageNotation } from "@enumeratio/boxes";
import { carrierLatex, carrierMacros } from "./carrier-latex.ts";
import { CARRIERS } from "./carrier-list.ts";

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { latex: carrierLatex(CARRIERS), macros: carrierMacros(CARRIERS) };
