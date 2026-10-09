import { expect, test } from "vite-plus/test";
import { type Box, type BoxNode, optionsOfBox } from "@enumeratio/boxes";
import { renderDiagram } from "../src/diagram.ts";
import { diagramBoxOf, followsClock } from "../src/diagram-lowering.ts";
import { plotItems } from "../src/plot-box.ts";
import { atPhase, strands, torusSquareBox } from "../src/torussquare.ts";

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
      .toSorted()
      .join(" ");
  expect(new Set(flipped.map(key))).toEqual(new Set(strands(3, 7).map(key)));
});

test("nonsense winds draw nothing rather than throwing", () => {
  expect(strands(0, 3)).toEqual([]);
  expect(strands(2.5, 3)).toEqual([]);
  expect(strands(-1, 3)).toEqual([]);
});

const rolesOf = (box: Box): string[] => plotItems(box as BoxNode).map((i) => i.role);

test("the figure draws the line, the point and the two circles", () => {
  const box = torusSquareBox(2, 3, { phase: 0.25 });
  const svg = renderDiagram(box as BoxNode);
  expect(svg).toContain("round the hole ×2");
  expect(svg).toContain("round the tube ×3");
  expect(rolesOf(box).filter((r) => r === "Strand")).toHaveLength(strands(2, 3).length);
  expect(rolesOf(box).filter((r) => r === "Dial")).toHaveLength(6); // a ring, a spoke and a dot, twice
  expect(rolesOf(box)).toContain("Marker");
  // The tube's caption reads upward along the square's left edge.
  const tube = plotItems(box as BoxNode).find((i) => i.prim[1] === "round the tube ×3")!;
  expect(optionsOfBox(tube.prim).Direction).toEqual([expect.closeTo(0, 9), 1]);
  expect(svg).toContain("rotate(-90");
  // Without a phase there is no point on it — a figure for a printed argument.
  expect(rolesOf(torusSquareBox(2, 3))).not.toContain("Marker");
  expect(rolesOf(torusSquareBox(2, 3, { phase: 0.25, dials: false }))).toContain("Marker");
  expect(rolesOf(torusSquareBox(2, 3, { phase: 0.25, dials: false }))).not.toContain("Dial");
});

test("TorusSquare lowers to a diagram box, its point pinned by At or following the clock", () => {
  const pinned = diagramBoxOf({ layout: "torus", p: "2", q: "3", phase: "0.32" })!;
  expect(rolesOf(pinned)).toContain("Marker");
  expect(followsClock({ layout: "torus", phase: "0.32" })).toBe(false);
  expect(followsClock({ layout: "torus", clock: "False" })).toBe(false);
  expect(followsClock({ layout: "torus" })).toBe(true);
  expect(rolesOf(diagramBoxOf({ layout: "torus", p: "2", q: "3", clock: "False" })!)).not.toContain("Marker");
  // The clock's phase moves the point.
  const at = (phase: number): unknown =>
    plotItems(diagramBoxOf({ layout: "torus", p: "2", q: "3" }, phase) as BoxNode).find((i) => i.role === "Marker")!
      .prim;
  expect(at(0.1)).not.toEqual(at(0.2));
});
