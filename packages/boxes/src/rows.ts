// What a `TableViewBox` asks of its rows (https://github.com/enumeratio/enumeratio/wiki/Speculative-Lazy-Grid, §2):
// a count that says how much it knows, and rows by range as boxes. Pure types and the arithmetic
// every environment shares; whatever holds the collection (a kernel, the page's engine) implements them.

import type { Box } from "./box.ts";
import { grid, tag, text } from "./box.ts";

/** How many rows there are, and how sure the source is. */
export type RowCount =
  | { readonly kind: "exact"; readonly n: bigint }
  // A scan in progress, or a walk that has not reached the end: at least `n`, at most `upper` when known.
  | { readonly kind: "atLeast"; readonly n: bigint; readonly upper?: bigint; readonly growing: boolean }
  | { readonly kind: "infinite" };

export interface ColumnSpec {
  readonly label: string;
  /** A width estimate, in em. */
  readonly width?: number;
  readonly numeric?: boolean;
}

/** Rows `[start, start + rows.length)` of the source's order, one `Box` per column asked for. */
export interface RowBatch {
  /** The source index of the first row: the one `At(collection, #)` reproduces (1-based). */
  readonly start: bigint;
  readonly rows: readonly (readonly Box[])[];
  /** The count as of this answer: a scan that found its end turns `atLeast` into `exact`. */
  readonly count: RowCount;
  /** The collection ended inside this range. */
  readonly end?: boolean;
  /** A scan spent its budget before it found the rows asked for: how far it has looked. */
  readonly stalled?: { readonly scanned: bigint };
  /** Why the source declines to answer (a sort of an infinite source, a collection with no order). */
  readonly declined?: string;
}

/** Half-open index range `[from, to)`, 1-based like `At`. */
export type IndexRange = readonly [from: bigint, to: bigint];

export interface RowSource {
  count(): RowCount;
  /** Rows of `range` and columns `[first, last)`; an aborted call rejects with the signal's reason. */
  rows(range: IndexRange, columns: readonly [first: number, last: number], signal?: AbortSignal): Promise<RowBatch>;
  /** `At` exists: any index costs what `At` costs. Otherwise a range past the walked prefix costs the walk. */
  readonly random: boolean;
  readonly columns: readonly ColumnSpec[];
  /** A row's height in em, a hint the drawer corrects by measuring. */
  readonly rowHeight?: number;
}

/** The count as a number: exact below 2^53, else the nearest double (for scroll extents). */
export const countNumber = (count: RowCount): number =>
  count.kind === "infinite" ? Number.POSITIVE_INFINITY : Number(count.n);

/** Whether the source has said all it knows: the count is exact. */
export const isSettled = (count: RowCount): boolean => count.kind === "exact";

/** `4,096`, with its sign of how sure: `≥ 4,096` for a lower bound, `∞` for infinite. */
export function describeCount(count: RowCount): string {
  if (count.kind === "infinite") return "∞";
  const n = describeBig(count.n);
  return count.kind === "exact" ? n : `≥ ${n}`;
}

const SUPER = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** A bigint with separators while it is a safe integer, else `≈ 1.55 × 10²⁵`. */
export function describeBig(n: bigint): string {
  if (n <= BigInt(Number.MAX_SAFE_INTEGER)) return n.toLocaleString("en-US");
  const digits = n.toString();
  const exponent = digits.length - 1;
  const mantissa = `${digits[0]}.${digits.slice(1, 3)}`;
  return `≈ ${mantissa} × 10${String(exponent)
    .split("")
    .map((d) => SUPER[Number(d)])
    .join("")}`;
}

/** What a pinned page leaves out, as a `Skeleton` row's text: `… 719,980 more`. */
export function skeletonText(shown: bigint, count: RowCount): string {
  if (count.kind === "infinite") return "…";
  const more = count.n - shown;
  if (count.kind === "exact") return more > 0n ? `… ${describeBig(more)} more` : "";
  return `… at least ${describeBig(more > 0n ? more : 0n)} more`;
}

/**
 * A pinned page as the plain `GridBox` a static environment draws: the header row, the rows,
 * then one `Skeleton` row for the rest (nothing when the source ended inside the page).
 */
export function pinnedPage(headers: readonly string[], batch: RowBatch): Box {
  const shown = batch.start - 1n + BigInt(batch.rows.length);
  const rest = batch.end === true ? "" : skeletonText(shown, batch.count);
  const width = Math.max(1, headers.length);
  const filler = (cell: Box): Box[] => [cell, ...Array.from({ length: width - 1 }, () => "")];
  return grid(
    [
      headers.map((h) => tag(text(h), "ColumnHeader")),
      ...batch.rows.map((row) => [...row]),
      ...(rest === "" ? [] : [filler(tag(text(rest), "Skeleton"))]),
    ],
    { GridBoxDividers: "All" },
  );
}
