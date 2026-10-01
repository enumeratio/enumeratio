// @enumeratio/analytic's heads in traditional notation: Barnes G, Clausen, Dirichlet
// L-functions, Pochhammer-style factorials, harmonic numbers, the Stieltjes constants. Each
// head's is data, `reference/<Head>/notation.json`, compiled here.

import { combineNotation, compileNotation, type Notation, type PackageNotation } from "@enumeratio/boxes";
import { NOTATION_DATA } from "./notation.generated.ts";

const compiled = combineNotation(Object.entries(NOTATION_DATA).map(([head, data]) => compileNotation(head, data)));

export const ANALYTIC_NOTATION: Notation = compiled.traditional;

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { traditional: ANALYTIC_NOTATION };
