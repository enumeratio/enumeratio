// A distribution's side of a kernel: ask for `Tally(CombinatorialStat(collection, "Stat"))` by the
// page's kernel, else the page's engine, and read it. Computed on demand, never stored; a
// collection past the caps declines with a reason rather than walking.

import {
  declineReason,
  type DistributionResult,
  distributionText,
  equidistributed,
  parseFor,
  readTally,
  triangleOf,
  type Triangle,
} from "@enumeratio/frontend/core";
import { pageKernel, WorkerUnavailableError } from "./kernel-client.ts";

export { equidistributed, type Triangle };

/** `text` (Epsil) evaluated, as MathJSON: by the page's kernel, else the page's engine. */
export async function evaluateText(text: string): Promise<unknown> {
  const ask = pageKernel();
  if (ask !== undefined) {
    try {
      const answer = await ask({ source: { text, format: "epsil" } });
      if (answer.error !== undefined) throw new Error(answer.error);
      return answer.value;
    } catch (err) {
      if (!(err instanceof WorkerUnavailableError)) throw err;
    }
  }
  const { parseExpression } = await import("@enumeratio/formats/expression");
  const { engine, parsed } = await parseFor((ce) =>
    parseExpression(text, { ce, parseLatex: (tex) => ce.parse(tex).json }),
  );
  if (parsed.errors.length > 0) throw new Error(parsed.errors.join("; "));
  return engine.box(parsed.json as never).evaluate().json;
}

/** Asks for the value of an Epsil text; the table's `evaluate` property swaps it (a test, a host). */
export type Evaluate = (text: string) => Promise<unknown>;

/** The element count of a collection, when the engine can say without walking it. */
async function countOf(collection: string, evaluate: Evaluate): Promise<bigint | undefined> {
  try {
    const json = await evaluate(`Count(${collection})`);
    const n = typeof json === "number" ? json : (json as { num?: string } | null)?.num;
    return n === undefined ? undefined : BigInt(n);
  } catch {
    return undefined;
  }
}

export interface TallyLimits {
  /** The collection's size parameter, for the size cap. */
  readonly size?: number;
  /** The largest size a distribution is computed at; 0 or absent for no size cap. */
  readonly maxSize?: number;
  /** The element count, when known; else it is asked for. */
  readonly count?: bigint;
}

/** The distribution of `statistic` over `collection`, or why there is none. */
export async function tally(
  collection: string,
  statistic: string,
  limits: TallyLimits = {},
  evaluate: Evaluate = evaluateText,
): Promise<DistributionResult> {
  // The size cap needs no engine: check it before asking for a count.
  const early = declineReason(limits);
  if (early !== undefined) return { ok: false, reason: early };
  const count = limits.count ?? (await countOf(collection, evaluate));
  const reason = declineReason({ ...limits, ...(count !== undefined && { count }) });
  if (reason !== undefined) return { ok: false, reason };
  // A tally walks every element: one whose size cannot be told is not started.
  if (count === undefined) return { ok: false, reason: "the collection's size is not known, so it is not walked" };
  try {
    return readTally(await evaluate(distributionText(collection, statistic)));
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * The statistic's distribution at each of `sizes` (`Permutations({size})`): a triangle, stopping
 * at the first size that declines.
 */
export function distributionTriangle(
  template: string,
  statistic: string,
  sizes: readonly number[],
  options: { readonly maxSize?: number; readonly progress?: (n: number) => void; readonly evaluate?: Evaluate } = {},
): Promise<Triangle> {
  return triangleOf(
    template,
    sizes,
    (collection, size) =>
      tally(collection, statistic, { size, ...(options.maxSize && { maxSize: options.maxSize }) }, options.evaluate),
    options.progress,
  );
}
