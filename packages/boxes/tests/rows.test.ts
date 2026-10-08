import { expect, test } from "vite-plus/test";
import { fromMathJson, isBox, tableView, text, toMathJson } from "../src/index.ts";
import { describeBig, describeCount, pinnedPage, skeletonText } from "../src/rows.ts";
import { toText } from "../src/render/index.ts";

test("a count says how sure it is", () => {
  expect(describeCount({ kind: "exact", n: 4096n })).toBe("4,096");
  expect(describeCount({ kind: "atLeast", n: 4096n, growing: true })).toBe("≥ 4,096");
  expect(describeCount({ kind: "infinite" })).toBe("∞");
  expect(describeBig(15511210043330985984000000n)).toBe("≈ 1.55 × 10²⁵");
});

test("what a pinned page leaves out is a Skeleton row, by how much is known", () => {
  expect(skeletonText(20n, { kind: "exact", n: 720000n })).toBe("… 719,980 more");
  expect(skeletonText(20n, { kind: "atLeast", n: 4116n, growing: false })).toBe("… at least 4,096 more");
  expect(skeletonText(20n, { kind: "infinite" })).toBe("…");
  expect(skeletonText(5n, { kind: "exact", n: 5n })).toBe("");
});

test("a pinned page is a plain grid: headers, rows, then the Skeleton row", () => {
  const rows = [[text("a")], [text("b")]];
  const grid = pinnedPage(["x"], { start: 1n, rows, count: { kind: "exact", n: 10n } });
  expect(toText(grid)).toBe("{{x}, {a}, {b}, {… 8 more}}");
  // The source ended inside the page: nothing is left out.
  const whole = pinnedPage(["x"], { start: 1n, rows, count: { kind: "exact", n: 2n }, end: true });
  expect(toText(whole)).toBe("{{x}, {a}, {b}}");
});

test("a TableViewBox holds its source as an expression and survives the round trip through MathJSON", () => {
  const box = tableView(["RowSource", ["Range", 1, 5]] as never, {
    ScrollPosition: 3,
    TableViewBoxHeaders: ["a", "b"],
  });
  expect(isBox(box)).toBe(true);
  expect(fromMathJson(toMathJson(box))).toEqual(box);
});
