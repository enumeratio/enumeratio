import { expect, test } from "vite-plus/test";
import { barChart3dSvg, barShade } from "../src/barchart3d.ts";

const count = (s: string, tag: string): number => s.split(`<${tag}`).length - 1;
const polys = (s: string): string[] =>
  [...s.matchAll(/<polygon points="([^"]+)"/g)].map(([, p]) => p);

/** The straight-on view (azimuth 0, elevation 0): x = 0 → 74, x = 1 → 286,
 * z = 0 → 236, z = 1 → 24, depth = y − ½. See project3d.test.ts. */
const flat = { azimuth: 0, elevation: 0 } as const;

// ---------------------------------------------------------------------------
// barShade
// ---------------------------------------------------------------------------

test("the top face is brighter than a side at the same height", () => {
  expect(barShade(1, 1)).toContain("82%");
  expect(barShade(1, 0.72)).toContain("59.04%");
  expect(barShade(0, 1)).toContain("24%");
});

test("shading clamps rather than extrapolating", () => {
  expect(barShade(5, 1)).toBe(barShade(1, 1));
  expect(barShade(Number.NaN, 1)).toBe(barShade(0, 1));
});

// ---------------------------------------------------------------------------
// barChart3dSvg
// ---------------------------------------------------------------------------

test("one bar draws three faces on the default viewBox", () => {
  const s = barChart3dSvg([[1]], { axes: false });
  expect(s).toContain('viewBox="0 0 360 260"');
  expect(s).toContain('aria-label="3-D bar chart"');
  // Two visible sides plus the top; the two back sides are never drawn.
  expect(count(s, "polygon")).toBe(3);
});

test("a full-cell bar's front face is exactly the projected cell", () => {
  const s = barChart3dSvg([[1]], { ...flat, axes: false, gap: 0 });
  // The y = 1 face, nearest the viewer at elevation 0, drawn after the side
  // at equal depth and before the top.
  expect(polys(s)[1]).toBe("286,236 74,236 74,24 286,24");
});

test("bars are painted back-to-front", () => {
  // Two rows of one bar each; depth is y − ½, so row 0 is farther and must be
  // drawn first. At elevation 0 the rows project onto the same screen columns,
  // so the tall far bar (top at 24) would wrongly cover the short near one
  // (top at 130) if the order were reversed.
  const all = polys(barChart3dSvg([[2], [1]], { ...flat, axes: false, gap: 0 }));
  expect(all.length).toBe(6);
  expect(all.indexOf("286,236 74,236 74,24 286,24")).toBe(1);
  expect(all.indexOf("286,236 74,236 74,130 286,130")).toBe(4);
});

test("an n×m matrix draws three faces per positive bar", () => {
  const m = [
    [1, 2, 3],
    [4, 5, 6],
  ];
  expect(count(barChart3dSvg(m, { axes: false }), "polygon")).toBe(18);
});

test("a zero or non-finite height draws no bar", () => {
  const m = [[0, 2, Number.NaN]];
  expect(count(barChart3dSvg(m, { axes: false }), "polygon")).toBe(3);
});

test("gap insets each bar inside its cell", () => {
  const tight = barChart3dSvg([[1]], { ...flat, axes: false, gap: 0 });
  const loose = barChart3dSvg([[1]], { ...flat, axes: false, gap: 0.5 });
  expect(tight).toContain("286,236");
  // A half-cell gap pulls the bar to the middle half of the cell.
  expect(loose).toContain("233,236");
  expect(loose).not.toContain("286,236");
});

test("heights are shaded relative to the tallest bar", () => {
  const s = barChart3dSvg([[1, 2]], { axes: false });
  // The short bar sits at half height (ramp 53%), the tall one at the top (82%).
  expect(s).toContain("53%");
  expect(s).toContain("82%");
});

test("zRange pins the height scale instead of using the data's own", () => {
  const auto = barChart3dSvg([[1, 2]], { axes: false });
  const pinned = barChart3dSvg([[1, 2]], { axes: false, zRange: [0, 10] });
  expect(auto).not.toBe(pinned);
  expect(pinned).not.toContain("82%");
});

test("a negative bar hangs below the zero plane", () => {
  // zlo = min(0, −1) = −1, so z = 0 sits halfway up the cube and both bars
  // draw -- one rising from it, one hanging beneath.
  const s = barChart3dSvg([[-1, 1]], { ...flat, axes: false, gap: 0 });
  expect(count(s, "polygon")).toBe(6);
  const all = polys(s);
  // Cube mid-height projects to y = 130: the left bar runs 236 → 130, the
  // right bar 130 → 24.
  expect(all.some((p) => p.includes("236") && p.includes("130"))).toBe(true);
  expect(all.some((p) => p.includes("130") && p.includes("24"))).toBe(true);
});

test("the axis box is drawn behind the bars by default", () => {
  const withAxes = barChart3dSvg([[1]]);
  const without = barChart3dSvg([[1]], { axes: false });
  expect(count(withAxes, "line")).toBe(3);
  expect(count(without, "line")).toBe(0);
  // The box precedes the bars in document order (a bar face is the first
  // polygon carrying a height-ramp fill).
  expect(withAxes.indexOf("<line")).toBeLessThan(withAxes.indexOf("color-mix"));
});

test("row and column labels are drawn, escaped, and capped at the matrix size", () => {
  const s = barChart3dSvg(
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

test("an empty or all-holes matrix yields a bare frame", () => {
  expect(count(barChart3dSvg([], { axes: false }), "polygon")).toBe(0);
  expect(count(barChart3dSvg([[]], { axes: false }), "polygon")).toBe(0);
  expect(count(barChart3dSvg([[Number.NaN]], { axes: false }), "polygon")).toBe(0);
});

test("a flat matrix draws every bar at the same height", () => {
  const s = barChart3dSvg(
    [
      [2, 2],
      [2, 2],
    ],
    { axes: false },
  );
  expect(count(s, "polygon")).toBe(12);
  expect(s).toContain("82%");
});

test("a title renders centred above the figure", () => {
  expect(barChart3dSvg([[1]], { title: "Counts" })).toContain(">Counts<");
});

test("determinism: the same matrix renders byte-identical SVG twice", () => {
  const m = Array.from({ length: 6 }, (_, j) =>
    Array.from({ length: 6 }, (_, i) => (i + 1) * (j + 2)),
  );
  const opts = { azimuth: 35, elevation: 22, colLabels: ["a", "b", "c"], title: "grid" };
  expect(barChart3dSvg(m, opts)).toBe(barChart3dSvg(m, opts));
});
