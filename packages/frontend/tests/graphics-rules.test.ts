import { describe, expect, it } from "vite-plus/test";
import {
  boundaryRuleOf,
  colorOf,
  colorRuleOf,
  edgeOf,
  type ElementFacts,
  mixColors,
  paintOf,
  propertiesOf,
  splitOptions,
  styleElement,
  testOf,
  valueOf,
} from "../src/graphics-rules.ts";

const facts = (props: string[], selected = false, relations: string[] = []): ElementFacts => ({
  has: (p) => props.includes(p),
  related: (r) => relations.includes(r),
  selected,
});

describe("tests", () => {
  it("weigh properties, the selection, relations to it, and And/Or/Not", () => {
    const t = testOf(["And", "IsIrreducible", ["Not", "IsPrime"]])!;
    expect(t(facts(["IsIrreducible"]))).toBe(1);
    expect(t(facts(["IsIrreducible", "IsPrime"]))).toBe(0);
    expect(testOf("Selected")!(facts([], true))).toBe(1);
    expect(testOf(["Associates", "Selected"])!(facts([], false, ["Associates"]))).toBe(1);
    expect(testOf(["Or", "IsUnit", "IsZero"])!(facts(["IsZero"]))).toBe(1);
    expect(testOf(["Plus", 1, 2])).toBeUndefined();
  });

  it("say which properties they read", () => {
    expect([...propertiesOf(["And", "IsIrreducible", ["Not", "IsPrime"]])].toSorted()).toEqual([
      "IsIrreducible",
      "IsPrime",
    ]);
  });
});

describe("options", () => {
  it("are the rules a head declares; any other rule is an argument", () => {
    const { positional, options } = splitOptions(
      ["LatticeTiles", "R", ["KeyValuePair", "IsPrime", "Teal"], ["KeyValuePair", "ColorMixing", "'Screen'"]],
      new Set(["ColorMixing"]),
    );
    expect(positional).toEqual(["R", ["KeyValuePair", "IsPrime", "Teal"]]);
    expect(options.get("ColorMixing")).toBe("'Screen'");
  });
});

describe("colors and edges", () => {
  it("read colors by name, hex, RGBColor and GrayLevel", () => {
    expect(colorOf("Teal")).toBe("#3ddbd9");
    expect(colorOf("'#FF8800'")).toBe("#ff8800");
    expect(colorOf(["RGBColor", 1, 0, 0])).toBe("#ff0000");
    expect(colorOf(["GrayLevel", 1])).toBe("#ffffff");
    expect(colorOf("Mauve")).toBeUndefined();
  });

  it("read Opacity around a color or a scheme, and a scheme's band and padding", () => {
    expect(paintOf(["Opacity", 0.5, "Teal"])).toEqual({ paint: "#3ddbd9", opacity: 0.5 });
    const s = paintOf([
      "ColorData",
      "'dusk'",
      "Norm",
      ["KeyValuePair", "Band", 20],
      ["KeyValuePair", "Padding", "'Periodic'"],
    ])!;
    expect(typeof s.paint === "object" && [s.paint.band, s.paint.mode]).toEqual([20, "wrap"]);
  });

  it("read an edge from a color or a Directive", () => {
    expect(edgeOf("Gold")).toEqual({ color: "#ffd166", width: 1.5, opacity: 1, dashing: [] });
    expect(edgeOf(["Directive", "White", ["AbsoluteThickness", 2.5], "Dashed"])).toEqual({
      color: "#ffffff",
      width: 2.5,
      opacity: 1,
      dashing: [6, 4],
    });
    expect(edgeOf(["EdgeForm", ["Directive", "Gold", "Thick"]])?.width).toBe(2.5);
    expect(edgeOf(["Directive", ["AbsoluteThickness", 2]])).toBeUndefined();
  });

  it("read rules, and leave a style they can't read unread", () => {
    expect(colorRuleOf(["KeyValuePair", "IsPrime", "Teal"])?.paint).toBe("#3ddbd9");
    expect(boundaryRuleOf(["KeyValuePair", "Selected", ["Directive", "White", "Thick"]])?.width).toBe(2.5);
    expect(colorRuleOf(["KeyValuePair", "IsPrime", ["Paint", "Gold"]])).toBeUndefined();
  });
});

describe("mixing", () => {
  const a: [string, number] = ["#3ddbd9", 0.8];
  const b: [string, number] = ["#ff5a5f", 0.5];

  it("takes the first match by default, as Wolfram's ColorRules do", () => {
    expect(mixColors([a, b], "First")).toBe("rgba(61, 219, 217, 0.8)");
  });

  it("is commutative when screened, added or multiplied, with nothing the identity", () => {
    for (const m of ["Screen", "Add", "Multiply"] as const) expect(mixColors([a, b], m)).toBe(mixColors([b, a], m));
    expect(mixColors([], "Screen")).toBeUndefined();
    expect(mixColors([["#000000", 1], a], "Screen")).toBe(mixColors([a], "Screen"));
  });

  it("paints in order when Normal", () => {
    expect(
      mixColors(
        [
          ["#ff0000", 1],
          ["#0000ff", 1],
        ],
        "Normal",
      ),
    ).toBe("#0000ff");
    expect(mixColors([a, b], "Normal")).not.toBe(mixColors([b, a], "Normal"));
  });

  it("styles an element from its rules: colors mixed, edges in order", () => {
    const colors = [
      colorRuleOf(["Rule", "IsPrime", "Teal"])!,
      colorRuleOf(["Rule", "Selected", ["Opacity", 0.3, "White"]])!,
    ];
    const edges = [boundaryRuleOf(["Rule", "Inert", "Gold"])!];
    const el = facts(["IsPrime", "Inert"], true);
    const forward = styleElement(colors, edges, "Screen", el, () => 0);
    expect(forward.color).toBe(styleElement(colors.toReversed(), edges, "Screen", el, () => 0).color);
    expect(forward.edges.map((e) => e.color)).toEqual(["#ffd166"]);
    expect(styleElement(colors, edges, "First", el, () => 0).color).toBe("#3ddbd9");
    expect(styleElement(colors, edges, "Screen", facts([]), () => 0).color).toBeUndefined();
  });
});

describe("values", () => {
  it("evaluate over a layer's per-element values", () => {
    const v = valueOf(["Sqrt", ["Abs", "Norm"]])!;
    expect(v((name) => (name === "Norm" ? -16 : undefined))).toBe(4);
    expect(valueOf(["Add", "X", ["Multiply", 2, "Y"]])!((n) => ({ X: 1, Y: 3 })[n])).toBe(7);
    expect(v(() => undefined)).toBeUndefined();
    expect(valueOf(["Zeta", "Norm"])).toBeUndefined();
  });
});
