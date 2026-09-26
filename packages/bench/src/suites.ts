// Which tiers a run takes (design/benchmarking.md §3.3). Tiers are data on each case; a suite
// only chooses among them, so a case times the same whichever suite ran it.

import type { BenchCase, Tier } from "./types.ts";

export const SUITES = {
  quick: ["small"],
  standard: ["small", "medium"],
  deep: ["small", "medium", "large"],
} as const satisfies Record<string, readonly Tier[]>;

export type Suite = keyof typeof SUITES;

export const DEFAULT_TIER: Tier = "medium";

export const tierOf = (c: BenchCase): Tier => c.bench.tier ?? DEFAULT_TIER;

export function isSuite(name: string): name is Suite {
  return Object.hasOwn(SUITES, name);
}

export const inSuite = (c: BenchCase, suite: Suite): boolean => (SUITES[suite] as readonly Tier[]).includes(tierOf(c));
