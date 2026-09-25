// Binary search tree from successive insertion — the sylvester congruence map (permutation ->
// binary_tree).
//
// REPRESENTATION. `binary_tree`'s declared shape (domain-data.ts) is `list<integer>`, flat —
// not the nested `leaf 0 / [L, R]` shape the collections package uses to GENERATE
// `BinaryTrees(n)` (packages/symbols/combinatorics/collections/src/families/kernels-extra.ts). Nothing in the repo yet
// constructs a `binary_tree` value, so there is no existing decoder to match; the flat shape
// is the constraint, and it also matches the worked example already staged for this carrier
// in scripts/collect-entries.ts's `SAMPLES` (`binary_tree: { contents: ["List", 1, 2, 3] }`).
//
// The encoding chosen here: a PARENT-POINTER array indexed by VALUE — entry v holds the value
// of v's parent in the tree, or 0 if v is the root. A binary search tree over the value set
// {1, ..., n} is determined by parentage alone: which child a value is (left or right) follows
// from the BST property by comparing it against its parent, so nothing is lost by dropping
// the side. This is also the encoding a fold can build without ever rewriting a nested
// structure at depth — the accumulator is one flat array, updated at one index per insertion,
// which is what makes it fit the "iterate over a RANGE and index" rule (tableau.ts) at all.

type MathJSON =
  | string
  | number
  | boolean
  | readonly MathJSON[]
  | { readonly [key: string]: unknown };

const at = (list: MathJSON, index: MathJSON): MathJSON => ["At", list, index];
const count = (list: MathJSON): MathJSON => ["Count", list];

const overRange = (
  n: MathJSON,
  initial: MathJSON,
  step: MathJSON,
  accumulator: string,
  variable: string,
): MathJSON => ["Fold", ["Function", step, accumulator, variable], initial, ["Range", 1, n]];

const WORD: MathJSON = "_raw";
const SIZE: MathJSON = count(WORD);
const ROOT: MathJSON = at(WORD, 1);

/** `v` and `x` fall on the same side of `cur` — both less, or both greater. Deciding a BST
 *  child by side rather than by value means a value can only ever match ONE candidate child,
 *  which is what lets `childOf` below pick a result with a plain fold instead of a search. */
const sameSide = (v: MathJSON, cur: MathJSON, x: MathJSON): MathJSON => [
  "Or",
  ["And", ["Less", v, cur], ["Less", x, cur]],
  ["And", ["Greater", v, cur], ["Greater", x, cur]],
];

/** The child of `cur` on `x`'s side, among values already placed in `parents` — or 0 if that
 *  side is still open. At most one `v` can satisfy `parents(v) = cur` on a given side, so
 *  folding a replacement (rather than accumulating) is exact. */
const childOf = (parents: MathJSON, cur: MathJSON, x: MathJSON): MathJSON =>
  overRange(
    SIZE,
    0,
    ["If", ["And", ["Equal", at(parents, "v"), cur], sameSide("v", cur, x)], "v", "kacc"],
    "kacc",
    "v",
  );

const DS_CUR: MathJSON = at("ds", 1);
const DS_DONE: MathJSON = at("ds", 2);

/** One step down from the root toward `x`: move to the matching child, or stop and report the
 *  attachment point. `done = 1` freezes the state exactly as `carried = 0` does in
 *  tableau.ts's insertion fold — once placed, every further step is a no-op. */
const descendStep = (parents: MathJSON, x: MathJSON): MathJSON => [
  "If",
  ["Equal", DS_DONE, 1],
  "ds",
  [
    "If",
    ["Equal", childOf(parents, DS_CUR, x), 0],
    ["List", DS_CUR, 1],
    ["List", childOf(parents, DS_CUR, x), 0],
  ],
];

/** Where `x` attaches under `parents`, starting from the root — found within `SIZE` steps,
 *  since a tree of at most `SIZE` nodes has no deeper path than that. */
const attachmentFor = (parents: MathJSON, x: MathJSON): MathJSON =>
  at(overRange(SIZE, ["List", ROOT, 0], descendStep(parents, x), "ds", "_k"), 1);

/** `parents` with index `x` replaced by `value` — a flat rebuild, not a patch, which is what
 *  keeps this a fold over a range instead of a mutation. */
const withParent = (parents: MathJSON, x: MathJSON, value: MathJSON): MathJSON =>
  overRange(
    SIZE,
    ["List"],
    ["Join", "wacc", ["List", ["If", ["Equal", "w", x], value, at(parents, "w")]]],
    "wacc",
    "w",
  );

const INS_ACC = "pacc";
const INS_I = "i";
const INS_X: MathJSON = at(WORD, INS_I);

/** Insert the i-th entry: the first entry needs no placement (an empty tree's root has no
 *  parent, and 0 is already every slot's initial value); every later one attaches under
 *  whatever `attachmentFor` finds in the tree built so far. */
const insertStep: MathJSON = [
  "If",
  ["Equal", INS_I, 1],
  INS_ACC,
  withParent(INS_ACC, INS_X, attachmentFor(INS_ACC, INS_X)),
];

const zeros: MathJSON = overRange(SIZE, ["List"], ["Join", "zacc", ["List", 0]], "zacc", "_z");

/** The finished parent-pointer array: every value's parent, 0 for the root. */
export const bstParents: MathJSON = overRange(SIZE, zeros, insertStep, INS_ACC, INS_I);
