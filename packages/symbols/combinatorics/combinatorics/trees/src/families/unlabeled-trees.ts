// Unlabelled and non-crossing tree families — the isomorphism-class batch. Rooted/free unlabelled
// trees (./unlabeled-tree-classes.ts) are listed in a canonical order so each isomorphism class
// is hit exactly once; element = level sequence (depths in canonical DFS order, root first at
// depth 0). Phylogenetic / non-crossing trees are an insertion-choice / arity digit sequence —
// all "ints" kind, matching the catalogued carriers' list<integer> shape (see ../carrier-data.ts). Moved out of collections/src/families/
// unlabeled-trees.ts (wire-carriers lane A-92, decision 6): all four families' shapes matched
// their carrier's exactly, so all four wire directly (`carrier: "X"`, no `carrierParams`
// needed -- each is a single flat list<integer>, no axis param packed alongside it).
// PlaneTree/Dissection, the other two carriers this decision checked against, have no family
// declared anywhere yet, so there's nothing to wire for them.
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import { floorDiv, modRank } from "../../../collections/src/families/kernels.ts";
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import {
  add,
  all,
  and,
  at,
  equal,
  fold,
  iff,
  len,
  less,
  map,
  mul,
  quotient,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";
import { nonCrossingTrees } from "./noncrossing-trees.ts";
import { rootedUnlabeledTrees, unlabeledFreeTrees } from "./unlabeled-tree-classes.ts";
import {
  KAryTreeCount,
  KAryTreeUnrank,
  KAryTreeRank,
  type KTree,
} from "../../../collections/src/families/kernels-extra.ts";

type MathJSON = unknown;

// ─── PhylogeneticTrees(n): A001147 — rooted binary trees on n labeled leaves (internal nodes
// unlabeled), built by successive insertion: start with leaves {1,2} as a cherry, then for
// k=3..n attach leaf k at one of (2k-3) places — the "above the current root" slot, or one of the
// tree's (2k-4) edges, each subdivided with a fresh internal node whose children are [existing
// subtree, leaf k] — enumerated in a fixed preorder-of-non-root-nodes order. Element = the digit
// sequence (d_3..d_n), d_k in [0, 2k-3) — the same factorial-number-system shape RecursiveTrees
// uses, just with each step's radix taken from the tree built so far. ─────────────────────────────
type PNode = number | [PNode, PNode];
function preorderPaths(t: PNode, path: number[] = []): number[][] {
  if (typeof t === "number") return [path];
  return [path, ...preorderPaths(t[0], [...path, 0]), ...preorderPaths(t[1], [...path, 1])];
}
function getAt(t: PNode, path: number[]): PNode {
  let cur = t;
  for (const d of path) cur = (cur as [PNode, PNode])[d];
  return cur;
}
function replaceAt(t: PNode, path: number[], node: PNode): PNode {
  if (path.length === 0) return node;
  const [l, r] = t as [PNode, PNode];
  const [d, ...rest] = path;
  return d === 0 ? [replaceAt(l, rest, node), r] : [l, replaceAt(r, rest, node)];
}
function findLeafPath(t: PNode, label: number): number[] | undefined {
  if (typeof t === "number") return t === label ? [] : undefined;
  const l = findLeafPath(t[0], label);
  if (l) return [0, ...l];
  const r = findLeafPath(t[1], label);
  if (r) return [1, ...r];
  return undefined;
}
function insertLeaf(t: PNode, k: number, slot: number): PNode {
  if (slot === 0) return [t, k];
  const path = preorderPaths(t).slice(1)[slot - 1];
  return replaceAt(t, path, [getAt(t, path), k]);
}

export function PhylogeneticTreeCount(n: number): number {
  if (n <= 2) return 1;
  let c = 1;
  for (let k = 3; k <= n; k++) c *= 2 * k - 3;
  return c;
}
export function PhylogeneticTreeUnrank(n: number, rank: number): number[] {
  if (n <= 2) return [];
  const total = PhylogeneticTreeCount(n);
  let rem = total ? modRank(rank, total) : 0;
  const digits = Array.from({ length: n - 2 }, () => 0);
  for (let k = n; k >= 3; k--) {
    const base = 2 * k - 3;
    digits[k - 3] = rem % base;
    rem = floorDiv(rem, base);
  }
  return digits;
}
export function PhylogeneticTreeRank(digits: number[], n: number): number {
  if (n <= 2) return 0;
  let t: PNode = [1, 2];
  for (let k = 3; k <= n; k++) t = insertLeaf(t, k, digits[k - 3]);
  let rank = 0,
    place = 1;
  for (let k = n; k >= 3; k--) {
    const parentPath = findLeafPath(t, k)!.slice(0, -1);
    let d: number;
    if (parentPath.length === 0) {
      d = 0;
      t = getAt(t, [0]); // above-root case: contract to the old (left) subtree
    } else {
      const x = getAt(t, parentPath) as [PNode, PNode];
      t = replaceAt(t, parentPath, x[0]); // contract M -> its left (pre-existing) child
      d =
        1 +
        preorderPaths(t)
          .slice(1)
          .findIndex((p) => p.join(",") === parentPath.join(","));
    }
    rank += d * place;
    place *= 2 * k - 3;
  }
  return rank;
}
export function IsPhylogeneticTreeOf(e: unknown, n: number): boolean {
  const len = Math.max(0, n - 2);
  if (!Array.isArray(e) || e.length !== len) return false;
  for (let i = 0; i < len; i++) {
    const k = i + 3;
    const d = e[i];
    if (!Number.isInteger(d) || d < 0 || d >= 2 * k - 3) return false;
  }
  return true;
}

// ─── NonCrossingTrees(n): A001764 — spanning trees on n+1 circle-labeled points with no crossing
// chords; C(3n,n)/(2n+1), the same Fuss–Catalan closed form as ternary trees with n internal nodes
// (Flajolet & Noy, "Analytic combinatorics of non-crossing configurations", 1999, give the bijection
// explicitly). Reuses the already-certified FullKAryTrees(n,3) kernel and just re-presents its nested
// element as the flat preorder arity word (n entries, each in 0..3) the "ints" carrier wants. ──────
function flattenKAry(t: KTree, k: number, out: number[]): void {
  if (t === 0) {
    out.push(0);
    return;
  }
  out.push(k);
  for (const c of t) flattenKAry(c, k, out);
}
function unflattenKAry(word: number[], pos: { i: number }): KTree {
  const a = word[pos.i++];
  if (a === 0) return 0;
  const kids: KTree[] = [];
  for (let c = 0; c < a; c++) kids.push(unflattenKAry(word, pos));
  return kids as KTree; // a is always exactly 3 here (FullKAryTrees(·,3) fills every internal node's 3 slots)
}
export function NonCrossingTreeCount(n: number): number {
  return KAryTreeCount(n, 3);
}
export function NonCrossingTreeUnrank(n: number, rank: number): number[] {
  const t = KAryTreeUnrank(n, 3, rank);
  const out: number[] = [];
  flattenKAry(t, 3, out);
  return out;
}
export function NonCrossingTreeRank(word: number[]): number {
  const t = unflattenKAry(word, { i: 0 });
  return KAryTreeRank(t, 3);
}
export function IsNonCrossingTreeOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e)) return false;
  // a valid preorder arity word: a single stack-based scan consumes exactly the whole word once,
  // with exactly n internal (arity-3) nodes — the n-internal-node ternary tree the bijection wants.
  let need = 1;
  let internal = 0;
  for (const a of e) {
    if (a !== 0 && a !== 3) return false;
    if (a === 3) internal++;
    need--;
    if (need < 0) return false;
    need += a;
  }
  return need === 0 && internal === n;
}

export const nonCrossingTreesKernel: NumberKernel = {
  head: "NonCrossingTrees",
  paramCount: 1,
  kind: "ints",
  carrier: "NonCrossingTree",
  count: ([n]) => NonCrossingTreeCount(n),
  unrank: ([n], r) => NonCrossingTreeUnrank(n, r),
  valid: (e, [n]) => IsNonCrossingTreeOf(e, n),
  rank: (e) => NonCrossingTreeRank(e as number[]),
};

export const phylogeneticTreesKernel: NumberKernel = {
  head: "PhylogeneticTrees",
  paramCount: 1,
  kind: "ints",
  carrier: "PhylogeneticTree",
  count: ([n]) => PhylogeneticTreeCount(n),
  unrank: ([n], r) => PhylogeneticTreeUnrank(n, r),
  valid: (e, [n]) => IsPhylogeneticTreeOf(e, n),
  rank: (e, [n]) => PhylogeneticTreeRank(e as number[], n),
};

// No `fast` path here: the TS kernel's rank rebuilds the tree to read each digit back (the independent
// reading the agreement tests use), which Epsil, reading the digits directly, beats ~10x.
// PhylogeneticTrees in Epsil: the digits d_3..d_n are a mixed-radix number, digit k of radix
// 2k − 3, k = n least significant. The TS kernel builds the tree digit by digit, but the digits
// alone fix the rank, so the definition reads them directly.
/** The number of digits, n − 2, none below n = 2. */
const digitCount: MathJSON = ["Max", sub("_n", 2), 0];
/** The radix of digit j (1-based, k = j + 2). */
const radix = (j: MathJSON): MathJSON => add(mul(2, j), 1);

const phylogeneticTrees: EpsilFamily = {
  head: "PhylogeneticTrees",
  paramCount: 1,
  kind: "ints",
  carrier: "PhylogeneticTree",
  params: ["_n"],
  epsil: {
    count: fold(mul("pc", sub(mul(2, "pk"), 3)), "pc", "pk", 1, upTo(3, "_n")),
    unrank: map(
      ["Mod", quotient("_r", fold(mul("pw", radix("pi")), "pw", "pi", 1, upTo(add("pj", 1), digitCount))), radix("pj")],
      "pj",
      upTo(1, digitCount),
    ),
    rank: fold(add(mul("pr", radix("pd")), at("_x", "pd")), "pr", "pd", 0, upTo(1, digitCount)),
    valid: iff(
      equal(len, digitCount),
      all((j) => and(["LessEqual", 0, at("_x", j)], less(at("_x", j), radix(j))), upTo(1, len), "pv"),
      "False",
    ),
  },
};

export const entries: (NumberKernel | EpsilFamily)[] = [
  rootedUnlabeledTrees,
  unlabeledFreeTrees,
  phylogeneticTrees,
  { ...nonCrossingTrees, fast: nonCrossingTreesKernel },
];
