// DyckPathsByHeight split out of collections/src/families/paths-partitions.ts (which mixed
// lattice-paths and set-partitions families) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 -- the only lattice-path family there carrying a top-level `carrier` ("DyckPath").
// DelannoyPaths/LukasiewiczPaths/MotzkinPathsByPeaks joined it (wire-carriers lane A-90): each
// element (list<integer>) matches its carrier's shape (DelannoyPath/LukasiewiczPath/MotzkinPath)
// exactly. GrandDyckPaths/RiordanPaths/FinePaths/BallotSequences declare no carrier at all and
// stay in collections per step 5 rule 4, same as this file's set-partitions-domain families
// (moved separately, see the set-partitions area commit).
import { modRank } from "../../../collections/src/families/kernels.ts";
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  add,
  all,
  and,
  at,
  cell,
  choose,
  equal,
  fold,
  iff,
  less,
  lets,
  mul,
  quotient,
  rowTable,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";
import { lukasiewiczPaths } from "./lukasiewicz.ts";
import { completionsOf, completionsSize, completionsTable, type Step, walkFamily } from "./walks.ts";
import {
  CatalanNumber,
  OrderedTreeUnrank,
  OrderedTreeRank,
  type OrdTree,
} from "../../../collections/src/families/kernels-extra.ts";

// ─── DelannoyPaths(n): lattice paths from (0,0) to (n,n) using East=(1,0), North=(0,1), and
// Diagonal=(1,1) steps — encoded as a token sequence over {0=E,1=N,2=D}. f[i][j] = # completions
// from (i,j) to (n,n). count(n) = f(0,0), the central Delannoy numbers. ────────────────────────
const _delannoyMemo = new Map<number, number[][]>();
function delannoyTable(n: number): number[][] {
  const cached = _delannoyMemo.get(n);
  if (cached) return cached;
  const f: number[][] = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
  f[n][n] = 1;
  for (let i = n; i >= 0; i--) {
    for (let j = n; j >= 0; j--) {
      if (i === n && j === n) continue;
      const e = i + 1 <= n ? f[i + 1][j] : 0;
      const north = j + 1 <= n ? f[i][j + 1] : 0;
      const d = i + 1 <= n && j + 1 <= n ? f[i + 1][j + 1] : 0;
      f[i][j] = e + north + d;
    }
  }
  _delannoyMemo.set(n, f);
  return f;
}
export function DelannoyPathCount(n: number): number {
  if (n < 0) return 0;
  return delannoyTable(n)[0][0];
}
export function DelannoyPathUnrank(n: number, rank: number): number[] {
  if (n <= 0) return [];
  const f = delannoyTable(n);
  const total = f[0][0];
  let r = total ? modRank(rank, total) : 0;
  const out: number[] = [];
  let i = 0,
    j = 0;
  while (i < n || j < n) {
    const blockE = i + 1 <= n ? f[i + 1][j] : 0;
    if (r < blockE) {
      out.push(0);
      i++;
      continue;
    }
    r -= blockE;
    const blockN = j + 1 <= n ? f[i][j + 1] : 0;
    if (r < blockN) {
      out.push(1);
      j++;
      continue;
    }
    r -= blockN;
    out.push(2);
    i++;
    j++;
  }
  return out;
}
export function DelannoyPathRank(path: number[], n: number): number {
  if (n <= 0) return 0;
  const f = delannoyTable(n);
  let i = 0,
    j = 0,
    rank = 0;
  for (const step of path) {
    if (step === 0) {
      i++;
      continue;
    }
    const blockE = i + 1 <= n ? f[i + 1][j] : 0;
    rank += blockE;
    if (step === 1) {
      j++;
      continue;
    }
    const blockN = j + 1 <= n ? f[i][j + 1] : 0;
    rank += blockN;
    i++;
    j++;
  }
  return rank;
}
export function isDelannoyPathOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e)) return false;
  let i = 0,
    j = 0;
  for (const step of e) {
    if (step === 0) i++;
    else if (step === 1) j++;
    else if (step === 2) {
      i++;
      j++;
    } else return false;
    if (i > n || j > n) return false;
  }
  return i === n && j === n;
}

// ─── LukasiewiczPaths(n): length-(n+1) integer words a_0..a_n (each a_i >= -1, prefix sums stay
// >=0 with the last one landing at -1) in bijection with plane trees on n edges via preorder
// traversal — a_i = (number of children of the i-th node, preorder) - 1. Reuses
// OrderedTree{Unrank,Rank} from kernels-extra.ts (same Catalan(n) count) and just reshapes the
// tree into its preorder child-count word. ──────────────────────────────────────────────────────
function preorderWord(node: OrdTree): number[] {
  const out: number[] = [node.length - 1];
  for (const child of node) out.push(...preorderWord(child));
  return out;
}
function wordToOrderedTree(word: number[], pos: { i: number }): OrdTree {
  const numChildren = word[pos.i] + 1;
  pos.i++;
  const children: OrdTree[] = [];
  for (let c = 0; c < numChildren; c++) children.push(wordToOrderedTree(word, pos));
  return children;
}
export function LukasiewiczPathUnrank(n: number, rank: number): number[] {
  return preorderWord(OrderedTreeUnrank(n, rank));
}
export function LukasiewiczPathRank(word: number[]): number {
  return OrderedTreeRank(wordToOrderedTree(word, { i: 0 }));
}
export function isLukasiewiczPathOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n + 1) return false;
  let needed = 1; // node-slots still awaiting a node, starting with just the root
  for (const a of e) {
    if (typeof a !== "number" || !Number.isInteger(a) || a < -1) return false;
    if (needed <= 0) return false;
    needed += a;
    if (needed < 0) return false;
  }
  return needed === 0;
}

// ─── DyckPathsByHeight(n,h): Dyck paths of semilength n with maximum height EXACTLY h.
// completions(s,height,reached) tracks steps remaining, current height (capped at h), and whether
// height h has been touched yet; count(n,h) = completions(2n,0,h===0). unrank/rank walk up-then-
// down exactly like plain DyckPaths, just within the height cap and the "must touch h" bookkeeping. ─
const _dpbhMemo = new Map<string, number>();
function dpbhCompletions(s: number, height: number, cap: number, reached: boolean): number {
  if (height < 0 || height > cap) return 0;
  if (s === 0) return height === 0 && reached ? 1 : 0;
  const key = `${s},${height},${cap},${reached}`;
  let v = _dpbhMemo.get(key);
  if (v === undefined) {
    const upH = height + 1;
    const up = upH <= cap ? dpbhCompletions(s - 1, upH, cap, reached || upH === cap) : 0;
    const down = height > 0 ? dpbhCompletions(s - 1, height - 1, cap, reached) : 0;
    v = up + down;
    _dpbhMemo.set(key, v);
  }
  return v;
}
export function DyckPathsByHeightCount(n: number, h: number): number {
  if (n < 0 || h < 0) return 0;
  return dpbhCompletions(2 * n, 0, h, h === 0);
}
export function DyckPathsByHeightUnrank(n: number, h: number, rank: number): number[] {
  const total = DyckPathsByHeightCount(n, h);
  let r = total ? modRank(rank, total) : 0;
  const out: number[] = [];
  let height = 0;
  let reached = h === 0;
  for (let s = 2 * n; s > 0; s--) {
    const upH = height + 1;
    const up = upH <= h ? dpbhCompletions(s - 1, upH, h, reached || upH === h) : 0;
    if (r < up) {
      out.push(1);
      height = upH;
      reached = reached || upH === h;
      continue;
    }
    r -= up;
    out.push(0);
    height--;
  }
  return out;
}
export function DyckPathsByHeightRank(path: number[], h: number): number {
  let r = 0;
  let height = 0;
  let reached = h === 0;
  for (let i = 0; i < path.length; i++) {
    const s = path.length - i;
    if (path[i] === 1) {
      const upH = height + 1;
      height = upH; // up is always tried first — contributes 0 to rank
      reached = reached || upH === h;
    } else {
      const upH = height + 1;
      const up = upH <= h ? dpbhCompletions(s - 1, upH, h, reached || upH === h) : 0;
      r += up;
      height--;
    }
  }
  return r;
}
export function isDyckPathsByHeightOf(e: unknown, n: number, h: number): boolean {
  if (!Array.isArray(e) || e.length !== 2 * n) return false;
  let height = 0,
    maxHeight = 0;
  for (const s of e) {
    if (s !== 0 && s !== 1) return false;
    height += s === 1 ? 1 : -1;
    if (height < 0) return false;
    if (height > maxHeight) maxHeight = height;
  }
  return height === 0 && maxHeight === h;
}

// ─── MotzkinPathsByPeaks(n,k): Motzkin paths of length n with exactly k peaks — a peak is an
// up-step immediately followed by a down-step — the Motzkin triangle (A055151).
// completions(s,h,prevUp,peaksLeft) tracks steps remaining, current height, whether the previous
// step was an up-step (so an immediate down-step scores a peak), and peaks still to place. ──────
const _mpbpMemo = new Map<string, number>();
function mpbpCompletions(s: number, h: number, prevUp: boolean, peaksLeft: number): number {
  if (h < 0 || peaksLeft < 0) return 0;
  if (s === 0) return h === 0 && peaksLeft === 0 ? 1 : 0;
  const key = `${s},${h},${prevUp},${peaksLeft}`;
  let v = _mpbpMemo.get(key);
  if (v === undefined) {
    const up = mpbpCompletions(s - 1, h + 1, true, peaksLeft);
    const level = mpbpCompletions(s - 1, h, false, peaksLeft);
    const down = h > 0 ? mpbpCompletions(s - 1, h - 1, false, peaksLeft - (prevUp ? 1 : 0)) : 0;
    v = up + level + down;
    _mpbpMemo.set(key, v);
  }
  return v;
}
export function MotzkinPathsByPeaksCount(n: number, k: number): number {
  if (n < 0 || k < 0) return 0;
  return mpbpCompletions(n, 0, false, k);
}
export function MotzkinPathsByPeaksUnrank(n: number, k: number, rank: number): number[] {
  const total = MotzkinPathsByPeaksCount(n, k);
  let r = total ? modRank(rank, total) : 0;
  const out: number[] = [];
  let h = 0,
    prevUp = false,
    peaksLeft = k;
  for (let s = n; s > 0; s--) {
    const up = mpbpCompletions(s - 1, h + 1, true, peaksLeft);
    if (r < up) {
      out.push(1);
      h++;
      prevUp = true;
      continue;
    }
    r -= up;
    const level = mpbpCompletions(s - 1, h, false, peaksLeft);
    if (r < level) {
      out.push(0);
      prevUp = false;
      continue;
    }
    r -= level;
    out.push(-1);
    if (prevUp) peaksLeft--;
    h--;
    prevUp = false;
  }
  return out;
}
export function MotzkinPathsByPeaksRank(path: number[], k: number): number {
  let r = 0,
    h = 0,
    prevUp = false,
    peaksLeft = k;
  for (let i = 0; i < path.length; i++) {
    const s = path.length - i;
    const step = path[i];
    if (step === 1) {
      h++;
      prevUp = true;
      continue;
    }
    r += mpbpCompletions(s - 1, h + 1, true, peaksLeft);
    if (step === 0) {
      prevUp = false;
      continue;
    }
    r += mpbpCompletions(s - 1, h, false, peaksLeft);
    if (prevUp) peaksLeft--;
    h--;
    prevUp = false;
  }
  return r;
}
export function isMotzkinPathsByPeaksOf(e: unknown, n: number, k: number): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  let h = 0,
    peaks = 0,
    prevUp = false;
  for (const s of e) {
    if (s !== -1 && s !== 0 && s !== 1) return false;
    if (s === -1 && prevUp) peaks++;
    h += s;
    if (h < 0) return false;
    prevUp = s === 1;
  }
  return h === 0 && peaks === k;
}

// ─── DyckPathsByHeight in Epsil (./walks.ts); the TS kernel above stays as the independent
// reading the agreement tests check against. The walks never above h that reach it are those
// never above h less those never above h − 1, so its completions are two tables of walks under
// a ceiling, the walk's flag saying whether it has reached h yet. ─────────────────────────────
const UP: Step = { token: 1, rise: 1, width: 1 };
const DOWN: Step = { token: 0, rise: -1, width: 1 };
const below = completionsOf("_h");
const dyckPathsByHeight = walkFamily({
  head: "DyckPathsByHeight",
  carrier: "DyckPath",
  fast: {
    count: ([n, h]) => DyckPathsByHeightCount(n, h),
    unrank: ([n, h], r) => DyckPathsByHeightUnrank(n, h, r),
    rank: (x, [, h]) => DyckPathsByHeightRank(x as number[], h),
    valid: (x, [n, h]) => isDyckPathsByHeightOf(x, n, h),
  },
  params: ["_n", "_h"],
  width: mul(2, "_n"),
  steps: [UP, DOWN],
  // Two tables in one list: `below` (never above h), then `under` (never above h − 1).
  tables: [
    completionsTable("hb", [UP, DOWN], mul(2, "_n"), "_h"),
    completionsTable("hu", [UP, DOWN], mul(2, "_n"), sub("_h", 1)),
  ],
  completions: (w, y, reached) =>
    iff(
      equal(reached, 1),
      below(w, y),
      sub(below(w, y), completionsOf(sub("_h", 1), completionsSize(mul(2, "_n"), "_h"))(w, y)),
    ),
  flag: {
    initial: iff(equal("_h", 0), 1, 0),
    after: (reached, y) => ["Max", reached, iff(equal(y, "_h"), 1, 0)],
  },
  top: (top) => equal(top, "_h"),
});

// ─── DelannoyPaths in Epsil: the E, N, D steps tried in that order. The paths from a point a
// columns and b rows short of (n, n) are the Delannoy number D(a, b) = Σ_k C(a, k) C(b, k) 2^k,
// the count in closed form; a negative side has none. The table D(a, b), a and b in 0..n, serves
// unrank and rank. A cell can't read its own row, so it is 1 + Σ_{j=1..b} (D(a − 1, j) + D(a − 1, j − 1)),
// which is D(a, b) = D(a − 1, b) + D(a − 1, b − 1) + D(a, b − 1) run down to D(a, 0) = 1. ───────
type MathJSON = unknown;
const delannoy = (tag: string, a: MathJSON, b: MathJSON): MathJSON =>
  fold(
    add(`${tag}_c`, mul(choose(a, `${tag}_k`), choose(b, `${tag}_k`), ["Power", 2, `${tag}_k`])),
    `${tag}_c`,
    `${tag}_k`,
    0,
    upTo(0, ["Min", a, b]),
  );
const delannoyWidth = add("_n", 1);
const delannoyCounts = rowTable(
  "dt",
  delannoyWidth,
  delannoyWidth,
  () => 1,
  (prev, a, b) =>
    iff(
      equal(b, 0),
      1,
      fold(add("dt_a", prev(sub(a, 1), "dt_j"), prev(sub(a, 1), sub("dt_j", 1))), "dt_a", "dt_j", 1, upTo(1, b)),
    ),
);
/** D(a, b) from the table, 0 on a negative side. */
const delannoyAt = (a: MathJSON, b: MathJSON): MathJSON =>
  iff(and(["GreaterEqual", a, 0], ["GreaterEqual", b, 0]), cell("_tables", delannoyWidth)(a, b), 0);
/** The paths left after an E step and after an N step from a point a columns and b rows short. */
const delannoyBlocks = (a: MathJSON, b: MathJSON): readonly [MathJSON, MathJSON] => [
  delannoyAt(sub(a, 1), b),
  delannoyAt(a, sub(b, 1)),
];
const delannoyPaths: EpsilFamily = (() => {
  const [us, rs] = [(i: number) => at("du_s", i), (i: number) => at("dr_s", i)];
  const [E, N] = ["du_e", "du_n"];
  const [e, n] = delannoyBlocks(us(2), us(3));
  const unrankStep = iff(
    and(equal(us(2), 0), equal(us(3), 0)),
    "du_s",
    lets(
      [
        [E, e, "integer"],
        [N, n, "integer"],
      ],
      iff(
        less(us(1), E),
        ["Join", ["List", us(1), sub(us(2), 1), us(3)], ["Drop", "du_s", 3], ["List", 0]],
        iff(
          less(us(1), add(E, N)),
          ["Join", ["List", sub(us(1), E), us(2), sub(us(3), 1)], ["Drop", "du_s", 3], ["List", 1]],
          ["Join", ["List", sub(us(1), add(E, N)), sub(us(2), 1), sub(us(3), 1)], ["Drop", "du_s", 3], ["List", 2]],
        ),
      ),
    ),
  );
  const [re, rn] = delannoyBlocks(rs(2), rs(3));
  const rankStep = lets(
    [
      ["dr_e", re, "integer"],
      ["dr_n", rn, "integer"],
    ],
    iff(
      equal("dr_t", 0),
      ["List", rs(1), sub(rs(2), 1), rs(3)],
      iff(
        equal("dr_t", 1),
        ["List", add(rs(1), "dr_e"), rs(2), sub(rs(3), 1)],
        ["List", add(rs(1), "dr_e", "dr_n"), sub(rs(2), 1), sub(rs(3), 1)],
      ),
    ),
  );
  const ends = (step: number) =>
    equal(fold(add("dv_c", iff(equal("dv_t", step), 0, 1)), "dv_c", "dv_t", 0, "_x"), "_n");
  return {
    head: "DelannoyPaths",
    carrier: "DelannoyPath",
    paramCount: 1,
    kind: "ints",
    params: ["_n"],
    fast: {
      count: ([n]) => DelannoyPathCount(n),
      unrank: ([n], r) => DelannoyPathUnrank(n, r),
      rank: (x, [n]) => DelannoyPathRank(x as number[], n),
      valid: (x, [n]) => isDelannoyPathOf(x, n),
    },
    epsil: {
      count: delannoy("dc", "_n", "_n"),
      tables: delannoyCounts,
      unrank: ["Drop", fold(unrankStep, "du_s", "du_j", ["List", "_r", "_n", "_n"], upTo(1, mul(2, "_n"))), 3],
      rank: at(fold(rankStep, "dr_s", "dr_t", ["List", 0, "_n", "_n"], "_x"), 1),
      valid: and(
        all((t) => and(["LessEqual", 0, t], ["LessEqual", t, 2]), "_x", "dv_a"),
        ends(1),
        ends(0),
      ),
    },
  };
})();

// ─── MotzkinPathsByPeaks in Epsil: a Motzkin walk whose flag is 2c + u, c the peaks made so far
// and u whether the last step was an up-step (a down-step right after it makes a peak). Its
// completions are one table M(s, h, p) over steps left, height and peaks still to make, for a
// walk whose last step was not an up. After an up the one difference is the down-step, which
// then spends a peak: M₁(s, h, p) = M(s, h, p) − [h > 0] (M(s − 1, h − 1, p) − M(s − 1, h − 1, p − 1)),
// so a row reads the two before it. The height never passes half the length. ──────────────────
const peakCap = quotient("_n", 2);
const peakColumns = mul(add(peakCap, 1), add("_k", 1));
const peakColumn = (h: MathJSON, p: MathJSON): MathJSON => add(mul(h, add("_k", 1)), p);
const peakTable = (() => {
  const height = (c: string) => quotient(c, add("_k", 1));
  const peaksLeft = (c: string) => ["Mod", c, add("_k", 1)];
  return rowTable(
    "pk",
    add("_n", 1),
    peakColumns,
    (c) => iff(equal(c, 0), 1, 0),
    (prev, s, c) => {
      const [h, p] = [height(c), peaksLeft(c)];
      const afterUp = sub(
        prev(sub(s, 1), peakColumn(add(h, 1), p)),
        iff(
          ["GreaterEqual", s, 2],
          sub(
            prev(sub(s, 2), peakColumn(h, p)),
            iff(["GreaterEqual", p, 1], prev(sub(s, 2), peakColumn(h, sub(p, 1))), 0),
          ),
          0,
        ),
      );
      return add(
        iff(["LessEqual", add(h, 1), peakCap], afterUp, 0),
        prev(sub(s, 1), peakColumn(h, p)),
        iff(["Greater", h, 0], prev(sub(s, 1), peakColumn(sub(h, 1), p)), 0),
      );
    },
  );
})();
/** M or M₁ by the flag's u, from the table `peaks`. */
const peakCompletions = (w: MathJSON, y: MathJSON, left: MathJSON, u: MathJSON): MathJSON => {
  const read = cell("_tables", peakColumns);
  const spent = sub(
    read(sub(w, 1), peakColumn(sub(y, 1), left)),
    iff(["GreaterEqual", left, 1], read(sub(w, 1), peakColumn(sub(y, 1), sub(left, 1))), 0),
  );
  return sub(read(w, peakColumn(y, left)), iff(and(equal(u, 1), ["Greater", y, 0], ["GreaterEqual", w, 1]), spent, 0));
};
const motzkinPathsByPeaks = walkFamily({
  head: "MotzkinPathsByPeaks",
  carrier: "MotzkinPath",
  fast: {
    count: ([n, k]) => MotzkinPathsByPeaksCount(n, k),
    unrank: ([n, k], r) => MotzkinPathsByPeaksUnrank(n, k, r),
    rank: (x, [, k]) => MotzkinPathsByPeaksRank(x as number[], k),
    valid: (x, [n, k]) => isMotzkinPathsByPeaksOf(x, n, k),
  },
  params: ["_n", "_k"],
  width: "_n",
  steps: [
    { token: 1, rise: 1, width: 1 },
    { token: 0, rise: 0, width: 1 },
    { token: -1, rise: -1, width: 1 },
  ],
  tables: [peakTable],
  completions: (w, y, flag) =>
    lets(
      [
        ["pc", quotient(flag, 2), "integer"],
        ["pu", ["Mod", flag, 2], "integer"],
      ],
      iff(["Or", ["Greater", "pc", "_k"], ["Greater", y, peakCap]], 0, peakCompletions(w, y, sub("_k", "pc"), "pu")),
    ),
  flag: {
    initial: 0,
    after: (flag, _y, rise) => {
      const down = ["Mod", flag, 2];
      return rise > 0 ? add(sub(flag, down), 1) : rise < 0 ? add(flag, down) : sub(flag, down);
    },
  },
  final: (flag) => equal(quotient(flag, 2), "_k"),
  declinePastDoubles: true,
});

// Kept separate from `entries` below only so collections/src/families/index.ts can splice
// `latticePathsPathsPartitionsBeforeDyckPathsByHeight` (DelannoyPaths, LukasiewiczPaths) back in
// where they held their (now consolidated) position in collections — §4 step 5.
export const entriesBeforeDyckPathsByHeight: (NumberKernel | EpsilFamily)[] = [
  delannoyPaths,
  {
    ...lukasiewiczPaths,
    fast: {
      count: ([n]) => CatalanNumber(n),
      unrank: ([n], r) => LukasiewiczPathUnrank(n, r),
      rank: (x) => LukasiewiczPathRank(x as number[]),
      valid: (x, [n]) => isLukasiewiczPathOf(x, n),
    },
  },
];

export const entries: (NumberKernel | EpsilFamily)[] = [dyckPathsByHeight, motzkinPathsByPeaks];
