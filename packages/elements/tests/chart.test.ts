import { expect, test } from "vite-plus/test";
import {
  arrayPlotSvg,
  barChartSvg,
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

test("array plot draws one cell per matrix entry", () => {
  const s = arrayPlotSvg([
    [1, 2],
    [3, 4],
  ]);
  expect(count(s, "rect")).toBe(4);
});

test("array plot handles ragged rows without throwing", () => {
  const s = arrayPlotSvg([[1, 2, 3], [4]]);
  expect(count(s, "rect")).toBe(4);
});

test("empty matrix yields a frame, no cells", () => {
  expect(count(arrayPlotSvg([]), "rect")).toBe(0);
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
