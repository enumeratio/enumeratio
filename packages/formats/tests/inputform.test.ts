import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { parseEpsil } from "@cortex-js/compute-engine/epsil";
import { afterAll, expect, test } from "vite-plus/test";
import { toInputForm } from "../src/inputform.ts";

// The corpus is every shape the normalization rules touch, plus enough ordinary
// expressions to catch a rule firing where it shouldn't. Each is printed from both
// trees compute-engine can hand us -- the canonical one, and the "raw" parse that keeps
// what was typed -- because the rules exist to reconcile exactly those two.
const CORPUS = [
  "\\frac{x+1}{y-2}",
  "1 - 2x",
  "x - y - z",
  "a - (b - c)",
  "-x",
  "x \\ge 3",
  "\\int_0^1 x^2 dx",
  "\\sum_{n=1}^{10} n^2",
  "\\prod_{k=1}^{5} k",
  "\\lim_{x\\to 0}\\frac{\\sin x}{x}",
  "e^{i\\pi}+1",
  "2 + 3i",
  "\\sin(x)\\cos(y)",
  "\\sqrt{x}",
  "\\sqrt[3]{x}",
  "\\frac{1}{2}",
  "x^2+1",
  "10^{-3}",
  "\\binom{5}{3}",
  "|x|",
  "\\log_2(8)",
  "\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}",
  "\\{1,2,3\\}",
  "[1,2,3]",
  "x_1 + x_2",
  "\\frac{d}{dx} x^2",
];

const ce = new ComputeEngine();

/** The canonical MathJSON of an InputForm string, or a diagnostic. */
function reparse(source: string): unknown {
  const [json, diagnostics] = parseEpsil(source);
  const errors = diagnostics.filter((d) => d.severity === "error");
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
