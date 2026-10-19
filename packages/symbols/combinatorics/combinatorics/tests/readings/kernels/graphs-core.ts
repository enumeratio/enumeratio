// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { Binomial } from "../../../collections/src/families/kernels-combinatorics.ts";
import { edgeIndexOf, edgePairs } from "../../../graphs/src/families/core.ts";
import {
  SubsetCount,
  SubsetRank,
  SubsetUnrank,
  TupleCount,
  TupleRank,
  TupleUnrank,
} from "./collections-kernels-extra.ts";

export function LabeledGraphRank(e: number[][], n: number): number {
  const edges = edgePairs(n);
  const idx = e.map(([u, v]) => edgeIndexOf(edges, u, v));
  idx.sort((a, b) => a - b);
  return SubsetRank(idx);
}

export function LabeledGraphUnrank(n: number, rank: number): number[][] {
  const edges = edgePairs(n);
  return SubsetUnrank(edges.length, rank).map((i) => edges[i - 1]);
}

// ─── LabeledGraphs(n): simple undirected graphs on [n] — subsets of K_n's edges. Count 2^C(n,2).
// Element = edge list, matching LabeledTrees' convention. ─────────────────────────────────────────
export function LabeledGraphCount(n: number): number {
  return SubsetCount(Binomial(n, 2));
}

export function TournamentRank(e: number[][], n: number): number {
  const edges = edgePairs(n);
  const bits = new Array(edges.length).fill(0);
  for (const [u, v] of e) {
    const idx = edgeIndexOf(edges, u, v);
    const [i, j] = edges[idx - 1];
    bits[idx - 1] = u === i && v === j ? 1 : 2;
  }
  return TupleRank(bits, 2);
}

export function TournamentUnrank(n: number, rank: number): number[][] {
  const edges = edgePairs(n);
  const bits = TupleUnrank(2, edges.length, rank);
  return edges.map(([i, j], k) => (bits[k] === 1 ? [i, j] : [j, i]));
}

// ─── Tournaments(n): orientations of K_n — for every edge, a direction. Count 2^C(n,2), reusing
// Tuples(2, C(n,2)) over the same edge order; element = the directed edge list [winner,loser]. ───
export function TournamentCount(n: number): number {
  return TupleCount(2, Binomial(n, 2));
}
