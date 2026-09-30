// LabeledTree(PruferSequence(...)): the Prüfer bijection, as a constructor overload rather than
// a CombinatorialMap (src/maps.ts stays untouched -- TQ-2/step 6 move its generic machinery down
// to structures separately). `attachConversion` (@enumeratio/structures) is the same mechanism
// src/maps.ts's own `convert: true` map rows use, called directly here since this one conversion
// isn't itself a catalogued map between two families -- PruferSequences already IS a family, and
// LabeledTrees already IS one too; this only lets the same code you'd write by hand
// (LabeledTree(PruferSequence([...]))) evaluate.
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { attachConversion } from "@enumeratio/structures";
import { asIntList, blocksMJ, type Boxed } from "../../collections/src/families/types.ts";
import { pruferDecode } from "../../collections/src/families/kernels-extra.ts";

/** The tree on the smallest `n` a Prüfer code of this length describes: length `n - 2`, so
 *  `n = length + 2` -- the empty code (length 0) is ambiguous between n=1 (no edges) and n=2 (one
 *  edge); resolved here to n=2, the smaller code with an actual edge. */
export function declareLabeledTreeFromPruferSequence(ce: ComputeEngine): void {
  attachConversion(
    ce,
    "LabeledTree",
    "PruferSequence",
    "prufer_sequence",
    "labeled_tree",
    (subject: BoxedExpression) => {
      const ops = (subject as unknown as { ops?: Boxed[] }).ops;
      const seq = asIntList(ops?.[0] ?? (subject as unknown as Boxed));
      const n = seq.length + 2;
      const edges = pruferDecode(seq, n);
      return ce.box(["LabeledTree", blocksMJ(edges)] as never);
    },
  );
}
