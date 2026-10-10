import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseExpression } from "@enumeratio/formats/expression";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { ENVIRONMENTS, plainJson } from "@enumeratio/frontend";
import { prerender } from "@enumeratio/frontend/prerender";
import { afterAll, expect, test } from "vite-plus/test";
import { visualMarkup } from "../src/visual.ts";

// The Out half of a `Cell`: reduction stops at the Cell (its operand is input source),
// so the Out reduces its own value before drawing it -- on paper a slider is pinned or
// sampled, not drawn live and unmovable. Each source is a Cell's operand, which is what
// its Out evaluates to: the graphics heads are held. Golden JSON compared with `toEqual`
// (AGENTS.md); regenerate with `UPDATE_VISUAL=1 vp test`.
const OUTS = ["Row([Slider((k, 2), (0, 5)), Dynamic(k^2)])", "Manipulate(Plot(Sin(a * x), (x, 0, 10)), (a, 1, 5))"];

const GOLDEN = fileURLToPath(new URL("./visual.golden.json", import.meta.url));
const updating = process.env.UPDATE_VISUAL === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

for (const src of OUTS) {
  const { json, errors } = parseExpression(src);
  expect(errors).toEqual([]);
  for (const env of ENVIRONMENTS) {
    const key = `${env.name}: Cell(${src})`;
    test(key, () => {
      const markup = visualMarkup(json, env);
      if (updating) {
        fresh[key] = markup;
        return;
      }
      expect(markup).toEqual(golden[key]);
    });
  }
}

// An evaluated layout of closed math is drawn from boxes: its cells are the host's typeset leaves.
// A cell that could follow the page (a free symbol, or an answer nothing evaluated) stays a readout.
const web = ENVIRONMENTS.find((env) => env.name === "web")!;
const leaves = { typeset: (tex: string) => `{${tex}}`, evaluated: true };

test("an evaluated Grid of closed formulas is a grid-box of typeset leaves", () => {
  const { json } = parseExpression('Grid([[1 / 2, Sqrt(2)], [Pi, "note"]])');
  expect(visualMarkup(json, web, leaves)).toBe(
    '<grid-box data-head="Grid" style="grid-template-columns: repeat(2, auto)">' +
      '<form-box data-form="TraditionalForm">{\\frac{1}{2}}</form-box>' +
      '<form-box data-form="TraditionalForm">{\\sqrt{2}}</form-box>' +
      '<form-box data-form="TraditionalForm">{π}</form-box>' +
      "<span>note</span></grid-box>",
  );
});

test("a cell with a free symbol stays a readout that follows the page", () => {
  const { json } = parseExpression("Grid([[k, k^2], [1, 2]])");
  expect(visualMarkup(json, web, leaves)).toBe(visualMarkup(json, web));
  expect(visualMarkup(json, web, leaves)).toContain('<dynamic-box value="k"></dynamic-box>');
});

test("an answer nothing evaluated stays readouts, even when closed", () => {
  const { json } = parseExpression("Grid([[1 / 2, Sqrt(2)]])");
  const markup = visualMarkup(json, web, { ...leaves, evaluated: false });
  expect(markup).toBe(visualMarkup(json, web));
  expect(markup).toContain("<dynamic-box");
});

test("a layout with a control, a plot or a readout keeps its elements", () => {
  const { json } = parseExpression("Row([Slider((k, 2), (0, 5)), Dynamic(k^2)])");
  expect(visualMarkup(json, web, leaves)).toBe(visualMarkup(json, web));
});

// A build writes a closed layout into the page ahead of the Out; it is the markup the Out draws.
test("the build's layout is the markup the Out draws", () => {
  // As a kernel answers: plain MathJSON.
  const json = plainJson(parseExpression("Grid([[1 / 2, Sqrt(2)], [Pi, 2^10]])").json as never) as never;
  const pre = prerender(new ComputeEngine(), { text: "", format: "epsil" }, json, json, true, leaves.typeset);
  expect(pre.visual).toBeDefined();
  expect(pre.visual).toBe(visualMarkup(json, web, { ...leaves, written: pre.display.boxes.TraditionalForm }));
});

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, JSON.stringify(fresh, null, 2) + "\n");
});
