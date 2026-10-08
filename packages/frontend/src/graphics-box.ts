// A figure's display list as a `GraphicsBox` (https://github.com/enumeratio/enumeratio/wiki/Speculative-Box-Primitives):
// plain boxes any environment draws with no layer code. Each mark is `TagBox`ed with its address
// ("1,0"), each link with its members ("1,0;2,1"); the marks' places ride on the
// `GraphicsComplexBox`, and a mark's resolved look on a `StyleBox` as `FaceForm` and `EdgeForm`.

import {
  type Box,
  disk,
  graphics,
  graphicsComplex,
  inset,
  line,
  type Options,
  type OptionValue,
  polygon,
  polyhedron,
  row,
  style,
  tag,
} from "@enumeratio/boxes";
import { type FigureHead, FIGURE_DEFAULTS, figureLayerOf } from "./figure-frames.ts";
import type { Json } from "./frame-json.ts";
import { boundaryRuleOf, type ColorMixing, colorRuleOf, type Edge, plainJson, rulesOf } from "./graphics-rules.ts";
import {
  type Address,
  type DisplayList,
  displayListOf,
  fitView,
  type FramePoint,
  type GraphicsPrimitive,
  type TileDrawOptions,
} from "./tiles-canvas.ts";

const point = (p: FramePoint): OptionValue => [...p];

/** MathJSON as an option value: heads become strings, anything that has no option form is `null`. */
function optionOf(json: Json): OptionValue {
  if (json === null || typeof json === "string" || typeof json === "number" || typeof json === "boolean") return json;
  return Array.isArray(json) ? json.map(optionOf) : null;
}

/** A primitive's box: its geometry as options, in the frame's coordinates. */
function primitiveBox(p: GraphicsPrimitive): Box {
  switch (p.head) {
    case "Disk":
      return disk({ Radius: p.radius, ...(p.center && { Center: point(p.center) }) });
    case "Line":
      return line({ Points: p.points.map(point), ...(p.breaks && { Breaks: [...p.breaks] }) });
    case "Polygon":
      return polygon({ Points: p.points.map(point) });
    case "Polyhedron":
      return polyhedron({ Faces: p.faces.map((ring) => ring.map(point)) });
    default:
      return inset(p.text, { Size: p.size, ...(p.at && { Center: point(p.at) }) });
  }
}

const edgeForm = (edges: readonly Edge[]): OptionValue[] =>
  edges.map((e) => [e.color, e.width, e.opacity, [...e.dashing]]);

const addressText = ([i, j]: Address): string => `${i},${j}`;

export interface GraphicsMeta {
  /** The rules as written, MathJSON; carried as data for a drawer that restyles. */
  readonly colorRules?: Json;
  readonly boundaryStyle?: Json;
  readonly colorMixing: ColorMixing;
  readonly selection: readonly Address[];
}

/**
 * A figure's display list as a `GraphicsBox`; undefined for a lattice's tiles, which have no
 * finite list to hold. `Complete` is false while marks are left to classify.
 */
export function graphicsBoxOf(list: DisplayList, meta: GraphicsMeta): Box | undefined {
  if (list.kind !== "marks") return undefined;
  const items: Box[] = [];
  for (const { address, mark, style: look, caption } of list.marks) {
    const options: Record<string, OptionValue> = {};
    if (look.color) options.FaceForm = look.color;
    if (look.edges.length > 0) options.EdgeForm = edgeForm(look.edges);
    items.push(style(tag(primitiveBox(mark), addressText(address)), options));
    if (caption)
      items.push(
        tag(
          inset(caption.text, {
            Center: point(caption.at),
            Size: caption.size,
            Opacity: caption.opacity,
            Role: "Caption",
          }),
          addressText(address),
        ),
      );
  }
  for (const { members, mark, edges } of list.links)
    items.push(style(tag(primitiveBox(mark), members.map(addressText).join(";")), { EdgeForm: edgeForm(edges) }));
  const complex = graphicsComplex(row(items), {
    Addresses: list.marks.map((m) => [...m.address]),
    Places: list.marks.map((m) => [...m.at]),
  });
  const options: Options = {
    ...(meta.colorRules !== undefined && { ColorRules: optionOf(plainJson(meta.colorRules)) }),
    ColorMixing: meta.colorMixing,
    ...(meta.boundaryStyle !== undefined && { BoundaryStyle: optionOf(plainJson(meta.boundaryStyle)) }),
    Selection: meta.selection.map((a) => [...a]),
    ViewKind: list.view ?? "plane",
    Complete: list.complete,
  };
  return graphics(complex, options);
}

/** A figure frame's head. A polytope looks through a camera first, so it is not one of these. */
const FLAT_FRAMES = ["StrandDiagram", "CellDiagram", "TreeDiagram", "PathDiagram"] as const;
export const isFlatFrame = (head: string): head is Exclude<FigureHead, "PolytopeFaces"> =>
  (FLAT_FRAMES as readonly string[]).includes(head);

/**
 * The `GraphicsBox` of a figure frame over its data, with the frame's default rules and
 * `selection` picked; the reason it can't be drawn, as text, otherwise. The `Show` of a value
 * lowers to this.
 */
export function figureGraphicsBox(
  head: Exclude<FigureHead, "PolytopeFaces">,
  data: Json,
  selection: readonly Address[] = [],
): Box | string {
  const layer = figureLayerOf(head, data);
  if (typeof layer === "string") return layer;
  const defaults = FIGURE_DEFAULTS[head];
  const options: TileDrawOptions = {
    colorRules: rulesOf(defaults.colors, colorRuleOf).rules,
    boundaryRules: rulesOf(defaults.edges, boundaryRuleOf).rules,
    colorMixing: "First",
    selection,
    fill: 1,
    phase: 0,
    budgetMs: Number.POSITIVE_INFINITY,
  };
  // A finite figure lists whole whatever the view; the fit only places it.
  const list = displayListOf(layer, 1, 1, fitView(layer, 1), options);
  return (
    graphicsBoxOf(list, {
      colorRules: defaults.colors,
      boundaryStyle: defaults.edges,
      colorMixing: "First",
      selection,
    }) ?? "not a finite figure"
  );
}
