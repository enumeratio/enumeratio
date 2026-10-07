import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { boundaryRuleOf, colorRuleOf } from "../src/graphics-rules.ts";
import {
  addressesOf,
  drawTiles,
  fitView,
  hitAt,
  type Address,
  type TileDrawOptions,
  type TileLayer,
} from "../src/tiles-canvas.ts";

// A toy figure layer, nothing like a lattice or a strand: a path graph whose nodes sit on a
// parabola, so the contract (`place`, `mark`, `links`, the `fixed` view) is held by something
// other than the layers that grew it.
const NODES = 4;
const toy: TileLayer = {
  basis: [
    [1, 0],
    [0, 1],
  ],
  maxIndex: NODES,
  view: "fixed",
  bounds: { i: [0, NODES - 1], j: [0, 0] },
  place: (i) => [2 * i, i * i],
  mark: () => ({ head: "Disk", radius: 0.4 }),
  links: () =>
    Array.from({ length: NODES - 1 }, (_, i): readonly Address[] => [
      [i, 0],
      [i + 1, 0],
    ]),
  known: () => true,
  prepare: () => {},
  has: (i, _j, name) => (name === "IsEven" ? i % 2 === 0 : name === "IsLast" ? i === NODES - 1 : undefined),
  value: (i, _j, name) => (name === "Index" ? i : undefined),
  relatedTo: (relation, [si], i) => relation === "Neighbor" && Math.abs(si - i) === 1,
};

type Op = readonly [string, ...number[]];
class PathStub {
  readonly ops: Op[] = [];
  moveTo(x: number, y: number) {
    this.ops.push(["moveTo", x, y]);
  }
  lineTo(x: number, y: number) {
    this.ops.push(["lineTo", x, y]);
  }
  arc(x: number, y: number, r: number) {
    this.ops.push(["arc", x, y, r]);
  }
  rect(x: number, y: number, w: number, h: number) {
    this.ops.push(["rect", x, y, w, h]);
  }
  closePath() {
    this.ops.push(["close"]);
  }
}

/** A context that records what is filled and stroked, and with what. */
function recorder() {
  const filled: { color: unknown; path: PathStub }[] = [];
  const stroked: { color: unknown; width: number; path: PathStub }[] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    globalAlpha: 1,
    save() {},
    restore() {},
    setLineDash() {},
    fill(path: PathStub) {
      filled.push({ color: this.fillStyle, path });
    },
    stroke(path: PathStub) {
      stroked.push({ color: this.strokeStyle, width: this.lineWidth, path });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, filled, stroked };
}

const options = (over: Partial<TileDrawOptions> = {}): TileDrawOptions => ({
  colorRules: [],
  boundaryRules: [],
  colorMixing: "First",
  selection: [],
  fill: 0.86,
  phase: 0,
  budgetMs: 1000,
  ...over,
});

const rule = (json: unknown) => colorRuleOf(json)!;
const edge = (json: unknown) => boundaryRuleOf(json)!;
const lineStrokes = <T extends { path: PathStub }>(stroked: T[]) =>
  stroked.filter((s) => s.path.ops.some((op) => op[0] === "lineTo"));

let had: unknown;
beforeEach(() => {
  had = (globalThis as { Path2D?: unknown }).Path2D;
  (globalThis as { Path2D?: unknown }).Path2D = PathStub;
});
afterEach(() => {
  (globalThis as { Path2D?: unknown }).Path2D = had;
});

describe("a figure layer", () => {
  it("lists its addresses from its bounds", () => {
    expect(addressesOf(toy)).toEqual([0, 1, 2, 3].map((i) => [i, 0]));
  });

  it("is fitted whole, with room, for a fixed view", () => {
    // Places span x 0 … 6, y 0 … 9; the marks' radius 0.4 widens that: the height binds.
    const { center, extent } = fitView(toy, 2, 0.5);
    expect(center).toEqual([3, 4.5]);
    expect(extent).toBeCloseTo(5.4);
    expect(fitView(toy, 0.5, 0.5).extent).toBeCloseTo(7.8);
  });

  it("is hit at an address, else at a link, else nowhere", () => {
    expect(hitAt(toy, [2.1, 1.1], 0.5)).toEqual([[1, 0]]);
    // Midway along the link between nodes 1 and 2.
    expect(hitAt(toy, [3, 2.5], 0.2)).toEqual([
      [1, 0],
      [2, 0],
    ]);
    expect(hitAt(toy, [10, 10], 0.5)).toEqual([]);
  });

  it("draws a mark per address, colored by ColorRules", () => {
    const { ctx, filled } = recorder();
    const rules = [rule(["Rule", "IsEven", "Teal"])];
    expect(drawTiles(ctx, 100, 100, toy, fitView(toy, 1), options({ colorRules: rules }))).toBe(true);
    expect(filled).toHaveLength(1);
    expect(filled[0]!.path.ops.filter((op) => op[0] === "arc")).toHaveLength(2);
  });

  it("strokes its links by the BoundaryStyle their members' properties match", () => {
    const { ctx, stroked } = recorder();
    const boundaryRules = [edge(["Rule", "IsLast", ["Directive", "White", ["AbsoluteThickness", 4]]])];
    drawTiles(ctx, 100, 100, toy, fitView(toy, 1), options({ boundaryRules }));
    // Only the link with the last node as a member matches.
    const lines = lineStrokes(stroked);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.width).toBe(4);
  });

  it("lights a link when a member is related to the selection", () => {
    const { ctx, stroked } = recorder();
    const boundaryRules = [edge(["Rule", ["Neighbor", "Selected"], "White"])];
    drawTiles(ctx, 100, 100, toy, fitView(toy, 1), options({ selection: [[0, 0]], boundaryRules }));
    // Node 1 neighbors the selected 0: links 0–1 and 1–2 have it as a member, 2–3 doesn't.
    expect(lineStrokes(stroked)).toHaveLength(2);
  });
});

describe("a lattice layer", () => {
  const lattice: TileLayer = {
    basis: [
      [1, 0],
      [0, 1],
    ],
    maxIndex: 2,
    bounds: { i: [0, 1], j: [0, 1] },
    known: () => true,
    prepare: () => {},
    has: () => true,
    value: () => undefined,
    relatedTo: () => false,
  };

  it("still draws a tile per point, with no marks or links", () => {
    const { ctx, filled } = recorder();
    const colorRules = [rule(["Rule", "True", "Gold"])];
    drawTiles(ctx, 100, 100, lattice, { center: [0.5, 0.5], extent: 2 }, options({ colorRules }));
    expect(filled).toHaveLength(1);
    const ops = filled[0]!.path.ops;
    expect(ops.filter((op) => op[0] === "arc")).toHaveLength(0);
    expect(ops.filter((op) => op[0] === "close")).toHaveLength(4);
  });
});
