// BinaryTrees/BinaryTreeParentArrays split out of collections/src/families/core.ts (which mixed
// every area) per https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 -- the only two families in core.ts's "trees with nested elements" section carrying a
// carrier ("BinaryTree" / "BinaryTreeParentArray"). KAryTrees/OrderedTrees declare none and stay
// in collections per step 5 rule 4. The generic kernel math stays in
// collections/src/families/kernels*.ts.
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import {
  BinaryTreeCount,
  BinaryTreeUnrank,
  BinaryTreeRank,
  IsBinaryTree,
  BinaryTreeParentArray,
  BinaryTreeOfParentArray,
  IsBinaryTreeParentArray,
  type BinTree,
} from "../../../collections/src/families/kernels-extra.ts";

export const entries: NumberKernel[] = [
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
  {
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
  },
];
