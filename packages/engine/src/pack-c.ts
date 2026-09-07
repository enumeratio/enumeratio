// pack-c.ts — standalone rank/unrank kernels for two combinatorial families, packaged as PackEntry
// objects. Self-contained: no imports, pure functions, no compute-engine/I-O dependency. Mirrors this
// package's existing kernel style (kernels.ts / kernels-combinatorics.ts): 0-based rank, DP-based
// unranking via suffix-completion counts, exact digit-by-digit rank as the inverse walk.

export type PackEntry = {
  head: string;                 // PascalCase MathJSON head
  paramCount: 1 | 2;
  kind: "ints" | "blocks";      // element shape: flat int list OR a list of int lists (blocks)
  count: (p: number[]) => number;
  unrank: (p: number[], r: number) => number[] | number[][];  // 0-based; "ints"=>number[], "blocks"=>number[][]
  rank: (e: any, p: number[]) => number;          // exact 0-based inverse
  valid: (e: any, p: number[]) => boolean;
};

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ─── AlternatingPermutations(n): up-down permutations a1<a2>a3<a4>... of {1,...,n}. Count = Euler zigzag
// numbers (OEIS A000111: 1,1,1,2,5,16,61,272,...). Unrank via the classical Entringer-number recursion:
// T(n,k) = #up-down perms of [n] starting with value k = Σ_{i=1}^{n-k} T(n-1,i). Once a1=k is fixed, the
// tail (a2..an) must be a DOWN-UP perm of the remaining (n-1)-set with a2 > k; by the complement bijection
// x -> n-x that tail is in bijection with an up-down perm of [n-1] whose first value lands in {1,...,n-k} —
// which is exactly what the sum over i counts. ──────────────────────────────────────────────────────────

// rows[m][k-1] = T(m,k), built bottom-up from row m-1's prefix sums (row 1 = [1] is the base case).
function entringerRows(n: number): number[][] {
  const rows: number[][] = [[], [1]];
  for (let m = 2; m <= n; m++) {
    const prev = rows[m - 1];
    const prefix = new Array(prev.length + 1).fill(0);
    for (let i = 1; i <= prev.length; i++) prefix[i] = prefix[i - 1] + prev[i - 1];
    const row = new Array(m);
    for (let k = 1; k <= m; k++) row[k - 1] = prefix[m - k] ?? 0;
    rows[m] = row;
  }
  return rows;
}

function AlternatingPermutationCount(n: number): number {
  if (n <= 1) return 1;
  return entringerRows(n)[n].reduce((a, b) => a + b, 0);
}

function AlternatingPermutationUnrank(n: number, rank: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [1];
  const row = entringerRows(n)[n];
  let r = normRank(rank, AlternatingPermutationCount(n));
  let k = 1;
  for (; k <= n; k++) {
    const sz = row[k - 1];
    if (r < sz) break;
    r -= sz;
  }
  const subUp = AlternatingPermutationUnrank(n - 1, r);
  // complement each tail rank (v -> n-v) then skip over k to land back in the real value space {1,...,n}\{k}.
  const tail = subUp.map((v) => { const c = n - v; return c < k ? c : c + 1; });
  return [k, ...tail];
}

function AlternatingPermutationRank(perm: number[]): number {
  const n = perm.length;
  if (n <= 1) return 0;
  const k = perm[0];
  const subUp = perm.slice(1).map((t) => { const c = t < k ? t : t - 1; return n - c; });
  const row = entringerRows(n)[n];
  let offset = 0;
  for (let kk = 1; kk < k; kk++) offset += row[kk - 1];
  return offset + AlternatingPermutationRank(subUp);
}

function IsAlternatingPermutation(a: unknown, n: number): boolean {
  if (!Array.isArray(a) || a.length !== n) return false;
  const seen = new Array(n + 1).fill(false);
  for (const x of a) {
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
    seen[x] = true;
  }
  for (let i = 0; i < n - 1; i++) {
    const ascentExpected = i % 2 === 0;
    if (ascentExpected ? !(a[i] < a[i + 1]) : !(a[i] > a[i + 1])) return false;
  }
  return true;
}

// ─── SetPartitionsNoSingletons(n): partitions of [n] with no block of size 1. Count = associated Bell
// numbers (OEIS A000296: 1,0,1,1,4,11,41,162,...). Unrank via an RGS-style DP over state (m, s) = (max
// label used so far, count of currently-singleton blocks among the m+1 open blocks); a completion is only
// valid once every block has grown past size 1. ────────────────────────────────────────────────────────

const _noSingletonMemo = new Map<string, number>();
// #ways to extend an RGS suffix of length `remaining`, given m+1 blocks open with s still singleton, such
// that no block is left singleton once the suffix is exhausted.
function noSingletonCompletions(remaining: number, m: number, s: number): number {
  if (remaining === 0) return s === 0 ? 1 : 0;
  const key = `${remaining},${m},${s}`;
  const cached = _noSingletonMemo.get(key);
  if (cached !== undefined) return cached;
  let v = 0;
  if (s > 0) v += s * noSingletonCompletions(remaining - 1, m, s - 1); // grow one of the s singleton blocks
  const nonSingleton = m + 1 - s;
  if (nonSingleton > 0) v += nonSingleton * noSingletonCompletions(remaining - 1, m, s); // grow a settled block
  v += noSingletonCompletions(remaining - 1, m + 1, s + 1); // open a new (singleton) block
  _noSingletonMemo.set(key, v);
  return v;
}

function SetPartitionsNoSingletonsCount(n: number): number {
  if (n < 0) return 0;
  return noSingletonCompletions(n, -1, 0);
}

// RGS (0-based labels, first-appearance order) -> blocks; label order == least-element order for free.
function rgsToBlocksNS(w: number[]): number[][] {
  const blocks: number[][] = [];
  w.forEach((b, i) => { (blocks[b] ??= []).push(i + 1); });
  return blocks;
}
function blocksToRgsNS(blocks: number[][], n: number): number[] {
  const ordered = blocks
    .map((b) => [...b].sort((a, z) => a - z))
    .filter((b) => b.length > 0)
    .sort((a, b) => a[0] - b[0]);
  const w = new Array(n).fill(-1);
  ordered.forEach((blk, bi) => blk.forEach((x) => { w[x - 1] = bi; }));
  return w;
}

function SetPartitionsNoSingletonsUnrank(n: number, rank: number): number[][] {
  const total = SetPartitionsNoSingletonsCount(n);
  let r = normRank(rank, total);
  const w: number[] = [];
  const blockSize: number[] = [];
  let m = -1, s = 0;
  for (let i = 0; i < n; i++) {
    const remainingAfter = n - i - 1;
    let chosen = -1, newm = m, news = s;
    for (let cand = 0; cand <= m + 1; cand++) {
      const isNew = cand > m;
      const nm = isNew ? m + 1 : m;
      const ns = isNew ? s + 1 : (blockSize[cand] === 1 ? s - 1 : s);
      const cnt = noSingletonCompletions(remainingAfter, nm, ns);
      if (r < cnt) { chosen = cand; newm = nm; news = ns; break; }
      r -= cnt;
    }
    w.push(chosen);
    blockSize[chosen] = (blockSize[chosen] ?? 0) + 1;
    m = newm; s = news;
  }
  return rgsToBlocksNS(w);
}

function SetPartitionsNoSingletonsRank(blocks: number[][], n: number): number {
  const w = blocksToRgsNS(blocks, n);
  let r = 0;
  const blockSize: number[] = [];
  let m = -1, s = 0;
  for (let i = 0; i < n; i++) {
    const remainingAfter = n - i - 1;
    const actual = w[i];
    // every candidate below `actual` is an existing block (actual <= m+1, so cand < actual implies cand <= m)
    for (let cand = 0; cand < actual; cand++) {
      const ns = blockSize[cand] === 1 ? s - 1 : s;
      r += noSingletonCompletions(remainingAfter, m, ns);
    }
    const isNew = actual > m;
    const wasSingleton = !isNew && blockSize[actual] === 1;
    blockSize[actual] = (blockSize[actual] ?? 0) + 1;
    if (isNew) { m += 1; s += 1; } else if (wasSingleton) { s -= 1; }
  }
  return r;
}

function IsSetPartitionNoSingletons(blocks: unknown, n: number): boolean {
  if (!Array.isArray(blocks)) return false;
  const seen = new Array(n + 1).fill(false);
  let total = 0;
  for (const blk of blocks) {
    if (!Array.isArray(blk) || blk.length < 2) return false; // no empty AND no singleton blocks
    for (const x of blk) {
      if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
      seen[x] = true;
      total++;
    }
  }
  return total === n;
}

export const entries: PackEntry[] = [
  {
    head: "AlternatingPermutations",
    paramCount: 1,
    kind: "ints",
    count: (p) => AlternatingPermutationCount(p[0]),
    unrank: (p, r) => AlternatingPermutationUnrank(p[0], r),
    rank: (e) => AlternatingPermutationRank(e as number[]),
    valid: (e, p) => IsAlternatingPermutation(e, p[0]),
  },
  {
    head: "SetPartitionsNoSingletons",
    paramCount: 1,
    kind: "blocks",
    count: (p) => SetPartitionsNoSingletonsCount(p[0]),
    unrank: (p, r) => SetPartitionsNoSingletonsUnrank(p[0], r),
    rank: (e, p) => SetPartitionsNoSingletonsRank(e as number[][], p[0]),
    valid: (e, p) => IsSetPartitionNoSingletons(e, p[0]),
  },
];
