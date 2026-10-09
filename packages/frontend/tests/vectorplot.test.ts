import { expect, test } from "vite-plus/test";
import { type BoxNode, makeBoxes, optionsOfBox } from "@enumeratio/boxes";
import { parseExpression } from "@enumeratio/formats/expression";
import { plainJson } from "../src/graphics-rules.ts";
import { isPlotBox, plotItems, renderPlot } from "../src/plot-box.ts";
import { unsampledPlot, vectorOptionsOf } from "../src/plot-lowering.ts";
import { PLOT_NOTATION } from "../src/plot-notation.ts";
import { plotSettingsOf } from "../src/symbols.ts";
import { type Field2d, sampleField, streamline, type VectorPlotOptions, vectorPlotBox } from "../src/vectorplot.ts";

const plot = (field: Field2d, x0: number, x1: number, y0: number, y1: number, opts: VectorPlotOptions = {}): BoxNode =>
  vectorPlotBox(field, x0, x1, y0, y1, opts) as BoxNode;
const heads = (box: BoxNode): string[] => plotItems(box).map((i) => i.prim[0]);
const count = (box: BoxNode, head: string): number => heads(box).filter((h) => h === head).length;
const svgOf = (box: BoxNode): string => renderPlot(box).svg;

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
// vectorPlotBox
// ---------------------------------------------------------------------------

test("a vector plot is a plot box: the frame is options, the range data", () => {
  const box = plot(rotation, -2, 2, -1, 1, { n: 5 });
  expect(isPlotBox(box)).toBe(true);
  expect(box[0]).toBe("GraphicsBox");
  expect(svgOf(box)).toContain('viewBox="0 0 340 200"');
});

test("vector mode lowers to one ArrowBox per sample", () => {
  const box = plot(rotation, -2, 2, -2, 2, { n: 5 });
  // 25 samples; the near-zero one at the centre may fall under the length floor.
  expect(count(box, "ArrowBox")).toBeGreaterThan(15);
  expect(count(box, "ArrowBox")).toBeLessThanOrEqual(25);
  expect(count(box, "LineBox")).toBe(0);
});

test("an arrow is centered on its sample and points along the field, in data coordinates", () => {
  const box = plot(uniform, 0, 1, 0, 1, { n: 2, axes: false });
  const [{ prim }] = plotItems(box);
  const [[ax, ay], [bx, by]] = (prim[1] as { Points: number[][] }).Points as [number[], number[]];
  expect((ax + bx) / 2).toBeCloseTo(0.25, 9);
  expect(ay).toBeCloseTo(0.25, 9);
  expect(by).toBeCloseTo(0.25, 9);
  expect(bx).toBeGreaterThan(ax);
});

test("a uniform field draws every arrow at full length", () => {
  const box = plot(uniform, 0, 1, 0, 1, { n: 3, axes: false });
  expect(count(box, "ArrowBox")).toBe(9);
  const lengths = plotItems(box).map(({ prim }) => {
    const [[ax], [bx]] = (prim[1] as { Points: number[][] }).Points as [number[], number[]];
    return bx - ax;
  });
  for (const length of lengths) expect(length).toBeCloseTo(lengths[0]!, 9);
});

test("a zero field draws no arrows", () => {
  expect(
    count(
      plot(() => [0, 0], -1, 1, -1, 1, { n: 4 }),
      "ArrowBox",
    ),
  ).toBe(0);
});

test("stream mode lowers to a LineBox and an ArrowBox head per streamline", () => {
  const box = plot(rotation, -2, 2, -2, 2, { type: "stream", n: 4, steps: 20 });
  expect(count(box, "LineBox")).toBeGreaterThan(2);
  expect(count(box, "ArrowBox")).toBe(count(box, "LineBox"));
});

test("a mark takes its color from |F| on the gradient", () => {
  const colors = (gradient: string): string[] =>
    plotItems(plot(rotation, -1, 1, -1, 1, { n: 4, gradient })).map(({ look }) => String(look.FaceForm));
  expect(new Set(colors("viridis")).size).toBeGreaterThan(1);
  expect(colors("magma")).not.toEqual(colors("viridis"));
  expect(colors("MAGMA")).toEqual(colors("magma"));
});

test("axes:false drops the axes and their labels", () => {
  const withAxes = svgOf(plot(rotation, -1, 1, -1, 1, { n: 4 }));
  const without = svgOf(plot(rotation, -1, 1, -1, 1, { n: 4, axes: false }));
  expect(withAxes.split("<text").length).toBeGreaterThan(1);
  expect(without.split("<text").length).toBe(1);
});

test("an inverted or empty range yields a bare box", () => {
  expect(plotItems(plot(rotation, 2, -2, -2, 2, { n: 4 }))).toEqual([]);
  expect(plotItems(plot(rotation, 0, 0, 0, 0, { n: 4 }))).toEqual([]);
});

test("a title renders centred above the frame", () => {
  expect(svgOf(plot(rotation, -1, 1, -1, 1, { n: 3, title: "Rotation" }))).toContain(">Rotation<");
});

test("axis labels are escaped, not injected", () => {
  const s = svgOf(plot(uniform, -1, 1, -1, 1, { n: 2, xLabel: "<x>" }));
  expect(s).toContain("&lt;x&gt;");
  expect(s).not.toContain("<x>");
});

test("determinism: the same field lowers to the same box twice", () => {
  const opts = { n: 6, title: "F" } as const;
  expect(plot(rotation, -2, 2, -2, 2, opts)).toEqual(plot(rotation, -2, 2, -2, 2, opts));
  expect(svgOf(plot(rotation, -2, 2, -2, 2, opts))).toBe(svgOf(plot(rotation, -2, 2, -2, 2, opts)));
});

test("determinism holds for streamlines too", () => {
  const opts = { type: "stream", n: 5, steps: 30 } as const;
  expect(plot(rotation, -2, 2, -2, 2, opts)).toEqual(plot(rotation, -2, 2, -2, 2, opts));
});

// ---------------------------------------------------------------------------
// The head as written
// ---------------------------------------------------------------------------

const settingsOf = (source: string): Record<string, string> | undefined => {
  const { json, errors } = parseExpression(source);
  expect(errors).toEqual([]);
  return plotSettingsOf(plainJson(json as never) as never);
};

test("a vector plot's options lower to the settings the box is drawn from", () => {
  const settings = settingsOf(
    'VectorPlot((Sin(y), Cos(x)), (x, -3, 3), (y, -2, 2), N -> 16, Label -> "F", XLabel -> "x", ColorFunction -> "Inferno")',
  )!;
  expect(settings).toMatchObject({
    u: "sin(y)",
    v: "cos(x)",
    xvar: "x",
    yvar: "y",
    n: "16",
    label: "F",
    gradient: "inferno",
  });
  const { x, y, options } = vectorOptionsOf(settings);
  expect([x, y]).toEqual([
    [-3, 3],
    [-2, 2],
  ]);
  expect(options).toMatchObject({ type: "vector", n: 16, title: "F", xLabel: "x", gradient: "inferno" });
});

test("a stream plot is the same field with streamlines", () => {
  const settings = settingsOf("StreamPlot((y, Sin(x)), (x, -3, 3), (y, -2, 2), Steps -> 80)")!;
  expect(vectorOptionsOf(settings).options).toMatchObject({ type: "stream", steps: 80 });
});

test("a field plot is a producer: its box holds the expression for an environment that can sample", () => {
  const { json } = parseExpression("VectorPlot((-y, x), (x, -2, 2), (y, -2, 2))");
  const box = makeBoxes(plainJson(json as never) as never, PLOT_NOTATION);
  expect(box[0]).toBe("GraphicsBox");
  expect(optionsOfBox(box as BoxNode).Producer).toBe("VectorPlot");
  expect(unsampledPlot(box)).toBeDefined();
});
