// A binary tree three ways: nested (`BinaryTree`: leaf 0, node [left, right], as the
// BinaryTrees collection lists them), as its in-order parent array (`BinaryTreeParentArray`:
// entry k holds the parent of the k-th node in order, 0 at the root, which is what
// `BinarySearchTreeParentArray` builds; see bst.ts), and as a Dyck path. Building a nested value
// is recursion an Epsil fold can't express, so these maps are kernels over MathJSON.

type Tree = 0 | readonly [Tree, Tree];
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

export function parentArrayOf(tree: Tree): number[] {
  const parents: number[] = [];
  let next = 1;
  const walk = (t: Tree): number => {
    if (t === 0) return 0;
    const left = walk(t[0]);
    const me = next++;
    const right = walk(t[1]);
    if (left !== 0) parents[left - 1] = me;
    if (right !== 0) parents[right - 1] = me;
    return me;
  };
  const root = walk(tree);
  if (root !== 0) parents[root - 1] = 0;
  return parents;
}

/** The tree an in-order parent array describes, or undefined when it describes none. */
export function treeOfParentArray(parents: readonly number[]): Tree | undefined {
  const n = parents.length;
  const left = Array.from({ length: n + 1 }, () => 0);
  const right = Array.from({ length: n + 1 }, () => 0);
  let root = 0;
  for (let v = 1; v <= n; v++) {
    const p = parents[v - 1]!;
    if (p < 0 || p > n || p === v) return undefined;
    if (p === 0) {
      if (root !== 0) return undefined;
      root = v;
    } else if (v < p) {
      if (left[p] !== 0) return undefined;
      left[p] = v;
    } else {
      if (right[p] !== 0) return undefined;
      right[p] = v;
    }
  }
  const build = (v: number, depth: number): Tree | undefined => {
    if (v === 0) return 0;
    if (depth > n) return undefined; // a cycle
    const l = build(left[v]!, depth + 1);
    const r = build(right[v]!, depth + 1);
    return l === undefined || r === undefined ? undefined : [l, r];
  };
  const tree = n === 0 ? 0 : build(root, 0);
  // Parentage alone doesn't force in-order labels; the round trip does.
  return tree !== undefined && parentArrayOf(tree).every((p, i) => p === parents[i]) ? tree : undefined;
}

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
