import { expect, test } from "vite-plus/test";
import { polarPlotSvg, polarToCartesian, samplePolar } from "../src/polarplot.ts";

const count = (s: string, tag: string): number => s.split(`<${tag}`).length - 1;

// ---------------------------------------------------------------------------
// polarToCartesian
// ---------------------------------------------------------------------------

test("the four cardinal angles map to the axes", () => {
  expect(polarToCartesian(0, 1).x).toBeCloseTo(1, 9);
  expect(polarToCartesian(0, 1).y).toBeCloseTo(0, 9);
  expect(polarToCartesian(Math.PI / 2, 2).x).toBeCloseTo(0, 9);
  expect(polarToCartesian(Math.PI / 2, 2).y).toBeCloseTo(2, 9);
  expect(polarToCartesian(Math.PI, 1).x).toBeCloseTo(-1, 9);
});

test("a negative radius points the opposite way", () => {
  const a = polarToCartesian(0, -1);
  expect(a.x).toBeCloseTo(-1, 9);
  expect(a.y).toBeCloseTo(0, 9);
});

// ---------------------------------------------------------------------------
// samplePolar
// ---------------------------------------------------------------------------

test("sampling includes both endpoints", () => {
  const pts = samplePolar((t) => t, 0, 1, 3);
  expect(pts.map((p) => p.theta)).toEqual([0, 0.5, 1]);
  expect(pts.map((p) => p.r)).toEqual([0, 0.5, 1]);
});

test("a throwing or non-finite r comes back as NaN, not a dropped sample", () => {
  const pts = samplePolar((t) => (t === 0 ? Number.POSITIVE_INFINITY : 1), 0, 1, 3);
  expect(pts.length).toBe(3);
  expect(Number.isFinite(pts[0].r)).toBe(false);
  const thrown = samplePolar(
    () => {
      throw new Error("pole");
    },
    0,
    1,
    2,
  );
  expect(thrown.every((p) => Number.isNaN(p.r))).toBe(true);
});

test("the sample count is clamped to at least two", () => {
  expect(samplePolar(() => 1, 0, 1, 1).length).toBe(2);
});

// ---------------------------------------------------------------------------
// polarPlotSvg
// ---------------------------------------------------------------------------

/** The unit circle r = 1, sampled at `n` angles. */
const circle = (n: number) => samplePolar(() => 1, 0, 2 * Math.PI, n);

test("a circle draws one curve path on a square viewBox", () => {
  const s = polarPlotSvg(circle(64));
  expect(s).toContain('viewBox="0 0 260 260"');
  expect(count(s, "path")).toBe(1);
});

test("r = 1 lands exactly on the outer radius at theta = 0", () => {
  // Default 260x260, pad 14 -> R = 116, centre (130, 130).
  const s = polarPlotSvg(circle(5), { axes: false });
  expect(s).toContain("M246,130");
});

test("the polar grid draws rings and twelve spokes", () => {
  const s = polarPlotSvg(circle(16));
  expect(count(s, "circle")).toBeGreaterThan(0);
  expect(count(s, "line")).toBe(12);
});

test("axes:false drops the grid entirely", () => {
  const s = polarPlotSvg(circle(16), { axes: false });
  expect(count(s, "circle")).toBe(0);
  expect(count(s, "line")).toBe(0);
  expect(count(s, "text")).toBe(0);
});

test("a pole (non-finite r) breaks the curve into subpaths", () => {
  const pts = [
    { theta: 0, r: 1 },
    { theta: 1, r: Number.NaN },
    { theta: 2, r: 1 },
    { theta: 3, r: 1 },
  ];
  const s = polarPlotSvg(pts, { axes: false });
  // Two runs -> two "M" move commands in the single path's `d`.
  expect((s.match(/M\d/g) ?? []).length).toBe(2);
});

test("markers draw a dot per finite sample", () => {
  const s = polarPlotSvg(circle(8), { axes: false, markers: true });
  expect(count(s, "circle")).toBe(8);
});

test("filled adds a translucent region under the stroked curve", () => {
  const plain = polarPlotSvg(circle(32), { axes: false });
  const filled = polarPlotSvg(circle(32), { axes: false, filled: true });
  expect(count(plain, "path")).toBe(1);
  expect(count(filled, "path")).toBe(2);
  expect(filled).toContain("Z");
});

test("max pins the outer radius, shrinking the drawn curve", () => {
  const s = polarPlotSvg(circle(5), { axes: false, max: 2 });
  // r = 1 at half the pinned radius: 130 + 116/2 = 188.
  expect(s).toContain("M188,130");
});

test("no finite samples yields a bare frame", () => {
  expect(count(polarPlotSvg([]), "path")).toBe(0);
  expect(count(polarPlotSvg([{ theta: 0, r: Number.NaN }]), "path")).toBe(0);
});

test("a title renders centred above the plot", () => {
  const s = polarPlotSvg(circle(8), { title: "Cardioid" });
  expect(s).toContain(">Cardioid<");
});

test("determinism: the same samples render byte-identical SVG twice", () => {
  const pts = samplePolar((t) => 1 + Math.cos(t), 0, 2 * Math.PI, 120);
  const opts = { filled: true, title: "r = 1 + cos θ" };
  expect(polarPlotSvg(pts, opts)).toBe(polarPlotSvg(pts, opts));
});
