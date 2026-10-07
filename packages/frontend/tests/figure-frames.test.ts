import { describe, expect, it } from "vite-plus/test";
import { figureLayerOf, lowerFigure } from "../src/figure-frames.ts";
import { addressesOf, fitView, hitAt } from "../src/tiles-canvas.ts";

const list = (...xs: unknown[]) => ["List", ...xs];
const cells = (json: unknown) => {
  const layer = figureLayerOf("CellDiagram", json);
  if (typeof layer === "string") throw new Error(layer);
  return layer;
};
const tree = (counts: number[]) => {
  const layer = figureLayerOf("TreeDiagram", ["PlaneTree", list(...counts)]);
  if (typeof layer === "string") throw new Error(layer);
  return layer;
};
const path = (head: "DyckPath" | "LatticePath", ...steps: number[]) => {
  const layer = figureLayerOf("PathDiagram", [head, list(...steps)]);
  if (typeof layer === "string") throw new Error(layer);
  return layer;
};
const partition = (...parts: number[]) => cells(["IntegerPartition", list(...parts)]);

describe("the cell frame", () => {
  it("has only the cells of a ragged shape as addresses", () => {
    const layer = partition(3, 1);
    expect(addressesOf(layer)).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 1],
    ]);
    expect(layer.has(2, 2, "IsFilled")).toBeUndefined();
  });

  it("measures hooks, arms and legs", () => {
    const layer = partition(4, 2, 1);
    expect([1, 2, 3, 4].map((c) => layer.value(1, c, "Hook"))).toEqual([6, 4, 2, 1]);
    expect(layer.value(1, 1, "Arm")).toBe(3);
    expect(layer.value(1, 1, "Leg")).toBe(2);
    expect(layer.value(1, 3, "Content")).toBe(2);
  });

  it("knows removable corners and the first row and column", () => {
    const layer = partition(3, 1);
    expect(addressesOf(layer).filter(([i, j]) => layer.has(i, j, "IsCorner"))).toEqual([
      [1, 3],
      [2, 1],
    ]);
    expect([layer.has(2, 1, "InFirstColumn"), layer.has(2, 1, "InFirstRow")]).toEqual([true, false]);
  });

  it("relates cells to the selected one: its hook, row, column and neighbors", () => {
    const layer = partition(3, 2, 1);
    const hook = addressesOf(layer).filter(([i, j]) => layer.relatedTo("Hook", [1, 2], i, j));
    expect(hook).toEqual([
      [1, 2],
      [1, 3],
      [2, 2],
    ]);
    expect(addressesOf(layer).filter(([i, j]) => layer.relatedTo("SameColumn", [1, 1], i, j))).toHaveLength(3);
    expect(layer.relatedTo("SameRow", [2, 1], 2, 2)).toBe(true);
    expect(layer.relatedTo("Adjacent", [2, 1], 3, 1)).toBe(true);
    expect(layer.relatedTo("Adjacent", [2, 1], 3, 2)).toBe(false);
  });

  it("carries a tableau's entries and describes the cell with its hook", () => {
    const layer = cells(["StandardTableau", list(list(1, 2, 4), list(3, 5))]);
    expect(layer.value(2, 2, "Entry")).toBe(5);
    expect(layer.label?.(1, 3)?.text).toBe("4");
    expect(layer.describe(1, 1)).toEqual({
      title: "cell (1, 1)",
      rows: [
        ["content", "0"],
        ["entry", "1"],
        ["hook", "4 (arm 2, leg 1)"],
      ],
    });
  });

  it("draws a composition as parts as wide as their value, picked anywhere over them", () => {
    const layer = cells(["Composition", list(3, 1)]);
    expect(addressesOf(layer)).toEqual([
      [1, 1],
      [1, 2],
    ]);
    expect(layer.value(1, 1, "Part")).toBe(1);
    expect(layer.value(1, 1, "Entry")).toBe(3);
    // Over the first part's left end, away from its center.
    expect(hitAt(layer, [0.7, -1], 0.1)).toEqual([[1, 1]]);
  });

  it("keeps a subset's absent members as unfilled addresses", () => {
    const layer = cells(["Subset", list(1, 3), 5]);
    expect(addressesOf(layer)).toHaveLength(5);
    expect([1, 2, 3, 4, 5].map((k) => layer.has(1, k, "IsFilled"))).toEqual([true, false, true, false, false]);
  });

  it("names what it cannot read", () => {
    expect(figureLayerOf("CellDiagram", ["IntegerPartition", list(1, 3)])).toMatch(/largest first/);
    expect(figureLayerOf("CellDiagram", ["Gizmo"])).toMatch(/CellDiagram needs/);
  });
});

describe("the tree frame", () => {
  // Preorder child counts of ((•,•),(•,(•,•))) : 2 2 0 0 2 0 2 0 0
  const layer = tree([2, 2, 0, 0, 2, 0, 2, 0, 0]);

  it("puts nodes at (depth, order) and its links on the parent edges", () => {
    expect(layer.bounds).toEqual({ i: [0, 3], j: [0, 3] });
    expect(addressesOf(layer)).toHaveLength(9);
    expect(layer.links?.()).toHaveLength(8);
    expect(layer.links?.()[0]).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });

  it("has leaf, root and internal, with depth, children and subtree size", () => {
    expect([layer.has(0, 0, "IsRoot"), layer.has(2, 0, "IsLeaf"), layer.has(1, 1, "IsInternal")]).toEqual([
      true,
      true,
      true,
    ]);
    expect(layer.value(1, 1, "Children")).toBe(2);
    expect(layer.value(1, 1, "SubtreeSize")).toBe(5);
    expect(layer.value(3, 0, "Depth")).toBe(3);
  });

  it("relates nodes by ancestry", () => {
    const sel: [number, number] = [1, 1];
    const lit = (relation: string) => addressesOf(layer).filter(([d, o]) => layer.relatedTo(relation, sel, d, o));
    expect(lit("Subtree")).toHaveLength(5);
    expect(lit("Descendant")).toHaveLength(4);
    expect(lit("Ancestor")).toEqual([[0, 0]]);
    expect(lit("Sibling")).toEqual([[1, 0]]);
  });

  it("reads a binary tree's nested form", () => {
    const binary = figureLayerOf("TreeDiagram", ["BinaryTree", list(list(0, 0), 0)]);
    expect(typeof binary === "string" ? binary : addressesOf(binary)).toHaveLength(5);
    expect(figureLayerOf("TreeDiagram", ["PlaneTree", list(2, 0)])).toMatch(/TreeDiagram needs/);
  });
});

describe("the path frame", () => {
  const dyck = path("DyckPath", 1, 1, 0, 0, 1, 0);

  it("visits (step, height) and links its steps", () => {
    expect(addressesOf(dyck)).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 1],
      [4, 0],
      [5, 1],
      [6, 0],
    ]);
    expect(dyck.links?.()).toHaveLength(6);
  });

  it("has peaks, valleys, returns and the direction it arrived in", () => {
    const at = (name: string) => addressesOf(dyck).filter(([i, j]) => dyck.has(i, j, name));
    expect(at("IsPeak")).toEqual([
      [2, 2],
      [5, 1],
    ]);
    expect(at("Valley")).toEqual([[4, 0]]);
    expect(at("Return")).toHaveLength(3);
    expect(at("Up")).toHaveLength(3);
    expect(dyck.value(6, 0, "Area")).toBe(5);
  });

  it("relates points by height, and the ends of a matching step pair", () => {
    expect(dyck.relatedTo("SameHeight", [1, 1], 3, 1)).toBe(true);
    // The step arriving at (3, 1) is the down step closing the one into (2, 2).
    const tunnel = addressesOf(dyck).filter(([i, j]) => dyck.relatedTo("Tunnel", [3, 1], i, j));
    expect(tunnel).toEqual([
      [1, 1],
      [2, 2],
      [3, 1],
    ]);
  });

  it("walks a lattice path east and north", () => {
    const lattice = path("LatticePath", 0, 1, 1, 0);
    expect(addressesOf(lattice).at(-1)).toEqual([2, 2]);
    expect(lattice.has(1, 0, "IsEast")).toBe(true);
    expect([0, 1, 2].map((y) => lattice.has(1, y, "IsCorner"))).toEqual([true, false, true]);
    expect(lattice.has(1, 1, "IsPeak")).toBeUndefined();
    expect(lattice.value(2, 2, "Area")).toBe(2);
  });

  it("fits whole, marks included", () => {
    expect(fitView(dyck, 1e9).extent).toBeGreaterThan(1);
  });
});

describe("Figure lowered to frames", () => {
  it("lowers each cell, tree and path kind to its Show", () => {
    expect(lowerFigure("partition", [3, 1])?.show).toContain("CellDiagram(IntegerPartition([3, 1]))");
    expect(lowerFigure("tableau", [2, 1])?.show).toContain("StandardTableau([[1, 2], [3]])");
    expect(lowerFigure("composition", [2, 1])?.show).toContain("CellDiagram(Composition([2, 1]))");
    expect(lowerFigure("subset", [1, 3], { n: 6 })?.show).toContain("Subset([1, 3], 6)");
    expect(lowerFigure("tree", [2, 0, 0])?.show).toContain("TreeDiagram(PlaneTree([2, 0, 0]))");
    expect(lowerFigure("binary-tree", [1, 0, 0])?.show).toContain("PlaneTree([2, 0, 0])");
    expect(lowerFigure("dyck", [1, 0])?.show).toContain("PathDiagram(DyckPath([1, 0]))");
    expect(lowerFigure("lattice", [0, 1])?.show).toContain("GridLines");
  });

  it("sizes the box to the figure", () => {
    expect(lowerFigure("partition", [4, 3, 2, 1])!.height).toBeGreaterThan(lowerFigure("partition", [4])!.height);
    expect(lowerFigure("dyck", [1, 1, 0, 0])!.width).toBeGreaterThan(lowerFigure("dyck", [1, 0])!.width);
  });

  it("leaves values no frame reads to the SVG", () => {
    expect(lowerFigure("partition", [1, 3])).toBeUndefined();
    expect(lowerFigure("tree", [2, 0])).toBeUndefined();
    expect(lowerFigure("dyck", [1, 2])).toBeUndefined();
    expect(lowerFigure("subset", [])).toBeDefined();
  });
});
