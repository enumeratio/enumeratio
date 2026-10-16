// PruferSequences split out of collections/src/families/tableaux-trees.ts (§4 step 5,
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible):
// it now carries "PruferSequence" -- a word, counted in its own right (n^(n-2)), not the edge
// list the Prüfer bijection decodes to (that's LabeledTree's job: see
// ../prufer-conversion.ts, a LabeledTree(...) constructor overload built with structures'
// attachConversion). Defined in Epsil (Tuples(n, n − 2)); the TS functions below are the
// independent reading its agreement test checks it against.
import { pruferSequences } from "../../../collections/src/families/closed-forms.ts";
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import type { NumberKernel } from "../../../collections/src/families/types.ts";
export const entries: (NumberKernel | EpsilFamily)[] = [
  pruferSequences({
    head: "PruferSequences",
    params: ["_n"],
    carrier: "PruferSequence",
  }),
];
