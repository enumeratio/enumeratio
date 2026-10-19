// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { BinaryTreeRank, BinaryTreeUnrank } from "../../../collections/src/families/kernels-extra.ts";
import { type NumberKernel } from "../../../collections/src/families/types.ts";
import {
  BinaryTreeCount,
  BinaryTreeOfParentArray,
  BinaryTreeParentArray,
  IsBinaryTreeParentArray,
} from "./collections-kernels-extra.ts";

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
