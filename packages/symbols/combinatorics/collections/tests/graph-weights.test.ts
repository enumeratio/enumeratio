import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

const U = (a: number, b: number) => ["UndirectedEdge", a, b];
const D = (a: number, b: number) => ["DirectedEdge", a, b];
const weightedGraph = (vertices: number[], edges: unknown[], weights: number[]) => [
  "Graph",
  ["List", ...vertices],
  ["List", ...edges],
  ["KeyValuePair", "EdgeWeight", ["List", ...weights]],
];

// ─── independent brute-force reference (Floyd-Warshall with weights) ───────────────────
//
// Written from scratch against a plain edge list -- never by calling the heads under
// test -- so a shared bug in graph-weights.ts can't hide from its own tests. Same shape
// as graphs.test.ts's own floydWarshallDistances, plus a `weight` per edge.

interface WeightedRef {
  n: number;
  edges: { a: number; b: number; directed: boolean; weight: number }[];
}

function floydWarshallWeighted(ref: WeightedRef): number[][] {
  const INF = Infinity;
  const dist = Array.from({ length: ref.n + 1 }, () => Array.from({ length: ref.n + 1 }, () => INF));
  for (let i = 1; i <= ref.n; i++) dist[i]![i] = 0;
  for (const e of ref.edges) {
    dist[e.a]![e.b] = Math.min(dist[e.a]![e.b]!, e.weight);
    if (!e.directed) dist[e.b]![e.a] = Math.min(dist[e.b]![e.a]!, e.weight);
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

test("GraphDistance/GraphDistanceMatrix (weighted) match an independent weighted Floyd-Warshall, on random small directed graphs", () => {
  let seed = 24601;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let trial = 0; trial < 30; trial++) {
    const n = 2 + Math.floor(rand() * 5);
    const edges: { a: number; b: number; directed: boolean; weight: number }[] = [];
    const edgeExprs: unknown[] = [];
    const weights: number[] = [];
    for (let a = 1; a <= n; a++) {
      for (let b = 1; b <= n; b++) {
        if (a !== b && rand() < 0.3) {
          const weight = 1 + Math.floor(rand() * 9); // 1..9, always positive
          edges.push({ a, b, directed: true, weight });
          edgeExprs.push(D(a, b));
          weights.push(weight);
        }
      }
    }
    const ref: WeightedRef = { n, edges };
    const dist = floydWarshallWeighted(ref);
    const g = weightedGraph(
      Array.from({ length: n }, (_, i) => i + 1),
      edgeExprs,
      weights,
    );
    const matrix = run(["GraphDistanceMatrix", g]) as unknown as [string, ...[string, ...(number | string)[]][]];
    for (let a = 1; a <= n; a++) {
      for (let b = 1; b <= n; b++) {
        const expected = dist[a]![b]!;
        const got = run(["GraphDistance", g, a, b]);
        const gotFromMatrix = matrix[a]![b]!;
        if (expected === Infinity) {
          expect(got).toEqual("PositiveInfinity");
          expect(gotFromMatrix).toEqual("PositiveInfinity");
        } else {
          expect(got).toBe(expected);
          expect(gotFromMatrix).toBe(expected);
        }
      }
    }
  }
});

test("FindShortestPath (weighted) returns a path whose summed weight matches GraphDistance", () => {
  let seed = 13579;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let trial = 0; trial < 20; trial++) {
    const n = 3 + Math.floor(rand() * 4);
    const edges: unknown[] = [];
    const weightOf = new Map<string, number>();
    const weights: number[] = [];
    for (let a = 1; a <= n; a++) {
      for (let b = a + 1; b <= n; b++) {
        if (rand() < 0.4) {
          const weight = 1 + Math.floor(rand() * 9);
          edges.push(U(a, b));
          weights.push(weight);
          weightOf.set(`${a},${b}`, weight);
          weightOf.set(`${b},${a}`, weight);
        }
      }
    }
    const g = weightedGraph(
      Array.from({ length: n }, (_, i) => i + 1),
      edges,
      weights,
    );
    for (let target = 2; target <= n; target++) {
      const dist = run(["GraphDistance", g, 1, target]);
      const path = run(["FindShortestPath", g, 1, target]) as unknown as [string, ...number[]];
      if (dist === "PositiveInfinity") {
        expect(path.slice(1)).toEqual([]);
        continue;
      }
      const vertices = path.slice(1);
      expect(vertices[0]).toBe(1);
      expect(vertices[vertices.length - 1]).toBe(target);
      let summed = 0;
      for (let i = 0; i + 1 < vertices.length; i++) summed += weightOf.get(`${vertices[i]},${vertices[i + 1]}`)!;
      expect(summed).toBe(dist);
    }
  }
});

// ─── WeightedAdjacencyMatrix ─────────────────────────────────────────────────────────────

test("WeightedAdjacencyMatrix: weight where an edge exists, 0 elsewhere, symmetric for an undirected edge", () => {
  const g = weightedGraph([1, 2, 3], [U(1, 2), D(2, 3)], [5, 7]);
  expect(run(["WeightedAdjacencyMatrix", g])).toEqual([
    "List",
    ["List", 0, 5, 0],
    ["List", 5, 0, 7],
    ["List", 0, 0, 0],
  ]);
});

test("WeightedAdjacencyMatrix falls back to AdjacencyMatrix's own 0/1 entries when the graph carries no EdgeWeight", () => {
  const g = ["Graph", ["List", 1, 2, 3], ["List", U(1, 2), D(2, 3)]];
  expect(run(["WeightedAdjacencyMatrix", g])).toEqual(run(["AdjacencyMatrix", g]));
});

// ─── negative weights: Dijkstra-based heads decline; WeightedAdjacencyMatrix does not ────

test("a negative edge weight makes GraphDistance/FindShortestPath/GraphDistanceMatrix stay unevaluated, but not WeightedAdjacencyMatrix", () => {
  const g = weightedGraph([1, 2, 3], [U(1, 2), U(2, 3)], [-5, 7]);
  const canonicalG = ce.box(g as never).json; // KeyValuePair canonicalizes to Tuple on boxing
  expect(run(["GraphDistance", g, 1, 3])).toEqual(["GraphDistance", canonicalG, 1, 3]);
  expect(run(["FindShortestPath", g, 1, 3])).toEqual(["FindShortestPath", canonicalG, 1, 3]);
  expect(run(["GraphDistanceMatrix", g])).toEqual(["GraphDistanceMatrix", canonicalG]);
  expect(run(["WeightedAdjacencyMatrix", g])).toEqual([
    "List",
    ["List", 0, -5, 0],
    ["List", -5, 0, 7],
    ["List", 0, 7, 0],
  ]);
});

// ─── a mismatched EdgeWeight count, or an unweighted query, are unaffected ───────────────

test("EdgeWeight must cover every edge -- a mismatched count leaves Graph (and every query on it) unevaluated", () => {
  const g = ["Graph", ["List", U(1, 2), U(2, 3)], ["KeyValuePair", "EdgeWeight", ["List", 5]]];
  const canonicalG = ce.box(g as never).json;
  expect(run(["VertexList", g])).toEqual(["VertexList", canonicalG]);
});

test("Subgraph/NeighborhoodGraph carry each surviving edge's own weight into the induced subgraph", () => {
  const g = weightedGraph([1, 2, 3, 4], [U(1, 2), U(2, 3), U(3, 4)], [5, 7, 9]);
  const sub = run(["Subgraph", g, ["List", 1, 2, 3]]);
  expect(run(["WeightedAdjacencyMatrix", sub])).toEqual([
    "List",
    ["List", 0, 5, 0],
    ["List", 5, 0, 7],
    ["List", 0, 7, 0],
  ]);
});

// ─── weights are invisible to structural queries (IsIsomorphicGraph, etc.) -- Wolfram's own default ───

test("IsIsomorphicGraph, ConnectedComponents and VertexDegree ignore edge weight entirely", () => {
  const heavy = weightedGraph([1, 2, 3], [U(1, 2), U(2, 3)], [1000, 1]);
  const light = weightedGraph([1, 2, 3], [U(1, 2), U(2, 3)], [1, 1000]);
  expect(run(["IsIsomorphicGraph", heavy, light])).toBe("True");
  expect(run(["VertexDegree", heavy])).toEqual(run(["VertexDegree", light]));
  expect(run(["ConnectedComponents", heavy])).toEqual(run(["ConnectedComponents", light]));
});
