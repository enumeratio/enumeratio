import { expect, it } from "vite-plus/test";
import { drawTiles, type TileLayer } from "../src/tiles-canvas.ts";

// Enough of a canvas context and Path2D to draw into nothing.
class Path {
  rect(): void {}
  moveTo(): void {}
  lineTo(): void {}
  closePath(): void {}
}
(globalThis as { Path2D?: unknown }).Path2D ??= Path;
const ctx = new Proxy({}, { get: () => () => {}, set: () => true }) as unknown as CanvasRenderingContext2D;

it("keeps classifying, frame after frame, until the view is known, whatever the budget", () => {
  const known = new Set<string>();
  const layer: TileLayer = {
    basis: [
      [1, 0],
      [0, 1],
    ],
    maxIndex: 1_000,
    known: (i, j) => known.has(`${i},${j}`),
    prepare: (i, j) => void known.add(`${i},${j}`),
    has: () => false,
    value: () => undefined,
    relatedTo: () => false,
  };
  const options = {
    colorRules: [],
    boundaryRules: [],
    colorMixing: "First" as const,
    selection: [],
    fill: 0.9,
    phase: 0,
    budgetMs: 0,
  };
  let frames = 0;
  while (frames < 10_000 && !drawTiles(ctx, 400, 400, layer, { center: [0, 0], extent: 50 }, options)) frames++;
  // A 100 × 100 view: every point classified, a bounded number of frames later.
  expect(known.size).toBeGreaterThanOrEqual(100 * 100);
  expect(frames).toBeLessThan(1_000);
});
