// Binary-tree and ordered-tree statistics, over `_x` = the tree as its carrier nests it.
//
// A binary tree is 0 (empty) or [left, right]. An ordered tree is the list of its children's
// trees, so a single vertex is []. Recursion is `recurse`/`self`: the function is handed itself,
// so each body is one closed expression. A lambda inside a body sees `self` but not the
// recursion's other parameters, so a body that maps over children passes nothing down.

import { isLeaf as leafTest, recurse as recurseOver, self as callSelf } from "../../src/recursion.ts";
import type { Definition, MathJSON } from "../../src/statistics/types.ts";
import { add, and, count, equals, fold, forEach, less, subtract, x } from "../../src/statistics/vocabulary.ts";

const isLeaf = leafTest as (tree: MathJSON) => MathJSON;
const self = callSelf as (...args: readonly MathJSON[]) => MathJSON;
const recurse = recurseOver as (body: MathJSON, params: readonly string[], ...args: readonly MathJSON[]) => MathJSON;

const stat = (on: string, head: string, summary: string, expr: MathJSON, note?: string): Definition => ({
  head,
  on,
  summary,
  expr,
  ...(note ? { note } : {}),
});
const binary = (head: string, summary: string, expr: MathJSON, note?: string) =>
  stat("BinaryTree", head, summary, expr, note);
const ordered = (head: string, summary: string, expr: MathJSON, note?: string) =>
  stat("OrderedTree", head, summary, expr, note);

const ifThen = (test: MathJSON, then: MathJSON, otherwise: MathJSON = 0): MathJSON => ["If", test, then, otherwise];
const list = (...items: MathJSON[]): MathJSON => ["List", ...items];

// ── binary trees ─────────────────────────────────────────────────────────────────────────

const left = (t: MathJSON): MathJSON => ["At", t, 1];
const right = (t: MathJSON): MathJSON => ["At", t, 2];

/** How many nodes a binary tree has: its empty subtrees number one more, and `Flatten` counts them at once. */
const nodesOf = (t: MathJSON): MathJSON => subtract(["Length", ["Flatten", list(t)]], 1);

/** The sum over every node `t` of `tree` of `contribution`, which reads the node as `t`. */
const overNodes = (contribution: MathJSON, tree: MathJSON = x): MathJSON =>
  recurse(ifThen(isLeaf("t"), 0, ["Add", contribution, self(left("t")), self(right("t"))]), ["t"], tree);

const noLeft = isLeaf(left("t"));
const noRight = isLeaf(right("t"));

/** The product over every node of the number of nodes at or below it. */
const treeFactorialOf = (tree: MathJSON): MathJSON =>
  recurse(ifThen(isLeaf("f"), 1, ["Multiply", nodesOf("f"), self(left("f")), self(right("f"))]), ["f"], tree);

/** The sum of the depths of the nodes, the root's being 0. */
const depthSum: MathJSON = recurse(
  ifThen(isLeaf("t"), 0, ["Add", "level", self(left("t"), add("level", 1)), self(right("t"), add("level", 1))]),
  ["t", "level"],
  x,
  0,
);

/** Every nonempty subtree of a binary tree, with repeats, the tree first. */
const binarySubtrees: MathJSON = recurse(
  ifThen(isLeaf("t"), list(), ["Join", list("t"), self(left("t")), self(right("t"))]),
  ["t"],
  x,
);

/** The nodes on the chain that starts at the tree and always takes the child at position `child`. */
const chainNodes = (child: number): MathJSON =>
  recurse(ifThen(isLeaf("t"), 0, add(1, self(["At", "t", child]))), ["t"], x);

/** The nodes on the left spine or the right spine, the root once. */
const boundaryNodes: MathJSON = ifThen(isLeaf(x), 0, subtract(add(chainNodes(1), chainNodes(2)), 1));

const twoChildren = ifThen(noLeft, 0, ifThen(noRight, 0, 1));

/** Field `n` of the pair bound to `name`. */
const pairOf = (name: MathJSON, n: number): MathJSON => ["At", name, n];

/** The pair [height in nodes, sum of the heights of the nodes]. */
const heightAndHeightSum: MathJSON = recurse(
  ifThen(isLeaf("t"), list(0, 0), [
    "Apply",
    [
      "Function",
      list(
        add(1, ["Max", pairOf("a", 1), pairOf("b", 1)]),
        add(add(1, ["Max", pairOf("a", 1), pairOf("b", 1)]), add(pairOf("a", 2), pairOf("b", 2))),
      ),
      ["Typed", "a", "'collection'"],
      ["Typed", "b", "'collection'"],
    ],
    self(left("t")),
    self(right("t")),
  ]),
  ["t"],
  x,
);

/** The hooks of a decomposition: `mode` 0 is a whole tree, 1 the left chain below a node, 2 the right chain. */
const hookCount: MathJSON = recurse(
  ifThen(isLeaf("t"), 0, [
    "If",
    equals("mode", 0),
    add(1, add(self(left("t"), 1), self(right("t"), 2))),
    [
      "If",
      equals("mode", 1),
      add(self(right("t"), 0), self(left("t"), 1)),
      add(self(left("t"), 0), self(right("t"), 2)),
    ],
  ]),
  ["t", "mode"],
  x,
  0,
);

/** The nodes from which the chain of children named by `directions` (1 left, 2 right) stays inside the tree. */
const pathsStarting = (directions: readonly number[]): MathJSON => {
  const walk = (node: MathJSON, rest: readonly number[]): MathJSON =>
    rest.length === 0
      ? 1
      : (() => {
          const child = ["At", node, rest[0]] as MathJSON;
          return ifThen(isLeaf(child), 0, walk(child, rest.slice(1)));
        })();
  return overNodes(walk("t", directions));
};

// ── ordered trees ────────────────────────────────────────────────────────────────────────

// `Max`/`Min` of a `Map` stay unevaluated inside a nested recursion (a vertex with two children
// whose own child has two), so extremes of the children are folds.
const largest = (over: MathJSON): MathJSON => fold(over, 0, ["Max", "a", "b"]);
const smallest = (over: MathJSON): MathJSON => fold(over, "PositiveInfinity", ["Min", "a", "b"]);

/** `body` for each child of `t`, as a list; `c` is the child. */
const overChildren = (t: MathJSON, body: MathJSON): MathJSON => ["Map", ["Function", body, "c"], t];
const childless = (t: MathJSON): MathJSON => equals(["Length", t], 0);

/** n!, with 0! and 1! stated: `Range(1, 0)` counts down. */
const factorialOf = (n: MathJSON): MathJSON => ifThen(less(n, 2), 1, ["Product", ["Range", 1, n]]);

const at = (list: MathJSON, index: number): MathJSON => ["At", list, index];

/**
 * The pair [vertices, other] of an ordered tree, `other` carried from the children's pairs: they
 * are folded by `step` (over accumulator `a`, child `b`) from [0, `start`], and `finish` (over the
 * fold `r`) makes the vertex's own pair. One pass, where a vertex count per vertex would nest a
 * recursion in another. A leaf's pair is `leaf`; the recursion needs that base case spelled out.
 */
const pairOver = (leaf: MathJSON, start: MathJSON, step: MathJSON, finish: MathJSON): MathJSON =>
  recurse(
    ifThen(childless("t"), leaf, [
      "Apply",
      ["Function", finish, ["Typed", "r", "'collection'"]],
      fold(overChildren("t", self("c")), list(0, start), step),
    ]),
    ["t"],
    x,
  );

/** [vertices, sum of the depths of the vertices]: each child's vertices sit one deeper in the parent. */
const verticesAndPathLength: MathJSON = pairOver(
  list(1, 0),
  0,
  list(add(at("a", 1), at("b", 1)), add(at("a", 2), add(at("b", 1), at("b", 2)))),
  list(add(1, at("r", 1)), at("r", 2)),
);

/** [vertices, product, over the vertices, of the vertices at or below each]. */
const verticesAndTreeFactorial: MathJSON = pairOver(
  list(1, 1),
  1,
  list(add(at("a", 1), at("b", 1)), ["Multiply", at("a", 2), at("b", 2)]),
  list(add(1, at("r", 1)), ["Multiply", add(1, at("r", 1)), at("r", 2)]),
);

/** Every subtree of an ordered tree, with repeats, the tree first. */
const orderedSubtrees: MathJSON = recurse(
  ifThen(childless("t"), list("t"), [
    "Join",
    list("t"),
    fold(overChildren("t", self("c")), list(), ["Join", "a", "b"]),
  ]),
  ["t"],
  x,
);

/** The number of edges on the path that always takes the child at position `child` of `t`. */
const edgesAlong = (child: MathJSON): MathJSON =>
  recurse(ifThen(childless("t"), 0, add(1, self(["At", "t", child]))), ["t"], x);

/**
 * The product, over the vertices, of the factorials of how many times each child tree occurs.
 * A map over the subtrees rather than a recursion, so the lambdas inside may read the vertex:
 * two child trees are equal when they are one after `Unique`.
 */
const automorphisms: MathJSON = fold(
  forEach(
    orderedSubtrees,
    ifThen(
      childless("s"),
      1,
      fold(
        forEach(["Unique", "s"], factorialOf(count("s", equals(["Length", ["Unique", list("k", "u")]], 1), "k")), "u"),
        1,
        ["Multiply", "a", "b"],
      ),
    ),
    "s",
  ),
  1,
  ["Multiply", "a", "b"],
);

/** [vertices, edges-to-nearest-leaf summary]: the number of vertices whose nearest leaf is `distance` away, and the root's own distance. */
const nearestLeafCounts = (distance: number): MathJSON =>
  pairOver(
    list(distance === 0 ? 1 : 0, 0),
    "PositiveInfinity",
    list(add(at("a", 1), at("b", 1)), ["Min", at("a", 2), at("b", 2)]),
    list(add(at("r", 1), ifThen(equals(add(1, at("r", 2)), distance), 1)), add(1, at("r", 2))),
  );

/**
 * [whether the tree is a chain (a leaf, or one child that is), how many prunings it takes to
 * become a chain (1 if it is already one), the most that takes among its non-chain children].
 * Pruning deletes the chains hanging off a vertex, so a tree is a chain after one pruning more
 * than its second-slowest non-chain child, or as slow as its slowest. The fold carries the
 * two slowest, the number of children, and whether the last one is a chain.
 */
const chainAndPruning: MathJSON = recurse(
  ifThen(childless("t"), list(1, 0, 0), [
    "Apply",
    [
      "Function",
      list(
        ifThen(and(equals(at("r", 3), 1), equals(at("r", 4), 1)), 1),
        ifThen(and(equals(at("r", 3), 1), equals(at("r", 4), 1)), 0, ["Max", 1, at("r", 1), add(at("r", 2), 1)]),
        at("r", 1),
      ),
      ["Typed", "r", "'collection'"],
    ],
    fold(
      overChildren("t", self("c")),
      list(0, 0, 0, 1),
      list(
        ifThen(equals(at("b", 1), 0), ["Max", at("a", 1), at("b", 2)], at("a", 1)),
        ifThen(equals(at("b", 1), 0), ["Max", at("a", 2), ["Min", at("a", 1), at("b", 2)]], at("a", 2)),
        add(at("a", 3), 1),
        at("b", 1),
      ),
    ),
  ]),
  ["t"],
  x,
);

/** The edges from the root down while a vertex has exactly one child. */
const trunkLength: MathJSON = recurse(ifThen(equals(["Length", "t"], 1), add(1, self(["At", "t", 1])), 0), ["t"], x);

export const TREE_STATISTICS: readonly Definition[] = [
  // ── binary trees ──
  binary(
    "Height",
    "The height: the most nodes on a path from the root, 0 for the empty tree.",
    recurse(ifThen(isLeaf("t"), 0, add(1, ["Max", self(left("t")), self(right("t"))])), ["t"], x),
  ),
  binary(
    "LeftSubtreeSize",
    "The number of nodes in the left subtree of the root.",
    recurse(ifThen(isLeaf("t"), 0, nodesOf(left("t"))), ["t"], x),
  ),
  binary(
    "LeftSpine",
    "The number of nodes on the left spine: the root and its chain of left children.",
    recurse(ifThen(isLeaf("t"), 0, add(1, self(left("t")))), ["t"], x),
    "Counts nodes, root included.",
  ),
  binary("Leaves", "The number of nodes with no children.", overNodes(ifThen(and(noLeft, noRight), 1))),
  binary(
    "UnaryNodes",
    "The number of nodes with exactly one child.",
    overNodes(ifThen(noLeft, ifThen(noRight, 0, 1), ifThen(noRight, 1, 0))),
  ),
  binary(
    "BinaryNodes",
    "The number of nodes with two children.",
    overNodes(ifThen(noLeft, 0, ifThen(noRight, 0, 1))),
    "Nodes with two children; FindStat calls them branches.",
  ),
  binary(
    "StrahlerNumber",
    "The Horton-Strahler number (register function): 0 for the empty tree, else the larger child's, plus one if the children tie.",
    recurse(
      ifThen(isLeaf("t"), 0, [
        "Apply",
        ["Function", ifThen(equals("a", "b"), add("a", 1), ["Max", "a", "b"]), "a", "b"],
        self(left("t")),
        self(right("t")),
      ]),
      ["t"],
      x,
    ),
  ),
  binary("PathLength", "The sum of the depths of the nodes, the root's being 0: the internal path length.", depthSum),
  binary(
    "ExternalPathLength",
    "The sum of the lengths of the paths from the root to the empty subtrees.",
    add(depthSum, ["Multiply", 2, nodesOf(x)]),
  ),
  binary(
    "Pitchforks",
    "The number of nodes whose subtree has exactly two nodes.",
    overNodes(ifThen(equals(nodesOf("t"), 2), 1)),
  ),
  binary("TreeFactorial", "The product, over the nodes, of the number of nodes at or below each.", treeFactorialOf(x)),
  binary(
    "LinearExtensionCount",
    "The number of linear extensions of the tree as a poset: n! over the tree factorial.",
    ["Divide", factorialOf(nodesOf(x)), treeFactorialOf(x)],
  ),
  binary(
    "CollessIndex",
    "The sum, over the nodes, of how much the node counts of the two subtrees differ.",
    overNodes(["Abs", subtract(nodesOf(left("t")), nodesOf(right("t")))]),
  ),
  binary(
    "MaximalLeftBranches",
    "The number of maximal paths of left edges.",
    recurse(
      ifThen(isLeaf("t"), 0, [
        "Add",
        ifThen(noLeft, 0, ifThen(equals("fromLeft", 0), 1)),
        self(left("t"), 1),
        self(right("t"), 0),
      ]),
      ["t", "fromLeft"],
      x,
      0,
    ),
    "A branch starts at a node with a left child that is not itself a left child.",
  ),
  binary("DistinctSubtrees", "The number of different nonempty subtrees.", ["Length", ["Unique", binarySubtrees]]),
  binary(
    "ProtectionNumber",
    "The edges from the root to the nearest leaf, a binary tree's empty subtree counting as a leaf.",
    recurse(ifThen(isLeaf("t"), 0, add(1, ["Min", self(left("t")), self(right("t"))])), ["t"], x),
  ),
  binary("RightChildCount", "The number of nodes with a right child.", overNodes(ifThen(noRight, 0, 1))),
  binary(
    "RightSubtreeSizeSum",
    "The sum, over the nodes, of the number of nodes in the right subtree.",
    overNodes(nodesOf(right("t"))),
  ),
  binary(
    "ParenthesisCodeValue",
    "The value, read in binary, of the tree's parenthesis word: each node is ( left ) right, with ( as 1 and ) as 0.",
    recurse(
      ifThen(isLeaf("t"), 0, [
        "Add",
        ["Power", 2, subtract(["Multiply", 2, nodesOf("t")], 1)],
        ["Multiply", self(left("t")), ["Power", 2, add(["Multiply", 2, nodesOf(right("t"))], 1)]],
        self(right("t")),
      ]),
      ["t"],
      x,
    ),
    "The word of a tree with n nodes has 2n digits; the empty tree's is empty, worth 0.",
  ),
  binary(
    "BoundaryNodes",
    "The number of nodes on the left spine or the right spine, the root counted once.",
    boundaryNodes,
    "FindStat calls these the external nodes; the name stays off the empty subtrees, which are Knuth's.",
  ),
  binary(
    "NonBoundaryNodes",
    "The number of nodes on neither the left spine nor the right spine.",
    subtract(nodesOf(x), boundaryNodes),
    "FindStat calls these the internal nodes.",
  ),
  binary(
    "NonRootBinaryNodes",
    "The number of nodes other than the root with two children.",
    ifThen(isLeaf(x), 0, add(overNodes(twoChildren, left(x)), overNodes(twoChildren, right(x)))),
    "The nodes of degree 3 in the tree's drawing: two children and a parent.",
  ),
  binary(
    "HookNumber",
    "The number of hooks in the decomposition of the tree into hooks: a node with the chains of left children and of right children below it, the subtrees hanging off those chains decomposed in turn.",
    hookCount,
  ),
  binary(
    "VertexHeightSum",
    "The sum, over the nodes, of the node's height (the most nodes on a path down).",
    pairOf(heightAndHeightSum, 2),
  ),
  ...(
    [
      [2, 2],
      [2, 2, 2],
      [2, 2, 2, 2],
      [2, 2, 1],
      [2, 2, 2, 1],
      [2, 1, 1],
      [2, 1, 1, 1],
      [2, 2, 1, 1],
      [2, 2, 1, 2],
    ] as const
  ).map((steps) =>
    binary(
      `${steps.map((step) => (step === 1 ? "Left" : "Right")).join("")}PathCount`,
      `The number of nodes from which taking the ${steps.map((step) => (step === 1 ? "left" : "right")).join(", then the ")} child stays inside the tree.`,
      pathsStarting(steps),
      "A contiguous pattern of nodes along one path, the subtrees off it anything.",
    ),
  ),

  // ── ordered trees ──
  ordered("RootDegree", "The number of children of the root.", ["Length", x]),
  ordered(
    "Height",
    "The height: the most edges on a path from the root.",
    recurse(ifThen(childless("t"), 0, add(1, largest(overChildren("t", self("c"))))), ["t"], x),
  ),
  ordered(
    "Leaves",
    "The number of vertices with no children.",
    recurse(ifThen(childless("t"), 1, ["Sum", overChildren("t", self("c"))]), ["t"], x),
  ),
  ordered("NonRootInternalNodes", "The number of vertices that are neither the root nor a leaf.", [
    "Sum",
    overChildren(x, recurse(ifThen(childless("s"), 0, add(1, ["Sum", overChildren("s", self("c"))])), ["s"], "c")),
  ]),
  ordered(
    "LargestOutDegree",
    "The most children any vertex has.",
    recurse(ifThen(childless("t"), 0, ["Max", ["Length", "t"], largest(overChildren("t", self("c")))]), ["t"], x),
  ),
  ordered(
    "StrahlerNumber",
    "The Strahler number: a leaf is 1, a vertex takes its largest child's, plus one if that value occurs twice.",
    recurse(
      ifThen(childless("t"), 1, [
        "Apply",
        ["Function", ["Max", ["At", "r", 1], add(["At", "r", 2], 1)], ["Typed", "r", "'collection'"]],
        // The two largest child values, largest first.
        [
          "Fold",
          [
            "Function",
            list(["Max", ["At", "p", 1], "e"], ["Max", ["At", "p", 2], ["Min", ["At", "p", 1], "e"]]),
            "p",
            "e",
          ],
          list(0, 0),
          overChildren("t", self("c")),
        ],
      ]),
      ["t"],
      x,
    ),
  ),
  ordered(
    "PathLength",
    "The sum of the depths of the vertices, the root's being 0.",
    at(verticesAndPathLength, 2),
    "Each vertex below a child sits one deeper than in the child's own tree, so the child contributes its vertex count plus its own path length.",
  ),
  ordered(
    "TreeFactorial",
    "The product, over the vertices, of the number of vertices at or below each.",
    at(verticesAndTreeFactorial, 2),
  ),
  ordered(
    "LinearExtensionCount",
    "The number of linear extensions of the tree as a poset: n! over the tree factorial.",
    [
      "Apply",
      ["Function", ["Divide", factorialOf(at("r", 1)), at("r", 2)], ["Typed", "r", "'collection'"]],
      verticesAndTreeFactorial,
    ],
  ),
  ordered("DistinctSubtrees", "The number of different subtrees.", ["Length", ["Unique", orderedSubtrees]]),
  ordered(
    "ProtectionNumber",
    "The edges from the root to the nearest leaf.",
    recurse(ifThen(childless("t"), 0, add(1, smallest(overChildren("t", self("c"))))), ["t"], x),
  ),
  ordered(
    "BoundaryLength",
    "The edges on the leftmost path from the root plus those on the rightmost.",
    add(edgesAlong(1), edgesAlong(-1)),
  ),
  ordered(
    "TrunkLength",
    "The edges from the root to the first vertex that does not have exactly one child.",
    trunkLength,
  ),
  ordered(
    "Breadth",
    "The most vertices at any one depth.",
    recurse(
      ifThen(equals(["Length", "level"], 0), 0, [
        "Max",
        ["Length", "level"],
        self(fold("level", list(), ["Join", "a", "b"])),
      ]),
      ["level"],
      list(x),
    ),
    "The largest number of nodes on one level, called breadth to keep width for posets.",
  ),
  ordered(
    "LongestPathVertexCount",
    "The most vertices on a path from the root: the height plus one.",
    recurse(ifThen(childless("t"), 1, add(1, largest(overChildren("t", self("c"))))), ["t"], x),
    "FindStat calls this the depth of an ordered tree.",
  ),
  ordered(
    "AutomorphismGroupSize",
    "The number of ways to permute identical children, at every vertex at once: the product, over the vertices, of the factorials of how many times each child tree occurs.",
    automorphisms,
  ),
  ordered(
    "InequivalentIncreasingTreeCount",
    "The number of increasing labelings of the tree up to its automorphisms: n! over the tree factorial and the automorphism group size.",
    [
      "Apply",
      [
        "Function",
        ["Divide", ["Divide", factorialOf(at("r", 1)), at("r", 2)], automorphisms],
        ["Typed", "r", "'collection'"],
      ],
      verticesAndTreeFactorial,
    ],
  ),
  ordered(
    "OneProtectedNodeCount",
    "The number of vertices whose nearest leaf is exactly one edge away.",
    at(nearestLeafCounts(1), 1),
  ),
  ordered(
    "TwoProtectedNodeCount",
    "The number of vertices whose nearest leaf is exactly two edges away.",
    at(nearestLeafCounts(2), 1),
  ),
  ordered(
    "PruningNumber",
    "The number of prunings, each deleting every maximal hanging branch (a path of single-child vertices to a leaf), that reduce the tree to a single vertex.",
    [
      "Apply",
      ["Function", ifThen(childless(x), 0, add(1, at("p", 3))), ["Typed", "p", "'collection'"]],
      chainAndPruning,
    ],
  ),
  ordered(
    "BoundaryLengthBeyondTrunk",
    "The edges on the leftmost path or the rightmost path from the root, less the trunk they share.",
    subtract(add(edgesAlong(1), edgesAlong(-1)), trunkLength),
  ),
];
