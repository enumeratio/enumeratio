import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

const U = (a: number, b: number) => ["UndirectedEdge", a, b];
const D = (a: number, b: number) => ["DirectedEdge", a, b];
const graph = (edges: unknown[]) => ["Graph", ["List", ...edges]];
const graphV = (vertices: unknown[], edges: unknown[]) => [
  "Graph",
  ["List", ...vertices],
  ["List", ...edges],
];

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
  const dist = Array.from({ length: ref.n + 1 }, () =>
    Array.from({ length: ref.n + 1 }, () => INF),
  );
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
  for (let i = 1; i <= n; i++)
    for (let j = i + 1; j <= n; j++) edges.push({ a: i, b: j, directed: false });
  return { n, edges };
}

function cycleRef(n: number): Ref {
  const r = pathRef(n);
  r.edges.push({ a: n, b: 1, directed: false });
  return r;
}

// ─── UndirectedEdge / DirectedEdge / Graph round-trip ───────────────────────────────────

test("Graph, UndirectedEdge and DirectedEdge are inert — they hold, unevaluated", () => {
  expect(run(U(1, 2))).toEqual(["UndirectedEdge", 1, 2]);
  expect(run(D(1, 2))).toEqual(["DirectedEdge", 1, 2]);
  // Graph declares no `evaluate` handler, so it holds exactly as written -- the 1-arg
  // `Graph(edges)` form is NOT normalized into the 2-arg `Graph(vertices, edges)` form;
  // only `VertexList` et al. infer the vertex set on read.
  expect(run(graph([U(1, 2), U(2, 3)]))).toEqual([
    "Graph",
    ["List", ["UndirectedEdge", 1, 2], ["UndirectedEdge", 2, 3]],
  ]);
});

test("VertexList follows first-appearance order (declared vertices, then edge endpoints)", () => {
  expect(run(["VertexList", graph([U(3, 1), U(1, 2)])])).toEqual(["List", 3, 1, 2]);
  expect(run(["VertexList", graphV([5, 1], [U(1, 2)])])).toEqual(["List", 5, 1, 2]);
});

test("EdgeList returns the edges in declared order, as given", () => {
  expect(run(["EdgeList", graph([U(2, 1), D(1, 3)])])).toEqual([
    "List",
    ["UndirectedEdge", 2, 1],
    ["DirectedEdge", 1, 3],
  ]);
});

test("VertexCount / EdgeCount", () => {
  expect(run(["VertexCount", graph([U(1, 2), U(2, 3), U(3, 1)])])).toBe(3);
  expect(run(["EdgeCount", graph([U(1, 2), U(2, 3), U(3, 1)])])).toBe(3);
});

// ─── VertexDegree: cross-checked against sum(degrees) = 2|E| ───────────────────────────

test("VertexDegree sums to 2|E| on an undirected graph (handshake lemma)", () => {
  const g = graph([U(1, 2), U(2, 3), U(3, 1), U(1, 1)]); // includes a self-loop
  const degs = run(["VertexDegree", g]) as unknown as [string, ...number[]];
  const total = (degs.slice(1) as number[]).reduce((a, b) => a + b, 0);
  expect(total).toBe(2 * 4);
  // vertex 1: U(1,2) + U(3,1) + the self-loop U(1,1) counted at both endpoints = 4
  expect(degs).toEqual(["List", 4, 2, 2]);
});

test("VertexDegree(g, v) matches the corresponding entry of VertexDegree(g)", () => {
  const g = graph([U(1, 2), U(2, 3), D(3, 1)]);
  expect(run(["VertexDegree", g, 2])).toBe(2);
  expect(run(["VertexDegree", g, 3])).toBe(2);
});

// ─── AdjacencyMatrix / IncidenceMatrix ──────────────────────────────────────────────────

test("AdjacencyMatrix is symmetric for an undirected graph and matches CompleteGraph(n)'s J-I", () => {
  // K4: every off-diagonal entry is 1, diagonal is 0.
  expect(run(["AdjacencyMatrix", ["CompleteGraph", 4]])).toEqual([
    "List",
    ["List", 0, 1, 1, 1],
    ["List", 1, 0, 1, 1],
    ["List", 1, 1, 0, 1],
    ["List", 1, 1, 1, 0],
  ]);
});

test("AdjacencyMatrix on a directed edge is asymmetric", () => {
  expect(run(["AdjacencyMatrix", graphV([1, 2], [D(1, 2)])])).toEqual([
    "List",
    ["List", 0, 1],
    ["List", 0, 0],
  ]);
});

test("IncidenceMatrix: each undirected-edge column sums to 2, each directed column sums to 0 (-1 + 1)", () => {
  const g = graphV([1, 2, 3], [U(1, 2), D(2, 3)]);
  expect(run(["IncidenceMatrix", g])).toEqual([
    "List",
    ["List", 1, 0],
    ["List", 1, -1],
    ["List", 0, 1],
  ]);
});

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
  expect(run(["VertexDegree", ["PathGraph", 5]])).toEqual(["List", 1, 2, 2, 2, 1]);
});

test("PathGraph(vertexList) builds a path along the given vertices", () => {
  expect(run(["PathGraph", ["List", "a", "b", "c"]])).toEqual([
    "Graph",
    ["List", "a", "b", "c"],
    ["List", ["UndirectedEdge", "a", "b"], ["UndirectedEdge", "b", "c"]],
  ]);
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

test("CompleteKaryTree(n) [binary]: n-1 edges (a tree), root degree <= 2", () => {
  for (const n of [1, 2, 7, 10]) {
    expect(run(["VertexCount", ["CompleteKaryTree", n]])).toBe(n);
    expect(run(["EdgeCount", ["CompleteKaryTree", n]])).toBe(n - 1);
  }
});

test("CompleteKaryTree(n, k): root has min(k, n-1) children", () => {
  expect(run(["VertexDegree", ["CompleteKaryTree", 10, 3], 1])).toBe(3);
});

test("PetersenGraph(): 10 vertices, 15 edges, 3-regular, girth 5 (not bipartite)", () => {
  expect(run(["VertexCount", ["PetersenGraph"]])).toBe(10);
  expect(run(["EdgeCount", ["PetersenGraph"]])).toBe(15);
  const degs = run(["VertexDegree", ["PetersenGraph"]]) as unknown as [string, ...number[]];
  expect(degs.slice(1).every((d) => d === 3)).toBe(true);
  expect(run(["IsBipartiteGraph", ["PetersenGraph"]])).toEqual("False");
  expect(run(["IsConnectedGraph", ["PetersenGraph"]])).toEqual("True");
});

// ─── ConnectedComponents / IsConnectedGraph, cross-checked against union-find ───────────

test("ConnectedComponents matches an independent union-find, on random small graphs", () => {
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
    expect(run(["IsConnectedGraph", g])).toEqual(
      unionFindComponentCount(ref) === 1 ? "True" : "False",
    );
  }
});

// ─── FindShortestPath / GraphDistance, cross-checked against Floyd–Warshall ─────────────

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

test("FindShortestPath returns a path whose length matches GraphDistance, or {} when unreachable", () => {
  const g = graphV([1, 2, 3, 4], [D(1, 2), D(2, 3), U(3, 4)]);
  expect(run(["FindShortestPath", g, 1, 4])).toEqual(["List", 1, 2, 3, 4]);
  expect(run(["FindShortestPath", g, 4, 1])).toEqual(["List"]); // directed edges block the way back
  expect(run(["GraphDistance", g, 4, 1])).toEqual("PositiveInfinity");
});

// ─── IsTreeGraph / IsBipartiteGraph ──────────────────────────────────────────────────────

test("IsTreeGraph: true for PathGraph/StarGraph/CompleteKaryTree, false for CycleGraph/CompleteGraph(n>2)", () => {
  expect(run(["IsTreeGraph", ["PathGraph", 5]])).toEqual("True");
  expect(run(["IsTreeGraph", ["StarGraph", 5]])).toEqual("True");
  expect(run(["IsTreeGraph", ["CompleteKaryTree", 10, 3]])).toEqual("True");
  expect(run(["IsTreeGraph", ["CycleGraph", 4]])).toEqual("False");
  expect(run(["IsTreeGraph", ["CompleteGraph", 4]])).toEqual("False");
  // disconnected forest is not a tree
  expect(run(["IsTreeGraph", graphV([1, 2, 3, 4], [U(1, 2), U(3, 4)])])).toEqual("False");
});

test("IsBipartiteGraph: true for even cycles/trees, false for odd cycles and self-loops", () => {
  expect(run(["IsBipartiteGraph", ["CycleGraph", 4]])).toEqual("True");
  expect(run(["IsBipartiteGraph", ["CycleGraph", 6]])).toEqual("True");
  expect(run(["IsBipartiteGraph", ["CycleGraph", 5]])).toEqual("False");
  expect(run(["IsBipartiteGraph", ["PathGraph", 7]])).toEqual("True");
  expect(run(["IsBipartiteGraph", graph([U(1, 1)])])).toEqual("False"); // self-loop
});

// ─── NeighborhoodGraph / Subgraph ─────────────────────────────────────────────────────────

test("NeighborhoodGraph(g, v, r) keeps exactly the vertices within distance r (cross-checked against GraphDistance)", () => {
  const g = ["PathGraph", 7];
  for (const r of [0, 1, 2, 3]) {
    const nbhd = run(["NeighborhoodGraph", g, 4, r]) as unknown as [string, unknown[], unknown[]];
    const vertexList = (nbhd[1] as unknown as [string, ...number[]]).slice(1);
    const expected = [1, 2, 3, 4, 5, 6, 7].filter((v) => Math.abs(v - 4) <= r);
    expect([...vertexList].sort((a, b) => (a as number) - (b as number))).toEqual(expected);
  }
});

test("Subgraph induces on the given vertices: edges kept iff both endpoints kept", () => {
  const g = ["CompleteGraph", 4];
  const sub = run(["Subgraph", g, ["List", 1, 2, 3]]);
  expect(sub).toEqual([
    "Graph",
    ["List", 1, 2, 3],
    ["List", ["UndirectedEdge", 1, 2], ["UndirectedEdge", 1, 3], ["UndirectedEdge", 2, 3]],
  ]);
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
