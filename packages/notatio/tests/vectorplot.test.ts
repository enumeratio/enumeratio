import { expect, test } from "vite-plus/test";
import { arrowPath, type Field2d, sampleField, streamline, vectorPlotSvg } from "../src/vectorplot.ts";

const count = (s: string, tag: string): number => s.split(`<${tag}`).length - 1;

/** Rigid rotation: F = (-y, x). Streamlines are circles about the origin. */
const rotation: Field2d = (x, y) => [-y, x];
/** Uniform flow to the right. */
const uniform: Field2d = () => [1, 0];

// ---------------------------------------------------------------------------
// sampleField
// ---------------------------------------------------------------------------

test("samples land on cell centres, nx*ny of them", () => {
  const s = sampleField(uniform, 0, 2, 0, 2, 2, 2);
  expect(s.length).toBe(4);
  // Cells are 1x1, so centres are at 0.5 and 1.5 on each axis.
  expect(s.map((p) => [p.x, p.y])).toEqual([
    [0.5, 0.5],
    [1.5, 0.5],
    [0.5, 1.5],
    [1.5, 1.5],
  ]);
});

test("magnitude is precomputed per sample", () => {
  const [s] = sampleField(() => [3, 4], 0, 1, 0, 1, 1, 1);
  expect(s.mag).toBe(5);
});

test("non-finite and throwing samples are dropped", () => {
  const spotty: Field2d = (x) => (x < 1 ? [Number.NaN, 0] : [1, 1]);
  expect(sampleField(spotty, 0, 2, 0, 1, 2, 1).length).toBe(1);
  const throwy: Field2d = () => {
    throw new Error("singular");
  };
  expect(sampleField(throwy, 0, 1, 0, 1, 2, 2)).toEqual([]);
});

test("a degenerate grid samples nothing", () => {
  expect(sampleField(uniform, 0, 1, 0, 1, 0, 3)).toEqual([]);
});

// ---------------------------------------------------------------------------
// arrowPath
// ---------------------------------------------------------------------------

test("a horizontal arrow has its shaft on the given segment", () => {
  const d = arrowPath(0, 0, 10, 0, 4);
  expect(d.startsWith("M0,0 L10,0")).toBe(true);
  // Two barbs meet at the tip, so the head sub-path passes through (10,0).
  expect(d).toContain("L10,0 L");
});

test("barbs sit behind the tip and straddle the shaft", () => {
  const d = arrowPath(0, 0, 10, 0, 4);
  const pts = [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(([, x, y]) => [Number(x), Number(y)]);
  // M(0,0) L(10,0) M(lx,ly) L(10,0) L(rx,ry)
  const [lx, ly] = pts[2];
  const [rx, ry] = pts[4];
  expect(lx).toBeLessThan(10);
  expect(rx).toBeLessThan(10);
  expect(ly).toBeCloseTo(-ry, 6);
});

test("a zero-length arrow yields no path", () => {
  expect(arrowPath(3, 3, 3, 3)).toBe("");
});

test("the head never outgrows the shaft", () => {
  const d = arrowPath(0, 0, 1, 0, 8);
  const pts = [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(([, x]) => Number(x));
  // Head length is clamped to the 1px shaft, so no barb reaches back past 0.
  expect(Math.min(...pts)).toBeGreaterThanOrEqual(0);
});

// ---------------------------------------------------------------------------
// streamline
// ---------------------------------------------------------------------------

const box = { x0: -2, x1: 2, y0: -2, y1: 2 };

test("uniform flow traces a straight horizontal line", () => {
  const pts = streamline(uniform, 0, 0, box, { step: 0.5, maxSteps: 3 });
  // 3 back + seed + 3 forward, all on y = 0 and evenly spaced in x.
  expect(pts.length).toBe(7);
  for (const p of pts) expect(p.y).toBeCloseTo(0, 9);
  expect(pts[0].x).toBeCloseTo(-1.5, 9);
  expect(pts[6].x).toBeCloseTo(1.5, 9);
});

test("rotation keeps a streamline on its circle", () => {
  const pts = streamline(rotation, 1, 0, box, { step: 0.1, maxSteps: 30 });
  // RK4 on the normalised field: the radius drifts only at fourth order.
  for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 3);
});

test("integration stops at the bounds", () => {
  const pts = streamline(uniform, 0, 0, box, { step: 0.5, maxSteps: 100 });
  for (const p of pts) {
    expect(p.x).toBeGreaterThanOrEqual(box.x0);
    expect(p.x).toBeLessThanOrEqual(box.x1);
  }
});

test("a seed outside the bounds traces nothing", () => {
  expect(streamline(uniform, 99, 0, box, { step: 0.1 })).toEqual([]);
});

test("a stagnation point yields the seed alone", () => {
  // F = 0 everywhere: the normalised direction is undefined, so no step is taken.
  const pts = streamline(() => [0, 0], 0, 0, box, { step: 0.1, maxSteps: 10 });
  expect(pts).toEqual([{ x: 0, y: 0 }]);
});

test("bidirectional:false drops the upstream tail", () => {
  const pts = streamline(uniform, 0, 0, box, {
    step: 0.5,
    maxSteps: 3,
    bidirectional: false,
  });
  expect(pts.length).toBe(4);
  expect(pts[0]).toEqual({ x: 0, y: 0 });
});

test("streamline is deterministic: identical input yields identical output", () => {
  const a = streamline(rotation, 1, 0.5, box, { step: 0.1, maxSteps: 25 });
  const b = streamline(rotation, 1, 0.5, box, { step: 0.1, maxSteps: 25 });
  expect(a).toEqual(b);
});

// ---------------------------------------------------------------------------
// vectorPlotSvg
// ---------------------------------------------------------------------------

test("vector mode draws one arrow path per sample", () => {
  const s = vectorPlotSvg(rotation, -2, 2, -2, 2, { n: 5 });
  expect(s).toContain('viewBox="0 0 340 200"');
  expect(s).toContain('aria-label="vector plot"');
  // 25 samples; the near-zero one at the centre may fall under the length floor.
  expect(count(s, "path")).toBeGreaterThan(15);
  expect(count(s, "path")).toBeLessThanOrEqual(25);
});

test("a uniform field draws every arrow at full length", () => {
  const s = vectorPlotSvg(uniform, 0, 1, 0, 1, { n: 3, axes: false });
  expect(count(s, "path")).toBe(9);
});

test("a zero field draws no arrows", () => {
  const s = vectorPlotSvg(() => [0, 0], -1, 1, -1, 1, { n: 4 });
  expect(count(s, "path")).toBe(0);
});

test("stream mode draws streamline paths and a direction head", () => {
  const s = vectorPlotSvg(rotation, -2, 2, -2, 2, { type: "stream", n: 4, steps: 20 });
  expect(s).toContain('aria-label="stream plot"');
  // A line plus its mid-line head, per seed that traced ≥ 2 points.
  expect(count(s, "path")).toBeGreaterThan(4);
});

test("axes:false drops the frame and its labels", () => {
  const withAxes = vectorPlotSvg(rotation, -1, 1, -1, 1, { n: 4 });
  const without = vectorPlotSvg(rotation, -1, 1, -1, 1, { n: 4, axes: false });
  expect(count(withAxes, "text")).toBeGreaterThan(0);
  expect(count(without, "text")).toBe(0);
});

test("an inverted or empty range yields a bare frame", () => {
  expect(count(vectorPlotSvg(rotation, 2, -2, -2, 2, { n: 4 }), "path")).toBe(0);
  expect(count(vectorPlotSvg(rotation, 0, 0, 0, 0, { n: 4 }), "path")).toBe(0);
});

test("a title renders centred above the frame", () => {
  const s = vectorPlotSvg(rotation, -1, 1, -1, 1, { n: 3, title: "Rotation" });
  expect(s).toContain(">Rotation<");
});

test("axis labels are escaped, not injected", () => {
  const s = vectorPlotSvg(uniform, -1, 1, -1, 1, { n: 2, xLabel: "<x>" });
  expect(s).toContain("&lt;x&gt;");
  expect(s).not.toContain("<x>");
});

test("determinism: the same field renders byte-identical SVG twice", () => {
  const opts = { n: 6, title: "F" } as const;
  expect(vectorPlotSvg(rotation, -2, 2, -2, 2, opts)).toBe(vectorPlotSvg(rotation, -2, 2, -2, 2, opts));
});

test("determinism holds for streamlines too", () => {
  const opts = { type: "stream", n: 5, steps: 30 } as const;
  expect(vectorPlotSvg(rotation, -2, 2, -2, 2, opts)).toBe(vectorPlotSvg(rotation, -2, 2, -2, 2, opts));
});
