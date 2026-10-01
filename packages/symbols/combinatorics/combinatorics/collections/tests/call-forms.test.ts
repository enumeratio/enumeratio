import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCombinatorics } from "../../src/index.ts";

// Brute-force cross-checks for the call forms in ./families/call-forms.ts, against
// independent generators (no shared code with the kernels those call forms route to) --
// for every count AND every enumeration, at small n so an O(2^n) / O(n!) generator stays
// cheap. See ../src/families/call-forms.ts for what's being tested and why.
//
// IntegerPartitions and SetPartitions live in their own areas now (A-94) and come out typed
// (`IntegerPartition(...)`, `SetPartition(...)`) once declareCombinatorics mints their
// carriers -- stripLists unwraps that one-arg carrier wrapper too, not just `List`.

const ce = new ComputeEngine();
declareCombinatorics(ce);

function countOf(expr: unknown): unknown {
  return ce.box(["Count", expr] as never).evaluate().json;
}

/** `["List", …]` (at every depth) -> a plain nested array, to compare against a
 *  brute-force generator's plain JS output without either side reformatting for the other.
 *  Also unwraps a one-arg carrier constructor (`IntegerPartition(x)`, `SetPartition(x)`) around
 *  the same shape, typed now that its area's carrier is declared alongside it -- and, for a
 *  carrier whose shape prefixes params onto the element (`Finset(Tuple(n, list))`), drops
 *  those leading params and keeps the Tuple's last slot, the element itself. */
function stripLists(x: unknown): unknown {
  if (!Array.isArray(x)) return x;
  const [head, ...rest] = x;
  if (head === "List") return rest.map(stripLists);
  if (typeof head === "string" && rest.length === 1) {
    const inner = rest[0];
    if (Array.isArray(inner) && inner[0] === "Tuple") return stripLists(inner[inner.length - 1]);
    return stripLists(inner);
  }
  return x;
}

/** Every element of a lazy collection. */
function elementsOf(expr: unknown): unknown[] {
  const list = ce.box(expr as never).evaluate({ materialization: true }).json as unknown as unknown[];
  return list.slice(1).map(stripLists);
}

const canon = (rows: readonly (readonly number[])[]): string[] => rows.map((r) => JSON.stringify(r)).toSorted();

// ─── independent generators ──────────────────────────────────────────────────────────

/** Every partition of n, largest part first within each partition (order across
 *  partitions unspecified -- callers compare as a SET via `canon`). */
function bruteForcePartitions(n: number, allowed: (p: number) => boolean = () => true): number[][] {
  const out: number[][] = [];
  const rec = (remaining: number, maxPart: number, current: number[]) => {
    if (remaining === 0) {
      out.push([...current]);
      return;
    }
    for (let p = Math.min(remaining, maxPart); p >= 1; p--) {
      if (!allowed(p)) continue;
      current.push(p);
      rec(remaining - p, p, current);
      current.pop();
    }
  };
  rec(n, n, []);
  return out;
}

/** Every subset of {1,…,n}, as an ascending member list. */
function bruteForceSubsets(n: number): number[][] {
  const out: number[][] = [];
  for (let mask = 0; mask < 2 ** n; mask++) {
    const s: number[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) s.push(i + 1);
    out.push(s);
  }
  return out;
}

/** Every set partition of {1,…,n}: each new element either starts a new block or joins
 *  an existing one -- the standard restricted-growth-string recursion, generated fresh
 *  (no shared code with kernels-combinatorics.ts's RGS machinery). Blocks come back
 *  ascending-first-element, members ascending within a block, so two set partitions are
 *  the same iff their JSON is. */
function bruteForceSetPartitions(n: number): number[][][] {
  if (n === 0) return [[]];
  const out: number[][][] = [];
  const rec = (elem: number, blocks: number[][]) => {
    if (elem > n) {
      out.push(blocks.map((b) => [...b]));
      return;
    }
    for (const b of blocks) {
      b.push(elem);
      rec(elem + 1, blocks);
      b.pop();
    }
    blocks.push([elem]);
    rec(elem + 1, blocks);
    blocks.pop();
  };
  rec(1, []);
  return out.map((blocks) => blocks.map((b) => [...b].toSorted((x, y) => x - y)));
}

const canonBlocks = (partitions: readonly (readonly (readonly number[])[])[]): string[] =>
  partitions
    .map((blocks) => JSON.stringify([...blocks].map((b) => [...b]).toSorted((a, b) => (a[0] ?? 0) - (b[0] ?? 0))))
    .toSorted();

// ─── IntegerPartitions(n, k) -- at most k parts ──────────────────────────────────────

for (const [n, k] of [
  [6, 2],
  [8, 3],
  [8, 0],
  [1, 5],
  [0, 0],
  [5, 5],
] as const) {
  test(`IntegerPartitions(${n}, ${k}) matches a brute-force "at most ${k} parts" scan`, () => {
    const want = bruteForcePartitions(n).filter((p) => p.length <= k);
    expect(countOf(["IntegerPartitions", n, k])).toBe(want.length);
    expect(canon(elementsOf(["IntegerPartitions", n, k]) as number[][])).toEqual(canon(want));
  });
}

// ─── IntegerPartitions(n, {k}) -- exactly k parts ────────────────────────────────────

for (const [n, k] of [
  [6, 2],
  [8, 3],
  [8, 0],
  [0, 0],
  [5, 1],
] as const) {
  test(`IntegerPartitions(${n}, {${k}}) matches a brute-force "exactly ${k} parts" scan`, () => {
    const want = bruteForcePartitions(n).filter((p) => p.length === k);
    const expr = ["IntegerPartitions", n, ["List", k]];
    expect(countOf(expr)).toBe(want.length);
    expect(canon(elementsOf(expr) as number[][])).toEqual(canon(want));
  });
}

// ─── IntegerPartitions(n, All, parts) -- parts restricted to an explicit list ────────

for (const [n, parts] of [
  [8, [1, 2, 5]],
  [10, [1, 3, 5, 7, 9]],
  [6, [2, 4]],
  [7, [2, 4]],
] as const) {
  test(`IntegerPartitions(${n}, All, {${parts.join(", ")}}) matches a brute-force restricted-parts scan`, () => {
    const allowed = new Set<number>(parts);
    const want = bruteForcePartitions(n, (p) => allowed.has(p));
    const expr = ["IntegerPartitions", n, "All", ["List", ...parts]];
    expect(countOf(expr)).toBe(want.length);
    expect(canon(elementsOf(expr) as number[][])).toEqual(canon(want));
  });
}

// ─── SetPartitions(n, k) -- Stirling numbers of the second kind ──────────────────────

for (const [n, k] of [
  [4, 2],
  [5, 3],
  [4, 1],
  [4, 4],
  [4, 0],
] as const) {
  test(`SetPartitions(${n}, ${k}) matches a brute-force "exactly ${k} blocks" scan`, () => {
    const want = bruteForceSetPartitions(n).filter((p) => p.length === k);
    const expr = ["SetPartitions", n, k];
    expect(countOf(expr)).toBe(want.length);
    expect(canonBlocks(elementsOf(expr) as number[][][])).toEqual(canonBlocks(want));
  });
}

// ─── Subsets(n, k) -- at most k elements ─────────────────────────────────────────────

for (const [n, k] of [
  [4, 2],
  [5, 0],
  [5, 5],
  [3, 10],
] as const) {
  test(`Subsets(${n}, ${k}) matches a brute-force "at most ${k}" scan`, () => {
    const want = bruteForceSubsets(n).filter((s) => s.length <= k);
    const expr = ["Subsets", n, k];
    expect(countOf(expr)).toBe(want.length);
    expect(canon(elementsOf(expr) as number[][])).toEqual(canon(want));
  });
}

// ─── Subsets(n, {k}) -- exactly k elements ───────────────────────────────────────────

for (const [n, k] of [
  [5, 2],
  [4, 0],
  [4, 4],
] as const) {
  test(`Subsets(${n}, {${k}}) matches a brute-force "exactly ${k}" scan`, () => {
    const want = bruteForceSubsets(n).filter((s) => s.length === k);
    const expr = ["Subsets", n, ["List", k]];
    expect(countOf(expr)).toBe(want.length);
    expect(canon(elementsOf(expr) as number[][])).toEqual(canon(want));
  });
}

// ─── Subsets(n, {kmin, kmax}) and (n, {kmin, kmax, step}) -- size ranges ─────────────

for (const [n, kmin, kmax, step] of [
  [5, 1, 3, 1],
  [5, 0, 5, 2],
  [6, 2, 4, 1],
] as const) {
  test(`Subsets(${n}, {${kmin}, ${kmax}, ${step}}) matches a brute-force size-range scan`, () => {
    const sizes = new Set<number>();
    for (let s = kmin; s <= kmax; s += step) sizes.add(s);
    const want = bruteForceSubsets(n).filter((s) => sizes.has(s.length));
    const expr = ["Subsets", n, ["List", kmin, kmax, step]];
    expect(countOf(expr)).toBe(want.length);
    expect(canon(elementsOf(expr) as number[][])).toEqual(canon(want));
  });
}

test("Subsets(n, {kmin, kmax}) defaults its step to 1", () => {
  const want = bruteForceSubsets(5).filter((s) => s.length >= 1 && s.length <= 3);
  const expr = ["Subsets", 5, ["List", 1, 3]];
  expect(countOf(expr)).toBe(want.length);
  expect(canon(elementsOf(expr) as number[][])).toEqual(canon(want));
});

// ─── Subsets(list) / SetPartitions(list) -- an explicit list of elements ────────────

test("Subsets(list) is Subsets(n) unranked in the same binary-mask order, elements swapped in for positions", () => {
  const expr = ["Subsets", ["List", "a", "b", "c"]];
  expect(countOf(expr)).toBe(8);
  expect(elementsOf(expr)).toEqual([[], ["a"], ["b"], ["a", "b"], ["c"], ["a", "c"], ["b", "c"], ["a", "b", "c"]]);
});

test("Count(Subsets(list)) is 2^n for an n-element list", () => {
  for (const n of [0, 1, 3, 7, 10]) {
    const list = ["List", ...Array.from({ length: n }, (_, i) => i)];
    expect(countOf(["Subsets", list])).toBe(2 ** n);
  }
});

// Regression for A-129/farm: Subsets(list, k) and Subsets(list, {k, …}) used to fall through
// to the n-is-an-integer branch (`integerAt(ops[0])` on the LIST itself, which is undefined)
// and decline entirely, so every size-restricted call over an explicit list came back empty.
test("Subsets(list, k) and Subsets(list, {k}) size-restrict over the list's own elements", () => {
  const list = ["List", "a", "b", "c", "d"];
  expect(elementsOf(["Subsets", list, ["List", 2]])).toEqual([
    ["a", "b"],
    ["a", "c"],
    ["b", "c"],
    ["a", "d"],
    ["b", "d"],
    ["c", "d"],
  ]);
  expect(countOf(["Subsets", list, 2])).toBe(1 + 4 + 6); // {}, singles, pairs
});

test("Subsets(collection) also takes a lazy collection, not just a List literal", () => {
  // Range(1, 10) is itself a lazy indexed collection, never materialized into a List --
  // elementsOf() has to read it through .each(), not by assuming operator === "List".
  expect(countOf(["Subsets", ["Range", 1, 10]])).toBe(1024);
});

test("SetPartitions(list) is SetPartitions(n) unranked in the same RGS order, elements swapped in for positions", () => {
  const expr = ["SetPartitions", ["List", "a", "b", "c"]];
  expect(countOf(expr)).toBe(5);
  expect(elementsOf(expr)).toEqual([
    [["a", "b", "c"]],
    [["a", "b"], ["c"]],
    [["a", "c"], ["b"]],
    [["a"], ["b", "c"]],
    [["a"], ["b"], ["c"]],
  ]);
});

// ─── PartitionsQ Euler identity, now provable (#137's promoted example) ─────────────

test("Euler: partitions into odd parts as many as partitions into distinct parts", () => {
  for (const n of [1, 5, 10, 15]) {
    const oddParts = countOf(["IntegerPartitions", n, "All", ["List", ...oddsUpTo(n)]]);
    const distinct = countOf(["DistinctPartitions", n]);
    expect(oddParts).toBe(distinct);
  }
});

function oddsUpTo(n: number): number[] {
  const out: number[] = [];
  for (let v = 1; v <= n; v += 2) out.push(v);
  return out;
}
