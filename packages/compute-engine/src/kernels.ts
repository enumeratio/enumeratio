// PascalCase kernels backing this library's MathJSON heads — a kernel's name IS its AST head, no
// mapping table. These are the certified permutation rank/unrank primitives, inlined from
// @enumeratio/math (permutations.ts / combinat.ts / notation.ts) so the package is a standalone,
// zero-runtime-dependency compute-engine library. The SQL target (sql-target.ts) owns snake_case
// emission; nothing here knows about SQL.

export type Permutation = number[]; // 1-indexed one-line notation

/** n!  (exact JS number up to n = 18). SQL twin: factorial(n int). */
export function Factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/** The r-th permutation of [n] in lex order (0-based rank), by Lehmer decode.
 *  SQL twin: permutation_unrank_lex(n int, ord bigint). */
export function PermutationUnrank(n: number, rank: number): Permutation {
  const N = Factorial(n);
  let rem = N ? (((Math.trunc(rank) % N) + N) % N) : 0;
  const avail = Array.from({ length: n }, (_, i) => i + 1);
  const res: number[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const f = Factorial(k);
    const idx = Math.floor(rem / f);
    rem = rem % f;
    res.push(avail[idx]);
    avail.splice(idx, 1);
  }
  return res;
}

/** Exact inverse of PermutationUnrank: the 0-based lex rank of a permutation word. */
export function PermutationRank(perm: Permutation): number {
  const n = perm.length;
  const avail = Array.from({ length: n }, (_, i) => i + 1);
  let rank = 0;
  let f = Factorial(Math.max(0, n - 1));
  for (let i = 0; i < n; i++) {
    const idx = avail.indexOf(perm[i]);
    rank += idx * f;
    avail.splice(idx, 1);
    const rem = n - 1 - i;
    if (rem > 0) f /= rem;
  }
  return rank;
}

/** Lehmer code L[i] = #{ j > i : perm[j] < perm[i] }, positions 0..n-2 (the always-0 tail dropped). */
export function LehmerCode(perm: Permutation): number[] {
  const avail = perm.map((_, i) => i + 1);
  return perm.slice(0, -1).map((x) => {
    const idx = avail.indexOf(x);
    avail.splice(idx, 1);
    return idx;
  });
}

/** Inversions (Coxeter length) = sum of the Lehmer code. SQL twin: perm_inversions(p permutation). */
export function Inversions(perm: Permutation): number {
  return LehmerCode(perm).reduce((a, b) => a + b, 0);
}

/** Is `perm` a permutation of [n] (each of 1..n exactly once)? */
export function IsPermutationOf(perm: Permutation, n: number): boolean {
  if (perm.length !== n) return false;
  const seen = new Array(n + 1).fill(false);
  for (const x of perm) {
    if (!Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
    seen[x] = true;
  }
  return true;
}

/** Canonical one-line text: digits run together up to n = 9, space-separated beyond.
 *  SQL twin: one_line(p permutation) / notation(p permutation). */
export function NotationPermutation(image: number[]): string {
  return (image?.length ?? 0) <= 9 ? (image ?? []).join("") : image.join(" ");
}

// ─── SymmetricGroup(n): the SAME n! permutations, read as a group — disjoint CYCLE notation, ordered by
// COXETER LENGTH (inversions), lex-tiebroken. A sibling of `Permutations` (bijective, non-order-isomorphic),
// mirroring the SQL DP in packages/data/packs/permutations-plus/symmetric_group.sql (#411) exactly — same
// Mahonian-table construction, same digit-by-digit block search, same cycle encoding. ──────────────────────

export type CycleNotation = number[][]; // disjoint cycles, increasing minimal-element order, each cycle in image order

/** Disjoint-cycle decomposition of a one-line permutation. Fixed points are singleton cycles, so the
 *  encoding alone (no external n) determines the permutation. SQL twin: to_cycles(p permutation). */
export function PermutationToCycles(perm: Permutation): CycleNotation {
  const n = perm.length;
  const visited = new Array(n + 1).fill(false); // 1-indexed; index 0 unused
  const cycles: number[][] = [];
  for (let i = 1; i <= n; i++) {
    if (visited[i]) continue; // i unvisited ⇒ i is the MINIMUM of its cycle
    const cyc: number[] = [];
    let j = i;
    do {
      visited[j] = true;
      cyc.push(j);
      j = perm[j - 1];
    } while (j !== i);
    cycles.push(cyc);
  }
  return cycles;
}

/** Exact inverse of PermutationToCycles. SQL twin: to_permutation(v permutation_cycles). */
export function CyclesToPermutation(cycles: CycleNotation): Permutation {
  const n = cycles.reduce((s, c) => s + c.length, 0);
  const img = new Array(n + 1).fill(0); // 1-indexed; index 0 unused
  for (const cyc of cycles) {
    const m = cyc.length;
    for (let k = 0; k < m; k++) img[cyc[k]] = cyc[(k + 1) % m];
  }
  return img.slice(1);
}

/** Is `cycles` a valid disjoint-cycle decomposition of a permutation of [n]? Every non-empty cycle, entries
 *  covering 1..n exactly once. SQL twin: contains_in_fiber(f symmetric_group_fiber, v permutation_cycles). */
export function IsCyclesOf(cycles: unknown, n: number): cycles is CycleNotation {
  if (!Array.isArray(cycles)) return false;
  const flat: number[] = [];
  for (const c of cycles) {
    if (!Array.isArray(c) || c.length === 0) return false;
    for (const x of c) {
      if (!Number.isInteger(x)) return false;
      flat.push(x);
    }
  }
  if (flat.length !== n) return false;
  flat.sort((a, b) => a - b);
  for (let i = 0; i < n; i++) if (flat[i] !== i + 1) return false;
  return true;
}

/** Mahonian table: tbl[m][k] = #permutations of size m with exactly k inversions, m = 0..n, k = 0..maxdeg.
 *  SQL twin: symmetric_group_mahonian_table(n int) (1-indexed there; tbl[m][k] here ≡ SQL tbl[m+1][k+1]). */
export function SymmetricGroupMahonianTable(n: number): number[][] {
  const maxdeg = (n * (n - 1)) / 2;
  const tbl: number[][] = Array.from({ length: n + 1 }, () => new Array(maxdeg + 1).fill(0));
  tbl[0][0] = 1; // m=0: the empty permutation, 0 inversions, count 1
  for (let m = 1; m <= n; m++) {
    for (let k = 0; k <= maxdeg; k++) {
      let s = 0;
      for (let d = 0; d <= Math.min(m - 1, k); d++) s += tbl[m - 1][k - d]; // convolve row m-1 with (1+q+...+q^(m-1))
      tbl[m][k] = s;
    }
  }
  return tbl;
}

/** The r-th permutation of [n] (0-based rank) in COXETER-LENGTH order (ties broken lexicographically on the
 *  one-line word), decoded back to one-line notation. SQL twin: symmetric_group_unrank_by_coxeter(n, r). */
export function SymmetricGroupUnrankByCoxeter(n: number, rank: number): Permutation {
  const N = Factorial(n);
  let j = N ? (((Math.trunc(rank) % N) + N) % N) : 0;
  const tbl = SymmetricGroupMahonianTable(n);
  const maxdeg = (n * (n - 1)) / 2;
  let k = 0;
  while (k <= maxdeg) { // find the inversions-block containing rank r
    const blockcount = tbl[n][k];
    if (j < blockcount) break;
    j -= blockcount;
    k++;
  }
  let s = k;
  const code: number[] = new Array(n).fill(0); // a length-n Lehmer code with digit-sum k (code[n-1] always 0)
  for (let p = 0; p < n; p++) {
    const remaining = n - 1 - p; // positions left AFTER this one; bound on this digit
    for (let d = 0; d <= remaining; d++) {
      const cnt = s - d >= 0 ? tbl[remaining][s - d] : 0;
      if (j < cnt) { code[p] = d; s -= d; break; }
      j -= cnt;
    }
  }
  // Standard Lehmer decode: code[i] = index into the still-available values (mirrors to_permutation in
  // lehmer_codes.sql — the same "L[i] = #{later, smaller}" convention).
  const avail = Array.from({ length: n }, (_, i) => i + 1);
  const perm: number[] = [];
  for (let i = 0; i < n; i++) {
    perm.push(avail[code[i]]);
    avail.splice(code[i], 1);
  }
  return perm;
}

/** Exact inverse of SymmetricGroupUnrankByCoxeter. SQL twin: symmetric_group_coxeter_rank(p permutation). */
export function SymmetricGroupCoxeterRank(perm: Permutation): number {
  const n = perm.length;
  const code = [...LehmerCode(perm), 0]; // length n; last entry always 0
  const tbl = SymmetricGroupMahonianTable(n);
  const k = code.reduce((a, b) => a + b, 0); // total inversions = the Coxeter-length block
  let rnk = 0;
  for (let d = 0; d < k; d++) rnk += tbl[n][d]; // all earlier blocks come first
  let s = k;
  for (let pos = 0; pos < n; pos++) {
    const remaining = n - 1 - pos;
    for (let d = 0; d < code[pos]; d++) if (s - d >= 0) rnk += tbl[remaining][s - d];
    s -= code[pos];
  }
  return rnk;
}
