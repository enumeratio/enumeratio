// A binary tree three ways: nested (`BinaryTree`: leaf 0, node [left, right], as the
// BinaryTrees collection lists them), as its in-order parent array (`BinaryTreeParentArray`:
// entry k holds the parent of the k-th node in order, 0 at the root, which is what
// `BinarySearchTreeParentArray` builds; see bst.ts), and as a Dyck path. Building a nested value
// is recursion an Epsil fold can't express, so these maps are kernels over MathJSON.
//
// The parent-array recursion itself is the collections family kernel's own
// (`BinaryTreeParentArray`/`BinaryTreeOfParentArray` in
// ../../collections/src/families/kernels-extra.ts, which enumerates `BinaryTreeParentArrays(n)`
// natively); this module only adds the MathJSON encode/decode boundary a map runs over.
import {
  BinaryTreeOfParentArray,
  BinaryTreeParentArray,
  type BinTree,
} from "../../collections/src/families/kernels-extra.ts";

type Tree = BinTree;
type MathJSON = unknown;

const decodeTree = (json: MathJSON): Tree | undefined => {
  if (json === 0) return 0;
  if (!Array.isArray(json) || json[0] !== "List" || json.length !== 3) return undefined;
  const left = decodeTree(json[1]);
  const right = decodeTree(json[2]);
  return left === undefined || right === undefined ? undefined : [left, right];
};
const encodeTree = (tree: Tree): MathJSON => (tree === 0 ? 0 : ["List", encodeTree(tree[0]), encodeTree(tree[1])]);

const decodeInts = (json: MathJSON): number[] | undefined =>
  Array.isArray(json) && json[0] === "List" && json.slice(1).every((x) => Number.isInteger(x))
    ? (json.slice(1) as number[])
    : undefined;
const encodeInts = (values: readonly number[]): MathJSON => ["List", ...values];

export const parentArrayOf = BinaryTreeParentArray;

/** The tree an in-order parent array describes, or undefined when it describes none. */
export const treeOfParentArray = BinaryTreeOfParentArray;

/** φ([L, R]) = U φ(L) D φ(R), FindStat's Mp00012. BinaryTrees is ranked through it. */
export function dyckPathOf(tree: Tree): number[] {
  return tree === 0 ? [] : [1, ...dyckPathOf(tree[0]), 0, ...dyckPathOf(tree[1])];
}

export function treeOfDyckPath(word: readonly number[]): Tree | undefined {
  if (word.length === 0) return 0;
  if (word[0] !== 1) return undefined;
  let height = 0;
  for (let j = 0; j < word.length; j++) {
    height += word[j] === 1 ? 1 : word[j] === 0 ? -1 : Number.NaN;
    if (!(height >= 0)) return undefined;
    if (height === 0) {
      const left = treeOfDyckPath(word.slice(1, j));
      const right = treeOfDyckPath(word.slice(j + 1));
      return left === undefined || right === undefined ? undefined : [left, right];
    }
  }
  return undefined;
}

// The kernels a map runs over its subject's contents; undefined declines.
export const binaryTreeParentArrayKernel = (json: MathJSON): MathJSON => {
  const tree = decodeTree(json);
  return tree === undefined ? undefined : encodeInts(parentArrayOf(tree));
};
export const binaryTreeOfParentArrayKernel = (json: MathJSON): MathJSON => {
  const parents = decodeInts(json);
  const tree = parents === undefined ? undefined : treeOfParentArray(parents);
  return tree === undefined ? undefined : encodeTree(tree);
};
export const dyckPathKernel = (json: MathJSON): MathJSON => {
  const tree = decodeTree(json);
  return tree === undefined ? undefined : encodeInts(dyckPathOf(tree));
};
export const binaryTreeOfDyckPathKernel = (json: MathJSON): MathJSON => {
  const word = decodeInts(json);
  const tree = word === undefined ? undefined : treeOfDyckPath(word);
  return tree === undefined ? undefined : encodeTree(tree);
};
