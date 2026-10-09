// The arithmetic of a lazy grid's drawer (https://github.com/enumeratio/enumeratio/wiki/Speculative-Lazy-Grid, §3): which rows
// a viewport shows and asks for, the blocks they are cached in, which blocks to drop, and how a
// scroll position maps to a row when the content is taller than a browser will scroll. Pure, so
// the web element and the terminal pager share it and a test needs no document.

import { describeBig, type IndexRange, type RowCount } from "@enumeratio/boxes";

/** Rows per cache block: aligned, so overlapping requests share. */
export const BLOCK_ROWS = 64n;
/** Rows past the viewport, either side, that are drawn and asked for. */
export const BUFFER_ROWS = 10;
/** A request is never for fewer rows than this (rounded up to whole blocks anyway)... */
export const MIN_ROWS_PER_REQUEST = 25;
/** ...nor more than this, so a jump far into a sequential source asks in steps. */
export const MAX_ROWS_PER_REQUEST = 250;
/** Blocks further than this many viewports from the view are dropped. */
export const FAR_OFF_VIEWPORTS = 2;
/** The tallest scroll area, in px; browsers cap an element somewhere between 17M and 33M. */
export const MAX_SCROLL_PX = 8_000_000;
/** Viewports of runway past what an unknown or infinite count has shown. */
export const RUNWAY_VIEWPORTS = 3;

/** The block (0-based) that holds source index `index` (1-based). */
export const blockOf = (index: bigint): bigint => (index - 1n) / BLOCK_ROWS;

/** Source indices `[from, to)` of block `block`. */
export const blockRange = (block: bigint): IndexRange => [block * BLOCK_ROWS + 1n, (block + 1n) * BLOCK_ROWS + 1n];

const max = (a: bigint, b: bigint): bigint => (a > b ? a : b);
const min = (a: bigint, b: bigint): bigint => (a < b ? a : b);

/** The last index + 1 a count allows, or `undefined` when it has no end yet. */
export function endOf(count: RowCount): bigint | undefined {
  return count.kind === "exact" ? count.n + 1n : undefined;
}

/** Rows `[from, to)` drawn for a view that starts at `top` and shows `visible` rows, with the buffer either side. */
export function windowOf(top: bigint, visible: number, count: RowCount, buffer = BUFFER_ROWS): IndexRange {
  const from = max(1n, top - BigInt(buffer));
  const to = top + BigInt(visible + buffer);
  const end = endOf(count);
  return [from, end === undefined ? to : min(to, max(end, from))];
}

/** The blocks that rows `[from, to)` touch, in order. */
export function blocksIn([from, to]: IndexRange): bigint[] {
  if (to <= from) return [];
  const blocks: bigint[] = [];
  for (let b = blockOf(from); b <= blockOf(to - 1n); b++) blocks.push(b);
  return blocks;
}

/** Contiguous blocks as ranges, so one request carries a run of them (capped at `MAX_ROWS_PER_REQUEST`). */
export function rangesOf(blocks: readonly bigint[]): IndexRange[] {
  const ranges: IndexRange[] = [];
  const perRequest = BigInt(Math.max(1, Math.floor(MAX_ROWS_PER_REQUEST / Number(BLOCK_ROWS)))) * BLOCK_ROWS;
  for (const block of blocks.toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const [from, to] = blockRange(block);
    const last = ranges.at(-1);
    if (last !== undefined && last[1] === from && to - last[0] <= perRequest) ranges[ranges.length - 1] = [last[0], to];
    else ranges.push([from, to]);
  }
  return ranges;
}

/**
 * The blocks to drop: those further than `FAR_OFF_VIEWPORTS` viewports from the rows in view,
 * except any in `keep` (the one holding focus or the selection).
 */
export function farOff(
  cached: Iterable<bigint>,
  view: IndexRange,
  visible: number,
  keep: ReadonlySet<bigint> = new Set(),
): bigint[] {
  const reach = BigInt(Math.max(1, visible) * FAR_OFF_VIEWPORTS);
  const near = [blockOf(max(1n, view[0] - reach)), blockOf(max(1n, view[1] + reach))] as const;
  return [...cached].filter((b) => (b < near[0] || b > near[1]) && !keep.has(b));
}

/** Rows of a viewport `heightPx` tall, at `rowPx` a row (at least one). */
export const visibleRows = (heightPx: number, rowPx: number): number =>
  Math.max(1, Math.ceil(heightPx / Math.max(1, rowPx)));

/** How many rows of scroll extent a count gives: its own, or what has been seen plus a runway. */
export function extentRows(count: RowCount, furthest: bigint, visible: number): number {
  if (count.kind === "exact") return Number(count.n);
  const seen = count.kind === "atLeast" && count.n > furthest ? count.n : furthest;
  return Number(seen) + visible * RUNWAY_VIEWPORTS;
}

/** The scroll area for `rows` rows: its height, and whether the browser's cap makes it a scaled one. */
export function scrollAreaPx(rows: number, rowPx: number): { px: number; scaled: boolean } {
  const px = rows * rowPx;
  return px <= MAX_SCROLL_PX ? { px, scaled: false } : { px: MAX_SCROLL_PX, scaled: true };
}

/**
 * The first row in view for a scroll position. A native area maps `scrollTop` to rows exactly;
 * a scaled one maps its fraction onto the rows past the last full viewport, so a thumb at the
 * bottom is the last row. Fine motion in a scaled area is by row (wheel, arrows), never pixels.
 */
export function topAt(
  scrollTop: number,
  area: { px: number; scaled: boolean },
  rows: number,
  rowPx: number,
  visible: number,
): bigint {
  if (!area.scaled) return BigInt(Math.floor(scrollTop / rowPx)) + 1n;
  const travel = Math.max(1, area.px - visible * rowPx);
  const fraction = Math.min(1, Math.max(0, scrollTop / travel));
  return BigInt(Math.round(fraction * Math.max(0, rows - visible))) + 1n;
}

/** The inverse of `topAt`: where to put the scroll position so `top` is the first row in view. */
export function scrollTopFor(
  top: bigint,
  area: { px: number; scaled: boolean },
  rows: number,
  rowPx: number,
  visible: number,
): number {
  if (!area.scaled) return Number(top - 1n) * rowPx;
  const travel = Math.max(1, area.px - visible * rowPx);
  return (Number(top - 1n) / Math.max(1, rows - visible)) * travel;
}

/** A row index for a line with little room: separators while it is short, else `1.55 × 10²⁵`. */
export function compactIndex(x: bigint): string {
  return x.toString().length <= COMPACT_DIGITS ? x.toLocaleString("en-US") : describeBig(x).replace(/^≈ /, "");
}

/** Digits a row index may have before the status line writes it in scientific form. */
const COMPACT_DIGITS = 12;

/**
 * `rows 1,201–1,220 of ≥ 4,096` for the status line and the live region; `compact` writes a
 * long index in scientific form so the line fits (the full text belongs in a `title`).
 */
export function statusText(first: bigint, last: bigint, total: string, compact = false): string {
  const n = compact ? compactIndex : (x: bigint): string => x.toLocaleString("en-US");
  return `rows ${n(first)}–${n(last)} of ${total}`;
}

/** An index typed into a jump field: digits, with separators allowed; `undefined` for anything else. */
export function parseIndex(text: string): bigint | undefined {
  const digits = text.trim().replaceAll(/[,_\s]/g, "");
  if (!/^\d+$/.test(digits)) return undefined;
  const n = BigInt(digits);
  return n >= 1n ? n : undefined;
}

/** Clamp a row index into `[1, count]` where the count is known. */
export function clampIndex(index: bigint, count: RowCount): bigint {
  const end = endOf(count);
  const floored = max(1n, index);
  return end === undefined ? floored : min(floored, max(1n, end - 1n));
}
