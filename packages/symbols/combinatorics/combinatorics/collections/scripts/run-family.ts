// One family's Plausible run, as a pure function over its derived instance (sampleable.ts):
// the size ramps from 0 to `maxSize` across the points, each point draws an address (retrying a
// discard up to `retries` times), and the properties run there. A failure shrinks along the
// address before it's reported. Nothing here knows any family by name.

import { sizeAt, streamFor } from "@enumeratio/plausible";
import type { FamilyKernel } from "../src/families/types.ts";
import { check, checkFamily, type Failure } from "./properties.ts";
import { type Address, sampleable, type Sampleable } from "./sampleable.ts";

export interface RunOptions {
  readonly seed: number;
  readonly points: number;
  readonly maxSize: number;
  /** Elements an enumerating kernel may generate for one draw. */
  readonly budget: bigint;
  readonly retries: number;
}

export interface FamilyReport {
  readonly head: string;
  readonly declared: boolean;
  readonly checked: number;
  readonly failures: Failure[];
  /** Why draws were discarded, and how often. */
  readonly discards: Record<string, number>;
}

/** Called before each check, so a supervisor that has to kill a run knows where it was. */
export type Progress = (address: string) => void;

export function runFamily(family: FamilyKernel, options: RunOptions, progress: Progress = () => {}): FamilyReport {
  const instance = sampleable(family);
  const report = {
    head: family.head,
    declared: family.declared !== undefined,
    checked: 0,
    failures: [] as Failure[],
    discards: {} as Record<string, number>,
  };
  if ("untestable" in instance) {
    report.failures.push({
      family: family.head,
      property: "contract",
      params: [],
      rank: -1n,
      detail: instance.untestable,
    });
    return report;
  }
  const rng = streamFor(options.seed, family.head);
  const familyChecked = new Set<string>();

  for (let point = 0; point < options.points; point++) {
    const size = sizeAt(point, options.points, options.maxSize);
    let address: Address | undefined;
    for (let attempt = 0; attempt <= options.retries && address === undefined; attempt++) {
      let draw;
      try {
        draw = instance.draw(rng, size, options.budget);
      } catch (error) {
        report.failures.push({
          family: family.head,
          property: "count",
          params: [],
          rank: -1n,
          detail: `count threw: ${String(error).slice(0, 120)}`,
        });
        return report;
      }
      if ("discard" in draw) report.discards[draw.discard] = (report.discards[draw.discard] ?? 0) + 1;
      else address = draw.address;
    }
    if (address === undefined) continue;

    progress(instance.show(address));
    const key = address.params.join(",");
    const familyFailure = familyChecked.has(key)
      ? undefined
      : finite(family, address.params)
        ? checkFamily(family, address.params, rng)
        : undefined;
    familyChecked.add(key);
    const failure = familyFailure ?? check(family, address.params, address.rank);
    report.checked++;
    if (failure !== undefined) {
      report.failures.push(shrinkFailure(instance, failure, options.budget));
      return report;
    }
  }
  return report;
}

const finite = (family: FamilyKernel, params: number[]): boolean => typeof family.count(params) === "bigint";

/** Greedy shrink along the address: take the first smaller address that fails the same way. */
function shrinkFailure(instance: Sampleable, failure: Failure, budget: bigint): Failure {
  const { family } = instance;
  let best = failure;
  const bestAddress = (): Address => ({ params: best.params, rank: best.rank < 0n ? 0n : best.rank });
  for (let steps = 0; steps < 200; steps++) {
    const next = instance.shrink(bestAddress()).find((candidate) => {
      const smaller = recheck(instance, candidate, best, budget);
      if (smaller === undefined) return false;
      best = smaller;
      return true;
    });
    if (next === undefined) break;
  }
  return best;

  function recheck(inst: Sampleable, candidate: Address, current: Failure, cap: bigint): Failure | undefined {
    let count: bigint | number;
    try {
      count = family.count(candidate.params);
    } catch {
      return undefined;
    }
    if (typeof count === "bigint") {
      if (count <= 0n) return undefined;
      const work = inst.declared?.work?.(candidate.params) ?? count;
      if (work > cap) return undefined;
    }
    const rank = typeof count === "bigint" && candidate.rank >= count ? count - 1n : candidate.rank;
    const again =
      current.rank < 0n
        ? typeof count === "bigint"
          ? checkFamily(family, candidate.params, streamFor(0, family.head))
          : undefined
        : check(family, candidate.params, rank);
    return again?.property === current.property ? again : undefined;
  }
}
