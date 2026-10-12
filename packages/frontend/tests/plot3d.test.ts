import { expect, test } from "vite-plus/test";

const grid = (nx: number, ny: number, f: (x: number, y: number) => number): number[][] =>
  Array.from({ length: ny }, (_, j) => Array.from({ length: nx }, (_, i) => f(i, j)));

test("the scene paints on a canvas with one fill per face", async () => {
  const { drawSurfaceScene, surfaceScene } = await import("../src/plot3d.ts");
  const scene = surfaceScene([grid(5, 4, (x, y) => x + y)], {
    title: "t",
    colorLegend: true,
    hover: [180, 130],
  });
  expect(scene.faces.count).toBe(4 * 3);
  const calls: Record<string, number> = {};
  const count = (name: string) => () => {
    calls[name] = (calls[name] ?? 0) + 1;
  };
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get: (_, name: string) => count(name),
    set: () => true,
  });
  drawSurfaceScene(ctx, scene, { fg: "#000", bg: "#fff", edge: "#888", accent: "#d97706" });
  // The faces, the legend swatches, and the readout marker.
  expect(calls.fill).toBe(scene.faces.count + 1);
  expect(calls.fillRect).toBe(scene.legend?.swatches.length);
  expect(calls.fillText).toBeGreaterThanOrEqual(3 + 2 + 1 + 1); // ticks, legend, title, readout
  expect(calls.clearRect).toBe(1);
});
