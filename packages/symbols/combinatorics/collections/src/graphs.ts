import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf } from "@enumeratio/boxed";

// Graphs (Wolfram frontier: UndirectedEdge/DirectedEdge top the gap list at 756/69 doc
// uses, with Graph and its query/family heads clustered right behind them).
//
// Representation: `Graph(edges)` or `Graph(vertices, edges)` is an INERT data head — it
// never evaluates to anything else, same as `PermutationGroup` (groupalgebra) or `List`
// itself. `UndirectedEdge(u, v)` / `DirectedEdge(u, v)` are inert edge heads. Everything
// else here is a pure query over that data: VertexList/EdgeList/VertexCount/EdgeCount/
// VertexDegree/AdjacencyMatrix/IncidenceMatrix read it; ConnectedComponents/
// IsConnectedGraph/FindShortestPath/GraphDistance/IsTreeGraph/IsBipartiteGraph/
// NeighborhoodGraph/Subgraph compute over it. The named families (CompleteGraph,
// PathGraph, CycleGraph, StarGraph, GridGraph, HypercubeGraph, CompleteKaryTree,
// PetersenGraph) just build the data head from a size parameter.
//
// Every query is exact and deterministic: no drawing, no layout, no randomised
// algorithms. Vertex order follows Wolfram's convention — first appearance, reading the
// declared vertex list (if given) then the edges in order, each edge's endpoints in
// (a, b) order.
//
// No rendering: a `<notatio-graph>` element (vertex/edge positions, an actual drawing) is
// out of scope here — see the module-level TODO at the bottom of this file for what it
// would need.

// ─── the model: vertices/edges over canonical string keys ─────────────────────────────────

interface Edge {
  readonly directed: boolean;
  readonly a: string; // canonical key
  readonly b: string;
  readonly expr: BoxedExpression; // original UndirectedEdge/DirectedEdge expression
}

interface GraphModel {
  readonly order: readonly string[]; // vertex keys, first-appearance order
  readonly label: ReadonlyMap<string, BoxedExpression>; // key -> original vertex expression
  readonly edges: readonly Edge[];
}

/** A stable key for a vertex expression — canonical MathJSON, so `1` and `2` never
 *  collide and a repeated vertex (same key) is recognised as the same vertex regardless
 *  of which occurrence built the label. */
const vertexKey = (expr: BoxedExpression): string => JSON.stringify(expr.json);

/** Read one `UndirectedEdge(u, v)` / `DirectedEdge(u, v)` expression, or `undefined` if
 *  `expr` is neither. */
function edgeOf(
  expr: BoxedExpression,
): { directed: boolean; a: BoxedExpression; b: BoxedExpression } | undefined {
  if (expr.operator !== "UndirectedEdge" && expr.operator !== "DirectedEdge") return undefined;
  const ops = operandsOf(expr);
  if (ops.length !== 2) return undefined;
  return { directed: expr.operator === "DirectedEdge", a: ops[0]!, b: ops[1]! };
}

/** Build a `GraphModel` from `Graph(edges)` or `Graph(vertices, edges)`. Vertices not
 *  named in an explicit vertex list but seen as an edge endpoint are appended, in
 *  first-appearance order — Wolfram accepts edges that mention a vertex the list omits. */
function graphOf(expr: BoxedExpression): GraphModel | undefined {
  if (expr.operator !== "Graph") return undefined;
  const ops = operandsOf(expr);
  if (ops.length !== 1 && ops.length !== 2) return undefined;
  const explicitVertices = ops.length === 2 ? ops[0] : undefined;
  const edgeList = ops.length === 2 ? ops[1] : ops[0];
  if (edgeList === undefined || edgeList.operator !== "List") return undefined;
  const rawEdges = operandsOf(edgeList).map(edgeOf);
  if (rawEdges.some((e) => e === undefined)) return undefined;

  const order: string[] = [];
  const label = new Map<string, BoxedExpression>();
  const see = (v: BoxedExpression): void => {
    const key = vertexKey(v);
    if (!label.has(key)) {
      label.set(key, v);
      order.push(key);
    }
  };
  if (explicitVertices !== undefined) {
    if (explicitVertices.operator !== "List") return undefined;
    for (const v of operandsOf(explicitVertices)) see(v);
  }
  const edges: Edge[] = [];
  for (let i = 0; i < rawEdges.length; i++) {
    const raw = rawEdges[i]!;
    see(raw.a);
    see(raw.b);
    edges.push({
      directed: raw.directed,
      a: vertexKey(raw.a),
      b: vertexKey(raw.b),
      expr: operandsOf(edgeList)[i]!,
    });
  }
  return { order, label, edges };
}

// ─── pure algorithms over the model (string keys only — no compute-engine here) ───────────

/** Neighbours reachable respecting edge direction: directed a->b gives b as an out-neighbour
 *  of a only; undirected edges go both ways. Used by FindShortestPath / GraphDistance. */
function directedAdjacency(model: GraphModel): Map<string, string[]> {
  const adj = new Map<string, string[]>(model.order.map((v) => [v, []]));
  for (const e of model.edges) {
    adj.get(e.a)!.push(e.b);
    if (!e.directed) adj.get(e.b)!.push(e.a);
  }
  return adj;
}

/** Neighbours ignoring direction entirely — the "underlying graph" Wolfram's
 *  ConnectedComponents / ConnectedGraphQ / TreeGraphQ / BipartiteGraphQ / NeighborhoodGraph
 *  operate on. */
function underlyingAdjacency(model: GraphModel): Map<string, string[]> {
  const adj = new Map<string, string[]>(model.order.map((v) => [v, []]));
  for (const e of model.edges) {
    adj.get(e.a)!.push(e.b);
    adj.get(e.b)!.push(e.a);
  }
  return adj;
}

/** Total degree of each vertex: every edge incident to it counts once per endpoint
 *  (a self-loop counts twice), regardless of direction — Wolfram's `VertexDegree`. */
function degrees(model: GraphModel): Map<string, number> {
  const deg = new Map<string, number>(model.order.map((v) => [v, 0]));
  for (const e of model.edges) {
    deg.set(e.a, (deg.get(e.a) ?? 0) + 1);
    deg.set(e.b, (deg.get(e.b) ?? 0) + 1);
  }
  return deg;
}

/** BFS shortest path from `source` to `target` over `adj` (unweighted, respects whatever
 *  adjacency it is given — directed or underlying). Returns the vertex-key path including
 *  both ends, or `[]` if unreachable (matching Wolfram's `FindShortestPath`). */
function bfsPath(
  adj: ReadonlyMap<string, readonly string[]>,
  source: string,
  target: string,
): string[] {
  if (source === target) return [source];
  const prev = new Map<string, string>();
  const seen = new Set<string>([source]);
  const queue: string[] = [source];
  for (let i = 0; i < queue.length; i++) {
    const u = queue[i]!;
    for (const v of adj.get(u) ?? []) {
      if (seen.has(v)) continue;
      seen.add(v);
      prev.set(v, u);
      if (v === target) {
        const path = [target];
        let cur = target;
        while (cur !== source) {
          cur = prev.get(cur)!;
          path.push(cur);
        }
        return path.reverse();
      }
      queue.push(v);
    }
  }
  return [];
}

/** Every vertex's weakly-connected component (underlying graph), grouped by union-find and
 *  returned as arrays of vertex keys — ordered by descending size, ties by the order the
 *  component's first vertex appears in `model.order` (Wolfram groups the largest component
 *  first). */
function connectedComponents(model: GraphModel): string[][] {
  const parent = new Map<string, string>(model.order.map((v) => [v, v]));
  const find = (v: string): string => {
    let root = v;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = v;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const e of model.edges) union(e.a, e.b);

  const groups = new Map<string, string[]>();
  for (const v of model.order) {
    const root = find(v);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(v);
  }
  return [...groups.values()].sort((x, y) => y.length - x.length);
}

/** Two-colouring of the underlying graph via BFS; `undefined` if no valid colouring exists
 *  (an odd cycle, or any self-loop). Disconnected graphs are handled per-component. */
function bipartiteColoring(model: GraphModel): Map<string, 0 | 1> | undefined {
  const adj = underlyingAdjacency(model);
  const color = new Map<string, 0 | 1>();
  for (const start of model.order) {
    if (color.has(start)) continue;
    color.set(start, 0);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const u = queue[i]!;
      const cu = color.get(u)!;
      for (const v of adj.get(u) ?? []) {
        if (v === u) return undefined; // self-loop: never 2-colourable
        if (!color.has(v)) {
          color.set(v, cu === 0 ? 1 : 0);
          queue.push(v);
        } else if (color.get(v) === cu) {
          return undefined;
        }
      }
    }
  }
  return color;
}

// ─── encoders ────────────────────────────────────────────────────────────────────────────

const listOf = (ce: ComputeEngine, items: readonly BoxedExpression[]): BoxedExpression =>
  ce.function("List", items);

const vertexListExpr = (ce: ComputeEngine, model: GraphModel): BoxedExpression =>
  listOf(
    ce,
    model.order.map((k) => model.label.get(k)!),
  );

// ─── named families ─────────────────────────────────────────────────────────────────────

const undirectedEdgeExpr = (ce: ComputeEngine, a: number, b: number): BoxedExpression =>
  ce.function("UndirectedEdge", [ce.number(a), ce.number(b)]);

/** `Graph(vertices 1..n, edges)` built from 1-based integer edges — every named family
 *  shares this shape, so they all decode through the same `graphOf`. */
function integerGraph(
  ce: ComputeEngine,
  n: number,
  edges: readonly (readonly [number, number])[],
): BoxedExpression {
  const vertices = listOf(
    ce,
    Array.from({ length: n }, (_, i) => ce.number(i + 1)),
  );
  const edgeList = listOf(
    ce,
    edges.map(([a, b]) => undirectedEdgeExpr(ce, a, b)),
  );
  return ce.function("Graph", [vertices, edgeList]);
}

function completeGraph(ce: ComputeEngine, n: number): BoxedExpression | undefined {
  if (!Number.isSafeInteger(n) || n < 1) return undefined;
  const edges: [number, number][] = [];
  for (let i = 1; i <= n; i++) for (let j = i + 1; j <= n; j++) edges.push([i, j]);
  return integerGraph(ce, n, edges);
}

/** `PathGraph(n)` (our convenience: the path 1-2-…-n) or `PathGraph(vertexList)` (Wolfram's
 *  actual form: a path along the given vertices, in order). */
function pathGraph(ce: ComputeEngine, spec: BoxedExpression): BoxedExpression | undefined {
  const n = integerAt(spec);
  if (n !== undefined) {
    if (n < 1) return undefined;
    const edges: [number, number][] = [];
    for (let i = 1; i < n; i++) edges.push([i, i + 1]);
    return integerGraph(ce, n, edges);
  }
  if (spec.operator === "List") {
    const vs = operandsOf(spec);
    if (vs.length === 0) return undefined;
    const vertices = listOf(ce, vs);
    const edges = listOf(
      ce,
      vs.slice(0, -1).map((v, i) => ce.function("UndirectedEdge", [v, vs[i + 1]!])),
    );
    return ce.function("Graph", [vertices, edges]);
  }
  return undefined;
}

function cycleGraph(ce: ComputeEngine, n: number): BoxedExpression | undefined {
  if (!Number.isSafeInteger(n) || n < 3) return undefined;
  const edges: [number, number][] = [];
  for (let i = 1; i < n; i++) edges.push([i, i + 1]);
  edges.push([n, 1]);
  return integerGraph(ce, n, edges);
}

/** `StarGraph(n)`: vertex 1 is the centre, joined to every one of the other `n - 1`. */
function starGraph(ce: ComputeEngine, n: number): BoxedExpression | undefined {
  if (!Number.isSafeInteger(n) || n < 1) return undefined;
  const edges: [number, number][] = [];
  for (let i = 2; i <= n; i++) edges.push([1, i]);
  return integerGraph(ce, n, edges);
}

/** `GridGraph({d1, d2, …})`: the Cartesian product of paths of those lengths. Vertices are
 *  numbered in row-major (last index fastest) order, 1-based. */
function gridGraph(ce: ComputeEngine, dims: readonly number[]): BoxedExpression | undefined {
  if (dims.length === 0 || dims.some((d) => !Number.isSafeInteger(d) || d < 1)) return undefined;
  const n = dims.reduce((a, b) => a * b, 1);
  const strides: number[] = [];
  let s = 1;
  for (let i = dims.length - 1; i >= 0; i--) {
    strides[i] = s;
    s *= dims[i]!;
  }
  const indexOf = (coord: readonly number[]): number =>
    1 + coord.reduce((acc, c, i) => acc + c * strides[i]!, 0);
  const edges: [number, number][] = [];
  const coord = Array.from({ length: dims.length }, () => 0);
  const advance = (): boolean => {
    for (let i = dims.length - 1; i >= 0; i--) {
      coord[i]!++;
      if (coord[i]! < dims[i]!) return true;
      coord[i] = 0;
    }
    return false;
  };
  do {
    const from = indexOf(coord);
    for (let axis = 0; axis < dims.length; axis++) {
      if (coord[axis]! + 1 < dims[axis]!) {
        const next = coord.slice();
        next[axis]!++;
        edges.push([from, indexOf(next)]);
      }
    }
  } while (advance());
  return integerGraph(ce, n, edges);
}

/** `HypercubeGraph(n)`: vertices are the 2^n bit-strings 0..2^n-1 (numbered 1-based, vertex
 *  `i` labels bit pattern `i - 1`), edges between patterns differing in exactly one bit. */
function hypercubeGraph(ce: ComputeEngine, n: number): BoxedExpression | undefined {
  if (!Number.isSafeInteger(n) || n < 0 || n > 20) return undefined; // 20 -> ~1e6 vertices, a sane cap
  const count = 2 ** n;
  const edges: [number, number][] = [];
  for (let v = 0; v < count; v++) {
    for (let bit = 0; bit < n; bit++) {
      const w = v ^ (1 << bit);
      if (w > v) edges.push([v + 1, w + 1]);
    }
  }
  return integerGraph(ce, count, edges);
}

/** `CompleteKaryTree(n)` (binary, `k = 2`) or `CompleteKaryTree(n, k)`: `n` vertices,
 *  1-indexed heap layout — vertex `i`'s children are `k(i-1)+2 .. k(i-1)+k+1`, whichever of
 *  those are `<= n`. */
function completeKaryTree(ce: ComputeEngine, n: number, k: number): BoxedExpression | undefined {
  if (!Number.isSafeInteger(n) || n < 1 || !Number.isSafeInteger(k) || k < 2) return undefined;
  const edges: [number, number][] = [];
  for (let i = 1; i <= n; i++) {
    for (let c = 0; c < k; c++) {
      const child = k * (i - 1) + 2 + c;
      if (child > n) break;
      edges.push([i, child]);
    }
  }
  return integerGraph(ce, n, edges);
}

/** The (undirected, unlabelled) Petersen graph: outer 5-cycle 1..5, inner pentagram
 *  6..10 (step 2), and the 5 spokes i <-> i+5. */
function petersenGraph(ce: ComputeEngine): BoxedExpression {
  const edges: [number, number][] = [];
  for (let i = 1; i <= 5; i++) edges.push([i, (i % 5) + 1]); // outer cycle
  for (let i = 0; i < 5; i++) edges.push([6 + i, 6 + ((i + 2) % 5)]); // inner pentagram
  for (let i = 1; i <= 5; i++) edges.push([i, i + 5]); // spokes
  return integerGraph(ce, 10, edges);
}

// ─── declare ─────────────────────────────────────────────────────────────────────────────

export function declareGraphs(ce: ComputeEngine): void {
  ce.declare("UndirectedEdge", { signature: "(any, any) -> value" });
  ce.declare("DirectedEdge", { signature: "(any, any) -> value" });
  ce.declare("Graph", { signature: "(any, any?) -> value" });

  ce.declare("VertexList", {
    signature: "(value) -> list",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      return g === undefined ? undefined : vertexListExpr(ce, g);
    },
  });

  ce.declare("EdgeList", {
    signature: "(value) -> list",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      return g === undefined
        ? undefined
        : listOf(
            ce,
            g.edges.map((e) => e.expr),
          );
    },
  });

  ce.declare("VertexCount", {
    signature: "(value) -> integer",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      return g === undefined ? undefined : ce.number(g.order.length);
    },
  });

  ce.declare("EdgeCount", {
    signature: "(value) -> integer",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      return g === undefined ? undefined : ce.number(g.edges.length);
    },
  });

  ce.declare("VertexDegree", {
    signature: "(value, any?) -> value",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      const deg = degrees(g);
      if (ops[1] === undefined)
        return listOf(
          ce,
          g.order.map((v) => ce.number(deg.get(v) ?? 0)),
        );
      const key = vertexKey(ops[1]);
      return deg.has(key) ? ce.number(deg.get(key)!) : undefined;
    },
  });

  ce.declare("AdjacencyMatrix", {
    signature: "(value) -> list",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      const index = new Map(g.order.map((v, i) => [v, i]));
      const rows = g.order.map(() => Array.from({ length: g.order.length }, () => 0));
      for (const e of g.edges) {
        const i = index.get(e.a)!;
        const j = index.get(e.b)!;
        rows[i]![j]! += 1;
        if (!e.directed) rows[j]![i]! += 1;
      }
      return listOf(
        ce,
        rows.map((row) =>
          listOf(
            ce,
            row.map((x) => ce.number(x)),
          ),
        ),
      );
    },
  });

  ce.declare("IncidenceMatrix", {
    signature: "(value) -> list",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      const index = new Map(g.order.map((v, i) => [v, i]));
      const rows = g.order.map(() => Array.from({ length: g.edges.length }, () => 0));
      g.edges.forEach((e, col) => {
        const i = index.get(e.a)!;
        const j = index.get(e.b)!;
        if (e.directed) {
          rows[i]![col]! += -1;
          rows[j]![col]! += 1;
        } else {
          rows[i]![col]! += 1;
          rows[j]![col]! += 1;
        }
      });
      return listOf(
        ce,
        rows.map((row) =>
          listOf(
            ce,
            row.map((x) => ce.number(x)),
          ),
        ),
      );
    },
  });

  ce.declare("ConnectedComponents", {
    signature: "(value) -> list",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      return listOf(
        ce,
        connectedComponents(g).map((component) =>
          listOf(
            ce,
            component.map((k) => g.label.get(k)!),
          ),
        ),
      );
    },
  });

  ce.declare("IsConnectedGraph", {
    signature: "(value) -> boolean",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      if (g.order.length === 0) return ce.False;
      return connectedComponents(g).length === 1 ? ce.True : ce.False;
    },
  });

  ce.declare("FindShortestPath", {
    signature: "(value, any, any) -> list",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined || ops[1] === undefined || ops[2] === undefined) return undefined;
      const source = vertexKey(ops[1]);
      const target = vertexKey(ops[2]);
      if (!g.label.has(source) || !g.label.has(target)) return undefined;
      const path = bfsPath(directedAdjacency(g), source, target);
      return listOf(
        ce,
        path.map((k) => g.label.get(k)!),
      );
    },
  });

  ce.declare("GraphDistance", {
    signature: "(value, any, any) -> value",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined || ops[1] === undefined || ops[2] === undefined) return undefined;
      const source = vertexKey(ops[1]);
      const target = vertexKey(ops[2]);
      if (!g.label.has(source) || !g.label.has(target)) return undefined;
      const path = bfsPath(directedAdjacency(g), source, target);
      return path.length === 0 ? ce.symbol("PositiveInfinity") : ce.number(path.length - 1);
    },
  });

  ce.declare("IsTreeGraph", {
    signature: "(value) -> boolean",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      if (g.order.length === 0) return ce.False;
      const connected = connectedComponents(g).length === 1;
      return connected && g.edges.length === g.order.length - 1 ? ce.True : ce.False;
    },
  });

  ce.declare("IsBipartiteGraph", {
    signature: "(value) -> boolean",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      return bipartiteColoring(g) === undefined ? ce.False : ce.True;
    },
  });

  ce.declare("NeighborhoodGraph", {
    signature: "(value, any, integer?) -> value",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined || ops[1] === undefined) return undefined;
      const start = vertexKey(ops[1]);
      if (!g.label.has(start)) return undefined;
      const radius = ops[2] === undefined ? 1 : integerAt(ops[2]);
      if (radius === undefined || radius < 0) return undefined;
      const adj = underlyingAdjacency(g);
      const distance = new Map<string, number>([[start, 0]]);
      const queue = [start];
      for (let i = 0; i < queue.length; i++) {
        const u = queue[i]!;
        const du = distance.get(u)!;
        if (du >= radius) continue;
        for (const v of adj.get(u) ?? []) {
          if (!distance.has(v)) {
            distance.set(v, du + 1);
            queue.push(v);
          }
        }
      }
      return induced(ce, g, new Set(distance.keys()));
    },
  });

  ce.declare("Subgraph", {
    signature: "(value, list) -> value",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined || ops[1] === undefined || ops[1].operator !== "List") return undefined;
      const keep = new Set(operandsOf(ops[1]).map(vertexKey));
      return induced(ce, g, keep);
    },
  });

  ce.declare("CompleteGraph", {
    signature: "(integer) -> value",
    evaluate: (ops) => {
      const n = ops[0] === undefined ? undefined : integerAt(ops[0]);
      return n === undefined ? undefined : completeGraph(ce, n);
    },
  });

  ce.declare("PathGraph", {
    signature: "(any) -> value",
    evaluate: (ops) => (ops[0] === undefined ? undefined : pathGraph(ce, ops[0])),
  });

  ce.declare("CycleGraph", {
    signature: "(integer) -> value",
    evaluate: (ops) => {
      const n = ops[0] === undefined ? undefined : integerAt(ops[0]);
      return n === undefined ? undefined : cycleGraph(ce, n);
    },
  });

  ce.declare("StarGraph", {
    signature: "(integer) -> value",
    evaluate: (ops) => {
      const n = ops[0] === undefined ? undefined : integerAt(ops[0]);
      return n === undefined ? undefined : starGraph(ce, n);
    },
  });

  ce.declare("GridGraph", {
    signature: "(any) -> value",
    evaluate: (ops) => {
      const spec = ops[0];
      if (spec === undefined) return undefined;
      if (spec.operator === "List") {
        const dims = operandsOf(spec).map(integerAt);
        return dims.some((d) => d === undefined) ? undefined : gridGraph(ce, dims as number[]);
      }
      return undefined;
    },
  });

  ce.declare("HypercubeGraph", {
    signature: "(integer) -> value",
    evaluate: (ops) => {
      const n = ops[0] === undefined ? undefined : integerAt(ops[0]);
      return n === undefined ? undefined : hypercubeGraph(ce, n);
    },
  });

  ce.declare("CompleteKaryTree", {
    signature: "(integer, integer?) -> value",
    evaluate: (ops) => {
      const n = ops[0] === undefined ? undefined : integerAt(ops[0]);
      const k = ops[1] === undefined ? 2 : integerAt(ops[1]);
      return n === undefined || k === undefined ? undefined : completeKaryTree(ce, n, k);
    },
  });

  ce.declare("PetersenGraph", {
    signature: "() -> value",
    evaluate: () => petersenGraph(ce),
  });
}

/** The induced subgraph of `g` on the vertex keys in `keep`: those vertices, in `g`'s
 *  original order, and every edge with both endpoints kept. */
function induced(ce: ComputeEngine, g: GraphModel, keep: ReadonlySet<string>): BoxedExpression {
  const vertices = listOf(
    ce,
    g.order.filter((k) => keep.has(k)).map((k) => g.label.get(k)!),
  );
  const edges = listOf(
    ce,
    g.edges.filter((e) => keep.has(e.a) && keep.has(e.b)).map((e) => e.expr),
  );
  return ce.function("Graph", [vertices, edges]);
}

// TODO(notatio rendering): drawing `Graph` (a `<notatio-graph>` element) needs a layout
// algorithm (force-directed / spectral for a general graph, closed-form for the named
// families) to place vertices, then an SVG/canvas element to draw them and the edges —
// none of which exists yet. Out of scope here; this module only makes `Graph` and its
// queries evaluate.
