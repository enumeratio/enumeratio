import { expect, test } from "vite-plus/test";
import {
  blocksToRgs,
  columnSource,
  compareCells,
  flatInts,
  formatCount,
  pageCount,
  splitColumns,
  substituteRow,
} from "../src/collection-table.ts";

test("columns split at top-level commas only", () => {
  expect(splitColumns("Descents, Part(_, 1), Max(_) - Min(_)")).toEqual([
    "Descents",
    "Part(_, 1)",
    "Max(_) - Min(_)",
  ]);
  expect(splitColumns("")).toEqual([]);
});

test("a bare head is shorthand for applying it to the row", () => {
  expect(columnSource("Descents")).toBe("Descents(_)");
  expect(columnSource("Length(_) + 1")).toBe("Length(_) + 1");
});

test("the row wildcard is substituted in both MathJSON encodings", () => {
  const row = ["List", 3, 1, 2] as const;
  expect(substituteRow(["Equal", ["Descents", "_"], 1], row)).toEqual([
    "Equal",
    ["Descents", row],
    1,
  ]);
  expect(
    substituteRow({ fn: ["Length", { sym: "_", sourceOffsets: [7, 8] }] } as never, row),
  ).toEqual({ fn: ["Length", row] });
});

test("counts are exact below 2^53 and flagged approximate above", () => {
  expect(formatCount(2432902008176640000)).toMatch(/^≈ 2\.43 × 10¹⁸$/);
  expect(formatCount(40320)).toBe("40,320");
  expect(pageCount(0, 20)).toBe(1);
  expect(pageCount(41, 20)).toBe(3);
});

test("cells sort numerically first, then by text", () => {
  const cells = [{ text: "b" }, { num: 3, text: "3" }, { text: "a" }, { num: -1, text: "-1" }];
  expect([...cells].sort(compareCells).map((c) => c.text)).toEqual(["-1", "3", "a", "b"]);
});

test("glyph adapters read flat lists and set-partition blocks", () => {
  expect(flatInts(["List", 2, 1])).toEqual([2, 1]);
  expect(flatInts(["List", ["List", 1], 2])).toBeUndefined();
  expect(blocksToRgs([[1, 2, 4], [3], [5]])).toEqual([0, 0, 1, 0, 2]);
});
