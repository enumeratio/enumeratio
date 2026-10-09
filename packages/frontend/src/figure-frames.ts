// A combinatorial value draws as the `Show` of its frame layer, with the frame's default rules.
// Each value head reads its layer in its frame's model (strand-frame.ts, cell-frame.ts,
// tree-frame.ts, path-frame.ts); the glyph kinds of glyphs.ts lower to the same `Show`s.
//
// A polytope is no glyph: `PolytopeFaces` (polytope-frame.ts) is a `Show` layer of its own.

import { cellLayer, cellModelOf } from "./cell-frame.ts";
import type { FigureLayer, Json } from "./frame-json.ts";
import { pathLayer, pathModelOf } from "./path-frame.ts";
import { polytopeLayer, polytopeModelOf } from "./polytope-frame.ts";
import {
  lowerStrandFigure,
  STRAND_DEFAULT_BOUNDARY_STYLE,
  STRAND_DEFAULT_COLOR_RULES,
  strandLayer,
  strandModelOf,
} from "./strand-frame.ts";
import { frameBounds } from "./tiles-canvas.ts";
import { treeLayer, treeModelOf } from "./tree-frame.ts";

/** The layer heads `Show` reads that are figure frames. */
export const FIGURE_HEADS = ["StrandDiagram", "CellDiagram", "TreeDiagram", "PathDiagram", "PolytopeFaces"] as const;
export type FigureHead = (typeof FIGURE_HEADS)[number];

/** The frame each combinatorial value draws in: `Show(frame(value))` is its default picture. */
export const VALUE_FRAMES = {
  Permutation: "StrandDiagram",
  SetPartition: "StrandDiagram",
  Diagram: "StrandDiagram",
  BraidClosure: "StrandDiagram",
  IntegerPartition: "CellDiagram",
  StandardTableau: "CellDiagram",
  Composition: "CellDiagram",
  Subset: "CellDiagram",
  PlaneTree: "TreeDiagram",
  BinaryTree: "TreeDiagram",
  DyckPath: "PathDiagram",
  LatticePath: "PathDiagram",
} as const satisfies Readonly<Record<string, FigureHead>>;

/** The `ImageSize` height, in px, of a value's default picture, by its frame. */
export const FRAME_HEIGHT: Readonly<Record<Exclude<FigureHead, "PolytopeFaces">, number>> = {
  StrandDiagram: 140,
  CellDiagram: 160,
  TreeDiagram: 200,
  PathDiagram: 160,
};

/**
 * The layer a frame head and its data make, or why it can't. `PolytopeFaces` takes the list of
 * its layers' expressions, `["List", PolytopeFaces(…), …]`: those of a `Show` share one frame.
 */
export function figureLayerOf(head: FigureHead, data: Json): FigureLayer | string {
  if (head === "PolytopeFaces") {
    const model = polytopeModelOf(Array.isArray(data) && data[0] === "List" ? data.slice(1) : [data]);
    return typeof model === "string" ? model : polytopeLayer(model);
  }
  const model =
    head === "StrandDiagram"
      ? strandModelOf(data)
      : head === "CellDiagram"
        ? cellModelOf(data)
        : head === "TreeDiagram"
          ? treeModelOf(data)
          : pathModelOf(data);
  if (typeof model === "string") return model;
  // The model types differ by head; each constructor reads only its own.
  if (head === "StrandDiagram") return strandLayer(model as Parameters<typeof strandLayer>[0]);
  if (head === "CellDiagram") return cellLayer(model as Parameters<typeof cellLayer>[0]);
  if (head === "TreeDiagram") return treeLayer(model as Parameters<typeof treeLayer>[0]);
  return pathLayer(model as Parameters<typeof pathLayer>[0]);
}

const ACCENT = "#d97706";
const edge = (color: string, width: number, ...more: Json[]): Json => [
  "Directive",
  color,
  ["AbsoluteThickness", width],
  ...more,
];
const rule = (test: Json, style: Json): Json => ["Rule", test, style];

/** The ink of a polytope's lines and points, light enough for the dark ground. */
const POLYTOPE_INK = "#c4c4d0";

const picked = (test: Json): Json => ["And", "Selected", test];

/**
 * What a `PolytopeFaces` draws when the author gives no rules: lines and points in ink, 2-faces
 * washed, a pick in the accent (a solid's boundary only when picked).
 */
const POLYTOPE_DEFAULTS = {
  colors: [
    "List",
    rule(picked("Dimension2"), ["Opacity", 0.35, ACCENT]),
    rule(picked("Interior"), ["Opacity", 0.12, ACCENT]),
    rule(picked(["Not", "Interior"]), ACCENT),
    rule("Dimension2", ["Opacity", 0.1, POLYTOPE_INK]),
    rule(["Not", "Interior"], POLYTOPE_INK),
  ] as Json,
  edges: ["List", rule(picked(["Not", "Interior"]), edge(ACCENT, 2))] as Json,
};

/** What a frame draws when the author gives no rules: the look of the glyph it stands in for. */
export const FIGURE_DEFAULTS: Readonly<Record<FigureHead, { readonly colors: Json; readonly edges: Json }>> = {
  PolytopeFaces: POLYTOPE_DEFAULTS,
  StrandDiagram: { colors: STRAND_DEFAULT_COLOR_RULES, edges: STRAND_DEFAULT_BOUNDARY_STYLE },
  CellDiagram: {
    colors: [
      "List",
      ["Rule", "Selected", ACCENT],
      ["Rule", ["Hook", "Selected"], ["Opacity", 0.55, ACCENT]],
      ["Rule", "Filled", ["Opacity", 0.16, ACCENT]],
    ],
    edges: [
      "List",
      ["Rule", "Selected", edge("White", 3)],
      ["Rule", ["Hook", "Selected"], edge(ACCENT, 2)],
      ["Rule", "Filled", edge(ACCENT, 1)],
      ["Rule", "True", edge("Gray", 1, ["Opacity", 0.5])],
    ],
  },
  TreeDiagram: {
    colors: [
      "List",
      ["Rule", "Selected", ACCENT],
      ["Rule", ["Descendant", "Selected"], ["Opacity", 0.55, ACCENT]],
      ["Rule", "True", ["Opacity", 0.16, ACCENT]],
    ],
    edges: [
      "List",
      ["Rule", "Selected", edge("White", 3)],
      ["Rule", ["Descendant", "Selected"], edge(ACCENT, 2.5)],
      ["Rule", "True", edge(ACCENT, 1.5)],
    ],
  },
  PathDiagram: {
    colors: [
      "List",
      ["Rule", "Selected", "White"],
      ["Rule", ["SameHeight", "Selected"], "Gold"],
      ["Rule", "True", ACCENT],
    ],
    edges: ["List", ["Rule", "Selected", edge("White", 3)], ["Rule", "True", edge(ACCENT, 2)]],
  },
};

/** Pixels per frame unit in a lowered figure, by kind (a glyph's old unit). */
const UNITS: Readonly<Record<string, number>> = {
  partition: 18,
  tableau: 20,
  composition: 18,
  subset: 22,
  dyck: 16,
  lattice: 20,
  tree: 20,
  "binary-tree": 20,
};

/** What `fitView` leaves around a figure, in frame units, on each side. */
const MARGIN = 0.6;

const list = (xs: readonly Json[]): Json => ["List", ...xs];

/** The layer a glyph kind lowers to, as MathJSON, with any `Show` options it needs. */
function expressionOf(
  kind: string,
  value: readonly number[],
  n: number | undefined,
): { head: FigureHead; layer: Json; options?: string } | undefined {
  switch (kind) {
    case "partition":
      return { head: VALUE_FRAMES.IntegerPartition, layer: ["IntegerPartition", list(value)] };
    case "tableau": {
      // The superstandard filling: 1 … n in reading order.
      let next = 1;
      const rows = value.map((p) => list(Array.from({ length: p }, () => next++)));
      return { head: VALUE_FRAMES.StandardTableau, layer: ["StandardTableau", list(rows)] };
    }
    case "composition":
      return { head: VALUE_FRAMES.Composition, layer: ["Composition", list(value)] };
    case "subset":
      return { head: VALUE_FRAMES.Subset, layer: ["Subset", list(value), n ?? Math.max(1, ...value)] };
    case "tree":
      return { head: VALUE_FRAMES.PlaneTree, layer: ["PlaneTree", list(value)] };
    case "binary-tree":
      return { head: VALUE_FRAMES.PlaneTree, layer: ["PlaneTree", list(value.map((b) => (b ? 2 : 0)))] };
    case "dyck":
      return { head: VALUE_FRAMES.DyckPath, layer: ["DyckPath", list(value)] };
    case "lattice":
      return {
        head: VALUE_FRAMES.LatticePath,
        layer: ["LatticePath", list(value)],
        options: "GridLines -> [1, 1], GridLinesStyle -> Directive(Gray, AbsoluteThickness(1), Opacity(0.35))",
      };
  }
  return undefined;
}

/** MathJSON as the text `Show` is written in: `Head(args)`, `[items]`. */
function print(json: Json): string {
  if (!Array.isArray(json)) return String(json);
  const [head, ...args] = json as [string, ...Json[]];
  return head === "List" ? `[${args.map(print).join(", ")}]` : `${head}(${args.map(print).join(", ")})`;
}

/** A glyph kind's picture as the `Show` of its value, and the box that fits it. Undefined where the SVG draws it. */
export function lowerFigure(
  kind: string,
  value: readonly number[],
  options: { readonly n?: number } = {},
): { readonly show: string; readonly width: number; readonly height: number } | undefined {
  if (!value.every(Number.isInteger)) return undefined;
  const strand = lowerStrandFigure(kind, value);
  if (strand) return strand;
  const lowered = expressionOf(kind, value, options.n);
  const unit = UNITS[kind];
  if (!lowered || unit === undefined) return undefined;
  const layer = figureLayerOf(lowered.head, lowered.layer);
  if (typeof layer === "string") return undefined;
  const box = frameBounds(layer);
  if (!box) return undefined;
  const [width, height] = [(box[1] - box[0] + 2 * MARGIN) * unit, (box[3] - box[2] + 2 * MARGIN) * unit];
  const extra = lowered.options ? `, ${lowered.options}` : "";
  return {
    show: `Show(${lowered.head}(${print(lowered.layer)})${extra}, ImageSize -> [Automatic, ${Math.round(height)}], GestureHandling -> "none")`,
    width: Math.round(width),
    height: Math.round(height),
  };
}
