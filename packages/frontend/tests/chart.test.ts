import { expect, test } from "vite-plus/test";
import { type Box, type BoxNode, makeBoxes, optionsOfBox } from "@enumeratio/boxes";
import { parseExpression } from "@enumeratio/formats/expression";
import {
  arrayPlotBox,
  barChartBox,
  boxWhiskerChartBox,
  chartSvg,
  chooseChartType,
  discretePlotBox,
  drawChart,
  fiveNumberSummary,
  histogramBox,
  isChartBox,
  pieChartBox,
  renderChart,
  sturgesBins,
} from "../src/chart.ts";
import { plainJson } from "../src/graphics-rules.ts";
import { loadLatticeModules } from "../src/lattice-layers.ts";
import { plotItems } from "../src/plot-box.ts";
import { holdsPlot } from "../src/plot-lowering.ts";
import { PLOT_NOTATION } from "../src/plot-notation.ts";

const node = (box: Box): BoxNode => box as BoxNode;
/** The primitives a chart's box holds, by head. */
const count = (box: Box, head: string): number => plotItems(node(box)).filter((i) => i.prim[0] === head).length;
const svgOf = (box: Box): string => renderChart(node(box));
const size = (box: Box): number[] => optionsOfBox(node(box)).ImageSize as number[];

// ---------------------------------------------------------------------------
// BarChart
// ---------------------------------------------------------------------------

test("bar chart draws one rectangle per value", () => {
  const box = barChartBox([3, 1, 4, 1, 5]);
  expect(isChartBox(box)).toBe(true);
  expect(size(box)).toEqual([340, 200]);
  expect(count(box, "RectangleBox")).toBe(5);
  expect(svgOf(box)).toContain('viewBox="0 0 340 200"');
});

test("bar chart labels render text under each bar", () => {
  const s = svgOf(barChartBox([1, 2, 3], { labels: ["a", "b", "c"] }));
  expect(s).toContain(">a<");
  expect(s).toContain(">b<");
  expect(s).toContain(">c<");
});

test("negative values dip below the zero baseline", () => {
  const box = barChartBox([3, -2, 1]);
  expect(count(box, "RectangleBox")).toBe(3);
  const dipped = plotItems(node(box))[1]!;
  expect(optionsOfBox(dipped.prim).Min).toEqual([1.1, -2]);
  expect(optionsOfBox(dipped.prim).Max).toEqual([1.9, 0]);
});

test("empty data yields a frame, no bars", () => {
  expect(count(barChartBox([]), "RectangleBox")).toBe(0);
  expect(svgOf(barChartBox([], { title: "none" }))).toContain(">none<");
});

// ---------------------------------------------------------------------------
// Histogram
// ---------------------------------------------------------------------------

test("histogram bins samples into the requested bar count", () => {
  const box = histogramBox([1, 2, 2, 3, 3, 3, 4, 4, 5], { bins: 5 });
  expect(count(box, "RectangleBox")).toBe(5);
  const heights = plotItems(node(box)).map((i) => (optionsOfBox(i.prim).Max as number[])[1]);
  expect(heights).toEqual([1, 2, 3, 2, 1]);
});

test("histogram falls back to Sturges' rule when bins is omitted", () => {
  const values = Array.from({ length: 16 }, (_, i) => i);
  expect(count(histogramBox(values), "RectangleBox")).toBe(sturgesBins(16));
});

test("sturgesBins grows logarithmically with sample count", () => {
  expect(sturgesBins(1)).toBe(1);
  expect(sturgesBins(16)).toBe(5); // ceil(log2 16) + 1 = 4 + 1
});

test("histogram range labels report the sampled min/max", () => {
  const s = svgOf(histogramBox([0, 5, 10]));
  expect(s).toContain(">0<");
  expect(s).toContain(">10<");
});

// ---------------------------------------------------------------------------
// PieChart
// ---------------------------------------------------------------------------

const wedges = (box: Box): number[][] => plotItems(node(box)).map((i) => optionsOfBox(i.prim).Angles as number[]);

test("pie chart draws one sector per positive value, in turns of the whole", () => {
  const box = pieChartBox([1, 2, 3]);
  expect(count(box, "DiskBox")).toBe(3);
  const angles = wedges(box);
  // Clockwise from twelve o'clock: the first wedge is a sixth of a turn, ending at its start.
  expect(angles[0]![1]).toBeCloseTo(Math.PI / 2);
  expect(angles[0]![1]! - angles[0]![0]!).toBeCloseTo(Math.PI / 3);
  expect(angles[2]![0]).toBeCloseTo(Math.PI / 2 - 2 * Math.PI);
  // A sector in SVG is a path out to the rim and round it.
  expect(svgOf(box).match(/d="M[^"]*L[^"]*A[^"]*Z" fill="#/g)).toHaveLength(3);
});

test("pie chart drops non-positive and non-finite entries", () => {
  expect(count(pieChartBox([2, 0, -1, Number.NaN, 3]), "DiskBox")).toBe(2);
});

test("a single entry is a whole turn, drawn as a circle, not a degenerate arc", () => {
  const box = pieChartBox([5]);
  const [a, b] = wedges(box)[0]!;
  expect(b! - a!).toBeCloseTo(2 * Math.PI);
  expect(svgOf(box)).not.toMatch(/d="M[^"]*L[^"]*A/);
});

test("pie chart legend lists labels when provided", () => {
  const s = svgOf(pieChartBox([1, 2], { labels: ["x", "y"] }));
  expect(s).toContain(">x<");
  expect(s).toContain(">y<");
});

test("all-zero/empty data yields a frame, no wedges", () => {
  expect(count(pieChartBox([]), "DiskBox")).toBe(0);
  expect(count(pieChartBox([0, 0]), "DiskBox")).toBe(0);
});

test("a wedge is a circle on the page: both axes take the same pixels to the unit", () => {
  const d = drawChart(node(pieChartBox([1, 1])));
  const disks = d.list.kind === "marks" ? d.list.marks.filter((m) => m.mark.head === "Disk") : [];
  expect(disks).toHaveLength(2);
  const [wedge] = disks;
  // Radius 1 on a 340 by 200 frame: r = min(0.38 * 340 - 10, (200 - 12) / 2 - 10, 160).
  expect(wedge!.mark.head === "Disk" && wedge!.mark.radius).toBeCloseTo(84);
});

// ---------------------------------------------------------------------------
// BoxWhiskerChart
// ---------------------------------------------------------------------------

test("fiveNumberSummary reports min/Q1/median/Q3/max", () => {
  const s = fiveNumberSummary([1, 2, 3, 4, 5]);
  expect(s).toEqual({ min: 1, q1: 2, median: 3, q3: 4, max: 5 });
});

test("fiveNumberSummary ignores non-finite entries", () => {
  const s = fiveNumberSummary([1, Number.NaN, 3, 5]);
  expect(s?.min).toBe(1);
  expect(s?.max).toBe(5);
});

test("fiveNumberSummary is undefined for empty input", () => {
  expect(fiveNumberSummary([])).toBeUndefined();
});

test("box-whisker chart draws one box per series", () => {
  const box = boxWhiskerChartBox([
    [1, 2, 3, 4, 5],
    [2, 4, 6, 8, 10],
  ]);
  expect(count(box, "RectangleBox")).toBe(2);
  // A whisker, two caps and a median line each.
  expect(count(box, "LineBox")).toBe(8);
});

test("box-whisker chart labels render under each box", () => {
  expect(svgOf(boxWhiskerChartBox([[1, 2, 3]], { labels: ["A"] }))).toContain(">A<");
});

// ---------------------------------------------------------------------------
// ArrayPlot
// ---------------------------------------------------------------------------

test("array plot draws one cell per matrix entry", () => {
  const box = arrayPlotBox([
    [1, 2],
    [3, 4],
  ]);
  expect(count(box, "RectangleBox")).toBe(4);
  // The first row is the top: cell (0, 0) spans y from 1 to 2.
  expect(optionsOfBox(plotItems(node(box))[0]!.prim).Min).toEqual([0, 1]);
});

test("array plot handles ragged rows without throwing", () => {
  expect(count(arrayPlotBox([[1, 2, 3], [4]]), "RectangleBox")).toBe(4);
});

test("empty matrix yields a frame, no cells", () => {
  expect(count(arrayPlotBox([]), "RectangleBox")).toBe(0);
});

test("array plot cells are square: height follows rows/cols", () => {
  expect(size(arrayPlotBox([[2, 3, 4, 5]]))).toEqual([340, 6 + 82 + 6]);
  expect(
    size(
      arrayPlotBox([
        [2, 3],
        [4, 5],
      ]),
    ),
  ).toEqual([340, 340]);
});

test("a tall array plot caps at a square frame and narrows", () => {
  const box = arrayPlotBox(Array.from({ length: 8 }, () => [2, 3]));
  expect(size(box)).toEqual([340, 340]);
  const [[left, right], [bottom, top]] = optionsOfBox(node(box)).ImagePadding as number[][];
  expect((340 - left! - right!) / (340 - bottom! - top!)).toBeCloseTo(2 / 8);
});

test("an explicit height stretches cells to fill", () => {
  expect(size(arrayPlotBox([[2, 3, 4, 5]], { height: 200 }))).toEqual([340, 200]);
});

test("a 0/1 array plot is two-tone: background for 0, foreground for 1", () => {
  const box = arrayPlotBox([
    [0, 1],
    [1, 0],
  ]);
  const faces = plotItems(node(box)).map((i) => i.look.FaceForm as string);
  expect(faces.filter((f) => f.startsWith("var(--notatio-fg"))).toHaveLength(2);
  expect(faces.filter((f) => f.startsWith("var(--notatio-bg"))).toHaveLength(2);
  expect(svgOf(box)).not.toContain("color-mix");
  // Anything else takes the gradient: viridis's first and last colors at the extremes.
  const ramped = svgOf(arrayPlotBox([[0, 2]]));
  expect(ramped).toContain("#440154");
  expect(ramped).toContain("#fde725");
});

// ---------------------------------------------------------------------------
// DiscretePlot
// ---------------------------------------------------------------------------

test("discrete plot draws a stem and a dot per value", () => {
  const box = discretePlotBox([1, 4, 2, 3]);
  expect(count(box, "LineBox")).toBe(4);
  expect(optionsOfBox(plotItems(node(box)).at(-1)!.prim).Points).toHaveLength(4);
  // The stems and the dots are marks; the zero axis rides on the box.
  expect(optionsOfBox(node(box)).AxesOrigin).toEqual([0, 0]);
});

test("discrete plot handles negative values below the baseline", () => {
  const box = discretePlotBox([-2, 1, -3]);
  expect(count(box, "LineBox")).toBe(3);
});

test("empty data yields a frame, no stems", () => {
  expect(count(discretePlotBox([]), "LineBox")).toBe(0);
  expect(count(discretePlotBox([]), "PointBox")).toBe(0);
});

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

test("a title renders centred above the frame", () => {
  expect(svgOf(barChartBox([1, 2, 3], { title: "Widgets" }))).toContain(">Widgets<");
});

test("chartSvg draws the member the kind names", () => {
  expect(chartSvg("pie", [1, 2])).toContain('aria-label="pie chart"');
  expect(chartSvg("array", [[1, 2]])).toContain('aria-label="array plot"');
});

// ---------------------------------------------------------------------------
// The head's rule
// ---------------------------------------------------------------------------

const boxOf = (source: string): Box =>
  makeBoxes(plainJson(parseExpression(source).json as never) as never, PLOT_NOTATION);

test("the chart heads lower to a GraphicsBox", () => {
  for (const [source, head] of [
    ["BarChart([3, 1, 4])", "RectangleBox"],
    ["Histogram([1, 2, 2, 3, 3, 3])", "RectangleBox"],
    ["PieChart([1, 2, 3])", "DiskBox"],
    ["BoxWhiskerChart([[1, 2, 3, 4], [2, 4, 6]])", "RectangleBox"],
    ["ArrayPlot([[1, 0], [0, 1]])", "RectangleBox"],
    ["DiscretePlot([1, 2, 4, 8])", "LineBox"],
    ['Chart([3, 1, 4], "pie")', "DiskBox"],
    ["Chart([3, 1, 4])", "RectangleBox"],
  ] as const) {
    const box = boxOf(source);
    expect(isChartBox(box), source).toBe(true);
    expect(count(box, head), source).toBeGreaterThan(0);
  }
});

test("a Chart of pairs is a plot of points, as its data's shape says", () => {
  const box = boxOf("Chart([[0, 1], [1, 3], [2, 2]])");
  expect(isChartBox(box)).toBe(false);
  expect(box[0]).toBe("GraphicsBox");
  expect(count(box, "PointBox")).toBe(1);
});

test("an ArrayPlot of a table is a Show's layer, lowered as before", async () => {
  await loadLatticeModules({ head: "ArrayPlot", data: [] });
  const box = boxOf("ArrayPlot(MultiplicationTable(QuotientRing(Integers, 5)))");
  expect(box[0]).toBe("GraphicsBox");
  expect(isChartBox(box)).toBe(false);
  // The table's producer, held as the Show it came from, not the cells of a matrix.
  expect(optionsOfBox(node(box)).Producer).toBe("ArrayPlot");
});

test("an element holds a plot or a chart in either spelling of its head, and an ArrayPlot only of a matrix", () => {
  for (const value of [
    "Plot(Sin(x), (x, 0, 1))",
    "histogram([1, 2])",
    "Histogram([1, 2])",
    " BarChart([1])",
    "ArrayPlot([[1]])",
  ])
    expect(holdsPlot(value), value).toBe(true);
  for (const value of [
    "ArrayPlot(MultiplicationTable(QuotientRing(Integers, 5)))",
    "Show(ArrayPlot([[1]]))",
    "plot2(x)",
    "",
  ])
    expect(holdsPlot(value), value).toBe(false);
});

// The family head's rule: which member the data's shape asks for.
test("chooseChartType reads the chart off the data's shape", () => {
  expect(chooseChartType([3, 1, 4, 1, 5])).toBe("bar");
  expect(chooseChartType(Array.from({ length: 40 }, (_, i) => i % 7))).toBe("histogram");
  expect(
    chooseChartType(
      Array.from({ length: 40 }, (_, i) => i),
      { labels: true },
    ),
  ).toBe("bar");
  expect(
    chooseChartType([
      [0, 1],
      [1, 3],
      [2, 2],
    ]),
  ).toBe("list");
  // Two-wide rows are pairs (ListPlot's own reading), so a matrix needs three columns.
  expect(
    chooseChartType([
      [1, 0, 2],
      [0, 3, 1],
    ]),
  ).toBe("array");
  expect(
    chooseChartType([
      [1, 2, 3, 4, 5],
      [2, 4, 6, 8],
    ]),
  ).toBe("box");
  expect(chooseChartType("nonsense")).toBe("bar");
  expect(chooseChartType([])).toBe("bar");
});
