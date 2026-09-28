// A cell reads back as exactly what was written into it, text or flow value, including the
// awkward ones: TeX backslashes, the empty string, a line break, a value that looks like
// another type.

import { expect, test } from "vite-plus/test";
import { decodeCell, encodeCell, parseTsv, stringifyTsv } from "../src/tsv.ts";

const TEXT = ["\\zeta(2)", "\\theta\\n", "", "two\nlines", "a\ttab", '"quoted', "5", "true", "  lead", "é√"];
const FLOW = [["Mod", 5, 0], "Pi", "5", 5, -1.5e-20, "NaN", "", "a: b", { num: "1.25" }, ["x\ty"], true, null];

test("text cells round-trip, and TeX stays as written", () => {
  for (const value of TEXT) expect(decodeCell(encodeCell(value, "text"), "text")).toBe(value);
  expect(encodeCell("\\frac{\\pi^2}{6}", "text")).toBe("\\frac{\\pi^2}{6}");
});

test("flow cells round-trip, and MathJSON stays readable", () => {
  for (const value of FLOW) expect(decodeCell(encodeCell(value, "flow"), "flow")).toEqual(value);
  expect(encodeCell(["Multiply", ["Rational", 1, 6], ["Power", "Pi", 2]], "flow")).toBe(
    "[Multiply, [Rational, 1, 6], [Power, Pi, 2]]",
  );
});

test("no cell holds a tab or line break, and an empty cell is absent", () => {
  for (const value of [...TEXT, ...FLOW.filter((v) => typeof v === "string")])
    expect(encodeCell(value, "text")).not.toMatch(/[\t\n\r]/);
  expect(decodeCell("", "text")).toBeUndefined();
  const table = { columns: ["id", "note"], rows: [{ id: "a", note: encodeCell("x\ny", "text") }] };
  expect(parseTsv(stringifyTsv(table))).toEqual(table);
});
