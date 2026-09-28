import { ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
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
  substituteRowPerHead,
  wantsCarrier,
} from "../src/collection-table.ts";

test("columns split at top-level commas only", () => {
  expect(splitColumns("Descents, Part(_, 1), Max(_) - Min(_)")).toEqual(["Descents", "Part(_, 1)", "Max(_) - Min(_)"]);
  expect(splitColumns("")).toEqual([]);
});

test("a bare head is shorthand for applying it to the row", () => {
  expect(columnSource("Descents")).toBe("Descents(_)");
  expect(columnSource("Length(_) + 1")).toBe("Length(_) + 1");
});

test("the row wildcard is substituted in both MathJSON encodings", () => {
  const row = ["List", 3, 1, 2] as const;
  expect(substituteRow(["Equal", ["Descents", "_"], 1], row)).toEqual(["Equal", ["Descents", row], 1]);
  expect(substituteRow({ fn: ["Length", { sym: "_", sourceOffsets: [7, 8] }] } as never, row)).toEqual({
    fn: ["Length", row],
  });
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

// The per-column wrap decision (BL-1): a statistic wraps the row in its carrier only when
// its declared argument type REJECTS the bare row and ACCEPTS the carrier -- never a blanket
// wrap, and never when the bare row already satisfies the head (a word statistic's union, or
// a generic `any`/`collection` function like `Length` or `Max`).
test("wantsCarrier wraps a carrier-only head, not a bare-list-accepting or generic one", () => {
  const ce = new ComputeEngine();
  ce.declareType("test_carrier", "list<integer>", { mint: true });
  ce.declare("TestCarrier", { signature: "(list<integer>) -> test_carrier" });
  ce.declare("CarrierOnlyStat", { signature: "(test_carrier) -> integer" });
  ce.declare("WordOrCarrierStat", { signature: "(test_carrier | list<integer>) -> integer" });

  const row = ce.box(["List", 1, 2, 3]);
  const bareType = row.type;
  const carrierType = ce.box(["TestCarrier", row.json]).type;

  expect(wantsCarrier(ce, "CarrierOnlyStat", 0, bareType, carrierType)).toBe(true);
  expect(wantsCarrier(ce, "WordOrCarrierStat", 0, bareType, carrierType)).toBe(false);
  expect(wantsCarrier(ce, "Length", 0, bareType, carrierType)).toBe(false);
  expect(wantsCarrier(ce, "Max", 0, bareType, carrierType)).toBe(false);
  // No registered carrier at all: nothing to wrap into, regardless of the head.
  expect(wantsCarrier(ce, "CarrierOnlyStat", 0, bareType, undefined)).toBe(false);
  // A head the engine has no definition for: no signature to read, stays bare, no retry.
  expect(wantsCarrier(ce, "NoSuchHead", 0, bareType, carrierType)).toBe(false);
});

test("substituteRowPerHead wraps only the occurrences whose own head asks for it", () => {
  const bare: MathJsonExpression = ["List", 1, 2, 3];
  const wrapped: MathJsonExpression = ["Carrier", bare];
  const json: MathJsonExpression = ["Subtract", ["CarrierOnlyStat", "_"], ["Length", "_"]];
  const decide = (head: string): boolean => head === "CarrierOnlyStat";
  expect(substituteRowPerHead(json, bare, wrapped, decide)).toEqual([
    "Subtract",
    ["CarrierOnlyStat", wrapped],
    ["Length", bare],
  ]);
  // No enclosing head (a bare `_` column) always gets the bare row.
  expect(substituteRowPerHead("_", bare, wrapped, () => true)).toEqual(bare);
});

// A real `columnSource("CycleCount")` parses to the OBJECT encoding, `_` and all -- not the
// shorthand array a hand-written test fixture reaches for -- so the decision has to be read
// off `{ sym: "_" }` too, not just the bare string. Missing this left every wrap-worthy column
// on the live site landing on bare, and so on ⚠ (caught reviewing SymmetricGroup's page).
test("substituteRowPerHead wraps a parsed (object-encoded) `_` occurrence the same way", () => {
  const bare: MathJsonExpression = ["List", 1, 2, 3];
  const wrapped: MathJsonExpression = ["Carrier", bare];
  const row = { sym: "_", sourceOffsets: [11, 12] };
  const json = { fn: ["CarrierOnlyStat", row] } as unknown as MathJsonExpression;
  expect(substituteRowPerHead(json, bare, wrapped, (head) => head === "CarrierOnlyStat")).toEqual({
    fn: ["CarrierOnlyStat", wrapped],
  });
});
