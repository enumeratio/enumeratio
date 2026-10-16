// BinaryTrees/BinaryTreeParentArrays split out of collections/src/families/core.ts (which mixed
// every area) per https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 -- the only two families in core.ts's "trees with nested elements" section carrying a
// carrier ("BinaryTree" / "BinaryTreeParentArray"). FullKAryTrees/OrderedTrees moved in alongside
// them (wire-carriers lane A-92): their carriers -- FullKAryTree, OrderedTree -- go NESTED, matching
// BinaryTree's own shape (`integer | list<any>`, https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible,
// #401), since both families' elements already are (kind "nested": KTree = 0 | KTree[], OrdTree
// = OrdTree[]). The generic kernel math stays in collections/src/families/kernels*.ts.
import type { EpsilFamily, FastKernel } from "../../../collections/src/families/epsil.ts";
import { catalanExact, fussCatalanExact } from "../../../collections/src/families/exact-counts.ts";
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import { binaryTreeParentArrays } from "./binary-tree-parents.ts";
import { binaryTrees, fullKAryTrees } from "./kary-trees.ts";
import { orderedTrees } from "./ordered-trees.ts";
import {
  BinaryTreeUnrank,
  BinaryTreeRank,
  IsBinaryTree,
  type BinTree,
  KAryTreeUnrank,
  KAryTreeRank,
  IsKAryTree,
  type KTree,
  OrderedTreeCount,
  OrderedTreeUnrank,
  OrderedTreeRank,
  IsOrderedTree,
  type OrdTree,
} from "../../../collections/src/families/kernels-extra.ts";
// The nested families are Epsil definitions interpreted (a nested element has no compiled type), with
// the TS kernels, which recurse over the tree natively, as their `fast` paths.
export const binaryTreesFast: FastKernel = {
  count: ([n]) => catalanExact(n),
  unrank: ([n], r) => BinaryTreeUnrank(n, r),
  valid: (e, [n]) => IsBinaryTree(e, n),
  rank: (e) => BinaryTreeRank(e as BinTree),
};
export const fullKAryTreesFast: FastKernel = {
  count: ([n, k]) => fussCatalanExact(n, k),
  unrank: ([n, k], r) => KAryTreeUnrank(n, k, r),
  valid: (e, [n, k]) => IsKAryTree(e, n, k),
  rank: (e, [, k]) => KAryTreeRank(e as KTree, k),
};
export const orderedTreesFast: FastKernel = {
  count: ([n]) => OrderedTreeCount(n),
  unrank: ([n], r) => OrderedTreeUnrank(n, r),
  valid: (e, [n]) => IsOrderedTree(e, n),
  rank: (e) => OrderedTreeRank(e as OrdTree),
};

export const entries: (NumberKernel | EpsilFamily)[] = [
  { ...binaryTrees, fast: binaryTreesFast },
  { ...binaryTreeParentArrays, fastCount: ([n]) => catalanExact(n) },
  { ...fullKAryTrees, fast: fullKAryTreesFast },
  { ...orderedTrees, fast: orderedTreesFast },
];
