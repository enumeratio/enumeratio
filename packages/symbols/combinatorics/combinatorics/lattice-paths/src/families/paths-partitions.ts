// DyckPathsByHeight split out of collections/src/families/paths-partitions.ts (which mixed
// lattice-paths and set-partitions families) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 -- the only lattice-path family there carrying a top-level `carrier` ("DyckPath").
// GrandDyckPaths/DelannoyPaths/RiordanPaths/FinePaths/BallotSequences/LukasiewiczPaths/
// MotzkinPathsByPeaks declare no carrier at all and stay in collections per step 5 rule 4, same
// as this file's set-partitions-domain families (moved separately, see the set-partitions area
// commit).
import type { NumberKernel } from "../../../collections/src/families/types.ts";

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
function DyckPathsByHeightCount(n: number, h: number): number {
  if (n < 0 || h < 0) return 0;
  return dpbhCompletions(2 * n, 0, h, h === 0);
}
function DyckPathsByHeightUnrank(n: number, h: number, rank: number): number[] {
  const total = DyckPathsByHeightCount(n, h);
  let r = total ? ((rank % total) + total) % total : 0;
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
function DyckPathsByHeightRank(path: number[], h: number): number {
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
function isDyckPathsByHeightOf(e: unknown, n: number, h: number): boolean {
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

export const entries: NumberKernel[] = [
  {
    head: "DyckPathsByHeight",
    carrier: "DyckPath",
    paramCount: 2,
    kind: "ints",
    count: ([n, h]) => DyckPathsByHeightCount(n, h),
    unrank: ([n, h], r) => DyckPathsByHeightUnrank(n, h, r),
    valid: (e, [n, h]) => isDyckPathsByHeightOf(e, n, h),
    rank: (e, [, h]) => DyckPathsByHeightRank(e as number[], h),
  },
];
