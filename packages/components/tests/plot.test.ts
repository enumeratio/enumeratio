import { expect, test } from "vite-plus/test";
import {
  adaptiveParam,
  adaptiveSample,
  linePlot,
  linePlotSvg,
  niceTicks,
  type PlotPoint,
} from "../src/plot.ts";

const sample = (f: (x: number) => number, lo: number, hi: number, n = 40): PlotPoint[] =>
  Array.from({ length: n }, (_, i) => {
    const x = lo + ((hi - lo) * i) / (n - 1);
    return { x, y: f(x) };
  });

const count = (s: string, tag: string): number => s.split(`<${tag}`).length - 1;

test("line plot draws a single continuous curve for a smooth function", () => {
  const s = linePlotSvg(sample(Math.sin, -Math.PI, Math.PI));
  expect(s).toContain('viewBox="0 0 340 200"');
  expect(count(s, "polyline")).toBe(1); // no gaps
  expect(count(s, "line")).toBe(2); // the two zero-axes
});

test("non-finite y splits the curve into segments (a pole)", () => {
  // 1/x over a domain straddling 0: the sample at/near 0 is non-finite.
  const pts = sample((x) => 1 / x, -2, 2, 41); // 41 => x = 0 is sampled exactly
  const s = linePlotSvg(pts);
  expect(count(s, "polyline")).toBe(2); // one segment each side of the pole
});

test("empty / all-non-finite input yields a frame, no curve", () => {
  expect(count(linePlotSvg([]), "polyline")).toBe(0);
  const nan = linePlotSvg([{ x: 0, y: Number.NaN }]);
  expect(count(nan, "polyline")).toBe(0);
});

test("axis labels report the sampled range", () => {
  const s = linePlotSvg(sample((x) => x, 0, 10));
  expect(s).toContain(">0<"); // xmin
  expect(s).toContain(">10<"); // xmax
});

test("axes:false drops the axes and labels, keeps the curve", () => {
  const s = linePlotSvg(sample(Math.sin, -Math.PI, Math.PI), { axes: false });
  expect(count(s, "polyline")).toBe(1); // curve still drawn
  expect(count(s, "line")).toBe(0); // no axes
  expect(count(s, "text")).toBe(0); // no labels
});

test("a log x-scale relabels the range with the raw endpoints", () => {
  const s = linePlotSvg(
    sample((x) => x, 1, 100, 30),
    { xScale: "log" },
  );
  expect(s).toContain(">1<"); // raw xmin, not log(1)=0 pixel space
  expect(s).toContain(">100<"); // raw xmax
});

test("log scale gaps out non-positive samples", () => {
  // y = x over [-2, 2]; the y-log scale rejects y <= 0, leaving only the top half.
  const s = linePlotSvg(
    sample((x) => x, -2, 2, 41),
    { yScale: "log" },
  );
  expect(count(s, "polyline")).toBe(1); // one segment, the positive part
});

test("several series overlay, each in its own colour", () => {
  const s = linePlotSvg([{ points: sample(Math.sin, -3, 3) }, { points: sample(Math.cos, -3, 3) }]);
  expect(count(s, "polyline")).toBe(2);
  expect(s).toContain("--notatio-accent"); // series 1
  expect(s).toContain("--notatio-series-2"); // series 2
});

test("points style draws a dot per finite sample instead of a line", () => {
  const pts = sample((x) => x * x, 0, 4, 9);
  const s = linePlotSvg([{ points: pts, style: "points" }]);
  expect(count(s, "polyline")).toBe(0);
  expect(count(s, "circle")).toBe(9);
});

test("a parametric curve (points not x-sorted) stays one segment", () => {
  const circle: PlotPoint[] = Array.from({ length: 60 }, (_, i) => {
    const t = (2 * Math.PI * i) / 59;
    return { x: Math.cos(t), y: Math.sin(t) };
  });
  const s = linePlotSvg(circle);
  expect(count(s, "polyline")).toBe(1);
  expect(s).toContain(">-1<"); // x range is the data range
});

test("hover marks the nearest sample of each series and lists coordinates", () => {
  const { svg, xAt } = linePlot(
    [
      { points: sample((x) => x, 0, 10, 11), label: "f" },
      { points: sample((x) => 2 * x, 0, 10, 11) },
    ],
    { hover: 3.2 },
  );
  expect(count(svg, "circle")).toBe(2); // one marker per series
  expect(svg).toContain("f: (3, 3)"); // labelled series snaps to x = 3
  expect(svg).toContain("(3, 6)");
  expect(count(svg, "line")).toBe(3); // two axes + the guide line
  // The pixel→data map inverts the x axis: left margin is xmin, right edge xmax.
  expect(xAt(38)).toBeCloseTo(0);
  expect(xAt(330)).toBeCloseTo(10);
});

test("without hover there is no readout", () => {
  const s = linePlotSvg(sample(Math.sin, -3, 3));
  expect(count(s, "circle")).toBe(0);
  expect(s).not.toContain("stroke-dasharray");
});

test("adaptiveSample stops after the first probe on a straight line", () => {
  // Each segment's midpoint is probed once to confirm it's straight; nothing
  // deeper. init + (init-1) probes, no recursion.
  const pts = adaptiveSample((x) => 2 * x + 1, 0, 10, { init: 11 });
  expect(pts.length).toBe(21);
  expect(pts[0]).toEqual({ x: 0, y: 1 });
  expect(pts.at(-1)).toEqual({ x: 10, y: 21 });
});

test("adaptiveSample refines where the curve bends, and stays ascending", () => {
  const pts = adaptiveSample((x) => Math.sin(1 / x), 0.05, 1, { init: 21, maxDepth: 8 });
  expect(pts.length).toBeGreaterThan(21); // the fast wiggle near lo forces splits
  const xs = pts.map((p) => p.x);
  expect([...xs].sort((a, b) => a - b)).toEqual(xs); // sorted, no dupes reorder
  // Density is higher near the small-x end (rapid oscillation) than the flat end.
  const half = (lo: number, hi: number): number => xs.filter((x) => x >= lo && x < hi).length;
  expect(half(0.05, 0.5)).toBeGreaterThan(half(0.5, 1));
});

test("adaptiveSample localizes a finiteness edge and respects the eval cap", () => {
  const pts = adaptiveSample((x) => (x < 0 ? Number.NaN : Math.sqrt(x)), -1, 1, {
    init: 9,
    maxDepth: 20,
    maxPoints: 60,
  });
  expect(pts.length).toBeLessThanOrEqual(60); // budget honoured despite deep maxDepth
  // Extra points cluster around the x=0 edge where finite meets non-finite.
  const near0 = pts.filter((p) => Math.abs(p.x) < 0.1).length;
  expect(near0).toBeGreaterThan(3);
});

test("niceTicks yields round 1/2/5 values inside the range", () => {
  expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
  expect(niceTicks(-1, 1, 4)).toEqual([-1, -0.5, 0, 0.5, 1]);
  expect(niceTicks(3, 3)).toEqual([]); // degenerate range
});

test("plotRange forces the y-window verbatim", () => {
  const s = linePlotSvg(sample(Math.sin, -3, 3), { plotRange: [-2, 2] });
  expect(s).toContain(">2<"); // ymax label is the forced 2
  expect(s).toContain(">-2<"); // ymin label
});

test("gridLines add faint lines but no extra labels; off by default", () => {
  const base = linePlotSvg(sample((x) => x, 0, 10));
  const grid = linePlotSvg(
    sample((x) => x, 0, 10),
    { gridLines: true },
  );
  expect(count(grid, "line")).toBeGreaterThan(count(base, "line"));
  expect(count(base, "line")).toBe(2); // default: just the two axes
});

test("fill draws a filled area under each line series", () => {
  const s = linePlotSvg(sample(Math.sin, -3, 3), { fill: true });
  expect(count(s, "polygon")).toBeGreaterThanOrEqual(1);
  expect(s).toContain("fill-opacity");
});

test("legend lists the labelled series", () => {
  const s = linePlotSvg(
    [
      { points: sample(Math.sin, -3, 3), label: "sin" },
      { points: sample(Math.cos, -3, 3), label: "cos" },
    ],
    { legend: true },
  );
  expect(s).toContain(">sin<");
  expect(s).toContain(">cos<");
});

test("axis labels render and are XML-escaped", () => {
  const s = linePlotSvg(
    sample((x) => x, 0, 10),
    { xLabel: "t", yLabel: "f<t>" },
  );
  expect(s).toContain(">t<");
  expect(s).toContain("f&lt;t&gt;"); // escaped, not raw <>
});

test("title renders centred above the frame and reserves headroom", () => {
  const s = linePlotSvg(sample(Math.sin, -3, 3), { title: "wave" });
  expect(s).toContain(">wave<");
  expect(s).toContain('text-anchor="middle"');
});

test("adaptiveParam keeps t-order and refines a curved arc more than a straight one", () => {
  // A straight diagonal: no planar bend -> only the probe layer, no recursion.
  const line = adaptiveParam((t) => [t, t], 0, 1, { init: 6 });
  expect(line.length).toBe(11); // init + probes, nothing deeper
  // A circle bends everywhere -> many extra points, and t-order is preserved.
  const circle = adaptiveParam((t) => [Math.cos(t), Math.sin(t)], 0, 2 * Math.PI, {
    init: 9,
    maxDepth: 6,
  });
  expect(circle.length).toBeGreaterThan(9);
  // First point is t=0 -> (1,0); the samples are NOT sorted by x (parametric).
  expect(circle[0].x).toBeCloseTo(1);
  const xs = circle.map((p) => p.x);
  expect([...xs].sort((a, b) => a - b)).not.toEqual(xs);
});

test("colorBy draws per-segment coloured strokes along a ramp", () => {
  const pts = sample(Math.sin, -3, 3, 20);
  const plain = linePlotSvg(pts);
  const ramped = linePlotSvg(pts, { colorBy: "y" });
  // Plain: one polyline. Ramped: one short polyline per adjacent pair.
  expect(count(plain, "polyline")).toBe(1);
  expect(count(ramped, "polyline")).toBe(19); // n-1 segments
  expect(ramped).toContain("color-mix"); // ramp colours
});

test("colorBy tints points mode too", () => {
  const s = linePlotSvg([{ points: sample((x) => x, 0, 4, 5), style: "points" }], { colorBy: "x" });
  expect(count(s, "circle")).toBe(5);
  expect(s).toContain("color-mix");
});
