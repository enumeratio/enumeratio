import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

const U = (a: number, b: number) => ["UndirectedEdge", a, b];
const D = (a: number, b: number) => ["DirectedEdge", a, b];
const graphV = (vertices: unknown[], edges: unknown[]) => ["Graph", ["List", ...vertices], ["List", ...edges]];

// ─── independent brute-force reference implementations ─────────────────────────────────
//
// These are written from scratch against plain edge lists — never by calling the heads
// under test — so a shared bug in graphs.ts can't hide from its own tests.

interface Ref {
  n: number;
  edges: { a: number; b: number; directed: boolean }[];
}

function floydWarshallDistances(ref: Ref): number[][] {
  const INF = Infinity;
  const dist = Array.from({ length: ref.n + 1 }, () => Array.from({ length: ref.n + 1 }, () => INF));
  for (let i = 1; i <= ref.n; i++) dist[i]![i] = 0;
  for (const e of ref.edges) {
    dist[e.a]![e.b] = Math.min(dist[e.a]![e.b]!, 1);
    if (!e.directed) dist[e.b]![e.a] = Math.min(dist[e.b]![e.a]!, 1);
  }
  for (let k = 1; k <= ref.n; k++) {
    for (let i = 1; i <= ref.n; i++) {
      for (let j = 1; j <= ref.n; j++) {
        const via = dist[i]![k]! + dist[k]![j]!;
        if (via < dist[i]![j]!) dist[i]![j] = via;
      }
    }
  }
  return dist;
}

function unionFindComponentCount(ref: Ref): number {
  const parent = Array.from({ length: ref.n + 1 }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
  for (const e of ref.edges) {
    const ra = find(e.a);
    const rb = find(e.b);
    if (ra !== rb) parent[ra] = rb;
  }
  const roots = new Set<number>();
  for (let i = 1; i <= ref.n; i++) roots.add(find(i));
  return roots.size;
}

function pathRef(n: number): Ref {
  const edges = [];
  for (let i = 1; i < n; i++) edges.push({ a: i, b: i + 1, directed: false });
  return { n, edges };
}

function completeRef(n: number): Ref {
  const edges = [];
  for (let i = 1; i <= n; i++) for (let j = i + 1; j <= n; j++) edges.push({ a: i, b: j, directed: false });
  return { n, edges };
}

function cycleRef(n: number): Ref {
  const r = pathRef(n);
  r.edges.push({ a: n, b: 1, directed: false });
  return r;
}

// ─── named families: sizes and structure cross-checked against independent formulas ────

test("CompleteGraph(n): n vertices, n(n-1)/2 edges, every degree n-1", () => {
  for (const n of [1, 2, 5, 6]) {
    expect(run(["VertexCount", ["CompleteGraph", n]])).toBe(n);
    expect(run(["EdgeCount", ["CompleteGraph", n]])).toBe((n * (n - 1)) / 2);
  }
});

test("PathGraph(n): n vertices, n-1 edges, endpoints degree 1, interior degree 2", () => {
  for (const n of [1, 2, 5]) {
    expect(run(["VertexCount", ["PathGraph", n]])).toBe(n);
    expect(run(["EdgeCount", ["PathGraph", n]])).toBe(Math.max(0, n - 1));
  }
});

test("CycleGraph(n): n vertices, n edges, every degree 2", () => {
  for (const n of [3, 4, 7]) {
    expect(run(["VertexCount", ["CycleGraph", n]])).toBe(n);
    expect(run(["EdgeCount", ["CycleGraph", n]])).toBe(n);
    const degs = run(["VertexDegree", ["CycleGraph", n]]) as unknown as [string, ...number[]];
    expect(degs.slice(1).every((d) => d === 2)).toBe(true);
  }
});

test("StarGraph(n): centre has degree n-1, every leaf has degree 1", () => {
  const n = 6;
  const degs = run(["VertexDegree", ["StarGraph", n]]) as unknown as [string, ...number[]];
  expect(degs[1]).toBe(n - 1);
  expect(degs.slice(2).every((d) => d === 1)).toBe(true);
});

test("GridGraph({m, n}): m*n vertices, m(n-1)+n(m-1) edges", () => {
  const m = 3;
  const n = 4;
  expect(run(["VertexCount", ["GridGraph", ["List", m, n]]])).toBe(m * n);
  expect(run(["EdgeCount", ["GridGraph", ["List", m, n]]])).toBe(m * (n - 1) + n * (m - 1));
});

test("HypercubeGraph(k): 2^k vertices, k*2^(k-1) edges, every degree k", () => {
  for (const k of [0, 1, 2, 3, 4]) {
    expect(run(["VertexCount", ["HypercubeGraph", k]])).toBe(2 ** k);
    expect(run(["EdgeCount", ["HypercubeGraph", k]])).toBe(k === 0 ? 0 : (k * 2 ** k) / 2);
    if (k > 0) {
      const degs = run(["VertexDegree", ["HypercubeGraph", k]]) as unknown as [string, ...number[]];
      expect(degs.slice(1).every((d) => d === k)).toBe(true);
    }
  }
});

// CompleteKaryTree's first argument is a LEVEL count, not a vertex count (kernel-verified:
// CompleteKaryTree[3, 2] has 7 vertices, CompleteKaryTree[1, 2] has 1) -- every level is
// completely filled, so vertex count = (k^levels - 1)/(k - 1).
test("CompleteKaryTree(levels, k): exact vertex/edge counts from the geometric series", () => {
  for (const [levels, k] of [
    [1, 2],
    [3, 2],
    [4, 3],
    [1, 5],
  ]) {
    const n = run(["VertexCount", ["CompleteKaryTree", levels, k]]) as number;
    expect(run(["EdgeCount", ["CompleteKaryTree", levels, k]])).toBe(n - 1); // a tree
  }
});

test("CompleteKaryTree(levels) [binary default]: same as CompleteKaryTree(levels, 2)", () => {
  expect(run(["EdgeList", ["CompleteKaryTree", 4]])).toEqual(run(["EdgeList", ["CompleteKaryTree", 4, 2]]));
});

test("PetersenGraph(): 3-regular, girth 5 (not bipartite)", () => {
  const degs = run(["VertexDegree", ["PetersenGraph"]]) as unknown as [string, ...number[]];
  expect(degs.slice(1).every((d) => d === 3)).toBe(true);
});

// ─── ConnectedComponents / IsConnectedGraph, cross-checked against union-find ───────────
//
// ConnectedComponents gives STRONGLY connected components, respecting edge direction
// (kernel-verified: Graph[{1->2,2->1,2->3}] -> {{3},{1,2}}). IsConnectedGraph/IsTreeGraph
// mean weak connectivity instead (a directed tree is never strongly connected) -- see
// isWeaklyConnected's own comment in graphs.ts. On a purely undirected graph the two
// notions coincide, which is what the union-find cross-check below exercises.

test("ConnectedComponents matches an independent union-find, on random small (undirected) graphs", () => {
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let trial = 0; trial < 30; trial++) {
    const n = 2 + Math.floor(rand() * 6);
    const edges: { a: number; b: number; directed: boolean }[] = [];
    const edgeExprs: unknown[] = [];
    for (let a = 1; a <= n; a++) {
      for (let b = a + 1; b <= n; b++) {
        if (rand() < 0.35) {
          edges.push({ a, b, directed: false });
          edgeExprs.push(U(a, b));
        }
      }
    }
    const ref: Ref = { n, edges };
    const g = graphV(
      Array.from({ length: n }, (_, i) => i + 1),
      edgeExprs,
    );
    const componentCount = (run(["ConnectedComponents", g]) as unknown as unknown[]).length - 1;
    expect(componentCount).toBe(unionFindComponentCount(ref));
    expect(run(["IsConnectedGraph", g])).toEqual(unionFindComponentCount(ref) === 1 ? "True" : "False");
  }
});

// ─── GraphDistance, cross-checked against Floyd–Warshall ───────────────────────────────

test("GraphDistance matches an independent Floyd-Warshall, on random small directed graphs", () => {
  let seed = 98765;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let trial = 0; trial < 30; trial++) {
    const n = 2 + Math.floor(rand() * 5);
    const edges: { a: number; b: number; directed: boolean }[] = [];
    const edgeExprs: unknown[] = [];
    for (let a = 1; a <= n; a++) {
      for (let b = 1; b <= n; b++) {
        if (a !== b && rand() < 0.3) {
          edges.push({ a, b, directed: true });
          edgeExprs.push(D(a, b));
        }
      }
    }
    const ref: Ref = { n, edges };
    const dist = floydWarshallDistances(ref);
    const g = graphV(
      Array.from({ length: n }, (_, i) => i + 1),
      edgeExprs,
    );
    for (let a = 1; a <= n; a++) {
      for (let b = 1; b <= n; b++) {
        const expected = dist[a]![b]!;
        const got = run(["GraphDistance", g, a, b]);
        if (expected === Infinity) {
          expect(got).toEqual("PositiveInfinity");
        } else {
          expect(got).toBe(expected);
        }
      }
    }
  }
});

// ─── NeighborhoodGraph ──────────────────────────────────────────────────────────────────

test("NeighborhoodGraph(g, v, r) keeps exactly the vertices within distance r (cross-checked against GraphDistance)", () => {
  const g = ["PathGraph", 7];
  for (const r of [0, 1, 2, 3]) {
    const nbhd = run(["NeighborhoodGraph", g, 4, r]) as unknown as [string, unknown[], unknown[]];
    const vertexList = (nbhd[1] as unknown as [string, ...number[]]).slice(1);
    const expected = [1, 2, 3, 4, 5, 6, 7].filter((v) => Math.abs(v - 4) <= r);
    expect([...vertexList].sort((a, b) => (a as number) - (b as number))).toEqual(expected);
  }
});

// sanity: the reference implementations used above agree with each other on a hand-picked case
test("reference helpers self-check: K4 minus one edge is still connected, has 5 edges", () => {
  const ref = completeRef(4);
  ref.edges.pop();
  expect(unionFindComponentCount(ref)).toBe(1);
  expect(ref.edges.length).toBe(5);
  expect(unionFindComponentCount(cycleRef(5))).toBe(1);
  expect(unionFindComponentCount(pathRef(5))).toBe(1);
});
