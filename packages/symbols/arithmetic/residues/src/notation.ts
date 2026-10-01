// @enumeratio/residues' notation: ℤ/m in StandardForm, `a \pmod{n}` both ways.

import type { PackageNotation } from "@enumeratio/boxes";
import { RESIDUES_LATEX } from "./latex.ts";

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { latex: RESIDUES_LATEX };
