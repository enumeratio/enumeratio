import { describe, expect, it } from "vite-plus/test";
import { lowerFigure } from "../src/figure-frames.ts";
import { strandLayer, strandModelOf } from "../src/strand-frame.ts";

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
    expect(lowerFigure("nonsense", [3, 1])).toBeUndefined();
    expect(lowerFigure("diagram", [0, 0, 1])).toBeUndefined();
    expect(lowerFigure("permutation", [1, 1])).toBeUndefined();
    expect(lowerFigure("permutation", [])).toBeUndefined();
  });
});

describe("a braid", () => {
  // σ₁ σ₂⁻¹ σ₁ on three strands.
  const word = [1, -2, 1];
  const layer = layerOf(["Braid", 3, list(...word)]);

  it("is a level per generator and an out side", () => {
    expect(layer.bounds).toEqual({ i: [1, 3], j: [0, 3] });
    expect(layer.value(1, 3, "Sign")).toBe(1);
    expect(layer.describe(1, 0).title).toBe("σ₁ σ₂⁻¹ σ₁");
  });

  it("follows a strand through every level", () => {
    // From slot 1: 1, 2, 3, 3 (σ₁ moves it to 2, σ₂⁻¹ to 3, σ₁ leaves it).
    const along = [0, 1, 2, 3].map((l) => [1, 2, 3].filter((s) => layer.relatedTo("SameStrand", [1, 0], s, l)));
    expect(along).toEqual([[1], [2], [3], [3]]);
    expect(layer.value(1, 0, "Image")).toBe(3);
  });

  it("has a generator's two strands over and under, by the letter's sign", () => {
    // σ₁: slot 1 over; σ₂⁻¹: slot 3 over, slot 2 under.
    expect([1, 2, 3].map((s) => layer.has(s, 0, "IsOver"))).toEqual([true, false, false]);
    expect([1, 2, 3].map((s) => layer.has(s, 0, "IsUnder"))).toEqual([false, true, false]);
    expect([1, 2, 3].map((s) => [layer.has(s, 1, "IsOver"), layer.has(s, 1, "IsUnder")])).toEqual([
      [false, false],
      [false, true],
      [true, false],
    ]);
    expect([1, 2, 3].map((s) => layer.value(s, 1, "Exponent"))).toEqual([undefined, -1, -1]);
    expect(layer.value(1, 0, "Exponent")).toBe(1);
    expect(layer.has(1, 3, "IsOver")).toBe(false);
  });

  it("crosses the strands it passes over or under", () => {
    expect(layer.relatedTo("Crosses", [1, 0], 2, 0)).toBe(true);
    expect(layer.relatedTo("Crosses", [1, 0], 1, 0)).toBe(false);
    const hopf = layerOf(["Braid", 3, list(1, 1)]);
    expect([1, 2, 3].map((s) => hopf.value(s, 0, "Crossings"))).toEqual([1, 1, 0]);
  });

  it("breaks the under strand where it crosses", () => {
    const strand = (s: number) => layer.linkMark!(layer.links!().find((m) => m.some(([a, b]) => a === s && b === 0))!);
    expect(strand(1)).not.toHaveProperty("breaks");
    expect(strand(2)).toMatchObject({ head: "Line", breaks: [expect.any(Number)] });
  });

  it("draws the identity as straight strands, and declines bad words", () => {
    expect(layerOf(["Braid", 2]).describe(1, 0).title).toBe("identity");
    expect(strandModelOf(["Braid", 2, list(2)])).toMatch(/letters/);
    expect(strandModelOf(["Braid", 0, list()])).toMatch(/strands/);
  });
});

describe("a braid named by a call", () => {
  it("expands TorusBraid and the braid constructors to their word", () => {
    // (σ₁σ₂)² on three strands.
    expect(layerOf(["TorusBraid", 3, 2]).describe(1, 0).title).toBe("σ₁ σ₂ σ₁ σ₂");
    expect(layerOf(["BraidInverse", ["Braid", 3, list(1, -2)]]).describe(1, 0).title).toBe("σ₂ σ₁⁻¹");
    expect(layerOf(["BraidPower", ["Braid", 2, list(1)], 3]).describe(1, 0).title).toBe("σ₁ σ₁ σ₁");
    expect(layerOf(["BraidProduct", ["Braid", 3, list(1)], ["TorusBraid", 3, 1]]).describe(1, 0).title).toBe(
      "σ₁ σ₁ σ₂",
    );
  });

  it("declines what is no braid", () => {
    expect(strandModelOf(["TorusBraid", 1, 2])).toMatch(/does not name a braid/);
    expect(strandModelOf(["BraidInverse", 3])).toMatch(/needs a braid/);
    expect(strandModelOf(["BraidPower", ["Braid", 2, list(1)], 1e9])).toMatch(/does not name a braid/);
  });
});

describe("a composition of braids", () => {
  // Composing stacks a above b, so b's letters are the lower levels.
  const stack = layerOf(["Compose", ["Braid", 3, list(1)], ["Braid", 3, list(-2)]]);

  it("keeps the word, with its over and under and exponents", () => {
    expect(stack.describe(1, 0).title).toBe("σ₂⁻¹ σ₁");
    expect([1, 2, 3].map((s) => stack.value(s, 0, "Exponent"))).toEqual([undefined, -1, -1]);
    expect([1, 2, 3].map((s) => stack.value(s, 1, "Exponent"))).toEqual([1, 1, undefined]);
    expect([1, 2, 3].map((s) => stack.has(s, 1, "IsOver"))).toEqual([true, false, false]);
  });

  it("aligns levels past an identity", () => {
    const withIdentity = layerOf(["Compose", ["Braid", 2, list(1)], ["Braid", 2]]);
    expect(withIdentity.describe(1, 0).title).toBe("σ₁");
    expect(withIdentity.has(1, 0, "IsOver")).toBe(false);
    expect(withIdentity.has(1, 1, "IsOver")).toBe(true);
    expect(withIdentity.value(1, 1, "Exponent")).toBe(1);
  });

  it("has no word once a diagram is among the parts", () => {
    const mixed = layerOf(["Compose", ["Braid", 2, list(1)], ["Permutation", list(2, 1)]]);
    expect(mixed.has(1, 0, "IsOver")).toBeUndefined();
  });
});

describe("a braid's closure", () => {
  const trefoil = layerOf(["BraidClosure", ["Braid", 2, list(1, 1, 1)]]);
  const hopf = layerOf(["BraidClosure", ["Braid", 2, list(1, 1)]]);
  const cells = (layer: ReturnType<typeof layerOf>, from: [number, number]) =>
    [0, 1, 2, 3].flatMap((l) => [1, 2].filter((s) => layer.relatedTo("SameStrand", from, s, l)).map((s) => [s, l]));

  it("makes a knot one component, however the strands return", () => {
    // σ₁³ sends slot 1 to slot 2 and back: both strands are one component.
    expect(cells(trefoil, [1, 0])).toHaveLength(8);
    expect(trefoil.value(1, 0, "Block")).toBe(trefoil.value(2, 0, "Block"));
    expect(trefoil.summary()).toContainEqual(["components", "1"]);
    expect(trefoil.describe(1, 0).rows).toContainEqual(["component", "1 of 1"]);
  });

  it("keeps the components of a link apart", () => {
    expect(hopf.summary()).toContainEqual(["components", "2"]);
    expect(cells(hopf, [1, 0])).toHaveLength(3);
    expect(hopf.relatedTo("SameStrand", [1, 0], 2, 0)).toBe(false);
    expect(hopf.relatedTo("Crosses", [1, 0], 2, 0)).toBe(true);
  });

  it("closes a composition of braids, and a torus braid", () => {
    const composed = layerOf(["BraidClosure", ["Compose", ["Braid", 2, list(1)], ["Braid", 2, list(1, 1)]]]);
    expect(composed.summary()).toContainEqual(["components", "1"]);
    expect(layerOf(["BraidClosure", ["TorusBraid", 2, 3]]).summary()).toContainEqual(["components", "1"]);
    expect(layerOf(["BraidClosure", ["TorusBraid", 3, 3]]).summary()).toContainEqual(["components", "3"]);
  });

  it("draws each arc round the right side, nested, from the out cell to the in cell", () => {
    const arc = (s: number) => {
      const link = trefoil.links!().find((m) => m.every(([a]) => a === s) && m[0]![1] === 3 && m[1]![1] === 0)!;
      const mark = trefoil.linkMark!(link);
      if (mark.head !== "Line") throw new Error("not a line");
      return mark.points as [number, number][];
    };
    const [one, two] = [arc(1), arc(2)];
    expect(one[0]).toEqual([1, 3 * 1.6]);
    expect(one.at(-1)).toEqual([1, 0]);
    expect(Math.max(...one.map((p) => p[0]))).toBeGreaterThan(Math.max(...two.map((p) => p[0])));
    expect(Math.max(...two.map((p) => p[0]))).toBeGreaterThan(2);
  });

  it("declines what is no braid, and a composition of closures", () => {
    expect(strandModelOf(["BraidClosure", ["Permutation", list(2, 1)]])).toMatch(/needs a braid/);
    expect(strandModelOf(["Compose", ["BraidClosure", ["Braid", 2, list(1)]], ["Braid", 2, list(1)]])).toMatch(
      /closure is of a composition/,
    );
  });
});
