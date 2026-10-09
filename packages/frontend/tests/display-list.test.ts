import { fromMathJson, isBox, toMathJson } from "@enumeratio/boxes";
import { expect, it } from "vite-plus/test";
import { figureGraphicsBox } from "../src/show-box.ts";
import { displayListOf, type DisplayList, type TileDrawOptions, type TileLayer } from "../src/tiles-canvas.ts";
import { boundaryRuleOf, colorRuleOf, rulesOf } from "../src/graphics-rules.ts";
import { FIGURE_DEFAULTS, figureLayerOf } from "../src/figure-frames.ts";

const list = (...xs: unknown[]) => ["List", ...xs];
const options = (selection: [number, number][] = [], budgetMs = 1e9): TileDrawOptions => ({
  colorRules: rulesOf(FIGURE_DEFAULTS.StrandDiagram.colors, colorRuleOf).rules,
  boundaryRules: rulesOf(FIGURE_DEFAULTS.StrandDiagram.edges, boundaryRuleOf).rules,
  colorMixing: "First",
  selection,
  fill: 1,
  phase: 0,
  budgetMs,
});
const strands = (() => {
  const layer = figureLayerOf("StrandDiagram", ["Permutation", list(3, 1, 2)]);
  if (typeof layer === "string") throw new Error(layer);
  return layer;
})();
const view = { center: [1, 0.5] as [number, number], extent: 2.5 };
const marksOf = (l: DisplayList) => {
  if (l.kind !== "marks") throw new Error("not a figure list");
  return l;
};

it("lists a figure's marks at their addresses, and its links, with no canvas", () => {
  const l = marksOf(displayListOf(strands, 400, 300, view, options()));
  expect(l.complete).toBe(true);
  expect(l.marks.map((m) => m.address)).toHaveLength(6);
  expect(l.marks.every((m) => m.mark.head === "Disk")).toBe(true);
  expect(l.links.length).toBeGreaterThan(0);
  expect(l.links.every((k) => k.mark.head === "Line" && k.edges.length > 0)).toBe(true);
});

it("restyles by selection without touching the geometry", () => {
  const plain = marksOf(displayListOf(strands, 400, 300, view, options()));
  const picked = marksOf(displayListOf(strands, 400, 300, view, options([[1, 0]])));
  expect(picked.marks.map((m) => [m.address, m.at, m.mark])).toEqual(plain.marks.map((m) => [m.address, m.at, m.mark]));
  expect(picked.marks.some((m) => m.selected)).toBe(true);
  expect(picked.marks.map((m) => m.style)).not.toEqual(plain.marks.map((m) => m.style));
});

it("keeps classifying within a budget, frame after frame, until the figure is known", () => {
  const known = new Set<string>();
  const slow: TileLayer = {
    ...strands,
    known: (i, j) => known.has(`${i},${j}`),
    prepare: (i, j) => void known.add(`${i},${j}`),
    addresses: () => Array.from({ length: 200 }, (_, n) => [n, 0] as const),
    links: () => [],
  };
  let frames = 1;
  while (!displayListOf(slow, 400, 300, view, options([], 0)).complete && frames < 100) frames++;
  expect(known.size).toBe(200);
  // The first frames classify the minimum and drop the rest; none is left to a later one.
  expect(frames).toBeGreaterThan(1);
});

it("lists a lattice layer's visible tiles, culling those off the canvas", () => {
  const lattice: TileLayer = {
    basis: [
      [1, 0],
      [0, 1],
    ],
    maxIndex: 1_000,
    known: () => true,
    prepare: () => {},
    has: () => undefined,
    value: () => undefined,
    relatedTo: () => false,
  };
  const l = displayListOf(
    lattice,
    400,
    400,
    { center: [0, 0], extent: 5 },
    { ...options(), colorRules: [], boundaryRules: [] },
  );
  expect(l.kind).toBe("tiles");
  if (l.kind === "tiles") {
    expect(l.tiles.length).toBeGreaterThanOrEqual(100);
    expect(l.tiles.length).toBeLessThan(200);
  }
});

it("lowers a frame to a GraphicsBox: marks tagged by address, links by members", () => {
  const box = figureGraphicsBox("StrandDiagram", ["Permutation", list(3, 1, 2)]);
  if (typeof box === "string") throw new Error(box);
  expect(isBox(box)).toBe(true);
  expect(fromMathJson(toMathJson(box))).toEqual(box);
  const tags = JSON.stringify(box).match(/"TagBox",\[.*?\],"([^"]*)"/g) ?? [];
  expect(tags.length).toBeGreaterThan(6);
  expect(box[0]).toBe("GraphicsBox");
  const outer = (box as readonly unknown[])[2] as Record<string, unknown>;
  expect(outer.ViewKind).toBe("fixed");
  expect(outer.ColorMixing).toBe("First");
  expect(outer.Selection).toEqual([]);
  // A link is tagged with the addresses it joins, ';'-separated.
  expect(JSON.stringify(box)).toMatch(/"\d+,\d+;\d+,\d+"/);
});

it("says why a frame has no figure", () => {
  expect(figureGraphicsBox("StrandDiagram", ["Permutation", list(1, 1)])).toEqual(expect.any(String));
});
