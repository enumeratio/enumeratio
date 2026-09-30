import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { afterAll, expect, test } from "vite-plus/test";
import { toInputForm } from "../src/inputform.ts";
import { parseExpression } from "../src/expression.ts";
import { CORPUS } from "./corpus.ts";

const ce = new ComputeEngine();

/** The canonical MathJSON of an InputForm string, or a diagnostic. */
function reparse(source: string): unknown {
  const { json, errors } = parseExpression(source, { ce });
  if (errors.length) return { parseError: source };
  return ce.box(json as Parameters<ComputeEngine["box"]>[0]).json;
}

// The goldens live in a committed JSON file compared with `toEqual` -- deliberately NOT
// `toMatchSnapshot`, whose client isn't set up when the `test` task runs through
// `vp run`. Regenerate with `UPDATE_INPUTFORM=1 vp test` after an intended change.
const GOLDEN = fileURLToPath(new URL("./inputform.golden.json", import.meta.url));
const updating = process.env.UPDATE_INPUTFORM === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

for (const latex of CORPUS) {
  test(`InputForm: ${latex}`, () => {
    const printed = {
      canonical: toInputForm(ce.parse(latex).json),
      raw: toInputForm(ce.parse(latex, { form: "raw" }).json),
    };
    if (updating) {
      fresh[latex] = printed;
      return;
    }
    expect(printed).toEqual(golden[latex]);
  });

  // The point of the format: what it prints, you can type back in. Both trees must
  // re-read as the same expression the LaTeX means -- a rule that changed the meaning
  // would show up here rather than as a prettier string.
  test(`InputForm round-trips: ${latex}`, () => {
    const expected = ce.parse(latex).json;
    expect(reparse(toInputForm(ce.parse(latex).json)), "from the canonical tree").toEqual(expected);
    expect(reparse(toInputForm(ce.parse(latex, { form: "raw" }).json)), "from the raw tree").toEqual(expected);
  });
}

// Regression for a printer that never returned: a ~1KB `FunctionExpand` closed
// form nests `Power`/`Multiply`/`Add`/`Sqrt` about a dozen levels deep, deep enough
// that compute-engine's Epsil formatter -- which re-lays out a node's line-vs-wrap
// choice from scratch on every `serialize`/`nextCol`/`cost` call -- multiplied its
// way to a hang. `toInputForm` now keeps every `serializeEpsil` call shallow (see
// `renderSafely` in `inputform.ts`), so this should print in well under a second.
test("InputForm: a deeply nested closed form prints instead of hanging", () => {
  const json = JSON.parse(
    readFileSync(fileURLToPath(new URL("./inputform-hang-repro.json", import.meta.url)), "utf8"),
  ) as MathJsonExpression;

  const start = performance.now();
  const printed = toInputForm(json);
  const elapsedMs = performance.now() - start;

  expect(elapsedMs, `printed in ${elapsedMs.toFixed(1)}ms`).toBeLessThan(2000);
  expect(reparse(printed)).toEqual(ce.box(json as Parameters<ComputeEngine["box"]>[0]).json);
});

test("InputForm never emits a LaTeX island", () => {
  for (const latex of CORPUS) {
    for (const form of ["canonical", "raw"] as const) {
      const printed = toInputForm(form === "raw" ? ce.parse(latex, { form: "raw" }).json : ce.parse(latex).json);
      expect(printed, `${latex} (${form})`).not.toMatch(/\$/);
    }
  }
});

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
