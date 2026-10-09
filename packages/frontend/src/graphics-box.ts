// A figure's display list as a `GraphicsBox` (https://github.com/enumeratio/enumeratio/wiki/Speculative-Box-Primitives):
// plain boxes any environment draws with no layer code. Each mark is `TagBox`ed with its address
// ("1,0"), each link with its members ("1,0;2,1"); the marks' places ride on the
// `GraphicsComplexBox`, and a mark's resolved look on a `StyleBox` as `FaceForm` and `EdgeForm`.
// The box holds the `Show` it came from (an `InterpretationBox`), so an environment that can ask
// the layer for more (a pan, a new view) does; one that can't draws the list.

import {
  type Box,
  type BoxNode,
  disk,
  graphics,
  graphicsComplex,
  inset,
  interpretation,
  isNode,
  line,
  optionsOfBox,
  type Options,
  type OptionValue,
  polygon,
  polyhedron,
  row,
  style,
  tag,
} from "@enumeratio/boxes";
import type { Json } from "./frame-json.ts";
import { type ColorMixing, type Edge, type ElementStyle, plainJson } from "./graphics-rules.ts";
import { type LatticeView, voronoiCell } from "./lattice.ts";
import {
  type Address,
  type DisplayList,
  type FramePoint,
  type GraphicsPrimitive,
  type LinkItem,
  type MarkItem,
  type ViewKind,
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
  /** The `Show` this lowers from, held so an environment can ask its layer for more. */
  readonly held?: Json;
  /** Where a pinned lattice looks, so a static drawer frames it as it was listed. */
  readonly view?: LatticeView;
  /** The scale of a lattice's frame, as `AspectRatio` reads it. */
  readonly aspect?: "Uniform" | "True";
  /** Fraction of its cell a lattice tile fills. */
  readonly fill?: number;
  /** How the frame is looked at, when the list does not say. */
  readonly viewKind?: ViewKind;
  /** The layer head whose producer the box holds in place of a list: a lattice not yet pinned. */
  readonly producer?: string;
}

const lookOf = (color: string | undefined, edges: readonly Edge[]): Record<string, OptionValue> => ({
  ...(color && { FaceForm: color }),
  ...(edges.length > 0 && { EdgeForm: edgeForm(edges) }),
});

/** A lattice's tiles in one view, each the polygon it fills around its place. */
function tilesContent(list: Extract<DisplayList, { kind: "tiles" }>, fill: number): Box {
  const cell = voronoiCell(list.basis).map(([x, y]) => [x * fill, y * fill] as const);
  const items = list.tiles.map(({ address, at, style: look }) =>
    style(
      tag(polygon({ Points: cell.map(([x, y]) => point([at[0] + x, at[1] + y])) }), addressText(address)),
      lookOf(look.color, look.edges),
    ),
  );
  return graphicsComplex(row(items), {
    Addresses: list.tiles.map((t) => [...t.address]),
    Places: list.tiles.map((t) => [...t.at]),
  });
}

function marksContent(list: Extract<DisplayList, { kind: "marks" }>): Box {
  const items: Box[] = [];
  for (const { address, mark, style: look, caption } of list.marks) {
    items.push(style(tag(primitiveBox(mark), addressText(address)), lookOf(look.color, look.edges)));
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
  return graphicsComplex(row(items), {
    Addresses: list.marks.map((m) => [...m.address]),
    Places: list.marks.map((m) => [...m.at]),
  });
}

/**
 * A display list as a `GraphicsBox`. A figure's marks and links are listed whole; a lattice's
 * list is the tiles of one pinned view (`meta.view`), as polygons. `Complete` is false while
 * marks are left to classify.
 */
export function graphicsBoxOf(list: DisplayList, meta: GraphicsMeta): Box {
  const content = list.kind === "marks" ? marksContent(list) : tilesContent(list, meta.fill ?? 0.86);
  const options: Options = {
    ...(meta.colorRules !== undefined && { ColorRules: optionOf(plainJson(meta.colorRules)) }),
    ColorMixing: meta.colorMixing,
    ...(meta.boundaryStyle !== undefined && { BoundaryStyle: optionOf(plainJson(meta.boundaryStyle)) }),
    Selection: meta.selection.map((a) => [...a]),
    ViewKind: meta.viewKind ?? (list.kind === "marks" ? list.view : undefined) ?? "plane",
    ...(meta.producer !== undefined && { Producer: meta.producer }),
    ...(meta.view && { View: [...meta.view.center, meta.view.extent] }),
    ...(meta.aspect && { AspectRatio: meta.aspect }),
    Complete: list.complete,
  };
  return graphics(meta.held === undefined ? content : interpretation(content, meta.held as never), options);
}

// ── Reading a box back ───────────────────────────────────────────────────────────────────

const numbersOf = (value: unknown): number[] | undefined =>
  Array.isArray(value) && value.every((v) => typeof v === "number") ? (value as number[]) : undefined;
const pointsOf = (value: unknown): number[][] =>
  Array.isArray(value)
    ? value.flatMap((p) => {
        const n = numbersOf(p);
        return n ? [n] : [];
      })
    : [];

function edgesOf(value: unknown): Edge[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((e) =>
    Array.isArray(e) && typeof e[0] === "string"
      ? [{ color: e[0], width: Number(e[1]), opacity: Number(e[2]), dashing: numbersOf(e[3]) ?? [] }]
      : [],
  );
}

/** The graphics primitive a mark box draws; undefined for any other box. */
function primitiveOf(box: Box): GraphicsPrimitive | undefined {
  if (!isNode(box)) return undefined;
  const o = optionsOfBox(box);
  switch (box[0]) {
    case "DiskBox": {
      const center = numbersOf(o.Center);
      return { head: "Disk", radius: Number(o.Radius), ...(center && { center }) };
    }
    case "LineBox": {
      const breaks = numbersOf(o.Breaks);
      return { head: "Line", points: pointsOf(o.Points), ...(breaks && { breaks }) };
    }
    case "PolygonBox":
      return { head: "Polygon", points: pointsOf(o.Points) };
    case "PolyhedronBox":
      return { head: "Polyhedron", faces: Array.isArray(o.Faces) ? o.Faces.map(pointsOf) : [] };
    case "InsetBox": {
      const at = numbersOf(o.Center);
      return typeof box[1] === "string"
        ? { head: "Text", text: box[1], size: Number(o.Size), ...(at && { at }) }
        : undefined;
    }
    default:
      return undefined;
  }
}

const addressOf = (name: string): Address => {
  const [i, j] = name.split(",").map(Number);
  return [i ?? 0, j ?? 0];
};

/** The `GraphicsBox` inside any wrapping `InterpretationBox`, and the `Show` it is held with. */
export function graphicsOf(box: Box): { box: BoxNode; held?: Json } | undefined {
  if (!isNode(box) || box[0] !== "GraphicsBox") return undefined;
  const content = box[1] as Box;
  return isNode(content) && content[0] === "InterpretationBox" ? { box, held: content[2] as Json } : { box };
}

/** The complex a `GraphicsBox` lists its marks in, whatever wraps it. */
export function complexOf(box: Box): Extract<BoxNode, readonly ["GraphicsComplexBox", ...unknown[]]> | undefined {
  const content = graphicsOf(box)?.box[1] as Box | undefined;
  const inner = isNode(content) && content[0] === "InterpretationBox" ? (content[1] as Box) : content;
  return isNode(inner) && inner[0] === "GraphicsComplexBox" ? inner : undefined;
}

/**
 * The finite `DisplayList` a `GraphicsBox` holds: the inverse of `graphicsBoxOf`, so a drawer
 * that reads the box draws what the canvas does. Undefined for a box with no list (a lattice
 * not yet pinned).
 */
export function displayListOfBox(box: Box): Extract<DisplayList, { kind: "marks" }> | undefined {
  const complex = complexOf(box);
  const graphicsBox = graphicsOf(box)?.box;
  if (!complex || !graphicsBox) return undefined;
  const o = optionsOfBox(graphicsBox);
  const { Places, Addresses } = optionsOfBox(complex);
  const places = new Map<string, number[]>();
  if (Array.isArray(Addresses) && Array.isArray(Places))
    Addresses.forEach((a, k) => {
      const place = numbersOf(Places[k]);
      if (Array.isArray(a) && place) places.set(a.join(","), place);
    });
  const selected = new Set(
    Array.isArray(o.Selection) ? o.Selection.map((a) => (Array.isArray(a) ? a.join(",") : "")) : [],
  );
  const content = complex[1] as Box;
  const items = isNode(content) && content[0] === "RowBox" ? (content[1] as readonly Box[]) : [content];
  const marks: MarkItem[] = [];
  const links: LinkItem[] = [];
  const captions = new Map<string, NonNullable<MarkItem["caption"]>>();
  for (const item of items) {
    let look: Options = {};
    let tagged = item;
    if (isNode(tagged) && tagged[0] === "StyleBox") [tagged, look] = [tagged[1] as Box, tagged[2] as Options];
    if (!isNode(tagged) || tagged[0] !== "TagBox") continue;
    const name = tagged[2] as string;
    const prim = tagged[1] as Box;
    if (isNode(prim) && prim[0] === "InsetBox" && optionsOfBox(prim).Role === "Caption") {
      const p = optionsOfBox(prim);
      captions.set(name, {
        at: (numbersOf(p.Center) ?? [0, 0]) as [number, number],
        text: typeof prim[1] === "string" ? prim[1] : "",
        size: Number(p.Size),
        opacity: Number(p.Opacity),
      });
      continue;
    }
    const mark = primitiveOf(prim);
    if (!mark) continue;
    const edges = edgesOf(look.EdgeForm);
    if (name.includes(";")) {
      links.push({ members: name.split(";").map(addressOf), mark, edges });
      continue;
    }
    const at = places.get(name) ?? [0, 0];
    const color = typeof look.FaceForm === "string" ? look.FaceForm : undefined;
    const elementStyle: ElementStyle = { ...(color && { color }), edges };
    marks.push({
      address: addressOf(name),
      at: [at[0] ?? 0, at[1] ?? 0],
      mark,
      style: elementStyle,
      selected: selected.has(name),
    });
  }
  return {
    kind: "marks",
    view: (typeof o.ViewKind === "string" ? o.ViewKind : undefined) as ViewKind | undefined,
    marks: marks.map((m) => {
      const caption = captions.get(addressText(m.address));
      return caption ? { ...m, caption } : m;
    }),
    links,
    complete: o.Complete !== false,
  };
}
