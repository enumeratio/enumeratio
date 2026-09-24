import { expect, test } from "vite-plus/test";
import {
  arrayPlotSvg,
  barChartSvg,
  chooseChartType,
  boxWhiskerChartSvg,
  discretePlotSvg,
  fiveNumberSummary,
  histogramSvg,
  pieChartSvg,
  sturgesBins,
} from "../src/chart.ts";

const count = (s: string, tag: string): number => s.split(`<${tag}`).length - 1;

// ---------------------------------------------------------------------------
// BarChart
// ---------------------------------------------------------------------------

test("bar chart draws one rect per value", () => {
  const s = barChartSvg([3, 1, 4, 1, 5]);
  expect(s).toContain('viewBox="0 0 340 200"');
  expect(count(s, "rect")).toBe(5);
});

test("bar chart labels render text under each bar", () => {
  const s = barChartSvg([1, 2, 3], { labels: ["a", "b", "c"] });
  expect(s).toContain(">a<");
  expect(s).toContain(">b<");
  expect(s).toContain(">c<");
});

test("negative values dip below the zero baseline", () => {
  const s = barChartSvg([3, -2, 1]);
  expect(count(s, "rect")).toBe(3);
});

test("empty data yields a frame, no bars", () => {
  expect(count(barChartSvg([]), "rect")).toBe(0);
});

// ---------------------------------------------------------------------------
// Histogram
// ---------------------------------------------------------------------------

test("histogram bins samples into the requested bar count", () => {
  const s = histogramSvg([1, 2, 2, 3, 3, 3, 4, 4, 5], { bins: 5 });
  expect(count(s, "rect")).toBe(5);
});

test("histogram falls back to Sturges' rule when bins is omitted", () => {
  const values = Array.from({ length: 16 }, (_, i) => i);
  const s = histogramSvg(values);
  expect(count(s, "rect")).toBe(sturgesBins(16));
});

test("sturgesBins grows logarithmically with sample count", () => {
  expect(sturgesBins(1)).toBe(1);
  expect(sturgesBins(16)).toBe(5); // ceil(log2 16) + 1 = 4 + 1
});

test("histogram range labels report the sampled min/max", () => {
  const s = histogramSvg([0, 5, 10]);
  expect(s).toContain(">0<");
  expect(s).toContain(">10<");
});

// ---------------------------------------------------------------------------
// PieChart
// ---------------------------------------------------------------------------

test("pie chart draws one wedge path per positive value", () => {
  const s = pieChartSvg([1, 2, 3]);
  expect(count(s, "path")).toBe(3);
});

test("pie chart drops non-positive and non-finite entries", () => {
  const s = pieChartSvg([2, 0, -1, Number.NaN, 3]);
  expect(count(s, "path")).toBe(2);
});

test("a single entry draws a full circle, not a degenerate arc", () => {
  const s = pieChartSvg([5]);
  expect(count(s, "circle")).toBe(1);
  expect(count(s, "path")).toBe(0);
});

test("pie chart legend lists labels when provided", () => {
  const s = pieChartSvg([1, 2], { labels: ["x", "y"] });
  expect(s).toContain(">x<");
  expect(s).toContain(">y<");
});

test("all-zero/empty data yields a frame, no wedges", () => {
  expect(count(pieChartSvg([]), "path")).toBe(0);
  expect(count(pieChartSvg([0, 0]), "path")).toBe(0);
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
  const s = boxWhiskerChartSvg([
    [1, 2, 3, 4, 5],
    [2, 4, 6, 8, 10],
  ]);
  expect(count(s, "rect")).toBe(2);
});

test("box-whisker chart labels render under each box", () => {
  const s = boxWhiskerChartSvg([[1, 2, 3]], { labels: ["A"] });
  expect(s).toContain(">A<");
});

// ---------------------------------------------------------------------------
// ArrayPlot
// ---------------------------------------------------------------------------

// Filled rects only: the frame border is `fill="none"`.
const cells = (s: string): number => (s.match(/<rect [^>]*fill="(?!none)/g) ?? []).length;
const viewBox = (s: string): number[] =>
  s
    .match(/viewBox="([^"]+)"/)![1]!
    .split(" ")
    .map(Number);

test("array plot draws one cell per matrix entry", () => {
  const s = arrayPlotSvg([
    [1, 2],
    [3, 4],
  ]);
  expect(cells(s)).toBe(4);
});

test("array plot handles ragged rows without throwing", () => {
  const s = arrayPlotSvg([[1, 2, 3], [4]]);
  expect(cells(s)).toBe(4);
});

test("empty matrix yields a frame, no cells", () => {
  expect(count(arrayPlotSvg([]), "rect")).toBe(0);
});

test("array plot cells are square: height follows rows/cols", () => {
  const wide = arrayPlotSvg([[2, 3, 4, 5]]);
  expect(viewBox(wide)).toEqual([0, 0, 340, 6 + 82 + 6]);
  const sq = arrayPlotSvg([
    [2, 3],
    [4, 5],
  ]);
  expect(viewBox(sq)).toEqual([0, 0, 340, 340]);
});

test("a tall array plot caps at a square frame and narrows", () => {
  const s = arrayPlotSvg(Array.from({ length: 8 }, () => [2, 3]));
  expect(viewBox(s)).toEqual([0, 0, 340, 340]);
  const w = s.match(/width="([\d.]+)" height="([\d.]+)" fill="none"/)!;
  expect(Number(w[1]) / Number(w[2])).toBeCloseTo(2 / 8);
});

test("an explicit height stretches cells to fill", () => {
  expect(viewBox(arrayPlotSvg([[2, 3, 4, 5]], { height: 200 }))).toEqual([0, 0, 340, 200]);
});

test("a 0/1 array plot is two-tone: background for 0, foreground for 1", () => {
  const s = arrayPlotSvg([
    [0, 1],
    [1, 0],
  ]);
  expect(s).not.toContain("color-mix");
  expect(s.split("var(--notatio-fg").length - 1).toBe(2);
  expect(s.split("var(--notatio-bg").length - 1).toBe(2);
  expect(arrayPlotSvg([[0, 2]])).toContain("color-mix");
});

// ---------------------------------------------------------------------------
// DiscretePlot
// ---------------------------------------------------------------------------

test("discrete plot draws a stem and a dot per value", () => {
  const s = discretePlotSvg([1, 4, 2, 3]);
  expect(count(s, "line")).toBe(1 + 4); // zero axis + one stem per value
  expect(count(s, "circle")).toBe(4);
});

test("discrete plot handles negative values below the baseline", () => {
  const s = discretePlotSvg([-2, 1, -3]);
  expect(count(s, "circle")).toBe(3);
});

test("empty data yields a frame, no stems", () => {
  expect(count(discretePlotSvg([]), "circle")).toBe(0);
});

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

test("a title renders centred above the frame", () => {
  const s = barChartSvg([1, 2, 3], { title: "Widgets" });
  expect(s).toContain(">Widgets<");
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
