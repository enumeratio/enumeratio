import { expect, test } from "vite-plus/test";
import { barChart3dSvg } from "../src/barchart3d.ts";
import { arrayPlotSvg, barChartSvg, boxWhiskerChartSvg, pieChartSvg } from "../src/chart.ts";
import { complexSurfaceSvg, hueColor, hueOf, type ComplexSurface } from "../src/complex-plot-3d.ts";
import { gradientUniform, MAX_STOPS, portraitShader } from "../src/complex-plot.ts";
import { contourSvg } from "../src/contour.ts";
import { densitySvg } from "../src/densityplot.ts";
import { mesh3dSvg, scatter3dSvg } from "../src/listplot3d.ts";
import { GRADIENTS, gradientNamed, rgbToOklab, hexToRgb, sampleGradient } from "../src/palettes.ts";
import { curve3dSvg, surfacesSvg } from "../src/plot3d.ts";
import { discreteName, gradientName, plotPalette } from "../src/plot-color.ts";
import { linePlotSvg } from "../src/plot.ts";
import { torusSquareSvg } from "../src/torussquare.ts";
import { vectorPlotSvg } from "../src/vectorplot.ts";

const grid = (n: number, f: (x: number, y: number) => number): number[][] =>
  Array.from({ length: n }, (_, j) => Array.from({ length: n }, (_, i) => f(i / (n - 1), j / (n - 1))));
const xs = [0, 1, 2, 3];
const ramp = grid(4, (x, y) => x + y);
const line = [0, 1, 2, 3].map((x) => ({ x, y: x * x }));

test("names are read without regard to case, and fall back to the defaults", () => {
  expect(gradientName(" Magma ")).toBe("magma");
  expect(gradientName("nonesuch")).toBe("viridis");
  expect(gradientName("nonesuch", "phase")).toBe("phase");
  expect(gradientName(undefined, "phase")).toBe("phase");
  expect(discreteName("SET1")).toBe("set1");
  expect(discreteName("nonesuch")).toBe("tableau10");
  expect(plotPalette().discrete.name).toBe("tableau10");
  expect(plotPalette({ reverse: true }).reversed).toBe(true);
});

// Each renderer: the gradient and the reverse flag change the output, an unknown name is the default.
const continuous: Record<string, (o: { gradient?: string; reverse?: boolean }) => string> = {
  // A plot clips to a random id per call.
  plot: (o) => linePlotSvg(line, { colorBy: "y", ...o }).replace(/nplot-\w+/g, ""),
  array: (o) => arrayPlotSvg(ramp, o),
  density: (o) => densitySvg(ramp, xs, xs, o),
  contourFilled: (o) => contourSvg(ramp, xs, xs, { filled: true, ...o }),
  contourLines: (o) => contourSvg(ramp, xs, xs, o),
  vector: (o) => vectorPlotSvg((x, y) => [-y, x], -1, 1, -1, 1, o),
  surface: (o) => surfacesSvg([ramp], { axes: false, xs, ys: xs, ...o }),
  barChart3d: (o) => barChart3dSvg(ramp, o),
  mesh: (o) => mesh3dSvg(ramp, o),
  scatter: (o) =>
    scatter3dSvg(
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
      ],
      o,
    ),
  curve: (o) =>
    curve3dSvg(
      Array.from({ length: 64 }, (_, k) => [Math.cos(k / 10), Math.sin(k / 10), k / 64] as const),
      o,
    ),
};

for (const [name, draw] of Object.entries(continuous)) {
  test(`${name}: the gradient and its reversal are choices`, () => {
    const plain = draw({});
    const magma = draw({ gradient: "magma" });
    expect(magma).not.toBe(plain);
    expect(draw({ gradient: "MAGMA" })).toBe(magma);
    expect(draw({ gradient: "magma", reverse: true })).not.toBe(magma);
    if (name !== "curve") expect(draw({ gradient: "nonesuch" })).toBe(plain);
  });
}

test("a curve in space colors along a cyclic rainbow unless told otherwise", () => {
  const points = Array.from({ length: 64 }, (_, k) => [Math.cos(k / 10), Math.sin(k / 10), k / 64] as const);
  expect(curve3dSvg(points)).toContain(`stroke="${sampleGradient(gradientNamed("sinebow"), 0)}"`);
  expect(curve3dSvg(points, { gradient: "viridis" })).toContain('stroke="#440154"');
});

test("series take the discrete scheme, one color each", () => {
  const two = [{ points: line }, { points: line.map((p) => ({ x: p.x, y: -p.y })) }];
  expect(linePlotSvg(two)).toContain('stroke="#4e79a7"');
  expect(linePlotSvg(two, { discrete: "set1" })).toContain('stroke="#e41a1c"');
  expect(linePlotSvg(two, { discrete: "set1" })).toContain('stroke="#377eb8"');
  expect(barChartSvg([1, 2, 3], { discrete: "set1" })).toContain('fill="#e41a1c"');
  expect(pieChartSvg([1, 2, 3], { discrete: "set1" })).toContain("#4daf4a");
  expect(
    boxWhiskerChartSvg(
      [
        [1, 2, 3],
        [2, 3, 4],
      ],
      { discrete: "set1" },
    ),
  ).toContain("#377eb8");
  expect(torusSquareSvg(2, 3, { discrete: "set1" })).toContain("#377eb8");
  expect(torusSquareSvg(2, 3)).toContain("#f28e2c");
  const surfaces = surfacesSvg([ramp, ramp.map((r) => r.map((v) => 6 - v))], { axes: false, discrete: "set1" });
  expect(surfaces).toContain("#e41a1c");
  expect(surfaces).toContain("#377eb8");
});

test("a lone surface takes the gradient; several keep a color each", () => {
  expect(surfacesSvg([ramp], { axes: false })).not.toContain("color-mix");
  expect(surfacesSvg([ramp, ramp], { axes: false })).toContain("color-mix");
});

test("the argument of a complex surface is colored on the phase wheel by default", () => {
  expect(hueColor(0)).toBe("#ff0000");
  expect(hueColor(0.5)).toMatch(/^#00f[c-f]ff$/); // cyan, to the table's 1/255
  expect(hueColor(Number.NaN)).toBe("hsl(0 0% 55%)");
  const surface: ComplexSurface = {
    heights: [
      [1, 1],
      [1, 1],
    ],
    hues: [
      [0, 0],
      [0, 0],
    ],
    xs: [0, 1],
    ys: [0, 1],
  };
  expect(complexSurfaceSvg(surface, { axes: false })).toContain('fill="#ff0000"');
  expect(complexSurfaceSvg(surface, { axes: false, gradient: "sinebow" })).toContain('fill="#ff4040"');
});

// ── The WGSL domain coloring ──────────────────────────────────────────────────────────────

test("the portrait and the complex surface agree: arg/2π along the gradient, red at arg 0", () => {
  expect(portraitShader("z")).toContain("fract(atan2(polar.y, polar.x) * 0.15915494);");
  expect(hueOf([1, 0])).toBe(0);
  expect(sampleGradient(gradientNamed("phase"), hueOf([1, 0]))).toBe("#ff0000");
});

test("every gradient fits the shader's stop table, in the space it blends in", () => {
  for (const g of GRADIENTS) {
    expect(g.stops.length).toBeLessThanOrEqual(MAX_STOPS);
    const u = gradientUniform(g);
    expect(u.length).toBe(MAX_STOPS * 4 + 4);
    expect(Array.from(u.slice(MAX_STOPS * 4))).toEqual([
      g.stops.length,
      g.space === "oklab" ? 1 : 0,
      g.cyclic ? 1 : 0,
      0,
    ]);
    const first = g.space === "oklab" ? rgbToOklab(hexToRgb(g.stops[0]!.color)) : hexToRgb(g.stops[0]!.color);
    first.forEach((v, i) => expect(u[i]).toBeCloseTo(v, 5));
    expect(u[3]).toBe(g.stops[0]!.at);
  }
  expect(gradientUniform(gradientNamed("phase"))[MAX_STOPS * 4 + 1]).toBe(0);
});
