// The lazy grid's arithmetic (https://github.com/enumeratio/enumeratio/wiki/Speculative-Lazy-Grid): windows, blocks,
// eviction, and the scroll mapping when the content is taller than a browser will scroll.

import type { RowCount } from "@enumeratio/boxes";
import { expect, test } from "vite-plus/test";
import { BOX_TAG_HEADS, BOX_TAGS, boxTag } from "../src/box-tags.ts";
import {
  BLOCK_ROWS,
  blockOf,
  blockRange,
  blocksIn,
  clampIndex,
  extentRows,
  farOff,
  MAX_SCROLL_PX,
  parseIndex,
  rangesOf,
  scrollAreaPx,
  scrollTopFor,
  statusText,
  topAt,
  windowOf,
} from "../src/table-view.ts";

const exact = (n: bigint): RowCount => ({ kind: "exact", n });
const open: RowCount = { kind: "atLeast", n: 100n, growing: true };

test("a box head's tag is kebab case, broken before capitals and runs of digits", () => {
  expect(boxTag("RowBox")).toBe("row-box");
  expect(boxTag("TableViewBox")).toBe("table-view-box");
  expect(boxTag("Graphics3DBox")).toBe("graphics-3d-box");
  expect(boxTag("GraphicsComplexBox")).toBe("graphics-complex-box");
});

test("every box head named …Box has a tag that meets the custom-element hyphen rule, and no two share one", () => {
  expect(BOX_TAG_HEADS).toContain("TableViewBox");
  expect(BOX_TAGS.every((tag) => /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(tag))).toBe(true);
  expect(new Set(BOX_TAGS).size).toBe(BOX_TAGS.length);
});

test("rows are cached in aligned blocks of 64", () => {
  expect(BLOCK_ROWS).toBe(64n);
  expect(blockOf(1n)).toBe(0n);
  expect(blockOf(64n)).toBe(0n);
  expect(blockOf(65n)).toBe(1n);
  expect(blockRange(1n)).toEqual([65n, 129n]);
  // The last row of SymmetricGroup(25) is in a block no double can name, but a bigint can.
  const last = 15511210043330985984000000n;
  expect(blockRange(blockOf(last))[0] <= last && last < blockRange(blockOf(last))[1]).toBe(true);
});

test("the window is the viewport plus a buffer, clamped to the rows there are", () => {
  expect(windowOf(1n, 20, exact(1000n))).toEqual([1n, 31n]);
  expect(windowOf(500n, 20, exact(1000n))).toEqual([490n, 530n]);
  expect(windowOf(990n, 20, exact(1000n))).toEqual([980n, 1001n]);
  // No end yet: the window runs on.
  expect(windowOf(990n, 20, open)).toEqual([980n, 1020n]);
});

test("blocks in a window are asked for as runs, a request at most a few blocks long", () => {
  expect(blocksIn([1n, 31n])).toEqual([0n]);
  expect(blocksIn([60n, 70n])).toEqual([0n, 1n]);
  expect(blocksIn([5n, 5n])).toEqual([]);
  expect(rangesOf([0n, 1n])).toEqual([[1n, 129n]]);
  // A gap makes two requests; a long run is cut at the per-request cap (250 rows: three blocks).
  expect(rangesOf([0n, 5n])).toEqual([
    [1n, 65n],
    [321n, 385n],
  ]);
  expect(rangesOf([0n, 1n, 2n, 3n, 4n])).toEqual([
    [1n, 193n],
    [193n, 321n],
  ]);
});

test("blocks far from the view are dropped, except the one holding focus", () => {
  const cached = [0n, 1n, 50n, 100n];
  const view = [3200n, 3230n] as const; // block 50
  expect(farOff(cached, view, 20)).toEqual([0n, 1n, 100n]);
  expect(farOff(cached, view, 20, new Set([0n]))).toEqual([1n, 100n]);
});

test("a count that is exact scrolls to its own extent; a lower bound or infinite gets a runway", () => {
  expect(extentRows(exact(1000n), 0n, 20)).toBe(1000);
  expect(extentRows({ kind: "infinite" }, 500n, 20)).toBe(560);
  expect(extentRows(open, 30n, 20)).toBe(160);
  expect(extentRows(open, 1000n, 20)).toBe(1060);
});

test("a scroll area under the cap maps pixels to rows exactly", () => {
  const area = scrollAreaPx(10_000, 30);
  expect(area).toEqual({ px: 300_000, scaled: false });
  expect(topAt(0, area, 10_000, 30, 20)).toBe(1n);
  expect(topAt(3000, area, 10_000, 30, 20)).toBe(101n);
  expect(scrollTopFor(101n, area, 10_000, 30, 20)).toBe(3000);
});

test("past the cap the area is scaled, the thumb at the bottom is the last row, and the mapping round-trips", () => {
  const rows = 1e9;
  const area = scrollAreaPx(rows, 30);
  expect(area).toEqual({ px: MAX_SCROLL_PX, scaled: true });
  expect(topAt(0, area, rows, 30, 20)).toBe(1n);
  const bottom = MAX_SCROLL_PX - 20 * 30;
  expect(topAt(bottom, area, rows, 30, 20)).toBe(BigInt(rows - 20) + 1n);
  const top = 123_456_789n;
  const back = topAt(scrollTopFor(top, area, rows, 30, 20), area, rows, 30, 20);
  // A pixel is thousands of rows here, which is why wheel and arrows move by row.
  expect(Math.abs(Number(back - top))).toBeLessThan(rows / MAX_SCROLL_PX + 2);
});

test("an index typed into a jump field takes separators and stays exact past 2^53", () => {
  expect(parseIndex("1,201")).toBe(1201n);
  expect(parseIndex(" 15511210043330985984000000 ")).toBe(15511210043330985984000000n);
  expect(parseIndex("0")).toBeUndefined();
  expect(parseIndex("1.5")).toBeUndefined();
  expect(parseIndex("")).toBeUndefined();
  expect(clampIndex(5000n, exact(1000n))).toBe(1000n);
  expect(clampIndex(5000n, open)).toBe(5000n);
  expect(clampIndex(-3n, open)).toBe(1n);
});

test("the status line reads the window and how sure the count is", () => {
  expect(statusText(1201n, 1220n, "≥ 4,096")).toBe("rows 1,201–1,220 of ≥ 4,096");
  expect(statusText(1n, 20n, "∞")).toBe("rows 1–20 of ∞");
});
