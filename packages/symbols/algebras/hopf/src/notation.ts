// @enumeratio/hopf's heads in traditional notation: the coalgebra operations (Δ, ε, S,
// ⊗), and the NSym/QSym bases indexed by composition. Each head's is data,
// `reference/<Head>/notation.json`, compiled here.

import { combineNotation, compileNotation, type Notation, type PackageNotation } from "@enumeratio/boxes";
import { NOTATION_DATA } from "./notation.generated.ts";

const compiled = combineNotation(Object.entries(NOTATION_DATA).map(([head, data]) => compileNotation(head, data)));

export const HOPF_NOTATION: Notation = compiled.traditional;

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { traditional: HOPF_NOTATION };
