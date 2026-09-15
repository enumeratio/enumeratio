import { expect, test } from "vite-plus/test";
import { atPhase, strands, torusSquareSvg } from "../src/torussquare.ts";

/** Distance from a point to the segment it should be sitting on. */
const offLine = (
  [x, y]: readonly [number, number],
  from: readonly [number, number],
  to: readonly [number, number],
): number => {
  const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
  const length = Math.hypot(dx, dy) || 1;
  const along = Math.max(0, Math.min(1, ((x - from[0]) * dx + (y - from[1]) * dy) / length ** 2));
  return Math.hypot(x - (from[0] + along * dx), y - (from[1] + along * dy));
};

test("the line is cut exactly where it leaves the square", () => {
  // A line of slope q/p leaves an edge (p-1) + (q-1) times, so it arrives in p+q-1 pieces.
  for (const [p, q] of [
    [2, 3],
    [3, 7],
    [1, 5],
    [5, 4],
    [1, 1],
  ] as const)
    expect(strands(p, q).length, `T(${p},${q})`).toBe(p + q - 1);
});

test("every piece stays inside the square", () => {
  for (const { from, to } of strands(3, 7))
    for (const value of [...from, ...to]) {
      expect(value).toBeGreaterThanOrEqual(-1e-9);
      expect(value).toBeLessThanOrEqual(1 + 1e-9);
    }
});

test("every piece has slope q/p — it is one straight line, cut up", () => {
  const [p, q] = [3, 7];
  for (const { from, to } of strands(p, q)) {
    const run = to[0] - from[0];
    const rise = to[1] - from[1];
    expect(rise / run).toBeCloseTo(q / p, 9);
  }
});

test("the travelling point is on the line at every moment", () => {
  // The point and the line are computed by different routes — one by wrapping a parameter, the
  // other by cutting at whole turns — so agreeing is a real check rather than a tautology.
  const [p, q] = [3, 7];
  const pieces = strands(p, q);
  for (let i = 0; i <= 200; i++) {
    const phase = i / 200;
    const at = atPhase(p, q, phase);
    const nearest = Math.min(...pieces.map((s) => offLine(at, s.from, s.to)));
    expect(nearest, `phase ${phase}`).toBeLessThan(1e-9);
  }
});

test("the point returns to the start after one cycle, and not before", () => {
  const [p, q] = [2, 3];
  expect(atPhase(p, q, 0)).toEqual([0, 0]);
  expect(atPhase(p, q, 1)[0]).toBeCloseTo(0, 9);
  expect(atPhase(p, q, 1)[1]).toBeCloseTo(0, 9);
  // Halfway through, it is back on neither circle's start.
  const half = atPhase(p, q, 0.5);
  expect(half[0]).toBeCloseTo(0, 9); // p = 2 has come round once
  expect(half[1]).toBeCloseTo(0.5, 9); // q = 3 has not
});

test("T(p,q) and T(q,p) are the same line, reflected in the diagonal", () => {
  // Which is the whole reason they are the same knot: swapping p and q is swapping which circle
  // you call which, and a torus does not care.
  const flipped = strands(7, 3).map(({ from, to }) => ({
    from: [from[1], from[0]] as const,
    to: [to[1], to[0]] as const,
  }));
  const key = (s: { from: readonly number[]; to: readonly number[] }): string =>
    [...s.from, ...s.to]
      .map((v) => v.toFixed(6))
      .sort()
      .join(" ");
  expect(new Set(flipped.map(key))).toEqual(new Set(strands(3, 7).map(key)));
});

test("nonsense winds draw nothing rather than throwing", () => {
  expect(strands(0, 3)).toEqual([]);
  expect(strands(2.5, 3)).toEqual([]);
  expect(strands(-1, 3)).toEqual([]);
});

test("the figure draws the line, the point and the two circles", () => {
  const svg = torusSquareSvg(2, 3, { phase: 0.25 });
  expect(svg).toContain("notatio-square-marker");
  expect(svg).toContain("round the hole ×2");
  expect(svg).toContain("round the tube ×3");
  // Without a phase there is no point on it — a figure for a printed argument.
  expect(torusSquareSvg(2, 3)).not.toContain("notatio-square-marker");
  expect(torusSquareSvg(2, 3, { phase: 0.25, dials: false })).toContain("notatio-square-marker");
});
