import { isBox, makeBoxes, optionsOfBox } from "@enumeratio/boxes";
import { parseExpression } from "@enumeratio/formats/expression";
import { expect, test } from "vite-plus/test";
import type { Triple } from "../src/plot3d.ts";
import { plainJson } from "../src/graphics-rules.ts";
import { gradientNamed, sampleGradient } from "../src/palettes.ts";
import { PLOT_NOTATION } from "../src/plot-notation.ts";
import { barChart3dBox, curveBox, heightShade, meshBox, scatterBox, surfaceBox } from "../src/graphics-3d-box.ts";
import { isGraphics3dBox, graphics3dHome, graphics3dSvg, unsampledGraphics3d } from "../src/graphics-3d-draw.ts";
import { barBoxOfSettings, gridFromPoints, holdsGraphics3d, listBoxOfSettings } from "../src/graphics-3d-lowering.ts";
import { graphics3dOfText, graphics3dSettingsOf } from "../src/symbols.ts";

const viridis = (t: number): string => sampleGradient(gradientNamed("viridis"), t);
const count = (s: string, tag: string): number => s.split(`<${tag}`).length - 1;
const polys = (s: string): string[] => [...s.matchAll(/<polygon points="([^"]+)"/g)].map(([, p]) => p!);
const circles = (s: string): [number, number][] =>
  [...s.matchAll(/<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)"/g)].map(([, x, y]) => [Number(x), Number(y)]);

/** The straight-on view (azimuth 0, elevation 0) of a framed-to-fit figure: x = 0 to 74 and 1 to 286, z = 0 to 236 and 1 to 24. */
const flat = { azimuth: 0, elevation: 0 } as const;

const grid = (nx: number, ny: number, f: (x: number, y: number) => number): number[][] =>
  Array.from({ length: ny }, (_, j) => Array.from({ length: nx }, (_, i) => f(i, j)));
const indices = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** A surface over the sample indices, drawn. */
const surface = (g: number[][], o: Parameters<typeof surfaceBox>[3] = {}, view = {}): string =>
  graphics3dSvg(surfaceBox([g], indices(g[0]?.length ?? 0), indices(g.length), o), view);

// ── The box ──────────────────────────────────────────────────────────────────────────────

test("a surface is one complex: every vertex once, the quads as indices", () => {
  const box = surfaceBox([grid(5, 4, (x, y) => x + y)], indices(5), indices(4));
  expect(isBox(box)).toBe(true);
  expect(isGraphics3dBox(box)).toBe(true);
  const complex = (box[1] as readonly unknown[])[1] as readonly unknown[][];
  expect(complex[0]![0]).toBe("GraphicsComplex3DBox");
  const [, polygon] = complex[0] as [
    string,
    [string, { Indices: unknown[]; FaceColors: string[] }],
    { Points: unknown[] },
  ];
  expect(polygon[0]).toBe("Polygon3DBox");
  expect(polygon[1].Indices).toHaveLength(4 * 3);
  expect(polygon[1].FaceColors).toHaveLength(4 * 3);
  expect((complex[0] as [string, unknown, { Points: unknown[] }])[2].Points).toHaveLength(20);
});

test("the chrome rides as options, and the box survives JSON", () => {
  const box = surfaceBox([grid(3, 3, (x, y) => x * y)], [0, 1, 2], [0, 10, 20], { title: "t", zScale: "sqrt" });
  const o = optionsOfBox(box as never);
  expect(o["PlotRange"]).toEqual([
    [0, 2],
    [0, 20],
    [0, 4],
  ]);
  expect(o["ScalingFunctions"]).toEqual(["linear", "linear", "sqrt"]);
  expect(o["PlotLabel"]).toBe("t");
  expect(JSON.parse(JSON.stringify(box))).toEqual(box);
  expect(graphics3dHome(box)).toEqual({ azimuth: 45, elevation: 15, zoom: 1 });
});

test("colors are resolved into the box: a drawer needs no gradient", () => {
  const box = surfaceBox([grid(3, 3, (x, y) => x + y)], [0, 1, 2], [0, 1, 2]);
  expect(JSON.stringify(box)).toContain(viridis(0.5));
});

// ── Surfaces ─────────────────────────────────────────────────────────────────────────────

test("surface emits one quad per grid cell", () => {
  const s = surface(
    grid(5, 4, (x, y) => x + y),
    { axes: false },
  );
  expect(s).toContain('viewBox="0 0 360 260"');
  expect(s).toContain('aria-label="surface plot"');
  expect(count(s, "polygon")).toBe(4 * 3);
});

test("cells touching a non-finite sample are dropped (a hole)", () => {
  const g = grid(4, 4, (x, y) => x * y);
  g[1]![1] = Number.NaN;
  expect(count(surface(g, { axes: false }), "polygon")).toBe(3 * 3 - 4);
});

test("degenerate grids yield an empty frame", () => {
  expect(count(graphics3dSvg(surfaceBox([[]], [], [])), "polygon")).toBe(0);
  expect(count(surface([[1, 2, 3]]), "polygon")).toBe(0);
});

test("a flat surface still renders (no divide-by-zero)", () => {
  // 4 surface cells + the floor rectangle of the axes box.
  expect(count(surface(grid(3, 3, () => 5)), "polygon")).toBe(4 + 1);
});

test("axes draw a floor + edges with range labels; Axes -> False drops them", () => {
  const g = grid(4, 4, (x, y) => x + y);
  const withAxes = graphics3dSvg(surfaceBox([g], [0, 1, 2, 3], [0, 10, 20, 30]));
  expect(count(withAxes, "line")).toBe(3);
  expect(withAxes).toContain(">30<");
  const without = surface(g, { axes: false });
  expect(count(without, "line")).toBe(0);
  expect(count(without, "polygon")).toBe(3 * 3);
});

test("the view rotates; elevation 90 flattens to a top view", () => {
  const g = grid(4, 4, (x, y) => x + y);
  const base = surface(g, { axes: false });
  const turned = surface(g, { axes: false }, { azimuth: 120 });
  expect(turned).not.toBe(base);
  expect(count(turned, "polygon")).toBe(9);
  // Straight down, height drops out: a flat and a sloped grid coincide.
  const flatTop = surface(
    grid(4, 4, () => 1),
    { axes: false },
    { elevation: 90 },
  );
  const slopedTop = surface(g, { axes: false }, { elevation: 90 });
  const bare = (s: string): string => s.replace(/fill="[^"]*"/g, "");
  expect(bare(flatTop)).toBe(bare(slopedTop));
});

test("the box's own view is where it starts, and a given view overrides it", () => {
  const g = grid(3, 3, (x, y) => x * y);
  const turned = surfaceBox([g], [0, 1, 2], [0, 1, 2], { azimuth: 120, axes: false });
  expect(graphics3dHome(turned).azimuth).toBe(120);
  expect(graphics3dSvg(turned)).toBe(surface(g, { axes: false }, { azimuth: 120 }));
  expect(graphics3dSvg(turned, { azimuth: 45 })).toBe(surface(g, { axes: false }));
});

test("zoom scales the projection about the frame center", () => {
  const g = grid(3, 3, () => 0);
  const xs = (s: string): number[] =>
    [...s.matchAll(/points="([^"]+)"/g)].flatMap((m) => m[1]!.split(" ").map((p) => Number(p.split(",")[0])));
  const spread = (v: number[]): number => Math.max(...v) - Math.min(...v);
  const a = xs(surface(g, { axes: false }));
  const b = xs(surface(g, { axes: false }, { zoom: 2 }));
  expect(spread(b)).toBeCloseTo(2 * spread(a), 0);
});

test("axes edges hang off the farthest floor corner for any azimuth", () => {
  const g = grid(3, 3, (x, y) => x * y);
  for (const azimuth of [0, 45, 135, 225, 315]) {
    const s = surface(g, {}, { azimuth });
    expect(count(s, "line")).toBe(3);
    expect(count(s, "text")).toBe(3);
  }
});

test("a title renders centered at the top", () => {
  expect(
    surface(
      grid(4, 4, (x, y) => x + y),
      { axes: false, title: "surf" },
    ),
  ).toContain(">surf<");
});

test("a color key draws a swatch bar with z-range labels", () => {
  const s = surface(
    grid(4, 4, (x, y) => x + y),
    { colorLegend: true },
  );
  // 8 swatches + the outline: rects the surface itself never adds.
  expect(count(s, "rect")).toBe(9);
  expect(s).toContain(">6<");
});

test("several surfaces overlay, their cells depth-sorted across all, each its own color", () => {
  const g1 = grid(4, 4, (x, y) => x + y);
  const g2 = grid(4, 4, (x, y) => 6 - x - y);
  const s = graphics3dSvg(surfaceBox([g1, g2], indices(4), indices(4), { axes: false }));
  expect(count(s, "polygon")).toBe(2 * 9);
  expect(s).toContain('fill-opacity="0.85"');
  expect(s).toContain("#4e79a7");
  expect(s).toContain("#f28e2c");
});

test("a lone surface takes the gradient; several keep a color each", () => {
  const g = grid(4, 4, (x, y) => x + y);
  expect(surface(g, { axes: false })).not.toContain("color-mix");
  expect(graphics3dSvg(surfaceBox([g, g], indices(4), indices(4), { axes: false }))).toContain("color-mix");
});

test("hover marks the nearest vertex and reads out its coordinates", () => {
  const g = grid(4, 4, (x, y) => x + y);
  expect(surface(g, {}, { hover: [1000, 1000] })).not.toContain('stroke-width="2"');
  expect(surface(g, {}, { hover: [180, 130] })).toContain('stroke-width="2"');
});

test("a scaling function bends an axis, and the labels read back through it", () => {
  const g = grid(3, 3, (x, y) => x + y + 1);
  const box = surfaceBox([g], [1, 10, 100], [0, 1, 2], { xScale: "log10" });
  expect(optionsOfBox(box as never)["PlotRange"]).toEqual([
    [1, 100],
    [0, 2],
    [1, 5],
  ]);
  expect(graphics3dSvg(box)).toContain(">100<");
});

// ── Meshes ───────────────────────────────────────────────────────────────────────────────

const mesh = (g: number[][], o: Parameters<typeof meshBox>[1] = {}, view = {}): string =>
  graphics3dSvg(meshBox(g, o), view);

test("an n by m grid draws (n-1)(m-1) quads", () => {
  const s = mesh(
    [
      [0, 1, 2],
      [1, 2, 3],
      [2, 3, 4],
    ],
    { axes: false },
  );
  expect(s).toContain('aria-label="3-D surface plot"');
  expect(count(s, "polygon")).toBe(4);
});

test("a quad's corners are exactly the projected samples", () => {
  const s = mesh(
    [
      [0, 1],
      [2, 3],
    ],
    { ...flat, axes: false },
    flat,
  );
  expect(s).toContain('points="74,236 286,165.33 286,24 74,94.67"');
  expect(s).toContain(viridis(0.5));
});

test("a quad touching a non-finite sample leaves a hole", () => {
  expect(
    count(
      mesh(
        [
          [0, 1, 2],
          [1, Number.NaN, 3],
          [2, 3, 4],
        ],
        { axes: false },
      ),
      "polygon",
    ),
  ).toBe(0);
});

test("a flat grid still renders, shaded from the middle of the ramp", () => {
  const s = mesh(
    [
      [5, 5],
      [5, 5],
    ],
    { axes: false },
  );
  expect(count(s, "polygon")).toBe(1);
  expect(s).toContain(viridis(0.5));
});

test("wireframe draws unfilled outlines", () => {
  const s = mesh(
    [
      [0, 1],
      [2, 3],
    ],
    { axes: false, wireframe: true },
  );
  expect(s).toContain('fill="none"');
  expect(s).not.toContain("color-mix");
});

test("an undersized grid yields a bare frame", () => {
  for (const g of [[], [[1]], [[1, 2]]]) expect(count(mesh(g, { axes: false }), "polygon")).toBe(0);
});

test("zRange pins the height ramp", () => {
  const g = [
    [0, 1],
    [2, 3],
  ];
  expect(mesh(g, { axes: false })).not.toBe(mesh(g, { axes: false, zRange: [-10, 10] }));
});

test("gridFromPoints bins scattered samples onto a grid, the mean z in each cell", () => {
  const {
    grid: g,
    xs,
    ys,
  } = gridFromPoints(
    [
      [0, 0, 1],
      [0, 0, 3],
      [1, 1, 5],
    ],
    2,
    2,
  );
  expect(g[0]![0]).toBe(2);
  expect(g[1]![1]).toBe(5);
  expect(Number.isNaN(g[0]![1])).toBe(true);
  expect(xs).toEqual([0, 1]);
  expect(ys).toEqual([0, 1]);
});

// ── Scatter ──────────────────────────────────────────────────────────────────────────────

const P = (x: number, y: number, z: number): Triple => [x, y, z];
const scatter = (pts: Triple[], o: Parameters<typeof scatterBox>[1] = {}, view = {}): string =>
  graphics3dSvg(scatterBox(pts, o), view);

test("a scatter draws one marker per point, exactly projected", () => {
  const s = scatter([P(0, 0, 0), P(1, 1, 1), P(0.5, 0.5, 0.5)], { axes: false }, flat);
  expect(s).toContain('aria-label="3-D point plot"');
  expect(circles(s)).toEqual([
    [74, 236],
    [180, 130],
    [286, 24],
  ]);
});

test("depth cueing shrinks and fades the farthest marker", () => {
  const radii = (s: string): number[] => [...s.matchAll(/ r="([\d.]+)"/g)].map(([, r]) => Number(r));
  const s = scatter([P(0, 0, 0), P(0, 1, 0)], { axes: false, size: 4 }, flat);
  expect(radii(s)).toEqual([2.2, 4]);
  expect(s).toContain('fill-opacity="0.55"');
  expect(radii(scatter([P(0, 0, 0), P(0, 1, 0)], { axes: false, size: 4, depthCue: 0 }, flat))).toEqual([4, 4]);
});

test("non-finite points are dropped; none is a bare frame", () => {
  expect(count(scatter([P(0, 0, 0), P(Number.NaN, 1, 1), P(1, 1, 1)], { axes: false }), "circle")).toBe(2);
  expect(count(scatter([]), "circle")).toBe(0);
});

// ── Bars ─────────────────────────────────────────────────────────────────────────────────

const bars = (m: number[][], o: Parameters<typeof barChart3dBox>[1] = {}, view = {}): string =>
  graphics3dSvg(barChart3dBox(m, o), view);

test("one bar draws three faces: the two sides toward the viewer and the top", () => {
  const s = bars([[1]], { axes: false });
  expect(s).toContain('aria-label="3-D bar chart"');
  expect(count(s, "polygon")).toBe(3);
});

test("a full-cell bar's front face is exactly the projected cell", () => {
  expect(polys(bars([[1]], { axes: false, gap: 0 }, flat))[1]).toBe("286,236 74,236 74,24 286,24");
});

test("bars are painted back to front", () => {
  const all = polys(bars([[2], [1]], { axes: false, gap: 0 }, flat));
  expect(all.length).toBe(6);
  expect(all.indexOf("286,236 74,236 74,24 286,24")).toBe(1);
  expect(all.indexOf("286,236 74,236 74,130 286,130")).toBe(4);
});

test("three faces per positive bar; a zero or non-finite height draws none", () => {
  expect(
    count(
      bars(
        [
          [1, 2, 3],
          [4, 5, 6],
        ],
        { axes: false },
      ),
      "polygon",
    ),
  ).toBe(18);
  expect(count(bars([[0, 2, Number.NaN]], { axes: false }), "polygon")).toBe(3);
});

test("a top is the gradient's color and a side the same, darkened", () => {
  const s = bars([[1]], { axes: false });
  expect(s).toContain(`fill="${heightShade(1, gradientNamed("viridis"))}"`);
  expect(s).toContain("color-mix(in srgb, #fde725 72%, black)");
});

test("gap insets each bar inside its cell", () => {
  expect(bars([[1]], { axes: false, gap: 0 }, flat)).toContain("286,236");
  const loose = bars([[1]], { axes: false, gap: 0.5 }, flat);
  expect(loose).toContain("233,236");
  expect(loose).not.toContain("286,236");
});

test("heights are shaded relative to the tallest bar; zRange pins the scale", () => {
  const s = bars([[1, 2]], { axes: false });
  expect(s).toContain(viridis(0.5));
  expect(s).toContain(viridis(1));
  expect(bars([[1, 2]], { axes: false, zRange: [0, 10] })).not.toBe(s);
});

test("a negative bar hangs below the zero plane", () => {
  const s = bars([[-1, 1]], { axes: false, gap: 0 }, flat);
  expect(count(s, "polygon")).toBe(6);
  const all = polys(s);
  expect(all.some((p) => p.includes("236") && p.includes("130"))).toBe(true);
  expect(all.some((p) => p.includes("130") && p.includes("24"))).toBe(true);
});

test("only the height axis is labeled; the box is drawn behind the bars", () => {
  const s = bars([[1]]);
  expect(count(s, "line")).toBe(3);
  expect(count(s, "text")).toBe(1);
  expect(count(bars([[1]], { axes: false }), "line")).toBe(0);
  expect(s.indexOf("<line")).toBeLessThan(s.indexOf("color-mix"));
});

test("row and column labels are drawn, escaped, and capped at the matrix size", () => {
  const s = bars(
    [
      [1, 2],
      [3, 4],
    ],
    { axes: false, colLabels: ["a", "<b>", "spare"], rowLabels: ["r1", "r2"] },
  );
  expect(count(s, "text")).toBe(4);
  expect(s).toContain("&lt;b&gt;");
  expect(s).not.toContain(">spare<");
});

test("an empty or all-holes matrix is a bare frame", () => {
  for (const m of [[], [[]], [[Number.NaN]]]) expect(count(bars(m, { axes: false }), "polygon")).toBe(0);
});

// ── Curves ───────────────────────────────────────────────────────────────────────────────

const ring = Array.from({ length: 64 }, (_, i) => {
  const t = (2 * Math.PI * i) / 64;
  return [Math.cos(t), Math.sin(t), 0] as const;
});

test("a curve is drawn as cased arcs, nearer ones over farther", () => {
  const s = graphics3dSvg(curveBox(ring));
  expect(s).toContain('aria-label="curve in space"');
  expect(count(s, "path")).toBeGreaterThan(16);
  expect(s).toContain("var(--notatio-bg");
});

test("a curve in space colors along a cyclic rainbow unless told otherwise", () => {
  expect(graphics3dSvg(curveBox(ring))).toContain(`stroke="${sampleGradient(gradientNamed("sinebow"), 0)}"`);
  expect(graphics3dSvg(curveBox(ring, { gradient: "viridis" }))).toContain('stroke="#440154"');
});

test("too few points, or non-finite ones, are dropped rather than poisoning the frame", () => {
  expect(graphics3dSvg(curveBox([]))).toContain("<svg");
  expect(graphics3dSvg(curveBox([[0, 0, 0]]))).toContain("<svg");
  expect(
    graphics3dSvg(
      curveBox([
        [0, 0, 0],
        [Number.NaN, 1, 1],
        [1, 1, 1],
      ]),
    ),
  ).toContain("<path");
});

test("a torus is drawn first and faintly, behind the curve", () => {
  const s = graphics3dSvg(curveBox(ring, { torus: { major: 2, minor: 1 } }));
  expect(s.indexOf('fill-opacity="0.045"')).toBeGreaterThan(-1);
  expect(s.indexOf('fill-opacity="0.045"')).toBeLessThan(s.indexOf("<path"));
  expect(count(s, "polygon")).toBe(28 * 40);
});

test("a curve can carry a travelling marker, never sorted into the strand", () => {
  const marked = (phase: number): [number, number] => {
    const m = /<circle class="notatio-curve-marker" cx="([-\d.]+)" cy="([-\d.]+)"/.exec(
      graphics3dSvg(curveBox(ring, { marker: phase }), { azimuth: 0, elevation: 90 }),
    );
    return [Number(m?.[1]), Number(m?.[2])];
  };
  expect(graphics3dSvg(curveBox(ring))).not.toContain("notatio-curve-marker");
  const [x0, y0] = marked(0);
  // A whole way round is back where it started, not a sample short of it.
  expect(marked(1)).toEqual([x0, y0]);
  const [xq, yq] = marked(0.25);
  expect(Math.hypot(xq - x0, yq - y0)).toBeGreaterThan(1);
  expect(marked(2.25)).toEqual([xq, yq]);
  expect(graphics3dSvg(curveBox(ring, { marker: 0.5 })).lastIndexOf("notatio-curve-marker")).toBeGreaterThan(
    graphics3dSvg(curveBox(ring, { marker: 0.5 })).lastIndexOf("<path"),
  );
});

test("a curve stays one scale on every axis, so a thin one is not stretched into its box", () => {
  const box = curveBox(
    [
      [0, 0, 0],
      [10, 0, 0],
      [10, 1, 0],
    ],
    { closed: false },
  );
  const [x, y, z] = optionsOfBox(box as never)["PlotRange"] as number[][];
  expect(x![1]! - x![0]!).toBe(y![1]! - y![0]!);
  expect(x![1]! - x![0]!).toBe(z![1]! - z![0]!);
});

// ── Writing them ─────────────────────────────────────────────────────────────────────────

test("a head is a figure in space when its value says so", () => {
  expect(holdsGraphics3d("Plot3D(x * y, (x, -1, 1), (y, -1, 1))")).toBe(true);
  expect(holdsGraphics3d(" barChart3D([[1]])")).toBe(true);
  expect(holdsGraphics3d("Graphics3D(Line(KnotCurve(TorusKnot(2, 3))))")).toBe(true);
  expect(holdsGraphics3d("Plot(Sin(x))")).toBe(false);
});

test("Wolfram's options lower to the settings the figure reads", () => {
  const text =
    'Plot3D(Sin(x) * y, (x, -3, 3), (y, 0, 2), PlotLabel -> "wave", PlotLegends -> True, Axes -> False, Gpu -> 100, Azimuth -> 200, ScalingFunctions -> ("Linear", "Linear", "Log"))';
  expect(graphics3dOfText(text)?.settings).toEqual({
    value: "sin(x) * y",
    "x-domain": "-3,3",
    "y-domain": "0,2",
    xvar: "x",
    yvar: "y",
    label: "wave",
    "color-legend": "true",
    axes: "false",
    gpu: "100",
    azimuth: "200",
    "x-scale": "linear",
    "y-scale": "linear",
    "z-scale": "log",
  });
});

test("a curve's settings: its points' expression, the torus, closing and the clock", () => {
  const settings = graphics3dOfText(
    'Graphics3D(Line(KnotCurve(TorusKnot(2, 3))), Torus -> (2, 1), Closed -> True, Clock -> True, Caption -> "trefoil")',
  )?.settings;
  expect(settings).toEqual({
    value: "KnotCurve(TorusKnot(2, 3))",
    torus: "2,1",
    closed: "true",
    clock: "true",
    caption: "trefoil",
  });
});

const lowered = (src: string) => makeBoxes(plainJson(parseExpression(src).json as never) as never, PLOT_NOTATION);

test("ListPlot3D and BarChart3D hold their data and lower whole", () => {
  const mesh3 = lowered("ListPlot3D([[1, 2], [3, 4]])");
  expect(isGraphics3dBox(mesh3)).toBe(true);
  expect(count(graphics3dSvg(mesh3, { elevation: 25 }), "polygon")).toBe(1 + 1);
  const points = lowered('ListPlot3D([[0, 0, 0], [1, 1, 1]], Type -> "points")');
  expect(count(graphics3dSvg(points), "circle")).toBe(2);
  const barBox = lowered("BarChart3D([3, 1, 4])");
  expect(isGraphics3dBox(barBox)).toBe(true);
  expect(count(graphics3dSvg(barBox), "polygon")).toBe(1 + 3 * 3);
});

test("a Plot3D of an expression is a producer: the box holds the expression it came from", () => {
  const box = lowered("Plot3D(x * y, (x, -1, 1), (y, -1, 1))");
  expect(isGraphics3dBox(box)).toBe(true);
  expect(optionsOfBox(box as never)["Producer"]).toBe("Plot3D");
  expect((unsampledGraphics3d(box) as unknown[])[0]).toBe("Plot3D");
});

test("what a box holds never leaves its attribute: a description and colors come out inert", () => {
  const box = [
    "Graphics3DBox",
    [
      "Polygon3DBox",
      {
        Points: [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 1],
        ],
        FaceForm: 'red" onload="x',
        EdgeColor: "red' onclick='x",
      },
    ],
    { Description: '" onmouseover="x', PlotLabel: "<b>" },
  ] as never;
  const s = graphics3dSvg(box);
  expect(s).not.toContain('" onmouseover');
  expect(s).not.toContain('" onload');
  expect(s).not.toContain("' onclick");
  expect(s).toContain('aria-label="&quot; onmouseover=&quot;x"');
  expect(s).toContain('fill="currentColor"');
  expect(s).toContain("&lt;b&gt;");
});

test("a head with no data to draw lowers to nothing", () => {
  expect(listBoxOfSettings({ data: "oops" })).toBeUndefined();
  expect(barBoxOfSettings({ data: "[]" })).toBeUndefined();
  expect(graphics3dSettingsOf(plainJson(parseExpression("Plot(Sin(x))").json as never) as never)).toBeUndefined();
});
