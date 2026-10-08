import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  cameraSpecOf,
  liftedToThree,
  orbited,
  projectTo3,
  throughCamera,
  type CameraSpec,
} from "../src/camera-frame.ts";
import { figureLayerOf, FIGURE_DEFAULTS } from "../src/figure-frames.ts";
import { boundaryRuleOf, colorRuleOf } from "../src/graphics-rules.ts";
import { addressesOf, drawTiles, hitAt, type TileLayer } from "../src/tiles-canvas.ts";

const polytope = (...layers: unknown[]) => {
  const layer = figureLayerOf("PolytopeFaces", ["List", ...layers.map((l) => ["PolytopeFaces", l])]);
  if (typeof layer === "string") throw new Error(layer);
  return layer;
};
const permutahedron = () => polytope(["Permutahedron", 4]);

const spec = (over: Partial<CameraSpec> = {}): CameraSpec => ({
  viewPoint: [0, -3, 0],
  viewVertical: [0, 0, 1],
  viewCenter: [0, 0, 0],
  spherical: true,
  magnification: 1,
  ...over,
});

describe("the polytope frame", () => {
  it("addresses a face by its dimension and place among that dimension's faces", () => {
    const layer = permutahedron();
    const byDimension = [0, 1, 2, 3].map((k) => addressesOf(layer).filter(([a]) => a === k).length);
    // The truncated octahedron: 24 vertices, 36 edges, 14 faces, the body.
    expect(byDimension).toEqual([24, 36, 14, 1]);
    expect(layer.view).toBe("camera");
  });

  it("marks vertices, edges, faces and the body as a disk, line, polygon and polyhedron", () => {
    const layer = permutahedron();
    expect([0, 1, 2, 3].map((k) => layer.mark!(k, 0).head)).toEqual(["Disk", "Line", "Polygon", "Polyhedron"]);
    const body = layer.mark!(3, 0);
    expect(body.head === "Polyhedron" && body.faces).toHaveLength(14);
  });

  it("publishes the properties by dimension", () => {
    const layer = permutahedron();
    const kinds = (name: string) => addressesOf(layer).filter(([k, i]) => layer.has(k, i, name)).length;
    expect([kinds("IsVertex"), kinds("IsEdge"), kinds("IsRidge"), kinds("IsFacet"), kinds("IsTop")]).toEqual([
      24, 36, 36, 14, 1,
    ]);
    expect(kinds("IsInterior")).toBe(15);
    expect(layer.has(2, 0, "Dimension2")).toBe(true);
  });

  it("measures dimension, vertices and the faces a face is on", () => {
    const layer = permutahedron();
    // A hexagon has six vertices; each vertex is on 3 edges, 3 faces and the body.
    const hexagon = [...Array(14).keys()].find((i) => layer.value(2, i, "VertexCount") === 6)!;
    expect(layer.value(2, hexagon, "Dimension")).toBe(2);
    expect(layer.value(0, 0, "Valence")).toBe(7);
    expect(layer.value(2, 5, "Index")).toBe(5);
  });

  it("relates faces to the picked one by the face poset", () => {
    const layer = permutahedron();
    const hexagon = [...Array(14).keys()].find((i) => layer.value(2, i, "VertexCount") === 6)!;
    const near = (relation: string, k: number) =>
      addressesOf(layer).filter(([a, i]) => a === k && layer.relatedTo(relation, [2, hexagon], a, i)).length;
    // Its closure: 6 vertices, 6 edges, itself. Its star: itself and the body.
    expect([near("FaceOf", 0), near("FaceOf", 1), near("FaceOf", 2), near("FaceOf", 3)]).toEqual([6, 6, 1, 0]);
    expect([near("Cofaces", 2), near("Cofaces", 3), near("HasFace", 3)]).toEqual([1, 1, 1]);
    expect([near("Incident", 0), near("Incident", 3)]).toEqual([6, 1]);
    // A cover: dimensions one apart.
    expect([near("Adjacent", 1), near("Adjacent", 3), near("Adjacent", 0)]).toEqual([6, 1, 0]);
    expect(near("SameDimension", 2)).toBe(14);
  });

  it("shares one frame among polytopes, numbering faces on through each dimension", () => {
    const layer = polytope(["Permutahedron", 4], ["Associahedron", 4]);
    // 24 + 14 vertices; the first 24 are the permutahedron's, so a relation never crosses over.
    expect(addressesOf(layer).filter(([k]) => k === 0)).toHaveLength(38);
    expect(layer.relatedTo("FaceOf", [3, 0], 0, 30)).toBe(false);
    expect(layer.relatedTo("FaceOf", [3, 0], 0, 3)).toBe(true);
  });

  it("describes a face in a PolyhedronData-like summary", () => {
    const layer = permutahedron();
    const { title, rows } = layer.describe(2, 0);
    expect(title).toMatch(/^2-face \{\{/);
    expect(rows.map(([k]) => k)).toEqual(["dimension", "vertices", "incident"]);
  });

  it("captions the selected face by default and the rest by MeshCellLabel", () => {
    const layer = permutahedron();
    expect(layer.label!(0, 0, false)).toBeUndefined();
    expect(layer.label!(0, 0, true)?.text).toBeTruthy();
    const all = figureLayerOf("PolytopeFaces", [
      "List",
      ["PolytopeFaces", ["Permutahedron", 3], ["Rule", "MeshCellLabel", ["List", ["Rule", 0, "'Index'"]]]],
    ]);
    if (typeof all === "string") throw new Error(all);
    expect([all.label!(0, 2)?.text, all.label!(1, 2)?.text]).toEqual(["3", undefined]);
  });

  it("declines what it can't draw", () => {
    expect(figureLayerOf("PolytopeFaces", ["List", ["PolytopeFaces", ["Permutahedron", 7]]])).toMatch(/too many/);
    expect(figureLayerOf("PolytopeFaces", ["List", ["PolytopeFaces", ["Blob", 3]]])).toMatch(/needs a polytope/);
  });
});

describe("the camera", () => {
  it("reads Wolfram's view options", () => {
    const s = cameraSpecOf(
      new Map<string, unknown>([
        ["ViewPoint", ["List", 1, ["Negate", 2], 3]],
        ["ViewAngle", 35],
        ["SphericalRegion", "True"],
      ]),
    );
    expect(s.viewPoint).toEqual([1, -2, 3]);
    expect([s.viewAngle, s.spherical, s.viewVertical]).toEqual([35, true, [0, 0, 1]]);
    expect(cameraSpecOf(new Map([["ViewPoint", "Above"]])).viewPoint).toEqual([0, 0, 3]);
    expect(cameraSpecOf(new Map()).viewAngle).toBeUndefined();
  });

  it("orbits so the near side follows the pointer, and stops short of the pole", () => {
    const layer = permutahedron();
    const flat = liftedToThree(layer);
    const nearest = [...Array(24).keys()].toSorted((p, q) => flat.place!(0, p)[1]! - flat.place!(0, q)[1]!)[0]!;
    const xOf = (viewPoint: readonly [number, number, number]) =>
      throughCamera(layer, spec({ viewPoint }), { viewPoint, zoom: 1 }, 1).layer.place!(0, nearest)[0]!;
    const home: [number, number, number] = [0, -3, 0];
    expect(xOf(orbited(home, [0, 0, 1], 40, 0))).toBeGreaterThan(xOf(home));
    expect(Math.hypot(...orbited(home, [0, 0, 1], 40, 25))).toBeCloseTo(3);
    const top = orbited(home, [0, 0, 1], 0, 100_000);
    expect(top[2] / Math.hypot(...top)).toBeLessThan(1);
  });

  it("sorts back to front, faces under lines under points, and shades by depth", () => {
    const layer = permutahedron();
    const flat = liftedToThree(layer);
    const vp: [number, number, number] = [0, -3, 0];
    const { layer: shown } = throughCamera(layer, spec(), { viewPoint: vp, zoom: 1 }, 1);
    const order = addressesOf(shown);
    const heads = order.map(([k, i]) => shown.mark!(k, i).head);
    expect(heads.indexOf("Line")).toBeGreaterThan(heads.lastIndexOf("Polygon"));
    expect(heads.indexOf("Disk")).toBeGreaterThan(heads.lastIndexOf("Line"));
    // Looking along +y from -y: a smaller y is nearer, so Depth rises with y.
    const depth = (k: number, i: number) => shown.value(k, i, "Depth")!;
    const ys = [...Array(24).keys()].toSorted((p, q) => flat.place!(0, p)[1]! - flat.place!(0, q)[1]!);
    expect(depth(0, ys[0]!)).toBeLessThan(depth(0, ys[23]!));
    expect(shown.view).toBe("camera");
  });

  it("takes the places to 3-D by one replaceable map: the layer's own, or ProjectionMatrix", () => {
    const layer = polytope(["CrossPolytope", 4]);
    // A 16-cell's own map leads with its last axes; this one keeps the first three.
    const swap = cameraSpecOf(
      new Map<string, unknown>([
        ["ProjectionMatrix", ["List", ["List", 1, 0, 0, 0], ["List", 0, 1, 0, 0], ["List", 0, 0, 1, 0]]],
      ]),
    ).projection!;
    expect(projectTo3(layer.place!(0, 0), swap)).toEqual([
      layer.place!(0, 0)[0],
      layer.place!(0, 0)[1],
      layer.place!(0, 0)[2],
    ]);
    const moved = [...Array(8).keys()].some(
      (i) =>
        JSON.stringify(liftedToThree(layer, swap).place!(0, i)) !== JSON.stringify(liftedToThree(layer).place!(0, i)),
    );
    expect(moved).toBe(true);
    expect(cameraSpecOf(new Map([["ProjectionMatrix", "Automatic"]])).projection).toBeUndefined();
  });

  it("fits the circumscribed sphere, or a perspective lens at its distance", () => {
    const layer = permutahedron();
    const state = { viewPoint: [0, -3, 0] as const, zoom: 1 };
    const sphere = throughCamera(layer, spec(), state, 1).view;
    expect(sphere.center).toEqual([0, 0]);
    expect(sphere.extent).toBeGreaterThan(1);
    expect(throughCamera(layer, spec(), { ...state, zoom: 2 }, 1).view.extent).toBeCloseTo(sphere.extent / 2);
    const lens = throughCamera(layer, spec({ viewAngle: 40 }), state, 1).view;
    expect(lens.extent).toBeCloseTo(3 * Math.tan((20 * Math.PI) / 180), 1);
  });
});

// A canvas that records fills in order.
class PathStub {
  readonly ops: unknown[][] = [];
  moveTo(...a: number[]) {
    this.ops.push(["moveTo", ...a]);
  }
  lineTo(...a: number[]) {
    this.ops.push(["lineTo", ...a]);
  }
  arc(...a: number[]) {
    this.ops.push(["arc", ...a]);
  }
  rect() {}
  closePath() {
    this.ops.push(["close"]);
  }
}
let had: unknown;
beforeEach(() => {
  had = (globalThis as { Path2D?: unknown }).Path2D;
  (globalThis as { Path2D?: unknown }).Path2D = PathStub;
});
afterEach(() => {
  (globalThis as { Path2D?: unknown }).Path2D = had;
});

const rulesOf = (head: "PolytopeFaces") => {
  const d = FIGURE_DEFAULTS[head];
  return {
    colorRules: (d.colors as unknown[]).slice(1).map((r) => colorRuleOf(r)!),
    boundaryRules: (d.edges as unknown[]).slice(1).map((r) => boundaryRuleOf(r)!),
  };
};

describe("drawing a camera frame", () => {
  const draw = (layer: TileLayer, selection: [number, number][] = []) => {
    const painted: { op: "fill" | "stroke"; color: unknown }[] = [];
    const ctx = {
      save() {},
      fillText() {},
      restore() {},
      setLineDash() {},
      fill() {
        painted.push({ op: "fill", color: (this as unknown as { fillStyle: string }).fillStyle });
      },
      stroke() {
        painted.push({ op: "stroke", color: (this as unknown as { strokeStyle: string }).strokeStyle });
      },
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;
    const { layer: shown, view } = throughCamera(layer, spec(), { viewPoint: [0, -3, 0], zoom: 1 }, 1);
    drawTiles(ctx, 200, 200, shown, view, {
      ...rulesOf("PolytopeFaces"),
      colorMixing: "First",
      selection,
      fill: 1,
      phase: 0,
      budgetMs: 1000,
    });
    return painted;
  };

  it("paints a mark at a time, faces before lines before points", () => {
    const painted = draw(permutahedron());
    const fills = painted.filter((p) => p.op === "fill").length;
    // 14 washed faces and 24 points; edges are strokes in the ink.
    expect(fills).toBe(14 + 24);
    expect(painted.filter((p) => p.op === "stroke").length).toBe(36);
    expect(painted.slice(0, 14).every((p) => p.op === "fill")).toBe(true);
  });

  it("lights a picked face in the accent", () => {
    const painted = draw(permutahedron(), [[2, 0]]);
    expect(painted.some((p) => typeof p.color === "string" && /rgba\(217, 119, 6, 0\.35\)/.test(p.color))).toBe(true);
  });

  it("picks a point over a line over a face, in the figure's own projection", () => {
    const layer = permutahedron();
    const { layer: shown } = throughCamera(layer, spec(), { viewPoint: [0, -3, 0], zoom: 1 }, 1);
    const at = shown.place!(0, 5) as [number, number];
    expect(hitAt(shown, at, 0.05)).toEqual([[0, 5]]);
    const middle = shown.place!(1, 3) as [number, number];
    expect(hitAt(shown, middle, 0.01)[0]?.[0]).toBe(1);
    const face = shown.place!(2, 0) as [number, number];
    expect(hitAt(shown, face, 0.001)[0]?.[0]).toBeLessThanOrEqual(2);
  });
});
