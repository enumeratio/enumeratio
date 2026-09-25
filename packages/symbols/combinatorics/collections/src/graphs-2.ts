import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf } from "@enumeratio/boxed";
import { degrees, directedAdjacency, type GraphModel, graphOf, integerGraph, listOf, vertexKey } from "./graphs.ts";
import { rngFor } from "./list-frontier.ts";

// Second wave of Wolfram-frontier graph heads, built on graphs.ts (PR #202): distance-based
// measures, structural predicates (our `Is…` naming, see graphs.ts's own note), and a few
// more named/random constructors. Same representation, same conventions: vertex order
// follows VertexList; disconnected graphs read Infinity for a distance/eccentricity that
// cannot be completed, mirroring Wolfram (kernel-verified for GraphDistance itself in
// graphs.ts; extended here to every other distance-shaped measure, NOT independently
// verified against a kernel this session — see the report's kernel-check list).

// ─── distance measures (all directed — GraphDistance's own convention) ────────────────────

const POSITIVE_INFINITY = (ce: ComputeEngine): BoxedExpression => ce.symbol("PositiveInfinity");

/** BFS distances from `source` to every vertex, over `adj` — `Infinity` (`-1` sentinel) for
 *  anything unreached. Shared by every measure below so they agree with each other and with
 *  `GraphDistance` on what "unreachable" means. */
function bfsDistances(adj: ReadonlyMap<string, readonly string[]>, source: string): Map<string, number> {
  const dist = new Map<string, number>([[source, 0]]);
  const queue = [source];
  for (let i = 0; i < queue.length; i++) {
    const u = queue[i]!;
    const du = dist.get(u)!;
    for (const v of adj.get(u) ?? []) {
      if (!dist.has(v)) {
        dist.set(v, du + 1);
        queue.push(v);
      }
    }
  }
  return dist;
}

/** All-pairs distances respecting edge direction — the matrix `GraphDistanceMatrix` reads,
 *  and what every eccentricity-shaped measure below is built from. */
function allPairsDistances(model: GraphModel): Map<string, Map<string, number>> {
  const adj = directedAdjacency(model);
  const table = new Map<string, Map<string, number>>();
  for (const v of model.order) table.set(v, bfsDistances(adj, v));
  return table;
}

const numberOrInfinity = (ce: ComputeEngine, d: number | undefined): BoxedExpression =>
  d === undefined ? POSITIVE_INFINITY(ce) : ce.number(d);

/** Eccentricity of `v`: the greatest distance from `v` to any other vertex, `Infinity` the
 *  moment one is unreachable (Wolfram's convention for a disconnected graph, per the task
 *  brief) — NOT just the max over what happens to be reachable. */
function eccentricity(
  model: GraphModel,
  distances: ReadonlyMap<string, Map<string, number>>,
  v: string,
): number | undefined {
  const row = distances.get(v);
  if (row === undefined) return undefined;
  let max = 0;
  for (const u of model.order) {
    if (u === v) continue;
    const d = row.get(u);
    if (d === undefined) return undefined; // unreachable -> Infinity
    if (d > max) max = d;
  }
  return max;
}

function eccentricities(model: GraphModel): Map<string, number | undefined> {
  const distances = allPairsDistances(model);
  const out = new Map<string, number | undefined>();
  for (const v of model.order) out.set(v, eccentricity(model, distances, v));
  return out;
}

// ─── acyclicity (shared by IsAcyclicGraph and IsPathGraph/IsTreeGraph-style checks) ────────

/** Whether the graph (directed edges respected, undirected edges bidirectional) contains a
 *  cycle. An undirected edge alone is never a cycle — walking back over the SAME edge you
 *  just arrived by doesn't count, tracked via edge index, not vertex — so a plain
 *  undirected tree reads acyclic, matching `IsTreeGraph`'s own (edges = vertices - 1) check.
 *  A self-loop, or two vertices joined by two directed edges in opposite directions, does
 *  count: those are genuine cycles.
 *
 *  For a directed edge, only a back edge to a vertex still ON the recursion stack (gray)
 *  is a cycle — a black (fully explored, popped) target is an ordinary DAG cross/forward
 *  edge. For an undirected edge, ANY already-visited non-parent neighbour (gray or black)
 *  is a cycle: undirected DFS has no cross edges within one connected exploration, so
 *  "visited and not where I came from" always means a cycle. This is the one place the two
 *  edge kinds are handled differently. */
function hasCycle(model: GraphModel): boolean {
  interface Entry {
    to: string;
    edgeIdx: number;
    directed: boolean;
  }
  const adj = new Map<string, Entry[]>(model.order.map((v) => [v, []]));
  model.edges.forEach((e, edgeIdx) => {
    adj.get(e.a)!.push({ to: e.b, edgeIdx, directed: e.directed });
    if (!e.directed) adj.get(e.b)!.push({ to: e.a, edgeIdx, directed: e.directed });
  });

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, 0 | 1 | 2>(model.order.map((v) => [v, WHITE]));
  let found = false;

  const dfs = (u: string, viaEdge: number | undefined): void => {
    color.set(u, GRAY);
    for (const { to, edgeIdx, directed } of adj.get(u) ?? []) {
      if (found) return;
      if (edgeIdx === viaEdge) continue; // don't backtrack over the same undirected edge
      const c = color.get(to)!;
      if (directed) {
        if (c === GRAY) {
          found = true;
          return;
        }
        if (c === WHITE) dfs(to, edgeIdx);
      } else {
        if (c !== WHITE) {
          found = true;
          return;
        }
        dfs(to, edgeIdx);
      }
    }
    color.set(u, BLACK);
  };

  for (const start of model.order) {
    if (color.get(start) === WHITE) dfs(start, undefined);
    if (found) return true;
  }
  return false;
}

// ─── simple-graph checks (shared by IsSimpleGraph, IsCompleteGraph, IsLoopFreeGraph) ───────

const hasSelfLoop = (model: GraphModel): boolean => model.edges.some((e) => e.a === e.b);

/** A signature per declared edge that treats `(a,b)` and `(b,a)` as the SAME undirected
 *  edge but keeps a directed edge distinct from its reverse — two edges sharing a signature
 *  are a multi-edge / parallel edge. */
function edgeSignatures(model: GraphModel): string[] {
  return model.edges.map((e) => {
    if (e.directed) return `D:${e.a}\u0000${e.b}`;
    const [x, y] = e.a <= e.b ? [e.a, e.b] : [e.b, e.a];
    return `U:${x}\u0000${y}`;
  });
}

const isSimple = (model: GraphModel): boolean => {
  if (hasSelfLoop(model)) return false;
  const sigs = edgeSignatures(model);
  return new Set(sigs).size === sigs.length;
};

// ─── isomorphism (brute force — small graphs only) ─────────────────────────────────────────

/** Vertices beyond this, `IsIsomorphicGraph` returns `undefined` (unevaluated) rather than
 *  attempting `n!` permutations — 9! = 362,880, still fast; 10! would not be. */
const ISOMORPHISM_VERTEX_LIMIT = 9;

/** Directed-aware adjacency signature set: `(i, j)` in the set means SOME edge goes from
 *  vertex index `i` to vertex index `j` in `order` — an undirected edge contributes both
 *  `(i, j)` and `(j, i)`, so comparing these sets is exactly comparing "is there an edge
 *  between these two, in this direction" for every ordered pair, which is what a graph
 *  isomorphism must preserve. */
function pairSet(model: GraphModel, order: readonly string[]): Set<string> {
  const index = new Map(order.map((v, i) => [v, i]));
  const set = new Set<string>();
  for (const e of model.edges) {
    const i = index.get(e.a)!;
    const j = index.get(e.b)!;
    set.add(`${i},${j}`);
    if (!e.directed) set.add(`${j},${i}`);
  }
  return set;
}

/** Heap's algorithm, yielding every permutation of `[0..n-1]` in place. */
function* permutations(n: number): Generator<number[]> {
  const a = Array.from({ length: n }, (_, i) => i);
  const c = new Array<number>(n).fill(0);
  yield a.slice();
  let i = 0;
  while (i < n) {
    if (c[i]! < i) {
      const swapWith = i % 2 === 0 ? 0 : c[i]!;
      [a[i], a[swapWith]] = [a[swapWith]!, a[i]!];
      yield a.slice();
      c[i]!++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
}

function areIsomorphic(g1: GraphModel, g2: GraphModel): boolean | undefined {
  if (g1.order.length !== g2.order.length || g1.edges.length !== g2.edges.length) return false;
  const n = g1.order.length;
  if (n > ISOMORPHISM_VERTEX_LIMIT) return undefined;
  const deg1 = degrees(g1);
  const deg2 = degrees(g2);
  const sorted = (m: ReadonlyMap<string, number>, order: readonly string[]): number[] =>
    order.map((v) => m.get(v) ?? 0).sort((a, b) => a - b);
  if (JSON.stringify(sorted(deg1, g1.order)) !== JSON.stringify(sorted(deg2, g2.order))) return false;

  const target = pairSet(g1, g1.order);
  const base = g2.order;
  for (const perm of permutations(n)) {
    const candidateOrder = perm.map((i) => base[i]!);
    const candidate = pairSet(g2, candidateOrder);
    if (candidate.size === target.size && [...target].every((k) => candidate.has(k))) return true;
  }
  return false;
}

// ─── named constructors ─────────────────────────────────────────────────────────────────

/** `WheelGraph(n)`: vertex 1 is the hub, joined to every one of the outer `n - 1` vertices,
 *  which themselves form a cycle — `n` vertices total (kernel-unverified; matches the
 *  common textbook convention and gives `EdgeCount = 2(n - 1)`). Needs `n >= 4` for the rim
 *  to be an actual cycle (>= 3 vertices). */
function wheelGraph(ce: ComputeEngine, n: number): BoxedExpression | undefined {
  if (!Number.isSafeInteger(n) || n < 4) return undefined;
  const edges: [number, number][] = [];
  for (let i = 2; i <= n; i++) edges.push([1, i]); // spokes
  for (let i = 2; i < n; i++) edges.push([i, i + 1]); // rim
  edges.push([n, 2]); // close the rim
  return integerGraph(ce, n, edges);
}

/** `CirculantGraph(n, k)` / `CirculantGraph(n, {k1, k2, …})`: vertex `i` (0-based internally,
 *  1-based in the result) joined to `i ± k (mod n)` for every offset `k` given. Offsets are
 *  deduplicated against their `n - k` mirror so `k` and `n - k` don't double an edge. */
function circulantGraph(ce: ComputeEngine, n: number, offsets: readonly number[]): BoxedExpression | undefined {
  if (!Number.isSafeInteger(n) || n < 2) return undefined;
  if (offsets.length === 0 || offsets.some((k) => !Number.isSafeInteger(k) || k < 1 || k >= n)) return undefined;
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  for (const k of offsets) {
    for (let i = 0; i < n; i++) {
      const j = (i + k) % n;
      const key = i < j ? `${i},${j}` : `${j},${i}`;
      if (i === j || seen.has(key)) continue;
      seen.add(key);
      edges.push([i + 1, j + 1]);
    }
  }
  return integerGraph(ce, n, edges);
}

/** `TuranGraph(n, r)`: the complete `r`-partite graph on `n` vertices with parts as equal as
 *  possible — the extremal `K_r`-free graph on `n` vertices with the most edges. Vertices
 *  1..n are assigned to parts in consecutive blocks: the first `n mod r` parts get
 *  `ceil(n/r)` vertices, the rest get `floor(n/r)` (kernel-unverified block ORDER — the
 *  partition sizes themselves are the graph's actual definition, order is just a labelling
 *  choice). Every pair in DIFFERENT parts is joined; same-part pairs are not. */
function turanGraph(ce: ComputeEngine, n: number, r: number): BoxedExpression | undefined {
  if (!Number.isSafeInteger(n) || n < 1 || !Number.isSafeInteger(r) || r < 1 || r > n) return undefined;
  const base = Math.floor(n / r);
  const extra = n % r;
  const partOf: number[] = []; // 0-based vertex -> 0-based part
  let v = 0;
  for (let p = 0; p < r; p++) {
    const size = base + (p < extra ? 1 : 0);
    for (let k = 0; k < size; k++) partOf[v++] = p;
  }
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (partOf[i] !== partOf[j]) edges.push([i + 1, j + 1]);
    }
  }
  return integerGraph(ce, n, edges);
}

/** `HararyGraph(k, n)`: the minimum-edge `k`-connected graph on `n` vertices (Harary, 1962).
 *  `k` even (`= 2r`): the circulant `CirculantGraph(n, {1, …, r})` — every vertex already has
 *  degree exactly `k`.
 *  `k` odd (`= 2r + 1`), `n` even: that circulant plus the `n/2` "diameter" edges `i <-> i +
 *  n/2` — one extra edge per vertex, degree `2r + 1`.
 *  `k` odd, `n` odd: that circulant plus edges `i <-> i + (n+1)/2` for `i = 0, …, (n-3)/2`,
 *  plus one closing edge `(n-1)/2 <-> n-1` — the textbook fix-up for the one vertex the
 *  even-offset scheme above would otherwise miss (all 0-based internally, kernel-unverified
 *  against a live kernel — the report flags this as the least certain construction here;
 *  cross-checked instead against the two structural invariants every Harary graph must
 *  have: `EdgeCount = ceil(k n / 2)` and minimum degree `>= k`). */
function hararyGraph(ce: ComputeEngine, k: number, n: number): BoxedExpression | undefined {
  if (!Number.isSafeInteger(k) || !Number.isSafeInteger(n) || k < 1 || n < k + 1) return undefined;
  const r = Math.floor(k / 2);
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  const add = (i: number, j: number): void => {
    if (i === j) return;
    const key = i < j ? `${i},${j}` : `${j},${i}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push([i + 1, j + 1]);
  };
  for (let off = 1; off <= r; off++) {
    for (let i = 0; i < n; i++) add(i, (i + off) % n);
  }
  if (k % 2 === 1) {
    if (n % 2 === 0) {
      for (let i = 0; i < n / 2; i++) add(i, i + n / 2);
    } else {
      const half = (n + 1) / 2;
      for (let i = 0; i <= (n - 3) / 2; i++) add(i, (i + half) % n);
      add((n - 1) / 2, n - 1);
    }
  }
  return integerGraph(ce, n, edges);
}

/** `LineGraph(g)`: one vertex per edge of `g` (numbered 1..m, in `EdgeList` order),
 *  UNDIRECTED regardless of `g`'s own edge directions — two line-graph vertices are joined
 *  iff their edges share an endpoint in `g` (Wolfram's default `LineGraph` output; the
 *  directed variant that only connects head-to-tail is out of scope here). A shared
 *  self-loop or multi-edge pair is de-duplicated to one line-graph edge. */
function lineGraph(ce: ComputeEngine, g: GraphModel): BoxedExpression {
  const m = g.edges.length;
  const incident = new Map<string, number[]>(g.order.map((v) => [v, []]));
  g.edges.forEach((e, idx) => {
    incident.get(e.a)!.push(idx);
    incident.get(e.b)!.push(idx);
  });
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  for (const v of g.order) {
    const inc = incident.get(v)!;
    for (let a = 0; a < inc.length; a++) {
      for (let b = a + 1; b < inc.length; b++) {
        const i = inc[a]!;
        const j = inc[b]!;
        const key = i < j ? `${i},${j}` : `${j},${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push([i + 1, j + 1]);
      }
    }
  }
  return integerGraph(ce, m, edges);
}

/** `AdjacencyGraph(matrix)` / `AdjacencyGraph(vertices, matrix)`: an `n x n` 0/1 (or any
 *  nonzero-means-edge) matrix. SYMMETRIC gives an undirected graph, one edge per `i < j`
 *  pair; anything else gives a directed graph, one edge per nonzero `(i, j)` (including
 *  `i == j` self-loops, and both `(i,j)`/`(j,i)` when both are set). */
function adjacencyGraph(
  ce: ComputeEngine,
  vertices: readonly BoxedExpression[] | undefined,
  matrix: number[][],
): BoxedExpression | undefined {
  const n = matrix.length;
  if (n === 0 || matrix.some((row) => row.length !== n)) return undefined;
  if (vertices !== undefined && vertices.length !== n) return undefined;
  let symmetric = true;
  outer: for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (matrix[i]![j] !== matrix[j]![i]) {
        symmetric = false;
        break outer;
      }
    }
  }
  const vertexExprs = vertices ?? Array.from({ length: n }, (_, i) => ce.number(i + 1));
  const vertexList = listOf(ce, vertexExprs);
  const edgeExprs: BoxedExpression[] = [];
  if (symmetric) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (matrix[i]![j] !== 0) edgeExprs.push(ce.function("UndirectedEdge", [vertexExprs[i]!, vertexExprs[j]!]));
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (matrix[i]![j] !== 0) edgeExprs.push(ce.function("DirectedEdge", [vertexExprs[i]!, vertexExprs[j]!]));
      }
    }
  }
  return ce.function("Graph", [vertexList, listOf(ce, edgeExprs)]);
}

const numberMatrixOf = (expr: BoxedExpression): number[][] | undefined => {
  if (expr.operator !== "List") return undefined;
  const rows = operandsOf(expr);
  const out: number[][] = [];
  for (const row of rows) {
    if (row.operator !== "List") return undefined;
    const nums = operandsOf(row).map(integerAt);
    if (nums.some((x) => x === undefined)) return undefined;
    out.push(nums as number[]);
  }
  return out;
};

/** `RandomGraph({n, m})`: a uniformly-chosen simple undirected graph on `n` vertices with
 *  exactly `m` edges — Fisher-Yates shuffle of the `C(n, 2)` possible edges, taking the
 *  first `m`, drawn from the SAME seeded stream `RandomInteger` uses (`rngFor` in
 *  `list-frontier.ts`), reseeded together by `SeedRandom`. NOT Wolfram's generator or
 *  algorithm — only `VertexCount`/`EdgeCount`/simplicity are guaranteed to match, same
 *  divergence `RandomInteger` itself documents. */
function randomGraph(ce: ComputeEngine, n: number, m: number): BoxedExpression | undefined {
  if (!Number.isSafeInteger(n) || n < 0 || !Number.isSafeInteger(m) || m < 0) return undefined;
  const maxEdges = (n * (n - 1)) / 2;
  if (m > maxEdges) return undefined;
  const allPairs: [number, number][] = [];
  for (let i = 1; i <= n; i++) for (let j = i + 1; j <= n; j++) allPairs.push([i, j]);
  const next = rngFor(ce);
  for (let i = allPairs.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [allPairs[i], allPairs[j]] = [allPairs[j]!, allPairs[i]!];
  }
  return integerGraph(ce, n, allPairs.slice(0, m));
}

// ─── centrality (numeric) ───────────────────────────────────────────────────────────────

/** `ClosenessCentrality(g, v)`: `(r - 1) / sum(distances from v to those r - 1 reachable
 *  vertices)`, where `r` is the number of vertices reachable from `v` INCLUDING `v` itself —
 *  restricting to the reachable set rather than erroring on a disconnected graph, matching
 *  how Wolfram documents this measure for a disconnected graph. `0` for an isolated vertex
 *  (nothing reachable to be close to). Distances respect edge direction (out-distances from
 *  `v`), same as `GraphDistance`/`GraphDistanceMatrix`. Kernel-unverified. */
function closenessCentrality(
  model: GraphModel,
  distances: ReadonlyMap<string, Map<string, number>>,
  v: string,
): number {
  const row = distances.get(v);
  if (row === undefined) return 0;
  let sum = 0;
  let reachable = 0;
  for (const [u, d] of row) {
    if (u === v) continue;
    sum += d;
    reachable++;
  }
  return reachable === 0 || sum === 0 ? 0 : reachable / sum;
}

/** `EigenvectorCentrality(g)`: the dominant eigenvector of the UNDIRECTED adjacency matrix
 *  (direction ignored, matching `IsConnectedGraph`'s underlying-graph convention), via power
 *  iteration, normalized so the LARGEST entry is `1`. That normalization (rather than unit
 *  Euclidean norm, or summing to `n`) is a documented choice, not a confirmed match to
 *  Wolfram's own — kernel-unverified, see the report. Power iteration needs a connected
 *  graph for a unique answer; run globally here regardless, which is well-defined but not
 *  guaranteed meaningful across disconnected components.
 *
 *  Power-iterates `A + I` (the adjacency matrix PLUS the identity), not bare `A`: a
 *  bipartite graph's spectrum is symmetric about 0, so its most-positive and most-negative
 *  eigenvalues have equal magnitude, and plain power iteration on `A` OSCILLATES between
 *  their two eigenvectors forever instead of converging — caught by this file's own `P3`
 *  test (a path is bipartite; squaring `A` doesn't fix it either, since `A^2` then has
 *  those same two eigenvalues collide into one genuinely degenerate eigenspace). Shifting
 *  by `+I` adds 1 to every eigenvalue without changing any eigenVECTOR, which breaks the
 *  tie (`λmax + 1` now strictly exceeds `|μ + 1|` for every other eigenvalue `μ`, since
 *  `|μ| <= λmax`) while leaving the answer — the Perron eigenvector, which is what
 *  "eigenvector centrality" means — exactly the vector plain power iteration on `A` would
 *  converge to on a non-bipartite graph. */
function eigenvectorCentrality(ce: ComputeEngine, model: GraphModel): BoxedExpression {
  const n = model.order.length;
  if (n === 0) return listOf(ce, []);
  const index = new Map(model.order.map((v, i) => [v, i]));
  const adj: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const e of model.edges) {
    const i = index.get(e.a)!;
    const j = index.get(e.b)!;
    adj[i]![j] = 1;
    adj[j]![i] = 1;
  }
  for (let i = 0; i < n; i++) adj[i]![i]! += 1; // shift by +I
  let x = new Array<number>(n).fill(1 / Math.sqrt(n));
  for (let iter = 0; iter < 200; iter++) {
    const next = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += adj[i]![j]! * x[j]!;
      next[i] = s;
    }
    const norm = Math.sqrt(next.reduce((acc, v) => acc + v * v, 0));
    if (norm === 0) {
      x = next;
      break;
    }
    x = next.map((v) => v / norm);
  }
  const max = Math.max(...x.map(Math.abs), 0);
  const scaled = max === 0 ? x : x.map((v) => v / max);
  return listOf(
    ce,
    scaled.map((v) => ce.number(v)),
  );
}

// ─── declare ─────────────────────────────────────────────────────────────────────────────

export function declareGraphs2(ce: ComputeEngine): void {
  ce.declare("GraphDistanceMatrix", {
    signature: "(value) -> list",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      const distances = allPairsDistances(g);
      return listOf(
        ce,
        g.order.map((v) =>
          listOf(
            ce,
            g.order.map((u) => numberOrInfinity(ce, distances.get(v)!.get(u))),
          ),
        ),
      );
    },
  });

  ce.declare("VertexEccentricity", {
    signature: "(value, any?) -> value",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      const ecc = eccentricities(g);
      if (ops[1] === undefined)
        return listOf(
          ce,
          g.order.map((v) => numberOrInfinity(ce, ecc.get(v))),
        );
      const key = vertexKey(ops[1]);
      return g.label.has(key) ? numberOrInfinity(ce, ecc.get(key)) : undefined;
    },
  });

  ce.declare("GraphRadius", {
    signature: "(value) -> value",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined || g.order.length === 0) return undefined;
      const ecc = [...eccentricities(g).values()];
      return ecc.some((e) => e === undefined) ? POSITIVE_INFINITY(ce) : ce.number(Math.min(...(ecc as number[])));
    },
  });

  ce.declare("GraphDiameter", {
    signature: "(value) -> value",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined || g.order.length === 0) return undefined;
      const ecc = [...eccentricities(g).values()];
      return ecc.some((e) => e === undefined) ? POSITIVE_INFINITY(ce) : ce.number(Math.max(...(ecc as number[])));
    },
  });

  ce.declare("GraphCenter", {
    signature: "(value) -> list",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      const ecc = eccentricities(g);
      const finite = g.order.filter((v) => ecc.get(v) !== undefined);
      if (finite.length === 0) return listOf(ce, []);
      const min = Math.min(...finite.map((v) => ecc.get(v)!));
      return listOf(
        ce,
        finite.filter((v) => ecc.get(v) === min).map((v) => g.label.get(v)!),
      );
    },
  });

  ce.declare("GraphPeriphery", {
    signature: "(value) -> list",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      const ecc = eccentricities(g);
      const finite = g.order.filter((v) => ecc.get(v) !== undefined);
      if (finite.length === 0) return listOf(ce, []);
      const max = Math.max(...finite.map((v) => ecc.get(v)!));
      return listOf(
        ce,
        finite.filter((v) => ecc.get(v) === max).map((v) => g.label.get(v)!),
      );
    },
  });

  ce.declare("VertexIndex", {
    signature: "(value, any) -> integer",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined || ops[1] === undefined) return undefined;
      const idx = g.order.indexOf(vertexKey(ops[1]));
      return idx === -1 ? undefined : ce.number(idx + 1);
    },
  });

  ce.declare("VertexInDegree", {
    signature: "(value, any?) -> value",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      const inDeg = new Map<string, number>(g.order.map((v) => [v, 0]));
      for (const e of g.edges) {
        inDeg.set(e.b, (inDeg.get(e.b) ?? 0) + 1);
        if (!e.directed) inDeg.set(e.a, (inDeg.get(e.a) ?? 0) + 1);
      }
      if (ops[1] === undefined)
        return listOf(
          ce,
          g.order.map((v) => ce.number(inDeg.get(v) ?? 0)),
        );
      const key = vertexKey(ops[1]);
      return inDeg.has(key) ? ce.number(inDeg.get(key)!) : undefined;
    },
  });

  ce.declare("VertexOutDegree", {
    signature: "(value, any?) -> value",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      const outDeg = new Map<string, number>(g.order.map((v) => [v, 0]));
      for (const e of g.edges) {
        outDeg.set(e.a, (outDeg.get(e.a) ?? 0) + 1);
        if (!e.directed) outDeg.set(e.b, (outDeg.get(e.b) ?? 0) + 1);
      }
      if (ops[1] === undefined)
        return listOf(
          ce,
          g.order.map((v) => ce.number(outDeg.get(v) ?? 0)),
        );
      const key = vertexKey(ops[1]);
      return outDeg.has(key) ? ce.number(outDeg.get(key)!) : undefined;
    },
  });

  ce.declare("ClosenessCentrality", {
    signature: "(value, any?) -> value",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      const distances = allPairsDistances(g);
      if (ops[1] === undefined)
        return listOf(
          ce,
          g.order.map((v) => ce.number(closenessCentrality(g, distances, v))),
        );
      const key = vertexKey(ops[1]);
      return g.label.has(key) ? ce.number(closenessCentrality(g, distances, key)) : undefined;
    },
  });

  ce.declare("EigenvectorCentrality", {
    signature: "(value) -> list",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      return g === undefined ? undefined : eigenvectorCentrality(ce, g);
    },
  });

  // ── predicates (our `Is…` naming — see graphs.ts's own note on IsConnectedGraph etc.) ──

  ce.declare("IsPathGraph", {
    signature: "(value) -> boolean",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      if (!isSimple(g)) return ce.False;
      const n = g.order.length;
      if (n === 1) return g.edges.length === 0 ? ce.True : ce.False;
      if (g.edges.length !== n - 1) return ce.False;
      const deg = degrees(g);
      const ends = g.order.filter((v) => deg.get(v) === 1).length;
      const middles = g.order.filter((v) => deg.get(v) === 2).length;
      return ends === 2 && middles === n - 2 ? ce.True : ce.False;
    },
  });

  ce.declare("IsAcyclicGraph", {
    signature: "(value) -> boolean",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      return g === undefined ? undefined : hasCycle(g) ? ce.False : ce.True;
    },
  });

  ce.declare("IsCompleteGraph", {
    signature: "(value) -> boolean",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      if (g === undefined) return undefined;
      if (g.edges.some((e) => e.directed) || !isSimple(g)) return ce.False;
      const n = g.order.length;
      return g.edges.length === (n * (n - 1)) / 2 ? ce.True : ce.False;
    },
  });

  ce.declare("IsLoopFreeGraph", {
    signature: "(value) -> boolean",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      return g === undefined ? undefined : hasSelfLoop(g) ? ce.False : ce.True;
    },
  });

  ce.declare("IsSimpleGraph", {
    signature: "(value) -> boolean",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      return g === undefined ? undefined : isSimple(g) ? ce.True : ce.False;
    },
  });

  ce.declare("IsIsomorphicGraph", {
    signature: "(value, value) -> boolean",
    evaluate: (ops) => {
      const g1 = ops[0] === undefined ? undefined : graphOf(ops[0]);
      const g2 = ops[1] === undefined ? undefined : graphOf(ops[1]);
      if (g1 === undefined || g2 === undefined) return undefined;
      const result = areIsomorphic(g1, g2);
      return result === undefined ? undefined : result ? ce.True : ce.False;
    },
  });

  // ── constructors ──

  ce.declare("WheelGraph", {
    signature: "(integer) -> value",
    evaluate: (ops) => {
      const n = ops[0] === undefined ? undefined : integerAt(ops[0]);
      return n === undefined ? undefined : wheelGraph(ce, n);
    },
  });

  ce.declare("CirculantGraph", {
    signature: "(integer, any) -> value",
    evaluate: (ops) => {
      const n = ops[0] === undefined ? undefined : integerAt(ops[0]);
      if (n === undefined || ops[1] === undefined) return undefined;
      if (ops[1].operator === "List") {
        const offsets = operandsOf(ops[1]).map(integerAt);
        return offsets.some((k) => k === undefined) ? undefined : circulantGraph(ce, n, offsets as number[]);
      }
      const k = integerAt(ops[1]);
      return k === undefined ? undefined : circulantGraph(ce, n, [k]);
    },
  });

  ce.declare("TuranGraph", {
    signature: "(integer, integer) -> value",
    evaluate: (ops) => {
      const n = ops[0] === undefined ? undefined : integerAt(ops[0]);
      const r = ops[1] === undefined ? undefined : integerAt(ops[1]);
      return n === undefined || r === undefined ? undefined : turanGraph(ce, n, r);
    },
  });

  ce.declare("HararyGraph", {
    signature: "(integer, integer) -> value",
    evaluate: (ops) => {
      const k = ops[0] === undefined ? undefined : integerAt(ops[0]);
      const n = ops[1] === undefined ? undefined : integerAt(ops[1]);
      return k === undefined || n === undefined ? undefined : hararyGraph(ce, k, n);
    },
  });

  ce.declare("LineGraph", {
    signature: "(value) -> value",
    evaluate: (ops) => {
      const g = ops[0] === undefined ? undefined : graphOf(ops[0]);
      return g === undefined ? undefined : lineGraph(ce, g);
    },
  });

  ce.declare("AdjacencyGraph", {
    signature: "(any, any?) -> value",
    evaluate: (ops) => {
      if (ops[0] === undefined) return undefined;
      const hasVertices = ops[1] !== undefined && ops[1].operator === "List" && ops[0].operator === "List";
      // AdjacencyGraph(matrix) vs AdjacencyGraph(vertices, matrix): the second operand is the
      // matrix unless it's absent, in which case the first operand is.
      const matrixExpr = ops[1] !== undefined ? ops[1] : ops[0];
      const matrix = numberMatrixOf(matrixExpr);
      if (matrix === undefined) return undefined;
      const vertices = hasVertices ? operandsOf(ops[0]) : undefined;
      return adjacencyGraph(ce, vertices, matrix);
    },
  });

  ce.declare("RandomGraph", {
    signature: "(any) -> value",
    evaluate: (ops) => {
      const spec = ops[0];
      if (spec === undefined || spec.operator !== "List") return undefined;
      const [n, m] = operandsOf(spec).map(integerAt);
      return n === undefined || m === undefined ? undefined : randomGraph(ce, n, m);
    },
  });
}
