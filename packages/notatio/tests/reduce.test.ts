import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseNotatio, serializeNotatio } from "@enumeratio/formats/notatio";
import { afterAll, expect, test } from "vite-plus/test";
import {
  browserEnvironment,
  COMPACT,
  type Environment,
  nodeEnvironment,
  PIPE,
  PRINT,
  TTY,
  WEB,
} from "../src/environment.ts";
import { declarations, pinValue, reduce, sampleValues } from "../src/reduce.ts";
import { markupOf, renderingOf } from "../src/symbols.ts";

// What each expression becomes in each environment: the controls pinned or sampled where
// nothing can drive them, a `Dynamic` read once, a GPU plot rasterized on paper, a `Row`
// stacked in a narrow column -- and left alone where the environment can do it. Golden
// JSON compared with `toEqual` (AGENTS.md); regenerate with `UPDATE_REDUCE=1 vp test`.
const CORPUS = [
  "Manipulate(Plot(Sin(a * x), (x, 0, 10)), (a, 1, 5))",
  "Manipulate(Sin(a) + b, (a, 0, 5, 0.5), ((b, 2), 0, 3))",
  'Manipulate(Sin(a) + b, (a, 0, 5, 0.5), ((b, 2), 0, 3), Static -> "Pin")',
  "Manipulate(a^2, (a, 0, 1), Static -> 3)",
  "Manipulate(k * x, (k, [1, 2, 3], PopupMenu))",
  "Row([Slider((k, 2), (0, 5)), Dynamic(k^2)])",
  // A cell holds its input: reduction pins a control around it, not inside it.
  "Column([Cell(Binomial(10, 3)), Slider((k, 2), (0, 5))])",
  "Cell(Row([Slider((k, 2), (0, 5)), Dynamic(k^2)]))",
  'Column([Slider(k, (0, 5), Static -> "Pin"), "so", k^2])',
  "Grid([[Slider(a, (0, 1)), Slider(b, (0, 1))], [a + b, a * b]])",
  'Panel(Labeled(Checkbox(on), "on?"))',
  "Row([Plot(Sin(k * x), (x, 0, 10)), Slider((k, 1), (1, 5))])",
  'Toggler(size, ["a few", "several", "many"])',
  'Row([Toggler((size, "several"), ["a few", Labeled("several", "some"), "many"]), size])',
  "Animator(t, (0, 1, 0.25))",
  "Row([Animator(t, (0, 1, 0.25)), Sin(t)])",
  "Slider2D((p, (0.3, 0.6)), ((0, 0), (1, 1)), 0.01)",
  "IntervalSlider((r, (1, 3)), (0, 5, 0.5))",
  "Locator((p, (1, 0.5)))",
  "Row([Plot(Sin(x), (x, 0, 10), Epilog -> Point((2, 0))), Locator((p, (1, 0.5)))])",
  "ComplexPlot(Zeta(z), z)",
  "Row([ComplexPlot3D(Gamma(z), z), Plot(Sin(x), (x, 0, 10))])",
  "Sin(x) + 1",
  "Plot(Sin(x), (x, 0, 10), PlotRange -> (-1, 1))",
];

const ENVS: readonly Environment[] = [WEB, PRINT, TTY, PIPE, COMPACT];

const GOLDEN = fileURLToPath(new URL("./reduce.golden.json", import.meta.url));
const updating = process.env.UPDATE_REDUCE === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

for (const src of CORPUS) {
  const { json, errors } = parseNotatio(src);
  expect(errors).toEqual([]);
  for (const env of ENVS) {
    const key = `${env.name}: ${src}`;
    test(key, () => {
      const reduced = reduce(json, env);
      const rendering = renderingOf(reduced);
      const result = {
        notatio: serializeNotatio(reduced),
        markup: rendering === undefined ? undefined : markupOf(rendering),
      };
      if (updating) {
        fresh[key] = result;
        return;
      }
      expect(result).toEqual(golden[key]);
    });
  }
}

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, JSON.stringify(fresh, null, 2) + "\n");
});

test("an environment that can drive its controls leaves the expression alone", () => {
  for (const src of CORPUS) {
    const { json } = parseNotatio(src);
    for (const env of [WEB, TTY]) {
      expect(serializeNotatio(reduce(json, env))).toBe(serializeNotatio(json));
    }
  }
});

test("declarations: a start, a range, a list; Manipulate parameters read the same way", () => {
  const decls = declarations(
    parseNotatio("Row([Slider((k, 2), (0, 5)), Manipulate(a + b, (a, 0, 1), (b, [1, 2]))])").json,
  );
  expect(decls.map((d) => [d.name, d.kind, serializeNotatio(pinValue(d)!)])).toEqual([
    ["k", "ranged", "2"],
    ["a", "ranged", "0"],
    ["b", "listed", "1"],
  ]);
});

test("sampling stays on the step grid, and caps at n", () => {
  const [d] = declarations(parseNotatio("Slider(k, (0, 1, 0.25))").json);
  expect(sampleValues(d!, 6)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  expect(sampleValues(d!, 3)).toEqual([0, 0.5, 1]);
  const [e] = declarations(parseNotatio("Slider(k, (0, 10))").json);
  expect(sampleValues(e!, 3)).toEqual([0, 5, 10]);
  const [c] = declarations(parseNotatio("Checkbox(on)").json);
  expect(sampleValues(c!, 6)).toEqual(["False", "True"]);
});

test("detectors: a pipe, a plain tty, a kitty; print, a phone, the web", () => {
  expect(nodeEnvironment({ isTTY: false, env: {} }).name).toBe("pipe");
  expect(nodeEnvironment({ isTTY: true, env: { TERM: "xterm-256color" } }).surface).toEqual([
    "text",
  ]);
  expect(nodeEnvironment({ isTTY: true, env: { TERM: "xterm-kitty" } }).surface).toEqual([
    "raster",
    "text",
  ]);
  expect(browserEnvironment({ print: true }).name).toBe("print");
  expect(browserEnvironment({ coarse: true, hover: false }).name).toBe("compact");
  expect(browserEnvironment({ hover: true, dark: true })).toMatchObject({
    name: "web",
    theme: "dark",
  });
});
