import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { afterAll, expect, test } from "vite-plus/test";
import {
  controlNames,
  DRAWING_SYMBOLS,
  markupOf,
  renderingOf,
  visualSymbol,
} from "../src/symbols.ts";

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
  "ComplexPlot3D(1/(z^2 + 1), (z, -2 - 2 * i, 2 + 2 * i))",
  "ComplexPlot3D(Gamma(z), z)",
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
  // A cell: the held input, its forms, and the value it should come to.
  "Cell(PowerModList(3, 1/2, 11))",
  'Cell(1 + 1, InForm -> "InputForm", OutForm -> "TraditionalForm", Expected -> 2)',
  // A transcript: `DynamicModule`/`Notebook` over a `List` of `Cell`s lowers each cell
  // to its own child, in document order -- one shared scope, not one child per module.
  "DynamicModule([Cell(1 + 1), Cell(2 + 2)])",
  "Notebook([Cell(1 + 1), Cell(2 + 2)])",
  // Reactive: `TrackedSymbols` lowers to one attribute, `all` or a symbol list.
  "DynamicModule([Cell(b := a + 1), Cell(a := 5), Cell(b^2)], TrackedSymbols -> All)",
  "DynamicModule([Cell(a := 5)], TrackedSymbols -> [a, b])",
  // The controls: a variable, or a variable with its start; a range or a list; and the
  // scope that binds them when anything else reads the variable.
  "Slider(k, (0, 5))",
  "Slider((k, 2), (0, 5, 0.5))",
  "VerticalSlider(h, (0, 10, 1))",
  "Animator(t, (0, 6.28, 0.05))",
  "Knob(n, (1, 8, 1))",
  "IntervalSlider((r, (1, 3)), (0, 5, 0.5))",
  "Slider2D((p, (0.3, 0.6)), ((0, 0), (1, 1)), 0.01)",
  "SetterBar(k, [2, 3, 5, 7])",
  'RadioButtonBar((q, 2), [Labeled(1, "one"), Labeled(2, "two")])',
  "TogglerBar((s, [1, 3]), [1, 2, 3, 4, 5])",
  "Toggler(on)",
  'Toggler(size, ["a few", "several", "many"])',
  "PopupMenu(n, [4, 5, 6, 8])",
  "ListPicker(L, [2, 3, 5, 7, 11])",
  "Checkbox((c, True))",
  'ColorSlider((c, "#3451b2"))',
  "InputField((f, Sin(x)))",
  "Locator((p, (1, 0.5)))",
  "Dynamic(k^2)",
  // Layout, and the implicit scope: `k` is declared by the slider and read by the rest.
  "Row([Slider((k, 2), (0, 5)), Dynamic(k^2)])",
  'Column([Slider(k, (0, 5)), "so", k^2])',
  "Grid([[Slider(a, (0, 1)), Slider(b, (0, 1))], [a + b, a * b]])",
  'Panel(Labeled(Checkbox(on), "on?"))',
  "Row([Plot(Sin(k * x), (x, 0, 10)), Slider((k, 1), (1, 5))])",
  // Options: trailing rules, singly or in a list, leftmost winning; a drawable option
  // (`Epilog`) is a slotted child, the rest are attributes.
  "Plot(Sin(x), (x, 0, 10), PlotRange -> (-1, 1), Epilog -> Point((1, 0.5)))",
  'Plot(Sin(x), (x, 0, 10), [PlotLabel -> "sine", GridLines -> True], PlotLabel -> "no")',
  'Slider(k, (0, 5), Appearance -> "Labeled")',
  // TestResultObject (@enumeratio/aestimatio's VerificationTest): a Success with an
  // actual output, a Failure that also carries the expected value, and an Error/Aborted
  // that has no ActualOutput to show.
  'TestResultObject(KeyValuePair("Outcome", "Success"), KeyValuePair("Input", 1 + 1), KeyValuePair("ActualOutput", 2), KeyValuePair("AbsoluteTimeUsed", 0))',
  'TestResultObject(KeyValuePair("Outcome", "Failure"), KeyValuePair("Input", 1 + 1), KeyValuePair("ExpectedOutput", 3), KeyValuePair("ActualOutput", 2), KeyValuePair("AbsoluteTimeUsed", 0), KeyValuePair("TestID", "adds"))',
  'TestResultObject(KeyValuePair("Outcome", "Aborted"), KeyValuePair("Input", FactorInteger(n)), KeyValuePair("ExpectedOutput", Missing), KeyValuePair("AbsoluteTimeUsed", 0.05))',
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
  for (const s of DRAWING_SYMBOLS) {
    // `Notebook` is Wolfram's name for the transcript configuration -- a `DynamicModule`
    // whose body is a `List` of `Cell`s -- so it deliberately shares `DynamicModule`'s
    // tag rather than getting a `notatio-notebook` of its own.
    if (s.head === "Notebook") {
      expect(s.tag).toBe("notatio-dynamic-module");
      continue;
    }
    if (s.fixed !== undefined && Object.keys(s.fixed).length === 0) {
      expect(s.tag, s.head).toBe(kebab(s.head));
      continue;
    }
    if (s.fixed === undefined) expect(s.tag, s.head).toBe(kebab(s.head));
    else
      expect(["notatio-chart", "notatio-graph-plot", "notatio-vector-plot"], s.head).toContain(
        s.tag,
      );
  }
  expect(visualSymbol("Sin")).toBeUndefined();
  expect(visualSymbol("Plot")?.tag).toBe("notatio-plot");
});

test("the controls' variables are collected, and only where they are declared", () => {
  const { json } = parseNotatio("Row([Slider(k, (0, 5)), Dynamic(k^2), Checkbox(on)])");
  expect([...controlNames(json)].sort()).toEqual(["k", "on"]);
  expect(controlNames(parseNotatio("Sin(k)").json).size).toBe(0);
});
