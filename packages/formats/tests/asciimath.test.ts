import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { afterAll, expect, test } from "vite-plus/test";
import { exportTo, getFormat, importFormats, importFrom } from "../src/index.ts";
import { CORPUS } from "./corpus.ts";

// What each expression prints as in AsciiMath, and what that and its MathML read back as.
// A row whose `back` differs from the expression is a gap in the round trip, kept visible
// rather than failing: the golden pins it, and a fix shows up as a diff. Regenerate with
// `UPDATE_ASCIIMATH=1 vp test tests/asciimath.test.ts`.
const GOLDEN = fileURLToPath(new URL("./asciimath.golden.json", import.meta.url));
const updating = process.env.UPDATE_ASCIIMATH === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

const ce = new ComputeEngine();

for (const latex of CORPUS) {
  test(`AsciiMath and MathML: ${latex}`, () => {
    const expr = ce.parse(latex);
    const asciimath = exportTo(expr, "AsciiMath") as string;
    const back = ce.box(importFrom(asciimath, "AsciiMath", { ce }) as never);
    const mathml = ce.box(importFrom(exportTo(expr, "MathML") as string, "MathML", { ce }) as never);
    const row = {
      asciimath,
      ...(back.isSame(expr) ? {} : { back: back.json }),
      ...(mathml.isSame(expr) ? {} : { mathmlBack: mathml.json }),
    };
    if (updating) fresh[latex] = row;
    else expect(row).toEqual(golden[latex]);
  });
}

test("AsciiMath and MathML read as well as write", () => {
  expect(getFormat("asciimath")?.name).toBe("AsciiMath");
  expect(importFormats()).toEqual(expect.arrayContaining(["AsciiMath", "MathML"]));
  expect(importFrom("sum_(n=1)^oo 1/n^2", "AsciiMath", { ce })).toEqual([
    "Sum",
    ["Power", "n", -2],
    ["Limits", "n", 1, "PositiveInfinity"],
  ]);
});

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
