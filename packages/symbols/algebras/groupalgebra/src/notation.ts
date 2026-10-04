// @enumeratio/groupalgebra's heads in traditional notation: the cyclic and dihedral
// families by order, the group algebra k[G], the direct product, and |G|. Each head's is data,
// `reference/<Head>/notation.json`, compiled here.

import { combineNotation, compileNotation, type Notation, type PackageNotation } from "@enumeratio/boxes";
import { NOTATION_DATA } from "./notation.generated.ts";

const compiled = combineNotation(Object.entries(NOTATION_DATA).map(([head, data]) => compileNotation(head, data)));

export const GROUPALGEBRA_NOTATION: Notation = compiled.traditional;

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { traditional: GROUPALGEBRA_NOTATION };
