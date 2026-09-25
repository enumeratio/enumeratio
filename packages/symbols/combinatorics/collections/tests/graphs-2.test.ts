import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

const U = (a: number, b: number) => ["UndirectedEdge", a, b];
const D = (a: number, b: number) => ["DirectedEdge", a, b];
const graph = (edges: unknown[]) => ["Graph", ["List", ...edges]];
const graphV = (vertices: unknown[], edges: unknown[]) => ["Graph", ["List", ...vertices], ["List", ...edges]];

// ─── independent reference implementations (never call the heads under test) ──────────────

interface Ref {
  n: number;
  edges: { a: number; b: number; directed: boolean }[];
}

function floydWarshall(ref: Ref): number[][] {
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

const inf = (x: number): unknown => (x === Infinity ? "PositiveInfinity" : x);

// ─── GraphDistanceMatrix vs. Floyd–Warshall ────────────────────────────────────────────

test("GraphDistanceMatrix matches an independent Floyd–Warshall on a mixed graph", () => {
  const ref: Ref = {
    n: 4,
    edges: [
      { a: 1, b: 2, directed: false },
      { a: 2, b: 3, directed: false },
      { a: 3, b: 4, directed: true },
    ],
  };
  const g = graph([U(1, 2), U(2, 3), D(3, 4)]);
  const expected = [
    "List",
    ...[1, 2, 3, 4].map((i) => ["List", ...[1, 2, 3, 4].map((j) => inf(floydWarshall(ref)[i]![j]!))]),
  ];
  expect(run(["GraphDistanceMatrix", g])).toEqual(expected);
});

test("GraphDistanceMatrix reads PositiveInfinity for an unreachable pair", () => {
  const g = graph([U(1, 2), U(3, 4)]);
  const m = run(["GraphDistanceMatrix", g]) as unknown as unknown[][];
  expect(m[1]![3]).toEqual("PositiveInfinity");
});

// ─── Eccentricity / Radius / Diameter / Center / Periphery: consistent with each other ────

test("radius <= diameter <= 2*radius on a connected graph (standard graph-theory bound)", () => {
  const g = graph([U(1, 2), U(2, 3), U(3, 4), U(4, 5), U(5, 1), U(1, 3)]);
  const radius = run(["GraphRadius", g]) as number;
  const diameter = run(["GraphDiameter", g]) as number;
  expect(radius).toBeLessThanOrEqual(diameter);
  expect(diameter).toBeLessThanOrEqual(2 * radius);
});

test("VertexEccentricity, GraphRadius and GraphDiameter agree with an independent BFS", () => {
  const g = graph([U(1, 2), U(2, 3), U(3, 1), U(3, 4)]);
  const ref: Ref = {
    n: 4,
    edges: [
      { a: 1, b: 2, directed: false },
      { a: 2, b: 3, directed: false },
      { a: 3, b: 1, directed: false },
      { a: 3, b: 4, directed: false },
    ],
  };
  const dist = floydWarshall(ref);
  const ecc = [1, 2, 3, 4].map((v) => Math.max(...[1, 2, 3, 4].filter((u) => u !== v).map((u) => dist[v]![u]!)));
  expect(run(["VertexEccentricity", g])).toEqual(["List", ...ecc]);
  expect(run(["GraphRadius", g])).toBe(Math.min(...ecc));
  expect(run(["GraphDiameter", g])).toBe(Math.max(...ecc));
});

test("GraphCenter and GraphPeriphery pick out the min/max-eccentricity vertices of a path", () => {
  // PathGraph(5): 1-2-3-4-5, eccentricities 4,3,2,3,4 -- center is {3}, periphery {1,5}.
  const g = graph([U(1, 2), U(2, 3), U(3, 4), U(4, 5)]);
  expect(run(["GraphCenter", g])).toEqual(["List", 3]);
  expect(run(["GraphPeriphery", g])).toEqual(["List", 1, 5]);
});

test("disconnected graph: eccentricity, radius, diameter are all PositiveInfinity", () => {
  const g = graph([U(1, 2), U(3, 4)]);
  expect(run(["VertexEccentricity", g, 1])).toEqual("PositiveInfinity");
  expect(run(["GraphRadius", g])).toEqual("PositiveInfinity");
  expect(run(["GraphDiameter", g])).toEqual("PositiveInfinity");
});

// ─── VertexIndex / VertexInDegree / VertexOutDegree ────────────────────────────────────

test("VertexIndex matches VertexList's own position", () => {
  const g = graphV([5, 1, 2], [U(1, 2)]);
  expect(run(["VertexIndex", g, 1])).toBe(2);
  expect(run(["VertexIndex", g, 5])).toBe(1);
});

test("VertexInDegree / VertexOutDegree on a MIXED graph ignore undirected edges entirely (kernel-verified)", () => {
  // Graph({1->2, 2<->3, 3->1}): Wolfram 15 gives in-degree {1,1,0}, out-degree {1,0,1} --
  // the undirected 2<->3 edge contributes to NEITHER measure once a directed edge is present.
  const g = graph([D(1, 2), U(2, 3), D(3, 1)]);
  expect(run(["VertexInDegree", g])).toEqual(["List", 1, 1, 0]);
  expect(run(["VertexOutDegree", g])).toEqual(["List", 1, 0, 1]);
});

test("VertexInDegree / VertexOutDegree fall back to VertexDegree on a purely undirected graph", () => {
  const g = graph([U(1, 2), U(2, 3), U(3, 1)]);
  const deg = run(["VertexDegree", g]);
  expect(run(["VertexInDegree", g])).toEqual(deg);
  expect(run(["VertexOutDegree", g])).toEqual(deg);
});

// ─── ClosenessCentrality / EigenvectorCentrality ───────────────────────────────────────

test("ClosenessCentrality of a star's hub is 1 (distance 1 to every leaf)", () => {
  const g = ["StarGraph", 5];
  expect(run(["ClosenessCentrality", g, 1])).toBe(1);
});

test("ClosenessCentrality is 0 for an isolated vertex", () => {
  const g = graphV([1, 2], []); // vertex 1, 2 with no edges at all
  expect(run(["ClosenessCentrality", g, 1])).toBe(0);
});

test("EigenvectorCentrality sums to 1 and matches Wolfram 15 on PathGraph({1,2,3,4})", () => {
  const g = graph([U(1, 2), U(2, 3), U(3, 4)]);
  const c = run(["EigenvectorCentrality", g]) as unknown as [string, ...number[]];
  const values = c.slice(1) as number[];
  expect(values.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  const expected = [0.190983005625053, 0.309016994374947, 0.309016994374947, 0.190983005625053];
  values.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 9));
});

test("EigenvectorCentrality matches Wolfram 15 on StarGraph(4)", () => {
  const g = ["StarGraph", 4];
  const c = run(["EigenvectorCentrality", g]) as unknown as [string, ...number[]];
  const values = c.slice(1) as number[];
  const expected = [0.366025403784439, 0.211324865405187, 0.211324865405187, 0.211324865405187];
  values.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 9));
});

// ─── predicates ─────────────────────────────────────────────────────────────────────────

test("IsPathGraph: true for an actual path, false for a cycle or a star", () => {
  expect(run(["IsPathGraph", graph([U(1, 2), U(2, 3), U(3, 4)])])).toEqual("True");
  expect(run(["IsPathGraph", ["CycleGraph", 4]])).toEqual("False");
  expect(run(["IsPathGraph", ["StarGraph", 4]])).toEqual("False");
});

test("IsAcyclicGraph: true for a tree, false for a cycle; an undirected tree isn't flagged by its own back-edges", () => {
  expect(run(["IsAcyclicGraph", graph([U(1, 2), U(2, 3), U(3, 4)])])).toEqual("True");
  expect(run(["IsAcyclicGraph", ["CycleGraph", 4]])).toEqual("False");
  expect(run(["IsAcyclicGraph", ["CompleteGraph", 4]])).toEqual("False");
});

test("IsAcyclicGraph: a directed 2-cycle (a->b, b->a) IS a cycle", () => {
  expect(run(["IsAcyclicGraph", graphV([1, 2], [D(1, 2), D(2, 1)])])).toEqual("False");
});

test("IsAcyclicGraph: a self-loop is a cycle", () => {
  expect(run(["IsAcyclicGraph", graph([U(1, 1)])])).toEqual("False");
});

test("IsCompleteGraph: true for CompleteGraph(n), false once an edge is missing", () => {
  expect(run(["IsCompleteGraph", ["CompleteGraph", 5]])).toEqual("True");
  expect(run(["IsCompleteGraph", graph([U(1, 2), U(2, 3), U(3, 1)])])).toEqual("True"); // K3 by hand
  expect(run(["IsCompleteGraph", graph([U(1, 2), U(2, 3)])])).toEqual("False"); // path, not K3
});

test("IsCompleteGraph: a directed graph counts too, when every ORDERED pair is joined (kernel-verified)", () => {
  // CompleteGraphQ[Graph[{1->2, 2->1}]] = True in Wolfram 15.
  expect(run(["IsCompleteGraph", graphV([1, 2], [D(1, 2), D(2, 1)])])).toEqual("True");
  // A single one-way edge leaves the (2,1) pair uncovered.
  expect(run(["IsCompleteGraph", graphV([1, 2], [D(1, 2)])])).toEqual("False");
  // The directed analogue of CompleteGraph(3): every ordered pair among 3 vertices, 6 edges.
  const directedK3 = graphV([1, 2, 3], [D(1, 2), D(2, 1), D(1, 3), D(3, 1), D(2, 3), D(3, 2)]);
  expect(run(["IsCompleteGraph", directedK3])).toEqual("True");
});

test("IsLoopFreeGraph / IsSimpleGraph distinguish a self-loop from a parallel edge", () => {
  expect(run(["IsLoopFreeGraph", graph([U(1, 2)])])).toEqual("True");
  expect(run(["IsLoopFreeGraph", graph([U(1, 1)])])).toEqual("False");
  expect(run(["IsSimpleGraph", graph([U(1, 2)])])).toEqual("True");
  expect(run(["IsSimpleGraph", graph([U(1, 2), U(2, 1)])])).toEqual("False"); // same undirected edge twice
  expect(run(["IsSimpleGraph", graph([U(1, 1)])])).toEqual("False");
});

test("IsIsomorphicGraph: true under a random relabelling, false against a different graph", () => {
  // CycleGraph(6) relabelled by a fixed permutation is still isomorphic to it.
  const relabelled = graphV([3, 6, 1, 4, 2, 5], [U(3, 6), U(6, 1), U(1, 4), U(4, 2), U(2, 5), U(5, 3)]);
  expect(run(["IsIsomorphicGraph", ["CycleGraph", 6], relabelled])).toEqual("True");
  expect(run(["IsIsomorphicGraph", ["CycleGraph", 6], ["StarGraph", 6]])).toEqual("False"); // same n, different structure
  expect(run(["IsIsomorphicGraph", ["CompleteGraph", 4], ["CycleGraph", 4]])).toEqual("False"); // same n, different edge count already
});

// ─── constructors ───────────────────────────────────────────────────────────────────────

test("WheelGraph(n) has n vertices and 2(n-1) edges (n-1 spokes + an (n-1)-cycle rim)", () => {
  expect(run(["VertexCount", ["WheelGraph", 6]])).toBe(6);
  expect(run(["EdgeCount", ["WheelGraph", 6]])).toBe(2 * 5);
});

test("CirculantGraph(n, k) is k-regular (every vertex has degree 2k, mirrored offset dedup aside)", () => {
  const g = ["CirculantGraph", 8, 2];
  const degs = run(["VertexDegree", g]) as unknown as [string, ...number[]];
  expect((degs.slice(1) as number[]).every((d) => d === 2)).toBe(true);
});

test("CirculantGraph(n, {k1, k2}) unions the two offset sets", () => {
  const g = ["CirculantGraph", 10, ["List", 1, 3]];
  const degs = run(["VertexDegree", g]) as unknown as [string, ...number[]];
  expect((degs.slice(1) as number[]).every((d) => d === 4)).toBe(true);
});

test("TuranGraph edge count matches the closed form for equal-size parts", () => {
  // TuranGraph(6, 3): three parts of size 2 -- complete 3-partite K(2,2,2), 3*C(2,2)... edges
  // = C(6,2) - 3*C(2,2) = 15 - 3 = 12.
  expect(run(["EdgeCount", ["TuranGraph", 6, 3]])).toBe(12);
  expect(run(["VertexCount", ["TuranGraph", 6, 3]])).toBe(6);
  // r = n: TuranGraph(n, n) is the complete graph.
  expect(run(["EdgeCount", ["TuranGraph", 5, 5]])).toBe(10);
});

test("HararyGraph(k, n): n vertices, ceil(k*n/2) edges, minimum degree >= k", () => {
  for (const [k, n] of [
    [4, 7],
    [3, 6],
    [3, 7],
    [5, 9],
  ]) {
    const g = ["HararyGraph", k, n];
    expect(run(["VertexCount", g])).toBe(n);
    expect(run(["EdgeCount", g])).toBe(Math.ceil((k * n) / 2));
    const degs = run(["VertexDegree", g]) as unknown as [string, ...number[]];
    expect(Math.min(...(degs.slice(1) as number[]))).toBeGreaterThanOrEqual(k);
  }
});

test("HararyGraph(3, 7) matches Wolfram 15's exact edge set (odd k, odd n)", () => {
  // The 7-cycle plus {1-4, 1-5, 2-6, 3-7} -- kernel-verified.
  const g = ["HararyGraph", 3, 7];
  const edges = run(["EdgeList", g]) as unknown as unknown[];
  const pairs = new Set(
    (edges.slice(1) as unknown[]).map((e) => {
      const [, a, b] = e as [string, number, number];
      return a < b ? `${a}-${b}` : `${b}-${a}`;
    }),
  );
  const expected = ["1-2", "2-3", "3-4", "4-5", "5-6", "6-7", "1-7", "1-4", "1-5", "2-6", "3-7"];
  expect(pairs.size).toBe(expected.length);
  for (const pair of expected) expect(pairs.has(pair)).toBe(true);
});

test("LineGraph edge count matches sum(C(deg,2)) over the original graph", () => {
  const g = graph([U(1, 2), U(2, 3), U(3, 1), U(3, 4)]);
  const degs = run(["VertexDegree", g]) as unknown as [string, ...number[]];
  const expected = (degs.slice(1) as number[]).reduce((acc, d) => acc + (d * (d - 1)) / 2, 0);
  expect(run(["VertexCount", ["LineGraph", g]])).toBe(4); // one per original edge
  expect(run(["EdgeCount", ["LineGraph", g]])).toBe(expected);
});

test("AdjacencyGraph builds an undirected graph from a symmetric matrix, directed from an asymmetric one", () => {
  const sym = ["List", ["List", 0, 1, 1], ["List", 1, 0, 0], ["List", 1, 0, 0]];
  expect(run(["EdgeList", ["AdjacencyGraph", sym]])).toEqual([
    "List",
    ["UndirectedEdge", 1, 2],
    ["UndirectedEdge", 1, 3],
  ]);
  const asym = ["List", ["List", 0, 1, 0], ["List", 0, 0, 0], ["List", 0, 0, 0]];
  expect(run(["EdgeList", ["AdjacencyGraph", asym]])).toEqual(["List", ["DirectedEdge", 1, 2]]);
});

test("RandomGraph({n, m}) is deterministic under SeedRandom and has exactly n vertices, m edges, no repeats", () => {
  run(["SeedRandom", 7]);
  const g1 = run(["RandomGraph", ["List", 6, 8]]);
  run(["SeedRandom", 7]);
  const g2 = run(["RandomGraph", ["List", 6, 8]]);
  expect(g1).toEqual(g2); // same seed -> same graph
  expect(run(["VertexCount", g1])).toBe(6);
  expect(run(["EdgeCount", g1])).toBe(8);
  expect(run(["IsSimpleGraph", g1])).toEqual("True");
});

test("RandomGraph rejects more edges than C(n,2) allows", () => {
  expect(run(["RandomGraph", ["List", 3, 10]])).toEqual(["RandomGraph", ["List", 3, 10]]);
});
