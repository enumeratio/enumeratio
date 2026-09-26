import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { listOf, type GraphModel } from "./graphs.ts";

// Edge weights: `Graph(edges, EdgeWeight -> {…})` (the model-building side lives in
// graphOf itself, graphs.ts). This module is the arithmetic side — Dijkstra over a
// weighted graph — shared by GraphDistance/FindShortestPath (graphs.ts) and
// GraphDistanceMatrix (graphs-2.ts) so a weighted graph and an unweighted one go through
// the same BFS-vs-Dijkstra branch everywhere, and by WeightedAdjacencyMatrix (declared
// here) which needs no shortest-path machinery at all.

/** A weight expression, read numerically (`.N().re`) rather than kept exact — same
 *  approach `EigenvectorCentrality` already takes for this module's kind of arithmetic.
 *  A missing weight (an edge in an otherwise-unweighted graph — never happens today,
 *  since `graphOf` requires `EdgeWeight` to cover every edge or none, but kept as a
 *  fallback for anything built by hand) reads as Wolfram's own default, `1`. */
export function numericWeight(weight: BoxedExpression | undefined): number {
  if (weight === undefined) return 1;
  const n = weight.N().re;
  return typeof n === "number" ? n : NaN;
}

interface WeightedStep {
  readonly to: string;
  readonly weight: number;
}

/** Neighbours with their edge weight, respecting edge direction — the weighted analogue of
 *  `directedAdjacency`. Every weight defaults to `1` when the graph carries none, so a
 *  caller can run this over an unweighted graph too (though nothing here does — BFS is
 *  cheaper and already exact for that case). */
function directedWeightedAdjacency(model: GraphModel): Map<string, WeightedStep[]> {
  const adj = new Map<string, WeightedStep[]>(model.order.map((v) => [v, []]));
  for (const e of model.edges) {
    const weight = numericWeight(e.weight);
    adj.get(e.a)!.push({ to: e.b, weight });
    if (!e.directed) adj.get(e.b)!.push({ to: e.a, weight });
  }
  return adj;
}

/** `true` the moment any edge weight is negative — Dijkstra's algorithm (what every
 *  weighted measure here runs) is only correct for non-negative weights; Wolfram itself
 *  switches to Bellman-Ford for a negatively-weighted graph, which is out of scope here.
 *  Callers decline (return `undefined`, i.e. stay unevaluated) rather than return a wrong
 *  answer. */
function hasNegativeWeight(adj: ReadonlyMap<string, readonly WeightedStep[]>): boolean {
  for (const steps of adj.values()) for (const step of steps) if (step.weight < 0) return true;
  return false;
}

/** Dijkstra distances from `source` to every vertex — plain O(V^2) selection (these graphs
 *  are small; no priority queue needed). `undefined` if a negative weight makes the result
 *  meaningless (see `hasNegativeWeight`). A vertex never reached is simply absent from the
 *  map, same convention `bfsDistances` uses. */
export function dijkstraDistances(model: GraphModel, source: string): Map<string, number> | undefined {
  const adj = directedWeightedAdjacency(model);
  if (hasNegativeWeight(adj)) return undefined;
  const dist = new Map<string, number>([[source, 0]]);
  const done = new Set<string>();
  for (;;) {
    let u: string | undefined;
    let best = Infinity;
    for (const [v, d] of dist) {
      if (!done.has(v) && d < best) {
        best = d;
        u = v;
      }
    }
    if (u === undefined) break;
    done.add(u);
    for (const { to, weight } of adj.get(u) ?? []) {
      const candidate = best + weight;
      if (!dist.has(to) || candidate < dist.get(to)!) dist.set(to, candidate);
    }
  }
  return dist;
}

/** All-pairs weighted distances — the weighted analogue of `allPairsDistances`
 *  (graphs-2.ts), what a weighted `GraphDistanceMatrix` reads. `undefined` if any edge
 *  weight is negative (see `hasNegativeWeight`) -- the WHOLE matrix declines together,
 *  same as any other Dijkstra-based measure here. */
export function allPairsWeightedDistances(model: GraphModel): Map<string, Map<string, number>> | undefined {
  const table = new Map<string, Map<string, number>>();
  for (const v of model.order) {
    const row = dijkstraDistances(model, v);
    if (row === undefined) return undefined;
    table.set(v, row);
  }
  return table;
}

/** Dijkstra shortest path from `source` to `target`, vertex keys including both ends, `[]`
 *  if unreachable (matching `bfsPath`'s convention) — `undefined` on a negative weight (see
 *  `hasNegativeWeight`). */
export function dijkstraPath(model: GraphModel, source: string, target: string): string[] | undefined {
  if (source === target) return [source];
  const adj = directedWeightedAdjacency(model);
  if (hasNegativeWeight(adj)) return undefined;
  const dist = new Map<string, number>([[source, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  for (;;) {
    let u: string | undefined;
    let best = Infinity;
    for (const [v, d] of dist) {
      if (!done.has(v) && d < best) {
        best = d;
        u = v;
      }
    }
    if (u === undefined) break;
    done.add(u);
    if (u === target) break;
    for (const { to, weight } of adj.get(u) ?? []) {
      const candidate = best + weight;
      if (!dist.has(to) || candidate < dist.get(to)!) {
        dist.set(to, candidate);
        prev.set(to, u);
      }
    }
  }
  if (!dist.has(target)) return [];
  const path = [target];
  let cur = target;
  while (cur !== source) {
    cur = prev.get(cur)!;
    path.push(cur);
  }
  return path.reverse();
}

// ─── WeightedAdjacencyMatrix (declared in graphs-2.ts, alongside AdjacencyMatrix's own
// dense-vs-sparse note) ──────────────────────────────────────────────────────────────────

/** `WeightedAdjacencyMatrix(g)`: entry (i, j) is the weight of the edge from vertex i to
 *  vertex j (both defaulting to Wolfram's own default weight, `1`, when `g` carries no
 *  `EdgeWeight` at all — so this agrees with `AdjacencyMatrix` on an unweighted graph),
 *  `0` where no edge exists. A multi-edge sums its parallel edges' weights, matching how
 *  `AdjacencyMatrix` sums parallel edges' counts. Returned as a plain (dense) matrix, not
 *  Wolfram's `SparseArray` — the same simplification `AdjacencyMatrix` documents, for the
 *  same reason (no sparse-matrix head here to return instead). */
export function weightedAdjacencyMatrixExpr(ce: ComputeEngine, g: GraphModel): BoxedExpression {
  const index = new Map(g.order.map((v, i) => [v, i]));
  const rows = g.order.map(() => Array.from({ length: g.order.length }, () => 0));
  for (const e of g.edges) {
    const i = index.get(e.a)!;
    const j = index.get(e.b)!;
    const w = numericWeight(e.weight);
    rows[i]![j]! += w;
    if (!e.directed) rows[j]![i]! += w;
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
}
