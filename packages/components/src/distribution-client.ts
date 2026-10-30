// A distribution's side of a kernel: ask for `Tally(CombinatorialStat(collection, "Stat"))` by the
// page's kernel, else the page's engine, and read it. Computed on demand, never stored; a
// collection past the caps declines with a reason rather than walking.

import {
  declineReason,
  type DistributionResult,
  distributionText,
  equidistributed,
  exprAt,
  parseFor,
  readTally,
  triangleOf,
  type Triangle,
  type TriangleRow,
} from "@enumeratio/frontend/core";
import { pageKernel, WorkerUnavailableError } from "./kernel-client.ts";

export { equidistributed, type Triangle };

/** The time `findEquidistributed` spends before it stops. */
export const DEFAULT_BUDGET_MS = 30_000;

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

export interface EquidistributionResult {
  /** The statistics whose distribution equals the subject's at every size compared. */
  readonly matches: readonly string[];
  /** Candidates that equal the subject at the small sizes, but whose larger rows were not reached. */
  readonly unconfirmed: readonly string[];
  /** How many candidates were fully decided (matched, or rejected). */
  readonly checked: number;
  readonly total: number;
  /** True when the time budget ran out before every candidate was decided. */
  readonly stopped: boolean;
}

/** The scan's two phases: every candidate at the small sizes, then the survivors at the rest. */
export type EquidistributionPhase = "screen" | "confirm";

/** Sizes up to this are tallied for every candidate at once: `5! = 120` elements is a few milliseconds. */
export const SCREEN_SIZE = 5;

const sameAt = (row: TriangleRow, answer: DistributionResult): boolean =>
  equidistributed([row], [{ n: row.n, ...answer }]);

/** The tallies of `statistic` at `sizes`, as the Epsil that asks for all of them. */
const tallyCalls = (template: string, statistic: string, sizes: readonly number[]): string =>
  `List(${sizes.map((n) => distributionText(exprAt(template, n), statistic)).join(", ")})`;

/** A `List` of `length` entries, or `undefined`. */
const listOfLength = (json: unknown, length: number): unknown[] | undefined =>
  Array.isArray(json) && json[0] === "List" && json.length === length + 1 ? json.slice(1) : undefined;

/** Candidates per screening call: few enough that progress and the budget stay fine-grained. */
export const SCREEN_BATCH = 25;

/**
 * Each of `statistics`' tallies at each of `sizes`, in one call. A statistic that cannot be
 * tallied declines at every size, without the others noticing. If the call as a whole fails, the
 * statistics are asked one by one.
 */
async function tallyBatch(
  template: string,
  statistics: readonly string[],
  sizes: readonly number[],
  evaluate: Evaluate,
): Promise<DistributionResult[][]> {
  const declined = (reason: string): DistributionResult[] => sizes.map(() => ({ ok: false, reason }));
  const read = (entry: unknown): DistributionResult[] =>
    listOfLength(entry, sizes.length)?.map(readTally) ?? declined("the statistic has no tally");
  const one = async (statistic: string): Promise<DistributionResult[]> => {
    try {
      return read(await evaluate(tallyCalls(template, statistic, sizes)));
    } catch (err) {
      return declined(err instanceof Error ? err.message : String(err));
    }
  };
  if (statistics.length > 1) {
    try {
      const json = await evaluate(`List(${statistics.map((s) => tallyCalls(template, s, sizes)).join(", ")})`);
      const entries = listOfLength(json, statistics.length);
      if (entries !== undefined) return entries.map(read);
    } catch {
      // fall through: one at a time tells the bad statistic from the good
    }
    return Promise.all(statistics.map(one));
  }
  return Promise.all(statistics.map(one));
}

/**
 * Which of `candidates` have the subject's distribution at every size the subject has a row for.
 * Two phases, each reported through `progress`: the candidates are tallied at the sizes up to
 * `SCREEN_SIZE` a batch to a call, which drops nearly all of them for a few milliseconds each; the
 * survivors are then walked row by row up to the subject's largest, dropped at the first that
 * differs. The collection's size is known from the subject, so no tally asks for a count. The
 * whole scan stops when `budgetMs` is spent; survivors not yet confirmed are `unconfirmed`. The
 * subject needs at least `minRows` rows, else equal distributions at one or two sizes say nothing.
 */
export async function findEquidistributed(
  template: string,
  subject: Triangle,
  candidates: readonly string[],
  options: {
    readonly maxSize?: number;
    readonly minRows?: number;
    readonly budgetMs?: number;
    readonly progress?: (checked: number, total: number, phase: EquidistributionPhase) => void;
    readonly evaluate?: Evaluate;
    readonly now?: () => number;
  } = {},
): Promise<EquidistributionResult> {
  const { minRows = 3, budgetMs = DEFAULT_BUDGET_MS, now = Date.now, evaluate = evaluateText } = options;
  const rows = subject.filter((r) => r.ok);
  const total = candidates.length;
  if (rows.length < minRows) return { matches: [], unconfirmed: [], checked: 0, total, stopped: false };
  const started = now();
  const spent = (): boolean => now() - started > budgetMs;
  const small = rows.filter((r) => r.n <= SCREEN_SIZE);
  const large = rows.filter((r) => r.n > SCREEN_SIZE);
  const countOf = (row: TriangleRow): bigint =>
    row.ok ? BigInt(row.distribution.counts.reduce((a, c) => a + c, 0)) : 0n;

  let rejected = 0;
  const survivors: string[] = [];
  for (let i = 0; i < candidates.length; i += SCREEN_BATCH) {
    if (spent()) return { matches: [], unconfirmed: [], checked: rejected, total, stopped: true };
    const batch = candidates.slice(i, i + SCREEN_BATCH);
    const answers = await tallyBatch(
      template,
      batch,
      small.map((r) => r.n),
      evaluate,
    );
    batch.forEach((candidate, j) => {
      if (small.every((row, k) => sameAt(row, answers[j]![k]!))) survivors.push(candidate);
      else rejected++;
    });
    options.progress?.(rejected + survivors.length, total, "screen");
  }

  const matches: string[] = [];
  let done = 0;
  for (const candidate of survivors) {
    if (spent()) return { matches, unconfirmed: survivors.slice(done), checked: rejected + done, total, stopped: true };
    let same = true;
    for (const row of large) {
      const answer = await tally(
        exprAt(template, row.n),
        candidate,
        { size: row.n, count: countOf(row), ...(options.maxSize && { maxSize: options.maxSize }) },
        evaluate,
      );
      if (!sameAt(row, answer)) {
        same = false;
        break;
      }
    }
    if (same) matches.push(candidate);
    done++;
    options.progress?.(done, survivors.length, "confirm");
  }
  return { matches, unconfirmed: [], checked: total, total, stopped: false };
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
