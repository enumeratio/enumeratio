// Shared setup and reference helpers for the map.test.ts shards (map-*.test.ts). Pulled out
// so each shard pays for its own engine instance without duplicating the reference algorithms.
import { ComputeEngine } from "@cortex-js/compute-engine";
import { ALL_STATISTICS, declareStatistics } from "@enumeratio/statistics/src";
import { declareDomains } from "../src/declare.ts";
import { DOMAINS } from "../src/domain-data.ts";
import { declareMaps, MAPS } from "../src/map.ts";

export { DOMAINS, MAPS };

const domainTypes = Object.fromEntries(DOMAINS.map((d) => [d.name, d.type]));
const constructorFor = Object.fromEntries(DOMAINS.map((d) => [d.type, d.name]));

export const ce = new ComputeEngine();
declareDomains(ce);
declareStatistics(ce, ALL_STATISTICS, { domainTypes });
declareMaps(ce, constructorFor);

export const perm = (...entries: number[]): unknown => ["Permutation", ["List", ...entries]];
/** The contents of a map's result — the list inside the constructor. */
export const result = (expr: unknown): unknown => {
  const evaluated = ce.box(expr as never).evaluate();
  const [contents] = (evaluated as unknown as { ops?: { json: unknown }[] }).ops ?? [];
  return contents?.json;
};

export function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1))
    for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), n, ...rest.slice(i)]);
  return out;
}
export const ALL = [1, 2, 3, 4, 5].flatMap(permutations);

/** The permutation's cycles, each as its forward orbit [start, p(start), p(p(start)), …]. */
export function cyclesOf(p: number[]): number[][] {
  const n = p.length;
  const seen = new Array<boolean>(n + 1).fill(false);
  const cycles: number[][] = [];
  for (let start = 1; start <= n; start++) {
    if (seen[start]) continue;
    const cycle: number[] = [];
    let at = start;
    do {
      seen[at] = true;
      cycle.push(at);
      at = p[at - 1]!;
    } while (at !== start);
    cycles.push(cycle);
  }
  return cycles;
}
export const cycleTypeOf = (p: number[]): number[] =>
  cyclesOf(p)
    .map((c) => c.length)
    .sort((a, b) => b - a);
export const conjugateOf = (parts: number[]): number[] => {
  const max = Math.max(0, ...parts);
  return Array.from({ length: max }, (_, k) => parts.filter((part) => part >= k + 1).length);
};
/** Cycles in decreasing length, filled with consecutive integers, each cycle written as a
 *  cyclic left-shift of its block — the convention ConjugacyClassRepresentative documents. */
export function canonicalRepresentative(p: number[]): number[] {
  const word: number[] = [];
  let start = 1;
  for (const len of cycleTypeOf(p)) {
    for (let k = 0; k < len; k++) word.push(k < len - 1 ? start + k + 1 : start);
    start += len;
  }
  return word;
}
/** Foata's first fundamental transformation: each cycle rotated to start at its own maximum,
 *  cycles ordered by increasing maximum, parentheses erased. */
export function foataOf(p: number[]): number[] {
  const rotated = cyclesOf(p).map((cycle) => {
    const maxAt = cycle.indexOf(Math.max(...cycle));
    return [...cycle.slice(maxAt), ...cycle.slice(0, maxAt)];
  });
  rotated.sort((a, b) => a[0]! - b[0]!);
  return rotated.flat();
}
export const leftToRightMaxima = (word: number[]): number =>
  word.filter((v, i) => word.slice(0, i).every((w) => w < v)).length;

/** Every restricted growth string of length n — i.e. every set partition of [n], in the
 *  canonical encoding (block label = rank of first appearance). */
export function restrictedGrowthStrings(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  const build = (rgs: number[], maxSoFar: number): void => {
    if (rgs.length === n) {
      out.push([...rgs]);
      return;
    }
    for (let label = 1; label <= maxSoFar + 1; label++) {
      rgs.push(label);
      build(rgs, Math.max(maxSoFar, label));
      rgs.pop();
    }
  };
  build([], 0);
  return out;
}
