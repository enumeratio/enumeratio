import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, afterAll } from "vite-plus/test";
import { entries } from "../src/families/unlabeled-trees.ts";

const byHead = new Map(entries.map((e) => [e.head, e]));

// ─── self-cert: unrank -> valid, rank(unrank(r)) === r, for every rank of every family. ────────────
const PARAMS: Record<string, number[][]> = {
  RootedUnlabeledTrees: Array.from({ length: 9 }, (_, i) => [i + 1]), // n=1..9, T(9)=286
  UnlabeledFreeTrees: Array.from({ length: 9 }, (_, i) => [i + 1]), // n=1..9, F(9)=47
  PhylogeneticTrees: Array.from({ length: 6 }, (_, i) => [i + 1]), // n=1..6, count(6)=945
  NonCrossingTrees: Array.from({ length: 6 }, (_, i) => [i]), // n=0..5, count(5)=273
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

// ─── OEIS counts, cross-checked against brute force below (never trusted blindly). ─────────────────
test("RootedUnlabeledTrees(n) = A000081", () => {
  const e = byHead.get("RootedUnlabeledTrees")!;
  expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => e.count([n]))).toEqual([
    1, 1, 2, 4, 9, 20, 48, 115, 286,
  ]);
});
test("UnlabeledFreeTrees(n) = A000055", () => {
  const e = byHead.get("UnlabeledFreeTrees")!;
  expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => e.count([n]))).toEqual([
    1, 1, 1, 2, 3, 6, 11, 23, 47,
  ]);
});
test("PhylogeneticTrees(n) = A001147 (2n-3)!!", () => {
  const e = byHead.get("PhylogeneticTrees")!;
  expect([1, 2, 3, 4, 5, 6, 7].map((n) => e.count([n]))).toEqual([1, 1, 3, 15, 105, 945, 10395]);
});
test("NonCrossingTrees(n) = A001764, C(3n,n)/(2n+1)", () => {
  const e = byHead.get("NonCrossingTrees")!;
  expect([0, 1, 2, 3, 4, 5, 6].map((n) => e.count([n]))).toEqual([1, 1, 3, 12, 55, 273, 1428]);
});

// ─── brute force #1: independent labeled-tree generator (Prufer, all n^(n-2) trees on [n]) plus a
// from-scratch AHU canonical form — a different code path than the multiset-rank kernel above. ─────
function allLabeledTrees(n: number): number[][][] {
  if (n === 1) return [[]];
  if (n === 2) return [[[1, 2]]];
  const codes = n - 2;
  const total = n ** codes;
  const out: number[][][] = [];
  for (let r = 0; r < total; r++) {
    let rem = r;
    const seq: number[] = [];
    for (let i = 0; i < codes; i++) {
      seq.push((rem % n) + 1);
      rem = Math.floor(rem / n);
    }
    const degree = Array.from({ length: n + 1 }, () => 1);
    for (const s of seq) degree[s]++;
    const edges: number[][] = [];
    const seqCopy = seq.slice();
    for (const s of seqCopy) {
      let leaf = -1;
      for (let v = 1; v <= n; v++)
        if (degree[v] === 1) {
          leaf = v;
          break;
        }
      edges.push([leaf, s]);
      degree[leaf]--;
      degree[s]--;
    }
    const remaining: number[] = [];
    for (let v = 1; v <= n; v++) if (degree[v] === 1) remaining.push(v);
    edges.push([remaining[0], remaining[1]]);
    out.push(edges);
  }
  return out;
}
function adjacencyOf(edges: number[][], n: number): number[][] {
  const adj: number[][] = Array.from({ length: n + 1 }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
  }
  return adj;
}
function canonicalRooted(adj: number[][], root: number, parent: number): string {
  const kids = adj[root]
    .filter((v) => v !== parent)
    .map((v) => canonicalRooted(adj, v, root))
    .sort();
  return `(${kids.join("")})`;
}
function centroids(adj: number[][], n: number): number[] {
  const size = Array.from({ length: n + 1 }, () => 0);
  const maxSub = Array.from({ length: n + 1 }, () => 0);
  const seen = Array.from({ length: n + 1 }, () => false);
  const order: number[] = [];
  const parent = Array.from({ length: n + 1 }, () => 0);
  const stack = [1];
  seen[1] = true;
  while (stack.length) {
    const u = stack.pop()!;
    order.push(u);
    for (const v of adj[u])
      if (!seen[v]) {
        seen[v] = true;
        parent[v] = u;
        stack.push(v);
      }
  }
  for (let i = order.length - 1; i >= 0; i--) {
    const u = order[i];
    size[u] = 1;
    for (const v of adj[u]) if (v !== parent[u]) size[u] += size[v];
  }
  for (const u of order) {
    let mx = n - size[u]; // the "upward" component (through the parent), 0 at the actual root
    for (const v of adj[u]) if (v !== parent[u]) mx = Math.max(mx, size[v]);
    maxSub[u] = mx;
  }
  let best = Infinity;
  for (let v = 1; v <= n; v++) best = Math.min(best, maxSub[v]);
  const cs: number[] = [];
  for (let v = 1; v <= n; v++) if (maxSub[v] === best) cs.push(v);
  return cs;
}
function canonicalFree(adj: number[][], n: number): string {
  if (n === 1) return "()";
  const cs = centroids(adj, n);
  return cs.map((c) => canonicalRooted(adj, c, 0)).sort()[0];
}

test("brute force: RootedUnlabeledTrees(n) isomorphism-class count matches A000081", () => {
  for (const n of [1, 2, 3, 4, 5, 6]) {
    const trees = allLabeledTrees(n);
    const seen = new Set<string>();
    for (const edges of trees) seen.add(canonicalRooted(adjacencyOf(edges, n), 1, 0));
    expect(seen.size).toBe(byHead.get("RootedUnlabeledTrees")!.count([n]));
  }
});
test("brute force: UnlabeledFreeTrees(n) isomorphism-class count matches A000055", () => {
  for (const n of [1, 2, 3, 4, 5, 6]) {
    const trees = allLabeledTrees(n);
    const seen = new Set<string>();
    for (const edges of trees) seen.add(canonicalFree(adjacencyOf(edges, n), n));
    expect(seen.size).toBe(byHead.get("UnlabeledFreeTrees")!.count([n]));
  }
});

// ─── brute force #2: geometric non-crossing check over all labeled trees on n+1 circle points. ─────
function edgesCross(a: number, b: number, c: number, d: number): boolean {
  const between = (x: number, lo: number, hi: number): boolean => {
    // does x lie strictly inside the arc (lo -> hi) going clockwise (increasing, wrapping)?
    if (lo < hi) return x > lo && x < hi;
    return x > lo || x < hi;
  };
  const cIn = between(c, a, b);
  const dIn = between(d, a, b);
  return cIn !== dIn;
}
test("brute force: NonCrossingTrees(n) count matches geometric no-crossing-chord trees on n+1 circle points", () => {
  for (const n of [1, 2, 3, 4]) {
    const V = n + 1;
    const trees = allLabeledTrees(V).map((edges) => edges.map(([u, v]) => [u - 1, v - 1])); // 0-indexed
    let count = 0;
    for (const edges of trees) {
      let ok = true;
      outer: for (let i = 0; i < edges.length && ok; i++)
        for (let j = i + 1; j < edges.length; j++) {
          const [a, b] = edges[i];
          const [c, d] = edges[j];
          if (new Set([a, b, c, d]).size < 4) continue; // sharing a vertex never crosses
          if (edgesCross(a, b, c, d)) {
            ok = false;
            break outer;
          }
        }
      if (ok) count++;
    }
    expect(count).toBe(byHead.get("NonCrossingTrees")!.count([n]));
  }
});

// ─── brute force #3: independent unordered-binary-partition count for phylogenetic trees (subset DP,
// a different recurrence than the insertion-radix product used by the kernel). ──────────────────────
function bruteForcePhyloCount(n: number): number {
  const memo = new Map<number, number>();
  const f = (mask: number): number => {
    if ((mask & (mask - 1)) === 0) return 1; // single leaf
    const hit = memo.get(mask);
    if (hit !== undefined) return hit;
    const lowBit = mask & -mask;
    let total = 0;
    for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
      if ((sub & lowBit) === 0) continue; // count each unordered {sub, mask^sub} once
      const rest = mask ^ sub;
      if (rest === 0 || rest === mask) continue;
      total += f(sub) * f(rest);
    }
    memo.set(mask, total);
    return total;
  };
  return f((1 << n) - 1);
}
test("brute force: PhylogeneticTrees(n) matches independent unordered-partition DP", () => {
  for (const n of [1, 2, 3, 4, 5, 6]) {
    expect(bruteForcePhyloCount(n)).toBe(byHead.get("PhylogeneticTrees")!.count([n]));
  }
});

// Golden JSON (AGENTS.md); regenerate with `UPDATE_UNLABELED_TREES_GOLDEN=1 vp test`.
const GOLDEN = fileURLToPath(new URL("./unlabeled-trees.golden.json", import.meta.url));
const updating = process.env.UPDATE_UNLABELED_TREES_GOLDEN === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

const GOLDEN_CASES: Record<string, number[][]> = {
  RootedUnlabeledTrees: [[6]],
  UnlabeledFreeTrees: [[6]],
  PhylogeneticTrees: [[5]],
  NonCrossingTrees: [[3]],
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
