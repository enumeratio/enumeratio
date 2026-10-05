// BinaryTrees/BinaryTreeParentArrays split out of collections/src/families/core.ts (which mixed
// every area) per https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 -- the only two families in core.ts's "trees with nested elements" section carrying a
// carrier ("BinaryTree" / "BinaryTreeParentArray"). FullKAryTrees/OrderedTrees moved in alongside
// them (wire-carriers lane A-92): their carriers -- FullKAryTree, OrderedTree -- go NESTED, matching
// BinaryTree's own shape (`integer | list<any>`, https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible,
// #401), since both families' elements already are (kind "nested": KTree = 0 | KTree[], OrdTree
// = OrdTree[]). The generic kernel math stays in collections/src/families/kernels*.ts.
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import { binaryTreeParentArrays } from "./binary-tree-parents.ts";
import {
  BinaryTreeCount,
  BinaryTreeUnrank,
  BinaryTreeRank,
  IsBinaryTree,
  BinaryTreeParentArray,
  BinaryTreeOfParentArray,
  IsBinaryTreeParentArray,
  type BinTree,
  KAryTreeCount,
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

export const binaryTreeParentArraysKernel: NumberKernel = {
  declared: {
    carrier: "BinaryTreeParentArray",
    params: [{ name: "n", role: "axis", min: 0 }],
    cost: { count: "closed", unrank: "polynomial", rank: "polynomial", valid: "polynomial" },
  },
  head: "BinaryTreeParentArrays",
  paramCount: 1,
  kind: "ints",
  carrier: "BinaryTreeParentArray",
  count: ([n]) => BinaryTreeCount(n),
  unrank: ([n], r) => BinaryTreeParentArray(BinaryTreeUnrank(n, r)),
  valid: (e, [n]) => IsBinaryTreeParentArray(e, n),
  rank: (e) => BinaryTreeRank(BinaryTreeOfParentArray(e as number[]) ?? 0),
};

// The nested families stay TS kernels: a nested element has no compiled type, so an Epsil
// definition would only be interpreted, and recursing over the tree is what the kernels do natively.
export const entries: (NumberKernel | EpsilFamily)[] = [
  {
    head: "BinaryTrees",
    paramCount: 1,
    kind: "nested",
    carrier: "BinaryTree",
    count: ([n]) => BinaryTreeCount(n),
    unrank: ([n], r) => BinaryTreeUnrank(n, r),
    valid: (e, [n]) => IsBinaryTree(e, n),
    rank: (e) => BinaryTreeRank(e as BinTree),
  },
  { ...binaryTreeParentArrays, fast: binaryTreeParentArraysKernel },
  {
    head: "FullKAryTrees",
    paramCount: 2,
    kind: "nested",
    carrier: "FullKAryTree",
    count: ([n, k]) => KAryTreeCount(n, k),
    unrank: ([n, k], r) => KAryTreeUnrank(n, k, r),
    valid: (e, [n, k]) => IsKAryTree(e, n, k),
    rank: (e, [, k]) => KAryTreeRank(e as KTree, k),
  },
  {
    head: "OrderedTrees",
    paramCount: 1,
    kind: "nested",
    carrier: "OrderedTree",
    count: ([n]) => OrderedTreeCount(n),
    unrank: ([n], r) => OrderedTreeUnrank(n, r),
    valid: (e, [n]) => IsOrderedTree(e, n),
    rank: (e) => OrderedTreeRank(e as OrdTree),
  },
];
