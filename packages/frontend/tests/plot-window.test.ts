import { expect, test } from "vite-plus/test";
import { plotSeries, plotSeriesIn, type SeriesItem } from "../src/plot.ts";
import { polarPlotBox, polarPlotBoxSvg, samplePolar, samplePolarIn } from "../src/polarplot.ts";
import type { BoxNode } from "@enumeratio/boxes";

const curve: SeriesItem[] = [{ label: "sin" }];
const sin = () => Math.sin;
const options = { domain: [0, 10] as const, samples: 160, adaptive: false };

test("no window is plotSeries itself", () => {
  expect(plotSeriesIn(curve, sin, options)).toEqual(plotSeries(curve, sin, options));
  expect(plotSeriesIn(curve, sin, { ...options, adaptive: true })).toEqual(
    plotSeries(curve, sin, { ...options, adaptive: true }),
  );
});

test("a narrower view is sampled within it, a point per pixel", () => {
  const [series] = plotSeriesIn(curve, sin, options, { x: [2, 3] }, 500);
  expect(series!.points).toHaveLength(500);
  expect(series!.points[0]!.x).toBe(2);
  expect(series!.points.at(-1)!.x).toBe(3);
  expect(series!.points.every((p) => p.x >= 2 && p.x <= 3 && p.y === Math.sin(p.x))).toBe(true);
});

test("a view past the domain is cut to it, and one outside it is empty", () => {
  const [cut] = plotSeriesIn(curve, sin, options, { x: [8, 14] }, 100);
  expect(cut!.points[0]!.x).toBe(8);
  expect(cut!.points.at(-1)!.x).toBe(10);
  expect(plotSeriesIn(curve, sin, options, { x: [11, 12] }, 100)[0]!.points).toEqual([]);
});

test("a parametric curve is sampled only where it passes through the view", () => {
  const circle = (k: number) => (t: number) => (k === 0 ? Math.cos(t) : Math.sin(t));
  const items: SeriesItem[] = [{ label: "x" }, { label: "y" }];
  const opts = { domain: [0, 2 * Math.PI] as const, samples: 160, parametric: true, adaptive: false };
  const window = { x: [0.9, 1.1] as const, y: [-0.1, 0.1] as const };
  const [series] = plotSeriesIn(items, circle, opts, window, 400);
  const points = series!.points.filter((p) => Number.isFinite(p.x));
  expect(points.length).toBeGreaterThan(10);
  // Every sample is near the view: the far side of the circle is not sampled.
  expect(points.every((p) => Math.hypot(p.x - 1, p.y) < 0.3)).toBe(true);
  // Denser than the whole curve's coarse pass would be over this stretch.
  const step = Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y);
  expect(step).toBeLessThan(0.2 / 100);
});

test("a polar curve is sampled where it passes through the view", () => {
  const unit = () => 1;
  const window = { center: [1, 0] as const, half: 0.1 };
  const points = samplePolarIn(unit, 0, 2 * Math.PI, window, 400).filter((p) => Number.isFinite(p.r));
  expect(points.length).toBeGreaterThan(10);
  expect(points.every((p) => Math.abs(p.theta) < 0.5 || Math.abs(p.theta - 2 * Math.PI) < 0.5)).toBe(true);
});

test("a zoomed polar box is clipped to its window; the whole one is as it was", () => {
  const whole = polarPlotBox(samplePolar(() => 1, 0, 2 * Math.PI, 64)) as BoxNode;
  expect(polarPlotBoxSvg(whole)).not.toContain("clip-path");
  const window = { center: [1, 0] as const, half: 0.2 };
  const zoomed = polarPlotBox(
    samplePolarIn(() => 1, 0, 2 * Math.PI, window, 300),
    { window },
  ) as BoxNode;
  expect(polarPlotBoxSvg(zoomed)).toContain("clip-path");
});
