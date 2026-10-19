// @enumeratio/residues' notation: ℤ/m in StandardForm, `a \pmod{n}` both ways, and the
// residue value as `(a mod n)` in TraditionalForm.

import { fence, type Notation, type PackageNotation, scalars } from "@enumeratio/boxes";
import { RESIDUES_LATEX } from "./latex.ts";
import { INTEGER_MOD } from "./names.ts";

export const RESIDUES_NOTATION: Notation = {
  // Fenced whole, as StandardForm is, so a sum of classes never reads as one modulus.
  [INTEGER_MOD]: scalars((args, write) =>
    args.length === 2 ? fence("(", [write.box(args[0]!), "mod", write.box(args[1]!)], ")") : undefined,
  ),
};

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { traditional: RESIDUES_NOTATION, latex: RESIDUES_LATEX };
