// Tournaments/LabeledGraphs/LabeledGraphsByEdges split out of
// collections/src/families/tableaux-trees.ts (which mixed every area) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 -- lane A-92: all three now carry a carrier ("Tournament" / "LabeledGraph"), so they
// move out of collections per step 5's own rule (a family with NO carrier stays there; one WITH
// one belongs in its area). `carrierParams: 1` prefixes `n` onto the carrier's Tuple argument
// alongside the edge list (`Tournament(n, edges)`); `m` (LabeledGraphsByEdges' second param)
// stays out of the carrier, same as `Composition`'s own axis/param split.
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import { Binomial } from "../../../collections/src/families/kernels-combinatorics.ts";
import { KSubsetCount, KSubsetUnrank, KSubsetRank } from "../../../collections/src/families/kernels-extra.ts";
import { labeledGraphs, labeledGraphsByEdges, tournaments } from "./epsil.ts";

// ─── edge indexing shared by LabeledGraphs/LabeledGraphsByEdges/Tournaments: the C(n,2) unordered
// pairs of [n] in lexicographic order, so "which edges are present/oriented" reduces to an
// existing Subset/KSubset/Tuple kernel over the index space [1..C(n,2)]. ──────────────────────────
export function edgePairs(n: number): number[][] {
  const edges: number[][] = [];
  for (let i = 1; i < n; i++) for (let j = i + 1; j <= n; j++) edges.push([i, j]);
  return edges;
}
export function edgeIndexOf(edges: number[][], u: number, v: number): number {
  const [a, b] = u < v ? [u, v] : [v, u];
  for (let k = 0; k < edges.length; k++) if (edges[k][0] === a && edges[k][1] === b) return k + 1;
  return 0;
}

// ─── LabeledGraphs(n): simple undirected graphs on [n] — subsets of K_n's edges. Count 2^C(n,2).
// Element = edge list, matching LabeledTrees' convention. ─────────────────────────────────────────

export function IsLabeledGraphOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e)) return false;
  const edges = edgePairs(n);
  const seen = new Set<number>();
  for (const pair of e as unknown[]) {
    if (!Array.isArray(pair) || pair.length !== 2) return false;
    const [u, v] = pair as number[];
    if (!Number.isInteger(u) || !Number.isInteger(v) || u < 1 || v < 1 || u > n || v > n || u === v) return false;
    const idx = edgeIndexOf(edges, u, v);
    if (idx === 0 || seen.has(idx)) return false;
    seen.add(idx);
  }
  return true;
}

// Membership of a tournament, the one op of Tournaments that stays ahead of Epsil: Epsil's walks the
// edge list quadratically (seconds a call at n = 100, tens of seconds at 200); the rest is Epsil's.
export function IsTournamentOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== Binomial(n, 2)) return false;
  const edges = edgePairs(n);
  const seen = new Set<number>();
  for (const pair of e as unknown[]) {
    if (!Array.isArray(pair) || pair.length !== 2) return false;
    const [u, v] = pair as number[];
    if (!Number.isInteger(u) || !Number.isInteger(v) || u < 1 || v < 1 || u > n || v > n || u === v) return false;
    const idx = edgeIndexOf(edges, u, v);
    if (idx === 0 || seen.has(idx)) return false;
    seen.add(idx);
  }
  return true;
}

// ─── LabeledGraphsByEdges(n,m): the (n,m) refinement — graphs on [n] with exactly m edges. Same
// edge list as LabeledGraphs, just a KSubset instead of a Subset. ─────────────────────────────────
export function LabeledGraphByEdgesCount(n: number, m: number): number {
  return KSubsetCount(Binomial(n, 2), m);
}
export function LabeledGraphByEdgesUnrank(n: number, m: number, rank: number): number[][] {
  const edges = edgePairs(n);
  return KSubsetUnrank(edges.length, m, rank).map((i) => edges[i - 1]);
}
export function LabeledGraphByEdgesRank(e: number[][], n: number): number {
  const edges = edgePairs(n);
  const idx = e.map(([u, v]) => edgeIndexOf(edges, u, v));
  idx.sort((a, b) => a - b);
  return KSubsetRank(idx);
}
export function IsLabeledGraphByEdgesOf(e: unknown, n: number, m: number): boolean {
  return Array.isArray(e) && e.length === m && IsLabeledGraphOf(e, n);
}

// ─── Tournaments(n): orientations of K_n — for every edge, a direction. Count 2^C(n,2), reusing
// Tuples(2, C(n,2)) over the same edge order; element = the directed edge list [winner,loser]. ───
// The TS kernels above are the independent readings of each Epsil family (./epsil.ts) in tests/readings/,
// in the same order; only LabeledGraphsByEdges still runs ahead of its definition.
export const entries: EpsilFamily[] = [
  {
    ...tournaments,
    fast: {
      count: () => undefined,
      unrank: () => undefined,
      rank: () => undefined,
      valid: (e, [n]) => IsTournamentOf(e, n),
    },
  },
  labeledGraphs,
  {
    ...labeledGraphsByEdges,
    fast: {
      count: ([n, m]) => LabeledGraphByEdgesCount(n, m),
      unrank: ([n, m], r) => LabeledGraphByEdgesUnrank(n, m, r),
      rank: (e, [n]) => LabeledGraphByEdgesRank(e as number[][], n),
      valid: (e, [n, m]) => IsLabeledGraphByEdgesOf(e, n, m),
    },
  },
];
