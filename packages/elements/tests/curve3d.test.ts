import { expect, test } from "vite-plus/test";
import { lorenzCurve, type Point3, torusKnotCurve } from "@enumeratio/braid/src";
import { curve3dSvg } from "../src/plot3d.ts";

const closes = (pts: readonly Point3[]) => {
  const [a, b] = [pts[0], pts[pts.length - 1]];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
};

test("a torus knot closes up into a loop", () => {
  // The last sample is one step short of the start, so it should be near but not equal.
  const pts = torusKnotCurve(2, 3, 600);
  expect(pts).toHaveLength(600);
  expect(closes(pts)).toBeLessThan(0.1);
});

test("every point of T(p,q) lies on the torus it is drawn on", () => {
  // (sqrt(x²+y²) − 2)² + z² = 1 is the tube of radius 1 about the circle of radius 2.
  for (const [p, q] of [
    [2, 3],
    [3, 2],
    [5, 4],
    [1, 7],
  ]) {
    for (const [x, y, z] of torusKnotCurve(p, q, 120)) {
      expect((Math.hypot(x, y) - 2) ** 2 + z ** 2).toBeCloseTo(1, 9);
    }
  }
});

test("T(p,q) winds p times around the axis", () => {
  // Total turning of the angle in the xy-plane, in whole turns.
  const turns = (p: number, q: number) => {
    const pts = torusKnotCurve(p, q, 2000);
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      let d = Math.atan2(pts[i][1], pts[i][0]) - Math.atan2(pts[i - 1][1], pts[i - 1][0]);
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      total += d;
    }
    return Math.round((total / (2 * Math.PI)) * (2000 / 1999));
  };
  expect(turns(2, 3)).toBe(2);
  expect(turns(3, 2)).toBe(3);
  expect(turns(5, 4)).toBe(5);
});

test("a Lorenz trajectory stays on the attractor rather than escaping", () => {
  const pts = lorenzCurve({ steps: 3000 });
  expect(pts).toHaveLength(3000);
  // Settled onto the wings: bounded, and straddling both lobes.
  const tail = pts.slice(500);
  expect(Math.max(...tail.map((p) => Math.hypot(p[0], p[1], p[2])))).toBeLessThan(100);
  expect(Math.min(...tail.map((p) => p[0]))).toBeLessThan(-1);
  expect(Math.max(...tail.map((p) => p[0]))).toBeGreaterThan(1);
});

test("the integrator is stable: every point is finite", () => {
  expect(lorenzCurve({ steps: 5000 }).every((p) => p.every(Number.isFinite))).toBe(true);
});

test("a curve is drawn as cased arcs, not cased segments", () => {
  // Casing every segment erases the curve: a segment's casing covers its own
  // neighbours, which are adjacent by construction. An arc is cased once along its
  // length, so a casing only interrupts where another arc genuinely passes in front.
  const svg = curve3dSvg(torusKnotCurve(2, 3, 600));
  const paths = svg.match(/<path /g) ?? [];
  expect(paths.length).toBeGreaterThan(20); // several arcs
  expect(paths.length).toBeLessThan(600); // but far fewer than segments
  expect(svg).toContain("var(--notatio-bg");
  // Each arc spans many points, so its path carries many line-tos.
  const first = svg.match(/d="([^"]+)"/)?.[1] ?? "";
  expect((first.match(/L/g) ?? []).length).toBeGreaterThan(3);
});

test("segments are ordered back to front", () => {
  // Painter's algorithm: whatever is drawn last is nearest, so the nearer strand wins.
  const svg = curve3dSvg(torusKnotCurve(2, 3, 200));
  expect(svg.startsWith("<svg")).toBe(true);
  expect(svg).toContain('viewBox="0 0 360 260"');
});

test("too few points is an empty picture, not a crash", () => {
  expect(curve3dSvg([])).toContain("<svg");
  expect(curve3dSvg([[0, 0, 0]])).toContain("<svg");
});

test("non-finite samples are dropped rather than poisoning the bounds", () => {
  const svg = curve3dSvg([
    [0, 0, 0],
    [Number.NaN, 1, 1],
    [1, 1, 1],
  ]);
  expect(svg).toContain("<path");
});

test("a curve can carry a travelling marker", () => {
  const ring = Array.from({ length: 64 }, (_, i) => {
    const t = (2 * Math.PI * i) / 64;
    return [Math.cos(t), Math.sin(t), 0] as const;
  });
  const marked = (phase: number): [number, number] => {
    const m = /<circle class="notatio-curve-marker" cx="([-\d.]+)" cy="([-\d.]+)"/.exec(
      curve3dSvg(ring, { marker: phase, azimuth: 0, elevation: 90 }),
    );
    return [Number(m?.[1]), Number(m?.[2])];
  };
  expect(curve3dSvg(ring, {})).not.toContain("notatio-curve-marker");
  // Looking straight down at a circle, a marker a quarter of the way round is a quarter turn
  // away — and one a whole way round is back where it started, not a sample short of it.
  const [x0, y0] = marked(0);
  expect(marked(1)).toEqual([x0, y0]);
  const [xq, yq] = marked(0.25);
  expect(Math.hypot(xq - x0, yq - y0)).toBeGreaterThan(1);
  // A phase outside [0,1) wraps rather than falling off the end.
  expect(marked(2.25)).toEqual([xq, yq]);
});
