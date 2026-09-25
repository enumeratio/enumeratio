import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, afterAll } from "vite-plus/test";
import { entries } from "../src/families/tableaux-plane.ts";

const byHead = new Map(entries.map((e) => [e.head, e]));

// ─── round-trip certification: rank(unrank(p,r),p) === r, and every unranked element is valid ──────────
const PARAMS: Record<string, number[][]> = {
  SemistandardTableaux: [
    [0, 1],
    [1, 1],
    [1, 3],
    [3, 2],
    [3, 3],
    [4, 2],
  ],
  GelfandTsetlin: [
    [0, 2],
    [1, 2],
    [2, 1],
    [2, 2],
    [3, 2],
  ],
  AlternatingSignMatrices: [[0], [1], [2], [3], [4]],
  SkewPartitions: [[0], [1], [2], [3], [4]],
  SkewStandardTableaux: [[0], [1], [2], [3], [4]],
  ShiftedStandardTableaux: [[0], [1], [2], [3], [4], [5]],
  StandardTableauPairs: [[0], [1], [2], [3], [4], [5]],
  PlanePartitions: [[0], [1], [2], [3], [4], [5]],
};

for (const [head, paramSets] of Object.entries(PARAMS)) {
  const entry = byHead.get(head);
  test(`${head} is registered`, () => expect(entry).toBeDefined());
  if (!entry) continue;
  for (const p of paramSets) {
    test(`${head}(${p.join(", ")}) round-trips`, () => {
      const total = entry.count(p);
      for (let r = 0; r < total; r++) {
        const element = entry.unrank(p, r);
        expect(entry.valid(element, p)).toBe(true);
        expect(entry.rank(element, p)).toBe(r);
      }
    });
  }
}

// ═══ independent brute-force cross-checks (deliberately not sharing code with the kernels) ═══

// SemistandardTableaux: brute-force every shape of n (via a fresh partition generator), then every
// filling of each shape by direct backtracking — compared as a SET against the kernel's enumeration.
function bruteIntPartitions(n: number): number[][] {
  const out: number[][] = [];
  const acc: number[] = [];
  (function rec(remaining: number, max: number) {
    if (remaining === 0) {
      out.push(acc.slice());
      return;
    }
    for (let p = Math.min(remaining, max); p >= 1; p--) {
      acc.push(p);
      rec(remaining - p, p);
      acc.pop();
    }
  })(n, n);
  return out;
}
function bruteSsytFillings(shape: number[], k: number): number[][][] {
  const out: number[][][] = [];
  const grid: number[][] = shape.map((len) => Array.from({ length: len }, () => 0));
  function cell(r: number, c: number): void {
    if (r === shape.length) {
      out.push(grid.map((row) => row.slice()));
      return;
    }
    if (c === shape[r]) {
      cell(r + 1, 0);
      return;
    }
    for (let v = 1; v <= k; v++) {
      if (c > 0 && grid[r][c - 1] > v) continue;
      if (r > 0 && c < shape[r - 1] && grid[r - 1][c] >= v) continue;
      grid[r][c] = v;
      cell(r, c + 1);
    }
  }
  cell(0, 0);
  return out;
}
const asKey = (rows: number[][]) =>
  JSON.stringify(rows.map((r) => r.length)) + "|" + JSON.stringify(rows.flat());
test("SemistandardTableaux(n,k) matches an independent brute-force enumeration for small n,k", () => {
  for (let n = 0; n <= 4; n++)
    for (let k = 1; k <= 3; k++) {
      const expected = new Set<string>();
      for (const shape of bruteIntPartitions(n))
        for (const f of bruteSsytFillings(shape, k)) expected.add(asKey(f));
      if (n === 0) expected.add(asKey([]));
      const entry = byHead.get("SemistandardTableaux")!;
      const total = entry.count([n, k]);
      const got = new Set<string>();
      for (let r = 0; r < total; r++) got.add(asKey(entry.unrank([n, k], r) as number[][]));
      expect(got).toEqual(expected);
      expect(total).toBe(expected.size);
    }
});

// AlternatingSignMatrices: brute-force every {-1,0,1}^(n*n) matrix (n<=3), filtered by an independently
// written ASM predicate, compared as a set against the kernel.
function isAsm(m: number[][], n: number): boolean {
  for (let i = 0; i < n; i++) {
    let pref = 0;
    for (let j = 0; j < n; j++) {
      pref += m[i][j];
      if (pref < 0 || pref > 1) return false;
    }
    if (pref !== 1) return false;
  }
  for (let j = 0; j < n; j++) {
    let pref = 0;
    for (let i = 0; i < n; i++) {
      pref += m[i][j];
      if (pref < 0 || pref > 1) return false;
    }
    if (pref !== 1) return false;
  }
  return true;
}
function bruteAsms(n: number): number[][][] {
  if (n === 0) return [[]];
  const results: number[][][] = [];
  const total = n * n;
  const cells = [-1, 0, 1];
  const flat = Array.from({ length: total }, () => -1);
  function rec(idx: number): void {
    if (idx === total) {
      const m: number[][] = [];
      for (let i = 0; i < n; i++) m.push(flat.slice(i * n, i * n + n));
      if (isAsm(m, n)) results.push(m);
      return;
    }
    for (const v of cells) {
      flat[idx] = v;
      rec(idx + 1);
    }
  }
  rec(0);
  return results;
}
test("AlternatingSignMatrices(n) matches an independent brute-force filter, n<=3", () => {
  const entry = byHead.get("AlternatingSignMatrices")!;
  for (const n of [0, 1, 2, 3]) {
    const expected = new Set(bruteAsms(n).map((m) => JSON.stringify(m)));
    const total = entry.count([n]);
    const got = new Set<string>();
    for (let r = 0; r < total; r++) got.add(JSON.stringify(entry.unrank([n], r)));
    expect(got).toEqual(expected);
    expect(total).toBe(expected.size);
  }
});

// SkewPartitions: brute-force every pair of partitions (lam, mu) with mu subseteq lam and |lam|-|mu|=n,
// bounded generously, filtered by an independent row/column-reduced predicate.
function isReducedSkew(lam: number[], mu: number[], n: number): boolean {
  if (mu.length > lam.length) return false;
  for (let i = 0; i < lam.length; i++) {
    if (i > 0 && lam[i] > lam[i - 1]) return false;
    const m = mu[i] ?? 0;
    if (i > 0 && m > (mu[i - 1] ?? 0)) return false;
    if (m >= lam[i]) return false;
  }
  if (lam.reduce((a, b) => a + b, 0) - mu.reduce((a, b) => a + b, 0) !== n) return false;
  const maxCol = lam[0] ?? 0;
  for (let col = 1; col <= maxCol; col++) {
    let covered = false;
    for (let i = 0; i < lam.length; i++) {
      const a = (mu[i] ?? 0) + 1;
      if (a <= col && col <= lam[i]) {
        covered = true;
        break;
      }
    }
    if (!covered) return false;
  }
  return true;
}
function brutePartitionsUpTo(maxParts: number, maxVal: number): number[][] {
  const out: number[][] = [[]];
  function rec(prefix: number[], remaining: number, cap: number): void {
    if (remaining === 0 || prefix.length === maxParts) return;
    for (let v = Math.min(cap, remaining); v >= 1; v--) {
      const next = [...prefix, v];
      out.push(next);
      rec(next, remaining - v, v);
    }
  }
  rec([], maxVal * maxParts, maxVal);
  return out;
}
test("SkewPartitions(n) anchors match the archived enumeratio checkout's hand-verified counts 1,1,3,9,28,87", () => {
  const entry = byHead.get("SkewPartitions")!;
  expect([0, 1, 2, 3, 4, 5].map((n) => entry.count([n]))).toEqual([1, 1, 3, 9, 28, 87]);
});
test("SkewPartitions(n) matches an independent brute-force filter, n<=3", () => {
  const entry = byHead.get("SkewPartitions")!;
  for (const n of [0, 1, 2, 3]) {
    const cands = brutePartitionsUpTo(n + 1, n + 1);
    const expected = new Set<string>();
    for (const lam of cands)
      for (const mu of cands)
        if (isReducedSkew(lam, mu, n)) expected.add(JSON.stringify([lam, mu]));
    const total = entry.count([n]);
    const got = new Set<string>();
    for (let r = 0; r < total; r++) got.add(JSON.stringify(entry.unrank([n], r)));
    expect(got).toEqual(expected);
    expect(total).toBe(expected.size);
  }
});

test("SkewStandardTableaux(n) anchors match the archived checkout's hand-verified counts 1,1,4,24,194", () => {
  const entry = byHead.get("SkewStandardTableaux")!;
  expect([0, 1, 2, 3, 4].map((n) => entry.count([n]))).toEqual([1, 1, 4, 24, 194]);
});
test("SkewStandardTableaux(n) >= StandardTableaux count is not asserted here (no cross-package import); instead every element's row_word has length n and shape sums to n", () => {
  const entry = byHead.get("SkewStandardTableaux")!;
  for (let n = 0; n <= 4; n++) {
    const total = entry.count([n]);
    for (let r = 0; r < total; r++) {
      const [lam, mu, w] = entry.unrank([n], r) as [number[], number[], number[]];
      expect(w.length).toBe(n);
      expect(lam.reduce((a, b) => a + b, 0) - mu.reduce((a, b) => a + b, 0)).toBe(n);
    }
  }
});

// ShiftedStandardTableaux: independent brute-force over strict partitions of n and their shifted fillings.
function bruteDistinctPartitions(n: number): number[][] {
  const out: number[][] = [];
  function rec(remaining: number, max: number, acc: number[]): void {
    if (remaining === 0) {
      out.push(acc.slice());
      return;
    }
    for (let p = Math.min(remaining, max); p >= 1; p--) {
      acc.push(p);
      rec(remaining - p, p - 1, acc);
      acc.pop();
    }
  }
  rec(n, n, []);
  return out;
}
function bruteShiftedFillings(shape: number[], n: number): number[][][] {
  // shape strictly decreasing row lengths; row i occupies absolute columns i..i+shape[i]-1.
  const out: number[][][] = [];
  const rows: number[][] = shape.map(() => []);
  function place(value: number): void {
    if (value > n) {
      out.push(rows.map((r) => r.slice()));
      return;
    }
    for (let r = 0; r < shape.length; r++) {
      if (rows[r].length >= shape[r]) continue;
      const c = rows[r].length; // position within row r, absolute column = r + c
      if (r > 0 && c + 1 < shape[r - 1] && rows[r - 1].length <= c + 1) continue; // cell above not yet filled
      rows[r].push(value);
      place(value + 1);
      rows[r].pop();
    }
  }
  place(1);
  return out;
}
test("ShiftedStandardTableaux(n) anchors match the archived checkout's hand-verified counts 1,1,1,2,3,6,12", () => {
  const entry = byHead.get("ShiftedStandardTableaux")!;
  expect([0, 1, 2, 3, 4, 5, 6].map((n) => entry.count([n]))).toEqual([1, 1, 1, 2, 3, 6, 12]);
});
test("ShiftedStandardTableaux(n) matches an independent brute-force enumeration, n<=5", () => {
  const entry = byHead.get("ShiftedStandardTableaux")!;
  for (let n = 0; n <= 5; n++) {
    const expected = new Set<string>();
    for (const shape of bruteDistinctPartitions(n))
      for (const f of bruteShiftedFillings(shape, n)) expected.add(asKey(f));
    const total = entry.count([n]);
    const got = new Set<string>();
    for (let r = 0; r < total; r++) got.add(asKey(entry.unrank([n], r) as number[][]));
    expect(got).toEqual(expected);
    expect(total).toBe(expected.size);
  }
});

// StandardTableauPairs: RSK is a bijection with permutations, so |pairs(n)| = n!, and every pair must
// have equal-shape SYT halves — checked independently of the kernel's own IsStandardTableauOf reuse.
function isIndependentSyt(rows: number[][], n: number): boolean {
  const seen = Array.from({ length: n + 1 }, () => false);
  let total = 0;
  for (let r = 0; r < rows.length; r++) {
    if (r > 0 && rows[r - 1].length < rows[r].length) return false;
    for (let c = 0; c < rows[r].length; c++) {
      const v = rows[r][c];
      if (v < 1 || v > n || seen[v]) return false;
      seen[v] = true;
      total++;
      if (c > 0 && rows[r][c - 1] >= v) return false;
      if (r > 0 && c < rows[r - 1].length && rows[r - 1][c] >= v) return false;
    }
  }
  return total === n;
}
test("StandardTableauPairs(n) = n!, and every element is a genuinely same-shape SYT pair", () => {
  const entry = byHead.get("StandardTableauPairs")!;
  expect([0, 1, 2, 3, 4, 5].map((n) => entry.count([n]))).toEqual([1, 1, 2, 6, 24, 120]);
  for (let n = 0; n <= 5; n++) {
    const total = entry.count([n]);
    for (let r = 0; r < total; r++) {
      const [P, Q] = entry.unrank([n], r) as [number[][], number[][]];
      expect(isIndependentSyt(P, n)).toBe(true);
      expect(isIndependentSyt(Q, n)).toBe(true);
      expect(P.map((row) => row.length)).toEqual(Q.map((row) => row.length));
    }
  }
});

// PlanePartitions: independent brute-force via nested-loop generation for very small n.
function brutePlanePartitions(n: number): number[][][] {
  if (n === 0) return [[]];
  const results: number[][][] = [];
  const rows: number[][] = [];
  function nextRows(ceiling: number[], remaining: number): number[][] {
    // every non-empty partition r, r.length<=ceiling.length, r[j]<=ceiling[j], sum<=remaining
    const out: number[][] = [];
    function rec(cur: number[], sum: number): void {
      if (cur.length > 0) out.push(cur.slice());
      if (cur.length === ceiling.length) return;
      const prev = cur.length ? cur[cur.length - 1] : Infinity;
      const hi = Math.min(prev, ceiling[cur.length]);
      for (let v = 1; v <= hi; v++) {
        if (sum + v > remaining) break;
        cur.push(v);
        rec(cur, sum + v);
        cur.pop();
      }
    }
    rec([], 0);
    return out;
  }
  function backtrack(ceiling: number[], remaining: number): void {
    if (remaining === 0) {
      results.push(rows.map((r) => r.slice()));
      return;
    }
    for (const nr of nextRows(ceiling, remaining)) {
      const cells = nr.reduce((a, b) => a + b, 0);
      rows.push(nr);
      backtrack(nr, remaining - cells);
      rows.pop();
    }
  }
  backtrack(
    Array.from({ length: n }, () => n),
    n,
  );
  return results;
}
test("PlanePartitions(n) matches OEIS A000219: 1,1,3,6,13,24,48", () => {
  const entry = byHead.get("PlanePartitions")!;
  expect([0, 1, 2, 3, 4, 5, 6].map((n) => entry.count([n]))).toEqual([1, 1, 3, 6, 13, 24, 48]);
});
test("PlanePartitions(n) matches an independent brute-force enumeration, n<=6", () => {
  const entry = byHead.get("PlanePartitions")!;
  for (let n = 0; n <= 6; n++) {
    const expected = new Set(brutePlanePartitions(n).map((rows) => asKey(rows)));
    const total = entry.count([n]);
    const got = new Set<string>();
    for (let r = 0; r < total; r++) got.add(asKey(entry.unrank([n], r) as number[][]));
    expect(got).toEqual(expected);
    expect(total).toBe(expected.size);
  }
});

// GelfandTsetlin: closed-form Weyl-dimension anchors from the archived checkout.
test("GelfandTsetlin(2,k) for k=1..4 is 4,10,20,35", () => {
  const entry = byHead.get("GelfandTsetlin")!;
  expect([1, 2, 3, 4].map((k) => entry.count([2, k]))).toEqual([4, 10, 20, 35]);
});
test("GelfandTsetlin(n,1) for n=1..4 is 2,4,8,16", () => {
  const entry = byHead.get("GelfandTsetlin")!;
  expect([1, 2, 3, 4].map((n) => entry.count([n, 1]))).toEqual([2, 4, 8, 16]);
});
test("GelfandTsetlin(3,2) = 35", () => {
  const entry = byHead.get("GelfandTsetlin")!;
  expect(entry.count([3, 2])).toBe(35);
});

// SemistandardTableaux: closed-form hook-content anchors from the archived checkout.
test("SemistandardTableaux(n,3) for n=0..4 is 1,3,9,19,39", () => {
  const entry = byHead.get("SemistandardTableaux")!;
  expect([0, 1, 2, 3, 4].map((n) => entry.count([n, 3]))).toEqual([1, 3, 9, 19, 39]);
});
test("SemistandardTableaux(3,k) for k=1..4 is 1,6,19,44", () => {
  const entry = byHead.get("SemistandardTableaux")!;
  expect([1, 2, 3, 4].map((k) => entry.count([3, k]))).toEqual([1, 6, 19, 44]);
});

// AlternatingSignMatrices: closed-form ASM-number anchors (A005130).
test("AlternatingSignMatrices(n) = A005130: 1,1,2,7,42,429", () => {
  const entry = byHead.get("AlternatingSignMatrices")!;
  expect([0, 1, 2, 3, 4, 5].map((n) => entry.count([n]))).toEqual([1, 1, 2, 7, 42, 429]);
});

// Golden JSON (AGENTS.md); regenerate with `UPDATE_TABLEAUX_PLANE_GOLDEN=1 vp test`.
const GOLDEN = fileURLToPath(new URL("./tableaux-plane.golden.json", import.meta.url));
const updating = process.env.UPDATE_TABLEAUX_PLANE_GOLDEN === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

const GOLDEN_CASES: Record<string, number[][]> = {
  SemistandardTableaux: [[3, 2]],
  GelfandTsetlin: [[3, 2]],
  AlternatingSignMatrices: [[4]],
  SkewPartitions: [[3]],
  SkewStandardTableaux: [[3]],
  ShiftedStandardTableaux: [[5]],
  StandardTableauPairs: [[4]],
  PlanePartitions: [[5]],
};

for (const [head, paramsList] of Object.entries(GOLDEN_CASES)) {
  for (const p of paramsList) {
    const key = `${head}(${p.join(",")})`;
    test(`golden: ${key}`, () => {
      const entry = byHead.get(head)!;
      const total = entry.count(p);
      const elements = Array.from({ length: total }, (_, r) => entry.unrank(p, r));
      if (updating) {
        fresh[key] = elements;
        return;
      }
      expect(elements).toEqual(golden[key]);
    });
  }
}

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
