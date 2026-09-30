// Endofunctions split out of collections/src/families/core.ts (which mixed every area) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 (wire-carriers lane A-91): its element (list<integer>) matches "Endofunction"'s shape
// exactly, same as BinaryWords <-> BinaryWord in words.ts. BinaryStrings/LatticePaths stay in
// collections per step 5 rule 4. Defined in Epsil: the tuples of n values over 1..n.
import { endofunctions } from "../../../collections/src/families/closed-forms.ts";
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import type { NumberKernel } from "../../../collections/src/families/types.ts";

export const entries: (NumberKernel | EpsilFamily)[] = [
  endofunctions({ head: "Endofunctions", params: ["_n"], carrier: "Endofunction" }),
];
