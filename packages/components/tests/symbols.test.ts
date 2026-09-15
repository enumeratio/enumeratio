import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { afterAll, expect, test } from "vite-plus/test";
import { markupOf, renderingOf, VISUAL_SYMBOLS, visualSymbol } from "../src/symbols.ts";

// A head that draws, and the component that draws it. The corpus is one expression per
// visual symbol plus the shapes that matter -- an iterator with and without a range, a
// family head with and without a member named, a Manipulate whose body is a plot and
// one whose body is a bare expression -- rendered to the tag/attributes/children a page
// would get. Golden JSON compared with `toEqual` (AGENTS.md); regenerate with
// `UPDATE_SYMBOLS=1 vp test` after an intended change.
const CORPUS = [
  "Plot(Sin(x), (x, 0, 10))",
  "Plot(Sin(x))",
  "Plot3D(x * y, (x, -1, 1), (y, -1, 1))",
  "ContourPlot(x^2 + y^2, (x, -2, 2), (y, -2, 2))",
  "DensityPlot(Sin(x) * Cos(y), (x, 0, 6), (y, 0, 6))",
  "PolarPlot(1 + Cos(t), (t, 0, 2 * Pi))",
  "VectorPlot((-y, x), (x, -2, 2), (y, -2, 2))",
  "StreamPlot((-y, x), (x, -2, 2), (y, -2, 2))",
  "ComplexPlot(Zeta(z), z)",
  "ListPlot([1, 4, 9, 16])",
  "ListLinePlot([[0, 1], [1, 3], [2, 2]])",
  "BarChart([3, 1, 4, 1, 5])",
  "Histogram([1, 2, 2, 3, 3, 3])",
  "PieChart([1, 2, 3])",
  "BoxWhiskerChart([[1, 2, 3, 4, 5], [2, 4, 6, 8]])",
  "ArrayPlot([[1, 0], [0, 1]])",
  "DiscretePlot([1, 2, 4, 8])",
  "Chart([3, 1, 4, 1, 5])",
  'Chart([1, 2, 3], "pie")',
  "ListPlot3D([[1, 2], [3, 4]])",
  "BarChart3D([[1, 2], [3, 4]])",
  "GraphPlot([[1, 2], [2, 3]])",
  "TreeGraph([[1, 2], [1, 3]])",
  "CollectionTable(Subsets(4))",
  "Manipulate(Plot(Sin(a * x), (x, 0, 10)), (a, 1, 5))",
  "Manipulate(Sin(a) + b, (a, 0, 5, 0.5), ((b, 2), 0, 3))",
  'Image("data:image/png;base64,AAA")',
  "Sin(x) + 1",
];

const GOLDEN = fileURLToPath(new URL("./symbols.golden.json", import.meta.url));
const updating = process.env.UPDATE_SYMBOLS === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

for (const src of CORPUS) {
  test(`rendering: ${src}`, () => {
    const { json, errors } = parseNotatio(src);
    expect(errors).toEqual([]);
    const rendering = renderingOf(json);
    const result = { rendering, markup: rendering === undefined ? undefined : markupOf(rendering) };
    if (updating) {
      fresh[src] = result;
      return;
    }
    expect(result).toEqual(golden[src]);
  });
}

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, JSON.stringify(fresh, null, 2) + "\n");
});

test("every visual symbol's tag is its name, kebab-cased, or its family's", () => {
  const kebab = (head: string): string =>
    "notatio-" + head.replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase();
  for (const s of VISUAL_SYMBOLS) {
    if (s.fixed === undefined) expect(s.tag, s.head).toBe(kebab(s.head));
    else
      expect(["notatio-chart", "notatio-graph-plot", "notatio-vector-plot"], s.head).toContain(
        s.tag,
      );
  }
  expect(visualSymbol("Sin")).toBeUndefined();
  expect(visualSymbol("Plot")?.tag).toBe("notatio-plot");
});
