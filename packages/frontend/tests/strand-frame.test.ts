import { describe, expect, it } from "vite-plus/test";
import { lowerFigure, strandLayer, strandModelOf } from "../src/strand-frame.ts";

const list = (...xs: unknown[]) => ["List", ...xs];
const layerOf = (json: unknown) => {
  const model = strandModelOf(json);
  if (typeof model === "string") throw new Error(model);
  return strandLayer(model);
};
const permutation = (...image: number[]) => layerOf(["Permutation", list(...image)]);
const diagram = (...blocks: number[][]) => layerOf(["Diagram", list(...blocks.map((b) => list(...b)))]);

describe("the strand frame's addresses", () => {
  it("are (slot, level), with the sign derived from the level", () => {
    const layer = permutation(3, 1, 2);
    expect(layer.bounds).toEqual({ i: [1, 3], j: [0, 1] });
    expect([layer.value(2, 0, "Sign"), layer.value(2, 1, "Sign")]).toEqual([-1, 1]);
    expect(layer.value(2, 1, "Level")).toBe(1);
    expect(layer.has(4, 0, "IsThrough")).toBeUndefined();
  });

  it("number blocks by first appearance, top row first, as a restricted-growth string does", () => {
    const layer = diagram([1, 2, -1, -2], [3, -3]);
    expect([1, 2, 3].map((s) => layer.value(s, 1, "Block"))).toEqual([0, 0, 1]);
    expect([1, 2, 3].map((s) => layer.value(s, 0, "Block"))).toEqual([0, 0, 1]);
  });

  it("title a block as signed labels", () => {
    const layer = diagram([1, 2, -1, -2], [3, -3]);
    expect(layer.describe(2, 0).title).toBe("{1, 2, -1, -2}");
    expect(layer.describe(3, 1)).toEqual({
      title: "{3, -3}",
      rows: [
        ["size", "2"],
        ["kind", "through"],
        ["image", "3"],
        ["crossings", "0"],
      ],
    });
  });
});

describe("a permutation", () => {
  const layer = permutation(3, 1, 2);

  it("is all through-strands, each slot's image the far end", () => {
    for (const s of [1, 2, 3]) {
      expect(layer.has(s, 0, "IsThrough")).toBe(true);
      expect(layer.has(s, 0, "IsCap")).toBe(false);
      expect(layer.has(s, 1, "IsCup")).toBe(false);
    }
    expect([1, 2, 3].map((s) => layer.value(s, 0, "Image"))).toEqual([3, 1, 2]);
    expect(layer.relatedTo("Image", [1, 0], 3, 1)).toBe(true);
    expect(layer.relatedTo("Image", [1, 0], 2, 1)).toBe(false);
  });

  it("crosses exactly where it has inversions", () => {
    expect([1, 2, 3].map((s) => layer.value(s, 0, "Crossings"))).toEqual([2, 1, 1]);
    expect(permutation(1, 2, 3).has(1, 0, "IsCrossing")).toBe(false);
    expect(layer.relatedTo("Crosses", [2, 0], 1, 0)).toBe(true);
    expect(layer.relatedTo("Crosses", [2, 0], 3, 0)).toBe(false);
  });

  it("has a link per strand, which a hit selects whole", () => {
    expect(layer.links!()).toEqual([
      [
        [3, 1],
        [1, 0],
      ],
      [
        [1, 1],
        [2, 0],
      ],
      [
        [2, 1],
        [3, 0],
      ],
    ]);
  });

  it("must be a rearrangement", () => {
    expect(strandModelOf(["Permutation", list(1, 1)])).toMatch(/rearrangement/);
  });
});

describe("a diagram", () => {
  it("tells cups, caps and through strands apart", () => {
    const e1 = diagram([1, 2], [-1, -2]);
    expect([e1.has(1, 1, "IsCup"), e1.has(1, 1, "IsCap"), e1.has(1, 0, "IsCap")]).toEqual([true, false, true]);
    expect(e1.has(1, 1, "IsThrough")).toBe(false);
    expect(e1.has(1, 1, "IsCrossing")).toBe(false);
    expect(diagram([1, -1], [2], [-2]).has(2, 1, "IsSingleton")).toBe(true);
  });

  it("finds a crossing among its strands, and the strands it crosses", () => {
    const s1 = diagram([1, -2], [2, -1], [3, -3]);
    expect([1, 2, 3].map((s) => s1.has(s, 1, "IsCrossing"))).toEqual([true, true, false]);
    // Selecting a cell of one strand lights the other, not its own.
    expect([1, 2, 3].map((s) => s1.relatedTo("Crosses", [1, 1], s, 0))).toEqual([true, false, false]);
    expect(s1.relatedTo("SameBlock", [1, 1], 2, 0)).toBe(true);
    expect(s1.relatedTo("SameBlock", [1, 1], 1, 0)).toBe(false);
  });

  it("relates neighbors and levels", () => {
    const layer = permutation(1, 2, 3);
    expect(layer.relatedTo("Adjacent", [2, 0], 3, 0)).toBe(true);
    expect(layer.relatedTo("Adjacent", [2, 0], 3, 1)).toBe(false);
    expect(layer.relatedTo("Above", [2, 0], 2, 1)).toBe(true);
    expect(layer.relatedTo("Below", [2, 1], 2, 0)).toBe(true);
  });

  it("draws a cup as an arc bowing into the frame, a through strand as an S", () => {
    const layer = diagram([1, 2], [-1, -2]);
    const [, cap] = layer.links!();
    const curve = layer.linkMark!(cap!);
    if (curve.head !== "Line") throw new Error("not a line");
    const ys = curve.points.map((p) => p[1]!);
    expect(Math.max(...ys)).toBeGreaterThan(0.2);
    expect(Math.min(...ys)).toBe(0);
  });
});

describe("a set partition", () => {
  it("is the frame with one level, a block a hyperedge", () => {
    const layer = layerOf(["SetPartition", list(list(1, 3), list(2), list(4))]);
    expect(layer.bounds).toEqual({ i: [1, 4], j: [0, 0] });
    expect(layer.has(1, 0, "IsThrough")).toBe(false);
    expect(layer.value(3, 0, "Size")).toBe(2);
    expect(layer.value(3, 0, "Sign")).toBe(0);
    expect(layer.relatedTo("SameBlock", [1, 0], 3, 0)).toBe(true);
    expect(layer.links!()).toEqual([
      [
        [1, 0],
        [3, 0],
      ],
    ]);
  });

  it("crosses where blocks interleave", () => {
    const crossing = layerOf(["SetPartition", list(list(1, 3), list(2, 4))]);
    expect(crossing.has(1, 0, "IsCrossing")).toBe(true);
    const nested = layerOf(["SetPartition", list(list(1, 4), list(2, 3))]);
    expect(nested.has(1, 0, "IsCrossing")).toBe(false);
  });
});

describe("Compose", () => {
  const e1 = ["Diagram", list(list(1, 2), list(-1, -2))];
  const layer = layerOf(["Compose", e1, e1]);

  it("stacks levels, gluing the middle row", () => {
    expect(layer.bounds).toEqual({ i: [1, 2], j: [0, 2] });
    expect(layer.value(1, 1, "Sign")).toBe(0);
    expect(layer.relatedTo("Above", [1, 0], 1, 2)).toBe(true);
  });

  it("closes a loop in the glued row", () => {
    expect(layer.has(1, 1, "IsLoop")).toBe(true);
    expect(layer.has(2, 1, "IsLoop")).toBe(true);
    expect(layer.has(1, 0, "IsLoop")).toBe(false);
    expect(layer.has(1, 2, "IsCup")).toBe(true);
    expect(layer.has(1, 0, "IsCap")).toBe(true);
    expect(layer.relatedTo("SameBlock", [1, 1], 2, 1)).toBe(true);
  });

  it("makes a through strand of two that meet in the glued row", () => {
    const id = ["Diagram", list(list(1, -1), list(2, -2))];
    const swap = ["Diagram", list(list(1, -2), list(2, -1))];
    const product = layerOf(["Compose", swap, swap]);
    expect(product.has(1, 0, "IsThrough")).toBe(true);
    expect(product.value(1, 0, "Image")).toBe(1);
    expect(layerOf(["Compose", id, swap]).value(1, 0, "Image")).toBe(2);
  });

  it("wants diagrams on the same strands", () => {
    expect(strandModelOf(["Compose", e1, ["Diagram", list(list(1, -1))]])).toMatch(/same number/);
  });
});

describe("Figure lowered", () => {
  it("turns a permutation, a set partition and a diagram into a Show of a strand diagram", () => {
    expect(lowerFigure("permutation", [3, 1, 2])?.show).toContain("StrandDiagram(Permutation([3, 1, 2]))");
    expect(lowerFigure("set-partition", [0, 1, 0])?.show).toContain("StrandDiagram(SetPartition([[1, 3], [2]]))");
    expect(lowerFigure("diagram", [0, 0, 1, 0, 0, 1])?.show).toContain(
      "StrandDiagram(Diagram([[1, 2, -1, -2], [3, -3]]))",
    );
  });

  it("sizes the box to the figure", () => {
    const small = lowerFigure("diagram", [0, 1, 0, 1])!;
    const large = lowerFigure("diagram", [0, 1, 2, 3, 0, 1, 2, 3])!;
    expect(large.width).toBeGreaterThan(small.width);
    expect(small.height).toBeGreaterThan(0);
  });

  it("leaves other kinds, and values that aren't one, to the SVG", () => {
    expect(lowerFigure("tableau", [3, 1])).toBeUndefined();
    expect(lowerFigure("diagram", [0, 0, 1])).toBeUndefined();
    expect(lowerFigure("permutation", [1, 1])).toBeUndefined();
    expect(lowerFigure("permutation", [])).toBeUndefined();
  });
});
