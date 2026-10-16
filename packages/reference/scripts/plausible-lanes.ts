// How Plausible runs one oracle lane: its time budget, and the verdict arguments it shares with the scan.

import type { MathJSON, System } from "@enumeratio/oracle";
import { asksForDigits, type verdictOf } from "./oracle-verdict.ts";

/** Minutes a lane may spend when its own entry below doesn't say. */
export const DEFAULT_LANE_MINUTES = 8;

/** Lanes whose nightly job has less to spare than the Python one: each job's 30 minutes also
 * hold its install and its rescan, so a sample budget is kept well inside what is left. */
const LANE_MINUTES: Partial<Record<System, number>> = {
  rust: 5,
  julia: 8,
};

/** One lane's sample budget in minutes: `override` (the `--lane-minutes` option) for every
 * lane, else the lane's own, else the default. */
export function laneMinutes(system: System, override?: string): number {
  if (override !== undefined) {
    const minutes = Number(override);
    if (!Number.isFinite(minutes) || minutes <= 0) throw new Error(`--lane-minutes must be positive: ${override}`);
    return minutes;
  }
  return LANE_MINUTES[system] ?? DEFAULT_LANE_MINUTES;
}

/** What the scan hands `verdictOf` for an example, for a sample: the same judgement, so a lane's
 * own rules apply to a sample as to a documented example (Rust's relative-only doubles and exact
 * integers, the digits an `N(x, d)` shows). A tolerance a template earned is its own, so none is passed. */
export const verdictArguments = (
  system: System,
  sample: MathJSON,
  expected: MathJSON,
  result: Parameters<typeof verdictOf>[2],
): Parameters<typeof verdictOf> => [system, expected, result, undefined, asksForDigits(sample), sample];

/** FNV-1a: a small stable string hash. */
export const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** `items` in an order seeded by the night and the lane: a lane that can't finish in its budget
 * (Julia runs about one sample in eight) then samples a different slice each night, not the same
 * leading templates every time. */
export const inLaneOrder = <T>(items: readonly T[], seed: string, system: System, id: (item: T) => string): T[] =>
  items.toSorted((a, b) => hash(`${seed}/${system}/${id(a)}`) - hash(`${seed}/${system}/${id(b)}`));
