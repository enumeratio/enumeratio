import { type BoxNode, graphicsOf, makeBoxes, optionsOfBox } from "@enumeratio/boxes";
import { expect, test } from "vite-plus/test";
import type { Complex } from "../src/complex-eval.ts";
import { complexSurfaceBox, sampleComplexSurface } from "../src/complex-plot-3d.ts";
import { graphics3dSvg } from "../src/graphics-3d-draw.ts";
import {
  complexPlotBox,
  complexPlotOptionsOf,
  complexViewOf,
  portraitColor,
  unsampledComplexPlotBox,
} from "../src/complex-plot-box.ts";
import { renderPlot } from "../src/plot-box.ts";
import { gradientNamed } from "../src/palettes.ts";
import { PLOT_NOTATION } from "../src/plot-notation.ts";
import { complexPlotSettingsOf } from "../src/symbols.ts";
import { imagesIn } from "./png.ts";

const phase = gradientNamed("phase");
const identity = (z: Complex): Complex => z;

test("a pole is white, a zero black, and a value with no magnitude is white as the shader makes it", () => {
  expect(portraitColor([Number.POSITIVE_INFINITY, 0], phase)).toBe("#ffffff");
  expect(portraitColor([Number.NaN, Number.NaN], phase)).toBe("#ffffff");
  expect(portraitColor([0, 0], phase)).toBe("#000000");
});

test("hue is the argument: red on the positive reals, cyan on the negative", () => {
  const [r, g, b] = [portraitColor([1, 0], phase), portraitColor([-1, 0], phase), portraitColor([0, 1], phase)];
  const channels = (hex: string): number[] => [1, 3, 5].map((k) => Number.parseInt(hex.slice(k, k + 2), 16));
  expect(channels(r)[0]!).toBeGreaterThan(channels(r)[1]!);
  expect(channels(g)[0]!).toBeLessThan(channels(g)[1]!);
  expect(b).not.toBe(r);
});

test("a larger magnitude is brighter", () => {
  const sum = (hex: string): number => [1, 3, 5].reduce((n, k) => n + Number.parseInt(hex.slice(k, k + 2), 16), 0);
  expect(sum(portraitColor([8, 0], phase))).toBeGreaterThan(sum(portraitColor([0.25, 0], phase)));
});

test("the raster has a cell per sample over the view, rows from the least imaginary part", () => {
  const box = complexPlotBox(identity, { resolution: 8, extent: 2, center: [1, 0] }) as BoxNode;
  expect(box[0]).toBe("GraphicsBox");
  const o = optionsOfBox(box);
  expect(o.PlotRange).toEqual([
    [0, 2],
    [-1, 1],
  ]);
  expect(o.Frame).toBe(true);
  const [image] = imagesIn(renderPlot(box).svg);
  expect([image!.width, image!.height]).toEqual([8, 8]);
  // z = x + iy: the bottom left is arg -3π/4 (cyan-ish), the top right arg π/4.
  expect(image!.pixels[7]![0]).not.toEqual(image!.pixels[0]![7]);
});

test("outside a mask the plane is a faint grid, not the portrait", () => {
  const [masked] = imagesIn(
    renderPlot(complexPlotBox(identity, { resolution: 6, extent: 4, mask: 0.5 }) as BoxNode).svg,
  );
  const corner = masked!.pixels[0]![0]!;
  expect(corner[0]).toBeLessThan(30);
  expect(corner[0]).toBe(corner[1]);
});

test("a function that throws leaves its cell clear", () => {
  const box = complexPlotBox(
    () => {
      throw new Error("no");
    },
    { resolution: 4 },
  );
  const [image] = imagesIn(renderPlot(box as BoxNode).svg);
  expect(image!.pixels.flat().every((p) => p[3] === 0)).toBe(true);
});

test("it is a pure function of its inputs", () => {
  const a = renderPlot(complexPlotBox(identity, { resolution: 12 }) as BoxNode).svg;
  expect(renderPlot(complexPlotBox(identity, { resolution: 12 }) as BoxNode).svg).toBe(a);
});

test("a hostile title or gradient name cannot reach the markup", () => {
  const nasty = `"><script>alert('x')</script>&`;
  const svg = renderPlot(complexPlotBox(identity, { resolution: 4, title: nasty, gradient: nasty }) as BoxNode).svg;
  expect(svg).not.toContain("<script");
  expect(svg).not.toContain("alert('x')");
  expect(svg).toContain("&lt;script&gt;");
});

test("the view reads a bare pair or an Epsil list, and ignores what is no number", () => {
  expect(complexViewOf({ center: "1.5,-2", extent: "3", mask: "1" })).toEqual({
    center: [1.5, -2],
    extent: 3,
    mask: 1,
  });
  expect(complexViewOf({ center: "[0.5, 0]" }).center).toEqual([0.5, 0]);
  expect(complexViewOf({ center: "[_c, 0]", extent: "-1", mask: "x" })).toEqual({
    center: [0, 0],
    extent: 2.4,
    mask: 0,
  });
  expect(complexViewOf({})).toEqual({ center: [0, 0], extent: 2.4, mask: 0 });
});

test("a ComplexPlot lowers to a raster not yet filled, holding its expression", () => {
  const expr = ["ComplexPlot", ["Zeta", "z"], "z", ["KeyValuePair", "Extent", 40]] as never;
  const box = makeBoxes(expr, PLOT_NOTATION) as BoxNode;
  expect(box[0]).toBe("InterpretationBox");
  const drawing = graphicsOf(box)!.box;
  expect(optionsOfBox(drawing).Producer).toBe("ComplexPlot");
  expect(optionsOfBox(drawing).PlotRange).toEqual([
    [-20, 20],
    [-20, 20],
  ]);
  expect(JSON.stringify(box)).toContain('"RasterBox"');
  expect(JSON.stringify(box)).toContain('"Zeta"');
});

test("settings name what the element reads", () => {
  const settings = complexPlotSettingsOf(["ComplexPlot", ["Zeta", "z"], "z", ["KeyValuePair", "Mask", 1]] as never);
  expect(settings).toMatchObject({ value: "zeta(z)", var: "z", mask: "1" });
  expect(complexPlotOptionsOf(settings!).mask).toBe(1);
  expect(complexPlotSettingsOf(["Plot", "x"] as never)).toBeUndefined();
  expect(graphicsOf(unsampledComplexPlotBox("z"))).toBeDefined();
});

test("a complex surface is one polygon complex, each face colored by its hue", () => {
  const surface = sampleComplexSurface(identity, { samples: 6, domain: [-1, 1, -1, 1] });
  const box = complexSurfaceBox(surface) as BoxNode;
  expect(box[0]).toBe("Graphics3DBox");
  const svg = graphics3dSvg(box);
  const fills = new Set([...svg.matchAll(/fill="(#[0-9a-f]{6}|hsl\([^"]*\))"/g)].map((m) => m[1]));
  expect(fills.size).toBeGreaterThan(4);
  expect(svg).not.toContain("<script");
});

test("a pole of a complex surface is clipped to the ceiling, not torn out", () => {
  const surface = sampleComplexSurface(([re, im]) => [1 / (re * re + im * im || 0), 0], {
    samples: 5,
    domain: [-1, 1, -1, 1],
    maxHeight: 3,
  });
  expect(Math.max(...surface.heights.flat())).toBe(3);
  expect(graphics3dSvg(complexSurfaceBox(surface))).toContain("<polygon");
});

test("a hostile gradient name cannot reach a complex surface's markup", () => {
  const nasty = `"><script>alert('x')</script>`;
  const surface = sampleComplexSurface(identity, { samples: 4 });
  expect(graphics3dSvg(complexSurfaceBox(surface, { gradient: nasty, title: nasty }))).not.toContain("<script");
});

test("a ComplexPlot3D lowers to a surface not yet sampled, holding its expression", () => {
  const box = makeBoxes(
    ["ComplexPlot3D", ["Divide", 1, ["Add", ["Power", "z", 2], 1]]] as never,
    PLOT_NOTATION,
  ) as BoxNode;
  expect(box[0]).toBe("Graphics3DBox");
  expect(optionsOfBox(box).Producer).toBe("ComplexPlot3D");
  expect(JSON.stringify(box)).toContain('"Divide"');
});
