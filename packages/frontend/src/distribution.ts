// The distribution of a statistic over a collection, and the triangle of them over sizes: what
// the table's distribution pane and a statistic's page draw. DOM-free; a host asks its engine
// for `Tally(CombinatorialStat(collection, "Stat"))` and reads the answer here. Nothing is stored:
// every tally is computed on demand, so each is capped to a size a browser can walk.

import { chartSvg } from "./chart.ts";
import { exprAt } from "./table-state.ts";

/** The most rows a distribution walks: a tally forces the whole collection (`SymmetricGroup(9)` is 362880). */
export const DISTRIBUTION_ROW_CAP = 100_000;

/** The value counts of a statistic, ascending by value. */
export interface Distribution {
  readonly values: readonly number[];
  readonly counts: readonly number[];
}

/** A distribution, or why there is none. */
export type DistributionResult =
  | { readonly ok: true; readonly distribution: Distribution }
  | { readonly ok: false; readonly reason: string };

/** The call whose value is the distribution, in Epsil. */
export const distributionText = (collection: string, statistic: string): string =>
  `Tally(CombinatorialStat(${collection}, "${statistic}"))`;

/** Why a collection is too large to tally, or `undefined` when it is not. */
export function declineReason(limits: {
  readonly size?: number;
  readonly maxSize?: number;
  readonly count?: bigint;
  readonly rowCap?: number;
}): string | undefined {
  const { size, maxSize, count, rowCap = DISTRIBUTION_ROW_CAP } = limits;
  if (size !== undefined && maxSize !== undefined && maxSize > 0 && size > maxSize)
    return `a distribution is computed up to size ${maxSize}; this is size ${size}`;
  if (count !== undefined && count > BigInt(rowCap))
    return `a distribution walks every element; ${count.toLocaleString("en-US")} is past the ${rowCap.toLocaleString("en-US")} it takes`;
  return undefined;
}

const num = (json: unknown): number | undefined => {
  if (typeof json === "number") return json;
  if (typeof json === "object" && json !== null && "num" in json) return Number((json as { num: string }).num);
  return undefined;
};

const listOf = (json: unknown): unknown[] | undefined =>
  Array.isArray(json) && json[0] === "List" ? json.slice(1) : undefined;

/**
 * `Tally`'s answer -- `Tuple(values, counts)` -- as a distribution, ascending by value. A
 * statistic that is not a number (a list, a word) has no histogram: it declines.
 */
export function readTally(json: unknown): DistributionResult {
  const parts = Array.isArray(json) && (json[0] === "Tuple" || json[0] === "Pair") ? json.slice(1) : undefined;
  const values = listOf(parts?.[0])?.map(num);
  const counts = listOf(parts?.[1])?.map(num);
  if (values === undefined || counts === undefined || values.length !== counts.length)
    return { ok: false, reason: "the statistic has no tally" };
  if (!values.every((v) => v !== undefined && Number.isFinite(v)) || !counts.every((c) => c !== undefined))
    return { ok: false, reason: "the statistic is not a number, so it has no distribution" };
  const order = values.map((_, i) => i).toSorted((a, b) => values[a]! - values[b]!);
  return {
    ok: true,
    distribution: { values: order.map((i) => values[i]!), counts: order.map((i) => counts[i]!) },
  };
}

/** Value -> count, with the values that never occur as zero: the polynomial's coefficients, lowest first. */
export function coefficients(d: Distribution): number[] {
  const low = d.values[0] ?? 0;
  const out: number[] = Array.from({ length: (d.values.at(-1) ?? low) - low + 1 }, () => 0);
  d.values.forEach((v, i) => (out[v - low] = d.counts[i]!));
  return out;
}

/** The distribution as a generating polynomial in `q`: `1 + 3q + 5q^2 + …`. */
export function polynomial(d: Distribution, variable = "q"): string {
  const low = d.values[0] ?? 0;
  return (
    d.values
      .map((v, i) => {
        const c = d.counts[i]!;
        const power = v === 0 ? "" : v === 1 ? variable : `${variable}^${v}`;
        return v === 0 ? String(c) : c === 1 ? power : `${c}${power}`;
      })
      .join(" + ") || String(low)
  );
}

/** The distribution drawn: a bar per value (zeros between included), labeled by the value. */
export function distributionSvg(d: Distribution, title?: string): string {
  const low = d.values[0] ?? 0;
  const bars = coefficients(d);
  return chartSvg("bar", bars, {
    labels: bars.map((_, i) => String(low + i)),
    ...(title !== undefined && { title }),
  });
}

/** One row of a triangle: the size and what the statistic does at it, or why it does nothing. */
export type TriangleRow = { readonly n: number } & DistributionResult;

/** Every statistic's rows, by size. */
export type Triangle = readonly TriangleRow[];

/** The sizes a triangle covers: from `min` up to `max`, or the first to decline. */
export function triangleSizes(min: number, max: number): number[] {
  return Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
}

/** Row `n` of `exprTemplate` (`Permutations({size})`) tallied by `tally`, which sees the collection text. */
export async function triangleOf(
  template: string,
  sizes: readonly number[],
  tally: (collection: string, n: number) => Promise<DistributionResult>,
  progress?: (n: number) => void,
): Promise<Triangle> {
  const rows: TriangleRow[] = [];
  for (const n of sizes) {
    const row = await tally(exprAt(template, n), n);
    rows.push({ n, ...row });
    progress?.(n);
    // Every size above one that declines is as large: stop rather than ask again.
    if (!row.ok) break;
  }
  return rows;
}

/** The rows that have a distribution, keyed by size. */
const tallied = (t: Triangle): Map<number, Distribution> =>
  new Map(t.flatMap((r) => (r.ok ? [[r.n, r.distribution] as const] : [])));

const sameCounts = (a: Distribution, b: Distribution): boolean => {
  const x = coefficients(a);
  const y = coefficients(b);
  return (a.values[0] ?? 0) === (b.values[0] ?? 0) && x.length === y.length && x.every((c, i) => c === y[i]);
};

/**
 * Whether two statistics are equidistributed over the sizes both were computed at: equal
 * distribution at each. `false` with no size in common -- nothing was compared.
 */
export function equidistributed(a: Triangle, b: Triangle): boolean {
  const left = tallied(a);
  const right = tallied(b);
  const common = [...left.keys()].filter((n) => right.has(n));
  return common.length > 0 && common.every((n) => sameCounts(left.get(n)!, right.get(n)!));
}
