// FindStat writes each object as text (`[2,1]`, `{{1,3},{2}}`, `[.,[.,.]]`); the carrier value
// we read it as, for the carriers whose text has been checked against our own, and the object's
// size, which the by-value matching caps. Where FindStat and we differ the reader says so.

import type { MathJSON } from "../../src/statistics/types.ts";

const list = (items: readonly MathJSON[]): MathJSON => ["List", ...items];
const ints = (text: string): number[] => JSON.parse(text) as number[];
const intList = (text: string): MathJSON => list(ints(text));
const rows = (text: string): MathJSON => list((JSON.parse(text) as number[][]).map((row) => list(row)));
const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);
const count = (text: string, pattern: RegExp): number => text.match(pattern)?.length ?? 0;

/** `{{1,3},{2}}` and `[{1},{2,3}]`: braces are blocks, so read them as lists. */
const blocks = (text: string): MathJSON =>
  list((JSON.parse(text.replace(/\{/g, "[").replace(/\}/g, "]")) as number[][]).map((block) => list(block)));

/** `[(1,2),(3,4)]` as the 2-element blocks `[[1,2],[3,4]]`. */
const pairs = (text: string): MathJSON =>
  list((JSON.parse(text.replace(/\(/g, "[").replace(/\)/g, "]")) as number[][]).map((pair) => list(pair)));

/** `[.,[.,.]]`: `.` is the empty tree, `[L,R]` a node with its left and right subtrees. */
function binaryTree(text: string): MathJSON {
  let at = 0;
  const tree = (): MathJSON => {
    if (text[at] === ".") {
      at++;
      return 0;
    }
    if (text[at] !== "[") throw new SyntaxError(`binary tree: unexpected ${text[at] ?? "end"} at ${at}`);
    at++;
    const left = tree();
    if (text[at++] !== ",") throw new SyntaxError(`binary tree: expected "," at ${at - 1}`);
    const right = tree();
    if (text[at++] !== "]") throw new SyntaxError(`binary tree: expected "]" at ${at - 1}`);
    return list([left, right]);
  };
  const result = tree();
  if (at !== text.length) throw new SyntaxError(`binary tree: trailing text at ${at}`);
  return result;
}

/** `[[],[[]]]`: a node is the list of its children, so `[]` is a single vertex. */
const orderedTree = (text: string): MathJSON => {
  const node = (value: unknown): MathJSON => {
    if (!Array.isArray(value)) throw new SyntaxError("ordered tree: expected a list of children");
    return list(value.map(node));
  };
  return node(JSON.parse(text));
};

interface Reader {
  readonly read: (text: string) => MathJSON;
  /** The size FindStat's tables are cut at: the length, sum or node count the collection grows by. */
  readonly size: (text: string) => number;
}

const READERS: Readonly<Record<string, Reader>> = {
  Permutation: { read: (t) => ["Permutation", intList(t)], size: (t) => ints(t).length },
  IntegerPartition: { read: (t) => ["IntegerPartition", intList(t)], size: (t) => sum(ints(t)) },
  // A Dyck path is its 0/1 steps: 1 up, 0 down; its size the semilength.
  DyckPath: { read: (t) => ["DyckPath", intList(t)], size: (t) => ints(t).length / 2 },
  SetPartition: { read: (t) => ["SetPartition", blocks(t)], size: (t) => count(t, /\d+/g) },
  // The word as a string of letters: `0110`, the empty word `""`.
  BinaryWord: {
    read: (t) => {
      if (!/^[01]*$/.test(t)) throw new SyntaxError("binary word: not 0s and 1s");
      return ["BinaryWord", list(t.split("").map(Number))];
    },
    size: (t) => t.length,
  },
  Composition: { read: (t) => ["Composition", intList(t)], size: (t) => sum(ints(t)) },
  // Signs are on the values and the entries are 1..n, as ours.
  SignedPermutation: { read: (t) => ["SignedPermutation", intList(t)], size: (t) => ints(t).length },
  // Same orientation as ours: a node is [left, right] and the empty tree is 0. Size is the node count.
  BinaryTree: { read: (t) => ["BinaryTree", binaryTree(t)], size: (t) => count(t, /\[/g) },
  // Ours is the same nesting; size is the edge count (a vertex per bracket, less the root).
  OrderedTree: { read: (t) => ["OrderedTree", orderedTree(t)], size: (t) => count(t, /\[/g) - 1 },
  // Rows, English notation, entries 1..n; size the entry count.
  StandardTableau: {
    read: (t) => ["StandardTableau", rows(t)],
    size: (t) => sum((JSON.parse(t) as number[][]).map((r) => r.length)),
  },
  // 1-based: entry i is the spot car i prefers, as ours.
  ParkingFunction: { read: (t) => ["ParkingFunction", intList(t)], size: (t) => ints(t).length },
  // Ours reads a matching as the set partition of its 2-element blocks (PerfectMatchings yields
  // SetPartitions, not the PerfectMatching carrier); size the number of points.
  PerfectMatching: { read: (t) => ["SetPartition", pairs(t)], size: (t) => count(t, /\d+/g) },
  // Rows of -1, 0, 1. Our AlternatingSignMatrices family yields the bare rows; this is the carrier's constructor on them.
  AlternatingSignMatrix: {
    read: (t) => ["AlternatingSignMatrix", rows(t)],
    size: (t) => (JSON.parse(t) as number[][]).length,
  },
  SetComposition: { read: (t) => ["SetComposition", blocks(t)], size: (t) => count(t, /\d+/g) },
};

/** The carrier value FindStat's `text` names, or `undefined` for a carrier we don't read. A malformed text throws. */
export const readObject = (carrier: string, text: string): MathJSON | undefined => READERS[carrier]?.read(text);

/** The size of the object FindStat's `text` names, or `undefined` for a carrier we don't read. */
export const objectSize = (carrier: string, text: string): number | undefined => READERS[carrier]?.size(text);

/** FindStat's collections that are one of our carriers, whether or not we read their objects. */
export const COLLECTION_CARRIER: Readonly<Record<string, string>> = {
  Permutations: "Permutation",
  "Signed permutations": "SignedPermutation",
  "Decorated permutations": "DecoratedPermutation",
  "Dyck paths": "DyckPath",
  "Integer partitions": "IntegerPartition",
  "Skew partitions": "SkewPartition",
  Cores: "CorePartition",
  "Set partitions": "SetPartition",
  "Ordered set partitions": "SetComposition",
  "Integer compositions": "Composition",
  "Binary words": "BinaryWord",
  "Binary trees": "BinaryTree",
  "Ordered trees": "OrderedTree",
  "Perfect matchings": "PerfectMatching",
  "Parking functions": "ParkingFunction",
  "Alternating sign matrices": "AlternatingSignMatrix",
  "Standard tableaux": "StandardTableau",
  "Semistandard tableaux": "SemistandardTableau",
  "Plane partitions": "PlanePartition",
  "Gelfand-Tsetlin patterns": "GelfandTsetlinPattern",
};

/** The carriers whose text we read. */
export const readableCarriers = (): string[] => Object.keys(READERS);
