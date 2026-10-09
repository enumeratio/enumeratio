import { declareCombinatorics } from "@enumeratio/combinatorics";
import { isNode, makeBoxes, optionsOfBox } from "@enumeratio/boxes";
import { expect, it } from "vite-plus/test";
import { configureEngine } from "../src/engine.ts";
import { displayListOfBox, graphicsOf } from "../src/graphics-box.ts";
import { loadLatticeModules } from "../src/lattice-layers.ts";
import {
  bind,
  evaluatedShow,
  FIGURE_NOTATION,
  heldShow,
  pinnedBox,
  producerOf,
  showBox,
  specOf,
  svgOfBox,
} from "../src/index.ts";

// What each route of a `Show` lowers to, by shape: the marks it lists and how it is looked at.
// A lattice lowers to a producer; a pinned view of it is a list like any figure's.

configureEngine((ce) => declareCombinatorics(ce));

const list = (...xs: unknown[]) => ["List", ...xs];
const rule = (name: string, value: unknown) => ["Rule", name, value];

/** The lowering `makeBoxes` gives a `Show`, as a box. */
function lower(show: unknown) {
  const box = makeBoxes(show as never, FIGURE_NOTATION);
  if (!isNode(box) || box[0] !== "GraphicsBox") throw new Error(`not a GraphicsBox: ${JSON.stringify(show)}`);
  return box;
}

/** The lowered `Show`, pinned: its marks and the options of its box. */
async function pinned(show: unknown) {
  await loadLatticeModules(specOf(show).tiles);
  const box = lower(show);
  const out = pinnedBox(box);
  if (typeof out === "string") throw new Error(out);
  const marks = displayListOfBox(out)?.marks ?? [];
  return { box, marks, options: optionsOfBox(graphicsOf(out)!.box) };
}

it("holds a lattice as a producer, and pins it to a finite list", async () => {
  const show = ["Show", ["LatticeTiles", ["QuadraticIntegers", -5]]];
  await loadLatticeModules(specOf(show).tiles);
  const box = lower(show);
  expect(optionsOfBox(box)).toMatchObject({ Producer: "LatticeTiles", ViewKind: "plane", Complete: false });
  expect(displayListOfBox(box)?.marks).toEqual([]);
  expect(heldShow(box)).toEqual(show);
  expect(typeof producerOf(box)).toBe("object");

  const { marks, options } = await pinned(show);
  expect(marks.length).toBeGreaterThan(20);
  expect(marks.length).toBeLessThanOrEqual(2000);
  expect(marks.every((m) => m.mark.head === "Polygon")).toBe(true);
  expect(options).toMatchObject({ ViewKind: "plane" });
  expect(options.Producer).toBeUndefined();
  expect(options.View).toHaveLength(3);
});

it("draws a pinned lattice as SVG, one path per tile", async () => {
  const show = ["Show", ["LatticeTiles", "GaussianIntegers", rule("ColorRules", list(rule("IsPrime", "Teal")))]];
  await loadLatticeModules(specOf(show).tiles);
  const out = svgOfBox(lower(show), 300, 300);
  expect(out.startsWith("<svg")).toBe(true);
  expect(out.match(/<path/g)!.length).toBeGreaterThan(50);
});

it("reads Embedding -> Logarithmic: a real field's elements at (log|σ₁|, log|σ₂|)", async () => {
  const plain = await pinned(["Show", ["LatticeTiles", ["QuadraticIntegers", 5]]]);
  const logarithmic = await pinned([
    "Show",
    ["LatticeTiles", ["QuadraticIntegers", 5], rule("Embedding", "'Logarithmic'")],
  ]);
  expect(logarithmic.marks.length).toBeGreaterThan(20);
  expect(logarithmic.options.ViewKind).toBe("plane");
  const places = (m: typeof plain.marks) => JSON.stringify(m.slice(0, 5).map((x) => x.at));
  expect(places(logarithmic.marks)).not.toBe(places(plain.marks));
  // An imaginary field has a single |σ|: no such picture, and the box says why.
  const bad = ["Show", ["LatticeTiles", ["QuadraticIntegers", -5], rule("Embedding", "'Logarithmic'")]];
  expect(showBox(bad)).toMatch(/imaginary/);
});

it("reads QuadraticOrder(D) by its discriminant", async () => {
  const { marks, options } = await pinned(["Show", ["LatticeTiles", ["QuadraticOrder", 12]]]);
  expect(marks.length).toBeGreaterThan(20);
  expect(options.ViewKind).toBe("plane");
  await loadLatticeModules({ head: "LatticeTiles", data: ["QuadraticOrder", 6] });
  expect(showBox(["Show", ["LatticeTiles", ["QuadraticOrder", 6]]])).toMatch(/discriminant/);
});

it("lowers the explorer's _R(Sqrt(_d)) ring once its wildcards are bound", async () => {
  const source = ["Show", ["LatticeTiles", ["_R", ["Sqrt", "_d"]]]];
  const bound = (R: string, d: unknown) =>
    bind(
      source,
      new Map<string, unknown>([
        ["R", R],
        ["d", d],
      ]),
    );
  const direct = await pinned(["Show", ["LatticeTiles", ["QuadraticIntegers", -5]]]);
  for (const d of [-5, ["Negate", 5]]) {
    const shown = await evaluatedShow(source, bound("AlgebraicIntegers", d));
    // A lattice layer is kept as bound: the ring reads its own Sqrt.
    expect(shown).toEqual(bound("AlgebraicIntegers", d));
    const { marks } = await pinned(shown);
    expect(marks.length).toBe(direct.marks.length);
  }
  const order = await pinned(await evaluatedShow(source, bound("AlgebraicOrder", 3)));
  const reference = await pinned(["Show", ["LatticeTiles", ["QuadraticOrder", 12]]]);
  expect(order.marks.length).toBe(reference.marks.length);
});

it("evaluates a figure's arguments with its head kept, then lowers it", async () => {
  // `Subset([1, 3], _n)` is a subset of n, though compute-engine reads it as a predicate.
  const source = ["Show", ["CellDiagram", ["Subset", list(1, 3), "_n"]]];
  const shown = await evaluatedShow(source, bind(source, new Map<string, unknown>([["n", ["Add", 2, 3]]])));
  expect(shown).toEqual(["Show", ["CellDiagram", ["Subset", list(1, 3), 5]]]);
  const made = lower(shown);
  const direct = lower(["Show", ["CellDiagram", ["Subset", list(1, 3), 5]]]);
  expect(displayListOfBox(made)!.marks).toHaveLength(displayListOfBox(direct)!.marks.length);
  expect(displayListOfBox(made)!.marks.length).toBeGreaterThan(0);
  expect(optionsOfBox(made).ViewKind).toBe("fixed");
});

it("falls back to whole evaluation where the head cannot be kept", async () => {
  // `At(Permutations(4), _k)` is the k-th permutation, not a figure's data until evaluated.
  const source = ["Show", ["StrandDiagram", ["At", ["Permutations", 4], "_k"]]];
  const shown = await evaluatedShow(source, bind(source, new Map<string, unknown>([["k", 3]])));
  const box = lower(shown);
  // Two levels of four strand ends.
  expect(displayListOfBox(box)!.marks).toHaveLength(8);
  expect(optionsOfBox(box).ViewKind).toBe("fixed");
});

it("lowers a polytope frame as seen from its ViewPoint", async () => {
  const show = ["Show", ["PolytopeFaces", ["Permutahedron", 4]]];
  const box = lower(show);
  expect(optionsOfBox(box).ViewKind).toBe("camera");
  // The truncated octahedron: 24 vertices, 36 edges, 14 faces, the body.
  expect(displayListOfBox(box)!.marks).toHaveLength(75);
});

it("lowers a bare layer as the Show of it", async () => {
  await loadLatticeModules({ head: "LatticeTiles", data: "GaussianIntegers" });
  const box = makeBoxes(["LatticeTiles", "EisensteinIntegers"] as never, FIGURE_NOTATION);
  expect(isNode(box) && box[0]).toBe("GraphicsBox");
});
