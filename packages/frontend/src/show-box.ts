// `Show` lowered to a `GraphicsBox` (https://github.com/enumeratio/enumeratio/wiki/Speculative-Box-Primitives, §3):
// the one contract every environment draws, whether a terminal, an SVG or the web element.
//
// A figure frame is a finite layer: its box lists every mark and link. A lattice is unbounded,
// so its box holds a producer, not data: the `Show` it came from (an `InterpretationBox`) and
// `Producer -> head`. An environment asks the producer for the marks in a view (`producerOf`),
// and a static one pins a view first (`pinnedBox`), which gives a finite list like any figure.
//
// Evaluating a `Show`'s bound parameters (`evaluatedShow`) comes before lowering and is the
// caller's: the lowering is a pure function of the expression, as every `makeBoxes` rule is.

import { type Box, type Notation, type NotationRule, optionsOfBox } from "@enumeratio/boxes";
import { cameraSpecOf, throughCamera } from "./camera-frame.ts";
import { loadEngineFor } from "./engine.ts";
import { FIGURE_HEADS, type FigureHead, figureLayerOf, VALUE_FRAMES } from "./figure-frames.ts";
import { argsOf, headOf, type Json } from "./frame-json.ts";
import { displayListOfBox, graphicsBoxOf, graphicsOf } from "./graphics-box.ts";
import { plainJson, ruleNameOf, splitOptions } from "./graphics-rules.ts";
import { latticeLayerOf, type ShowLayer } from "./lattice-layers.ts";
import { clampLatticeView, type LatticeView, maxExtentFor } from "./lattice.ts";
import { declared, type ShowSpec, type ShowTiles, specOf } from "./show-spec.ts";
import { svg, type SvgOptions } from "./svg-draw.ts";
import {
  type Address,
  type DisplayList,
  displayListOf,
  fitBox,
  fitView,
  listBounds,
  type TileDrawOptions,
  type TileLayer,
} from "./tiles-canvas.ts";

/** Points a view may hold before zooming out stops. */
export const MAX_POINTS = 120_000;
/** Fraction of its cell a lattice tile fills. */
export const TILE_FILL = 0.86;

const NO_LAYER =
  "Show needs a layer: LatticeTiles(ring, …), ArrayPlot(table, …), StrandDiagram(diagram, …), CellDiagram(cells, …), TreeDiagram(tree, …), PathDiagram(path, …) or PolytopeFaces(polytope, …).";

/** The layer a `Show` tiles, made: a figure frame's, or a lattice's once its library is loaded. */
function layerOfTiles(tiles: ShowTiles, aspect: ShowSpec["aspect"]): ShowLayer | string {
  if (tiles.head === "LatticeTiles" || tiles.head === "ArrayPlot") return latticeLayerOf(tiles, aspect);
  return figureLayerOf(tiles.head, tiles.layers ? ["List", ...tiles.layers] : tiles.data);
}

const SHOW_OPTIONS = declared("Show");

/** The options of a `Show` as a camera frame reads them. */
const optionsOf = (show: Json): Map<string, Json> => splitOptions(show, SHOW_OPTIONS).options;

const drawOptions = (spec: ShowSpec, selection: readonly Address[], budgetMs: number): TileDrawOptions => ({
  colorRules: spec.colorRules,
  boundaryRules: spec.boundaryRules,
  colorMixing: spec.colorMixing,
  selection,
  fill: TILE_FILL,
  phase: 0,
  budgetMs,
});

/**
 * A `Show` as a `GraphicsBox`; the reason it can't be drawn, as text, otherwise. A figure lists
 * whole (a camera frame as seen from its `ViewPoint`); a lattice is a producer, unpinned.
 */
export function showBox(show: Json, selection: readonly Address[] = []): Box | string {
  const spec = specOf(show);
  if (spec.tiles === undefined) return NO_LAYER;
  const layer = layerOfTiles(spec.tiles, spec.aspect);
  if (typeof layer === "string") return layer;
  const meta = {
    colorRules: spec.written.colors,
    boundaryStyle: spec.written.edges,
    colorMixing: spec.colorMixing,
    selection,
    held: show,
    aspect: spec.aspect,
  } as const;
  if (!layer.place) {
    // Unbounded: nothing to list until a view says which part.
    const empty: DisplayList = { kind: "tiles", basis: layer.basis, tiles: [], complete: false };
    return graphicsBoxOf(empty, { ...meta, viewKind: layer.view, producer: spec.tiles.head });
  }
  let shown: TileLayer = layer;
  let view = fitView(layer, 1);
  if (layer.view === "camera") {
    const camera = cameraSpecOf(optionsOf(show));
    ({ layer: shown, view } = throughCamera(layer, camera, { viewPoint: camera.viewPoint, zoom: 1 }, 1));
  }
  // A finite figure lists whole whatever the view; the fit only places it.
  return graphicsBoxOf(displayListOf(shown, 1, 1, view, drawOptions(spec, selection, Number.POSITIVE_INFINITY)), {
    ...meta,
    viewKind: layer.view,
  });
}

/**
 * The `GraphicsBox` of a figure frame over its data, with the frame's default rules and
 * `selection` picked; the reason it can't be drawn, as text, otherwise.
 */
export function figureGraphicsBox(
  head: Exclude<FigureHead, "PolytopeFaces">,
  data: Json,
  selection: readonly Address[] = [],
): Box | string {
  return showBox(["Show", [head, data]], selection);
}

// ── Rules ────────────────────────────────────────────────────────────────────────────────

/** The `Show` an expression draws as: a `Show`, a layer on its own, or a value's default picture. */
function showOf(json: Json): Json {
  const head = headOf(json);
  if (head === undefined) return undefined;
  if (head === "Show") return json;
  if (head === "LatticeTiles" || head === "ArrayPlot" || (FIGURE_HEADS as readonly string[]).includes(head))
    return ["Show", json];
  if (Object.hasOwn(VALUE_FRAMES, head)) return ["Show", [VALUE_FRAMES[head as keyof typeof VALUE_FRAMES], json]];
  return undefined;
}

const figureRule =
  (head: string): NotationRule =>
  (args) => {
    const show = showOf(plainJson([head, ...args] as Json));
    const box = show === undefined ? undefined : showBox(show);
    return typeof box === "string" ? undefined : box;
  };

/**
 * `Show`, each layer on its own and each value's default picture as `makeBoxes` rules:
 * `Permutation([3, 1, 2])` is `Show(StrandDiagram(…))`, which lowers to a `GraphicsBox`. The
 * terminal, the SVG drawer and the web element all draw this one lowering.
 */
export const FIGURE_NOTATION: Notation = Object.fromEntries(
  ["Show", "LatticeTiles", "ArrayPlot", ...FIGURE_HEADS, ...Object.keys(VALUE_FRAMES)].map((head) => [
    head,
    figureRule(head),
  ]),
);

// ── Evaluation, before lowering ──────────────────────────────────────────────────────────

const wildcarded = (json: Json): boolean => JSON.stringify(json ?? null).includes('"_');

const evaluate = async (json: Json): Promise<Json> => {
  const ce = await loadEngineFor(json);
  return plainJson(ce.box(json as never).evaluate().json);
};

/**
 * `value` (bound from `written`, the same expression with its wildcards), drawn as `draws`
 * reads it. A value the frame draws keeps its head and has its arguments evaluated:
 * `Subset([1, 3], _n)` is a subset, though compute-engine reads it as a predicate and evaluates
 * it to `False`. One the frame can't draw that way is evaluated whole: `At(Permutations(4), _k)`
 * is the k-th permutation. Written whole, it stays as written and needs no engine.
 */
async function evaluated(value: Json, written: Json, draws: (json: Json) => boolean): Promise<Json> {
  if (!wildcarded(written)) return value;
  const valueHead = headOf(value);
  if (valueHead !== undefined && !valueHead.startsWith("_")) {
    const writtenArgs = argsOf(written);
    const args = await Promise.all(argsOf(value).map((arg, k) => (wildcarded(writtenArgs[k]) ? evaluate(arg) : arg)));
    const kept: Json = [valueHead, ...args];
    if (draws(kept)) return kept;
  }
  return evaluate(value);
}

/**
 * `bound` (a `Show` with its parameters filled in), with each figure layer's data evaluated where
 * `source` wrote it over variables. Lattice and table layers, and data written whole, are kept.
 */
export async function evaluatedShow(source: Json, bound: Json): Promise<Json> {
  const layers = argsOf(bound);
  const written = argsOf(source);
  const out = await Promise.all(
    layers.map(async (layer, k) => {
      const head = headOf(layer);
      const was = written[k];
      if (head === undefined || !(FIGURE_HEADS as readonly string[]).includes(head) || ruleNameOf(layer) !== undefined)
        return layer;
      if (head === "PolytopeFaces")
        return evaluated(layer, was, (json) => typeof figureLayerOf("PolytopeFaces", ["List", json]) !== "string");
      // The layer's data is its first argument that is no option it declares.
      const options = declared(head);
      const at = argsOf(layer).findIndex((a) => {
        const name = ruleNameOf(a);
        return name === undefined || !options.has(name);
      });
      if (at < 0) return layer;
      const data = await evaluated(
        argsOf(layer)[at],
        argsOf(was)[at],
        (json) => typeof figureLayerOf(head as FigureHead, json) !== "string",
      );
      return [head, ...argsOf(layer).map((a, i) => (i === at ? data : a))];
    }),
  );
  return [headOf(bound) ?? "Show", ...out];
}

// ── The producer ─────────────────────────────────────────────────────────────────────────

/** What a lattice box holds in place of a list: the layer, asked for the marks in a view. */
export interface Producer {
  readonly layer: ShowLayer;
  readonly spec: ShowSpec;
  /** The `Show` it was lowered from. */
  readonly show: Json;
  /**
   * The marks in `view`, within `options.budgetMs` of classifying, centre outwards; `complete` is
   * false while some are left. `layer` is the one to ask when it has been looked at through a
   * camera first.
   */
  list(view: LatticeView, width: number, height: number, options: TileDrawOptions, layer?: TileLayer): DisplayList;
}

/** The `Show` a `GraphicsBox` was lowered from. */
export const heldShow = (box: Box): Json => graphicsOf(box)?.held;

/** The producer a `GraphicsBox` holds; the reason there is none, as text, otherwise. */
export function producerOf(box: Box): Producer | string {
  const show = heldShow(box);
  if (show === undefined) return "This box holds no Show to ask.";
  const spec = specOf(show);
  if (spec.tiles === undefined) return NO_LAYER;
  const layer = layerOfTiles(spec.tiles, spec.aspect);
  if (typeof layer === "string") return layer;
  return {
    layer,
    spec,
    show,
    list: (view, width, height, options, asked = layer) => displayListOf(asked, width, height, view, options),
  };
}

/** Where a layer starts: a finite one fitted whole to a canvas of `aspect` (w / h), else its own home. */
export function homeView(layer: ShowLayer, aspect: number): LatticeView {
  if (layer.view === "fixed" || layer.place) return fitView(layer, aspect);
  if (!layer.bounds) return layer.home?.() ?? { center: [0, 0], extent: 20 };
  const { i, j } = layer.bounds;
  const [b0, b1] = layer.basis;
  const xs = [i[0], i[1]].flatMap((a) => [j[0], j[1]].map((b) => a * b0[0] + b * b1[0]));
  const ys = [i[0], i[1]].flatMap((a) => [j[0], j[1]].map((b) => a * b0[1] + b * b1[1]));
  const [w, h] = [Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1];
  return {
    center: [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2],
    extent: (Math.max(h, w / aspect) / 2) * 1.02,
  };
}

/**
 * Keep a view on a finite layer: no wider than the whole layer with a margin (nor than the cell
 * budget), its center within the layer's rectangle.
 */
function clampToBounds(
  basis: readonly [readonly [number, number], readonly [number, number]],
  bounds: { readonly i: readonly [number, number]; readonly j: readonly [number, number] },
  view: LatticeView,
  aspect: number,
  maxCells: number,
): LatticeView {
  const corners = [bounds.i[0], bounds.i[1]].flatMap((i) =>
    [bounds.j[0], bounds.j[1]].map((j) => [i * basis[0][0] + j * basis[1][0], i * basis[0][1] + j * basis[1][1]]),
  );
  const [xs, ys] = [corners.map((c) => c[0]!), corners.map((c) => c[1]!)];
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const whole = Math.max((y1 - y0) / 2, (x1 - x0) / (2 * aspect)) * 1.1 + 1;
  const unit = Math.sqrt(Math.abs(basis[0][0] * basis[1][1] - basis[0][1] * basis[1][0]));
  const extent = Math.min(Math.max(view.extent, 1.5 * unit), whole, maxExtentFor(basis, aspect, maxCells));
  const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
  return { center: [clamp(view.center[0], x0, x1), clamp(view.center[1], y0, y1)], extent };
}

/** Keep a view to what a layer can answer and `maxCells` tiles. */
export function clampView(layer: ShowLayer, view: LatticeView, aspect: number, maxCells = MAX_POINTS): LatticeView {
  // Points anywhere: no lattice range to keep to, only a sane zoom.
  if (layer.points || layer.place) return { center: view.center, extent: Math.min(Math.max(view.extent, 0.5), 1e6) };
  if (layer.bounds) return clampToBounds(layer.basis, layer.bounds, view, aspect, maxCells);
  return clampLatticeView({ basis: layer.basis, maxIndex: layer.maxIndex }, view, aspect, maxCells);
}

// ── Static environments ──────────────────────────────────────────────────────────────────

/** A view's size in tiles, for a print or a pipe: enough to read a lattice by, few enough to draw. */
const PIN_CELLS = 400;

export interface PinOptions {
  /** The canvas it will be drawn on, in px (default 480 by 480). */
  readonly width?: number;
  readonly height?: number;
  /** Most tiles the view may hold (default 400). */
  readonly maxCells?: number;
  /** The view to pin; the layer's home otherwise. */
  readonly view?: LatticeView;
}

/**
 * A box with a list in it: a figure's box as it is, a lattice's (which holds a producer) pinned
 * to one view, so every tile of it is listed. The reason it can't be, as text, otherwise.
 * Static environments (print, SVG, a pipe) draw this; the web asks the producer as the reader pans.
 */
export function pinnedBox(box: Box, options: PinOptions = {}): Box | string {
  const g = graphicsOf(box);
  if (!g) return "Not a GraphicsBox.";
  if (optionsOfBox(g.box).Producer === undefined) return box;
  const producer = producerOf(box);
  if (typeof producer === "string") return producer;
  const [width, height] = [options.width ?? 480, options.height ?? 480];
  const aspect = width / height;
  const view = clampView(
    producer.layer,
    options.view ?? homeView(producer.layer, aspect),
    aspect,
    options.maxCells ?? PIN_CELLS,
  );
  const { spec } = producer;
  const selected = optionsOfBox(g.box).Selection;
  const selection = (Array.isArray(selected) ? selected : []) as unknown as Address[];
  const list = producer.list(view, width, height, drawOptions(spec, selection, Number.POSITIVE_INFINITY));
  return graphicsBoxOf(list, {
    colorRules: spec.written.colors,
    boundaryStyle: spec.written.edges,
    colorMixing: spec.colorMixing,
    selection,
    held: producer.show,
    aspect: spec.aspect,
    view,
    viewKind: producer.layer.view,
  });
}

/** A `GraphicsBox` as SVG, a lattice pinned first: the static drawer of the lowering. */
export function svgOfBox(box: Box, width: number, height: number, options: SvgOptions & PinOptions = {}): string {
  const pinned = pinnedBox(box, { width, height, ...options });
  if (typeof pinned === "string") return pinned;
  const list = displayListOfBox(pinned);
  if (!list) return "";
  const o = optionsOfBox(graphicsOf(pinned)!.box);
  const view: LatticeView = Array.isArray(o.View)
    ? { center: [Number(o.View[0]), Number(o.View[1])], extent: Number(o.View[2]) }
    : fitBox(listBounds(list), width / height);
  return svg(list, width, height, view, options);
}
