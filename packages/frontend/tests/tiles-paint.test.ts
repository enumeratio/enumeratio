import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, expect, it } from "vite-plus/test";
import { cameraSpecOf, throughCamera } from "../src/camera-frame.ts";
import { FIGURE_DEFAULTS, type FigureHead, figureLayerOf } from "../src/figure-frames.ts";
import { boundaryRuleOf, colorRuleOf, rulesOf } from "../src/graphics-rules.ts";
import { drawTiles, type TileDrawOptions, type TileLayer } from "../src/tiles-canvas.ts";

// The canvas output is pinned by a hash of every context call and path op a layer draws. The
// hashes were taken from `drawTiles` before it split into `displayListOf` and `paint`, so a
// refactor that moves a pixel moves a hash. Regenerate with `UPDATE_PAINT=1 vp test`.
const GOLDEN = fileURLToPath(new URL("./tiles-paint.golden.json", import.meta.url));
const updating = process.env.UPDATE_PAINT === "1";
const golden: Record<string, { calls: number; hash: string }> = updating
  ? {}
  : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: typeof golden = {};

/** A context that records every call, property set and path op into one log. */
function recorder(): { ctx: CanvasRenderingContext2D; log: unknown[] } {
  const log: unknown[] = [];
  class Path {
    ops: unknown[] = [];
    rect(...a: number[]): void {
      this.ops.push(["rect", ...a]);
    }
    moveTo(...a: number[]): void {
      this.ops.push(["moveTo", ...a]);
    }
    lineTo(...a: number[]): void {
      this.ops.push(["lineTo", ...a]);
    }
    arc(...a: number[]): void {
      this.ops.push(["arc", ...a]);
    }
    closePath(): void {
      this.ops.push(["closePath"]);
    }
  }
  (globalThis as { Path2D?: unknown }).Path2D = Path;
  const ctx = new Proxy(
    {},
    {
      get:
        (_, name) =>
        (...args: unknown[]) =>
          log.push([name, ...args.map((a) => (a instanceof Path ? a.ops : a))]),
      set: (_, name, value) => {
        log.push(["set", name, value]);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}

const list = (...xs: unknown[]) => ["List", ...xs];
const figure = (head: FigureHead, json: unknown) => {
  const layer = figureLayerOf(head, json);
  if (typeof layer === "string") throw new Error(layer);
  return layer;
};

const options = (head: FigureHead, selection: [number, number][]): TileDrawOptions => ({
  colorRules: rulesOf(FIGURE_DEFAULTS[head].colors, colorRuleOf).rules,
  boundaryRules: rulesOf(FIGURE_DEFAULTS[head].edges, boundaryRuleOf).rules,
  colorMixing: "First",
  selection,
  ink: "#999999",
  fill: 0.86,
  phase: 0,
  budgetMs: 1e9,
});

type View = { center: [number, number]; extent: number };

function check(id: string, layer: TileLayer, opts: TileDrawOptions, view: View) {
  it(`paints ${id} as it always has`, () => {
    const { ctx, log } = recorder();
    expect(drawTiles(ctx, 400, 300, layer, view, opts)).toBe(true);
    const hash = createHash("sha256").update(JSON.stringify(log)).digest("hex");
    fresh[id] = { calls: log.length, hash };
    expect(log.length).toBeGreaterThan(0);
    if (!updating) expect(fresh[id]).toEqual(golden[id]);
  });
}

const strands = figure("StrandDiagram", ["Permutation", list(3, 1, 2)]);
check("strands", strands, options("StrandDiagram", []), { center: [1, 0.5], extent: 2.5 });
check("strands-selected", strands, options("StrandDiagram", [[1, 0]]), { center: [1, 0.5], extent: 2.5 });
const tree = figure("TreeDiagram", ["PlaneTree", list(2, 1, 0, 0)]);
check("tree", tree, options("TreeDiagram", []), { center: [1, 1], extent: 3 });
check("tree-selected", tree, options("TreeDiagram", [[0, 0]]), { center: [1, 1], extent: 3 });
const dyck = figure("PathDiagram", ["DyckPath", list(1, 1, 0, 1, 0, 0)]);
check("dyck", dyck, options("PathDiagram", []), { center: [3, 1.5], extent: 3 });
check("dyck-selected", dyck, options("PathDiagram", [[2, 0]]), { center: [3, 1.5], extent: 3 });
const cells = figure("CellDiagram", ["IntegerPartition", list(4, 2, 1)]);
check("partition", cells, options("CellDiagram", []), { center: [2, 2], extent: 3 });
check("partition-selected", cells, options("CellDiagram", [[1, 2]]), { center: [2, 2], extent: 3 });

// A tableau labels its cells, so this one draws text.
const tableau = figure("CellDiagram", ["StandardTableau", list(list(1, 2, 4), list(3))]);
check("tableau", tableau, options("CellDiagram", []), { center: [1.5, 1.5], extent: 3 });
check("tableau-selected", tableau, options("CellDiagram", [[1, 2]]), { center: [1.5, 1.5], extent: 3 });

const polytope = figure("PolytopeFaces", list(["PolytopeFaces", ["Permutahedron", 4]]));
const camera = throughCamera(
  polytope,
  { ...cameraSpecOf(new Map()), viewPoint: [0, -3, 0] },
  { viewPoint: [0, -3, 0], zoom: 1 },
  400 / 300,
);
check("polytope", camera.layer, options("PolytopeFaces", []), camera.view as View);

// A lattice layer of tiles: a color rule by property, an edge on the even ones, a selection.
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
  relatedTo: (_, s, i) => s[0] === i,
};
const latticeOptions = (selection: [number, number][], mixing: "First" | "Normal"): TileDrawOptions => ({
  colorRules: rulesOf(list(["Rule", "Even", "Red"], ["Rule", "True", ["Opacity", 0.5, "Blue"]]), colorRuleOf).rules,
  boundaryRules: rulesOf(list(["Rule", "Even", ["Directive", "Black", ["AbsoluteThickness", 2]]]), boundaryRuleOf)
    .rules,
  colorMixing: mixing,
  selection,
  fill: 0.9,
  phase: 0,
  budgetMs: 1e9,
});
check("lattice", lattice, latticeOptions([], "First"), { center: [0.5, 0.5], extent: 4 });
check("lattice-selected", lattice, latticeOptions([[1, 1]], "Normal"), { center: [0.5, 0.5], extent: 4 });
// Zoomed out until a tile is a few pixels: the squares-without-edges path.
check("lattice-tiny", lattice, latticeOptions([], "First"), { center: [0, 0], extent: 90 });

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
