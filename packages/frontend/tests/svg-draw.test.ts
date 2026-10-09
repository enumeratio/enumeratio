import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeBoxes } from "@enumeratio/boxes";
import { afterAll, expect, it } from "vite-plus/test";
import { FIGURE_DEFAULTS, type FigureHead, figureLayerOf } from "../src/figure-frames.ts";
import { FIGURE_NOTATION } from "../src/show-box.ts";
import { boundaryRuleOf, colorRuleOf, rulesOf } from "../src/graphics-rules.ts";
import { svg } from "../src/svg-draw.ts";
import { displayListOf, fitView, type TileDrawOptions, type TileLayer } from "../src/tiles-canvas.ts";

// The SVG of a few figures, pinned as written. Regenerate with `UPDATE_SVG=1 vp test`.
const GOLDEN = fileURLToPath(new URL("./svg-draw.golden.json", import.meta.url));
const updating = process.env.UPDATE_SVG === "1";
const golden: Record<string, string> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: typeof golden = {};

const list = (...xs: unknown[]) => ["List", ...xs];
const options = (head: FigureHead, selection: [number, number][]): TileDrawOptions => ({
  colorRules: rulesOf(FIGURE_DEFAULTS[head].colors, colorRuleOf).rules,
  boundaryRules: rulesOf(FIGURE_DEFAULTS[head].edges, boundaryRuleOf).rules,
  colorMixing: "First",
  selection,
  fill: 0.86,
  phase: 0,
  budgetMs: 1e9,
});

function check(id: string, head: FigureHead, json: unknown, selection: [number, number][] = []) {
  it(`draws ${id} as SVG`, () => {
    const layer = figureLayerOf(head, json as never);
    if (typeof layer === "string") throw new Error(layer);
    const view = fitView(layer, 4 / 3);
    const out = svg(displayListOf(layer, 400, 300, view, options(head, selection)), 400, 300, view);
    expect(out).toMatch(/^<svg [^>]*><path /);
    fresh[id] = out;
    if (!updating) expect(out).toBe(golden[id]);
  });
}

check("strands", "StrandDiagram", ["Permutation", list(3, 1, 2)]);
check("strands-selected", "StrandDiagram", ["Permutation", list(3, 1, 2)], [[1, 0]]);
check("tree", "TreeDiagram", ["PlaneTree", list(2, 1, 0, 0)]);
check("dyck", "PathDiagram", ["DyckPath", list(1, 1, 0, 1, 0, 0)]);
check("tableau", "CellDiagram", ["StandardTableau", list(list(1, 2, 4), list(3))]);

it("draws a lattice's tiles as SVG", () => {
  const lattice: TileLayer = {
    basis: [
      [1, 0],
      [0.5, 0.8660254037844386],
    ],
    maxIndex: 1_000,
    known: () => true,
    prepare: () => {},
    has: (i, j, p) => (p === "Even" ? (i + j) % 2 === 0 : undefined),
    value: () => undefined,
    relatedTo: () => false,
  };
  const o: TileDrawOptions = {
    ...options("StrandDiagram", []),
    colorRules: rulesOf(list(["Rule", "Even", "Red"]), colorRuleOf).rules,
    boundaryRules: [],
  };
  const view = { center: [0.5, 0.5] as [number, number], extent: 2 };
  const out = svg(displayListOf(lattice, 200, 200, view, o), 200, 200, view);
  fresh.lattice = out;
  expect(out).toContain('fill="#ff5a5f"');
  if (!updating) expect(out).toBe(golden.lattice);
});

it("lowers Show and a value head to a GraphicsBox by rule, and leaves other heads alone", () => {
  const strands = ["Permutation", list(3, 1, 2)] as never;
  expect(makeBoxes(strands, FIGURE_NOTATION)[0]).toBe("GraphicsBox");
  expect(makeBoxes(["Show", ["StrandDiagram", strands]] as never, FIGURE_NOTATION)[0]).toBe("GraphicsBox");
  expect(makeBoxes(["Permutation", list(1, 1)] as never, FIGURE_NOTATION)[0]).not.toBe("GraphicsBox");
  expect(makeBoxes(["Add", "x", 1] as never, FIGURE_NOTATION)[0]).not.toBe("GraphicsBox");
});

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, JSON.stringify(fresh, null, 2) + "\n");
});
