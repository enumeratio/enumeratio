// Independent readings of the tree statistics adopted from FindStat, written against the
// definitions in FindStat's words (a node and its subtrees) rather than against the expressions.
//
// A binary tree is 0 (empty) or [left, right]; an ordered tree is the list of its children's
// trees, so a single vertex is [].
export type Binary = 0 | readonly [Binary, Binary];
export type Ordered = readonly Ordered[];

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const product = (a: readonly number[]): number => a.reduce((x, y) => x * y, 1);
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
const maximum = (a: readonly number[]): number => (a.length === 0 ? 0 : Math.max(...a));

/** Every nonempty subtree of a binary tree, the tree itself first. */
const binarySubtrees = (t: Binary): (readonly [Binary, Binary])[] =>
  t === 0 ? [] : [t, ...binarySubtrees(t[0]), ...binarySubtrees(t[1])];
/** Every subtree of an ordered tree (one per vertex), the tree itself first. */
const orderedSubtrees = (t: Ordered): Ordered[] => [t, ...t.flatMap(orderedSubtrees)];

const binarySize = (t: Binary): number => binarySubtrees(t).length;
const orderedSize = (t: Ordered): number => orderedSubtrees(t).length;

const binaryHeight = (t: Binary): number => (t === 0 ? 0 : 1 + Math.max(binaryHeight(t[0]), binaryHeight(t[1])));
const orderedHeight = (t: Ordered): number => (t.length === 0 ? 0 : 1 + maximum(t.map(orderedHeight)));

/** The vertices of a tree with their depths, as (subtree, depth) pairs. */
const binaryDepths = (t: Binary, d = 0): [readonly [Binary, Binary], number][] =>
  t === 0 ? [] : [[t, d], ...binaryDepths(t[0], d + 1), ...binaryDepths(t[1], d + 1)];
const orderedDepths = (t: Ordered, d = 0): [Ordered, number][] => [
  [t, d],
  ...t.flatMap((c) => orderedDepths(c, d + 1)),
];

/** Horton-Strahler number: the register function, with the empty tree at 0. */
const binaryStrahler = (t: Binary): number => {
  if (t === 0) return 0;
  const [a, b] = [binaryStrahler(t[0]), binaryStrahler(t[1])];
  return a === b ? a + 1 : Math.max(a, b);
};
const orderedStrahler = (t: Ordered): number => {
  if (t.length === 0) return 1;
  const values = t.map(orderedStrahler);
  const top = Math.max(...values);
  return values.filter((v) => v === top).length === 1 ? top : top + 1;
};

const key = (t: unknown): string => JSON.stringify(t);

export const BINARY_READINGS: Record<string, (t: Binary) => number> = {
  LinearExtensionCount: (t) => factorial(binarySize(t)) / product(binarySubtrees(t).map(binarySize)),
  Height: binaryHeight,
  LeftSubtreeSize: (t) => (t === 0 ? 0 : binarySize(t[0])),
  LeftSpine: (t) => {
    let n = 0;
    for (let v = t; v !== 0; v = v[0]) n++;
    return n;
  },
  BinaryNodes: (t) => binarySubtrees(t).filter((s) => s[0] !== 0 && s[1] !== 0).length,
  Leaves: (t) => binarySubtrees(t).filter((s) => s[0] === 0 && s[1] === 0).length,
  UnaryNodes: (t) => binarySubtrees(t).filter((s) => (s[0] === 0) !== (s[1] === 0)).length,
  StrahlerNumber: binaryStrahler,
  PathLength: (t) => sum(binaryDepths(t).map(([, d]) => d)),
  ExternalPathLength: (t) => sum(binaryDepths(t).map(([, d]) => d)) + 2 * binarySize(t),
  Pitchforks: (t) => binarySubtrees(t).filter((s) => binarySize(s) === 2).length,
  TreeFactorial: (t) => product(binarySubtrees(t).map(binarySize)),
  MaximalLeftBranches: (t) => {
    const starts = (s: Binary, isLeftChild: boolean): number =>
      s === 0 ? 0 : (s[0] !== 0 && !isLeftChild ? 1 : 0) + starts(s[0], true) + starts(s[1], false);
    return starts(t, false);
  },
  CollessIndex: (t) => sum(binarySubtrees(t).map((s) => Math.abs(binarySize(s[0]) - binarySize(s[1])))),
  DistinctSubtrees: (t) => new Set(binarySubtrees(t).map(key)).size,
  ProtectionNumber: (t) =>
    t === 0 ? 0 : 1 + Math.min(BINARY_READINGS.ProtectionNumber!(t[0]), BINARY_READINGS.ProtectionNumber!(t[1])),
};

export const ORDERED_READINGS: Record<string, (t: Ordered) => number> = {
  RootDegree: (t) => t.length,
  LinearExtensionCount: (t) => factorial(orderedSize(t)) / product(orderedSubtrees(t).map(orderedSize)),
  Height: orderedHeight,
  Leaves: (t) => orderedSubtrees(t).filter((s) => s.length === 0).length,
  NonRootInternalNodes: (t) => orderedSubtrees(t).filter((s) => s !== t && s.length > 0).length,
  MaximumOutDegree: (t) => maximum(orderedSubtrees(t).map((s) => s.length)),
  StrahlerNumber: orderedStrahler,
  PathLength: (t) => sum(orderedDepths(t).map(([, d]) => d)),
  TreeFactorial: (t) => product(orderedSubtrees(t).map(orderedSize)),
  DistinctSubtrees: (t) => new Set(orderedSubtrees(t).map(key)).size,
  ProtectionNumber: (t) => (t.length === 0 ? 0 : 1 + Math.min(...t.map(ORDERED_READINGS.ProtectionNumber!))),
  BoundaryLength: (t) => {
    let n = 0;
    for (let v = t; v.length > 0; v = v[0]!) n++;
    for (let v = t; v.length > 0; v = v.at(-1)!) n++;
    return n;
  },
  TrunkLength: (t) => {
    let n = 0;
    for (let v = t; v.length === 1; v = v[0]!) n++;
    return n;
  },
  Breadth: (t) => {
    const perDepth = new Map<number, number>();
    for (const [, d] of orderedDepths(t)) perDepth.set(d, (perDepth.get(d) ?? 0) + 1);
    return maximum([...perDepth.values()]);
  },
};
