// Drawing a tile layer onto a canvas: each element styled by its rules (`graphics-rules.ts`),
// faces batched by the color they mix to, edges stroked inside one another in rule order, and
// new elements computed only within a frame's budget, centre outwards. A layer that places its own
// marks (`place`) is drawn as a finite figure instead: marks at its addresses, then its links.

import {
  type BoundaryRule,
  type ColorMixing,
  type ColorRule,
  type ElementFacts,
  styleElement,
  valueOf,
} from "./graphics-rules.ts";
import { latticeCoordinates, latticePoint, type LatticeView, type Vec2, visibleRange, voronoiCell } from "./lattice.ts";

/** An address in a frame: a pair of integers, `(i, j)` for a lattice, `(slot, level)` for strands. */
export type Address = readonly [i: number, j: number];

/** A point of a frame's space, of any dimension; a 2-D frame reads the first two. */
export type FramePoint = readonly number[];

/**
 * What a mark draws, in Wolfram's graphics heads, in the frame's coordinates. A `Disk` sits at its
 * address's `place` unless it names a `center`; a `Text` likewise at `at`.
 */
export type GraphicsPrimitive =
  | { readonly head: "Disk"; readonly radius: number; readonly center?: FramePoint }
  | { readonly head: "Line"; readonly points: readonly FramePoint[] }
  | { readonly head: "Polygon"; readonly points: readonly FramePoint[] }
  /** A solid shown as its boundary: the rings of its faces. */
  | { readonly head: "Polyhedron"; readonly faces: readonly (readonly FramePoint[])[] }
  | { readonly head: "Text"; readonly text: string; readonly size: number; readonly at?: FramePoint };

/**
 * How a frame is looked at: `plane` pans and zooms over a lattice; `fixed` is fitted to its layer
 * whole, with no pan or zoom beyond the fit; `camera` looks at a 3-D layer through `Show`'s
 * `ViewPoint` and its kin (`camera-frame.ts`), orbited by drag and zoomed by wheel or pinch.
 */
export type ViewKind = "plane" | "fixed" | "camera";

/** Text over a mark: `size` in frame units, `opacity` of the ink, `at` where it sits if not at the mark's place. */
export interface FigureLabel {
  readonly text: string;
  readonly size: number;
  readonly opacity?: number;
  readonly at?: FramePoint;
}

/** What a tile layer answers about its elements, for rules. */
export interface TileLayer {
  readonly basis: readonly [Vec2, Vec2];
  readonly maxIndex: number;
  /** The frame's view; `plane` when absent. */
  readonly view?: ViewKind;
  /**
   * Where address (i, j) sits in the frame's space. Absent: the lattice's own `latticePoint`, and
   * the layer's tiles are the basis's cells. Present, the layer is a figure over its `bounds`:
   * marks at the places of the addresses in them, then its links.
   */
  place?(i: number, j: number): FramePoint;
  /** What address (i, j) draws, at its place; a small disk when absent. */
  mark?(i: number, j: number): GraphicsPrimitive;
  /**
   * The addresses a figure has when they are not the whole rectangle of `bounds` (a ragged
   * diagram, the nodes of a tree). Absent: every address in `bounds`.
   */
  addresses?(): readonly Address[];
  /**
   * A camera frame's default map from the places' space to 3-D, as a 3 × d matrix: what
   * `ProjectionMatrix -> Automatic` means at address (i, j). Absent: the places' first three coordinates.
   */
  projection?(i: number, j: number): readonly (readonly number[])[];
  /** A caption for address (i, j), drawn in the frame's ink over its mark; `selected` when it is picked. */
  label?(i: number, j: number, selected?: boolean): FigureLabel | undefined;
  /**
   * The links of the figure, each a tuple of the addresses it joins (Wolfram's `Graph` edges, a
   * `GraphicsComplex`'s lines), drawn after the marks and styled by `BoundaryStyle` through their
   * members' properties. A hit on a link selects its members.
   */
  links?(): readonly (readonly Address[])[];
  /** The curve a link takes (a `Line`, or a `Polygon` for a hyperedge); a line through its members' places when absent. */
  linkMark?(link: readonly Address[]): GraphicsPrimitive;
  /**
   * A layer of points anywhere in the plane, not of a lattice: each one's position, element (n, 0)
   * the n-th. Its tiles take the basis's cell shape, centred on the points.
   */
  points?(): readonly Vec2[];
  /** The index ranges a finite layer has (a table's rows and columns); ±maxIndex otherwise. */
  readonly bounds?: { readonly i: Vec2; readonly j: Vec2 };
  /** Whether point (i, j) is classified already, so drawing it costs nothing. */
  known(i: number, j: number): boolean;
  /** Classify point (i, j) now. */
  prepare(i: number, j: number): void;
  has(i: number, j: number, property: string): boolean | undefined;
  value(i: number, j: number, name: string): number | undefined;
  relatedTo(relation: string, selected: Vec2, i: number, j: number): boolean;
}

export interface TileDrawOptions {
  readonly colorRules: readonly ColorRule[];
  readonly boundaryRules: readonly BoundaryRule[];
  readonly colorMixing: ColorMixing;
  readonly selection: readonly Vec2[];
  /** The color labels are drawn in; gray when absent. */
  readonly ink?: string;
  /** Fraction of a cell its tile fills. */
  readonly fill: number;
  /** Shifts every scheme by this many bands, to animate it. */
  readonly phase: number;
  /** Stop classifying new points once this many ms have gone to classifying; the caller draws again. */
  readonly budgetMs: number;
}

/** Points every frame classifies whatever the budget says, so a slow classifier still gets on. */
const MIN_PREPARED = 64;

/** The width, in CSS pixels, a line mark is stroked at in its color. */
const LINE_WIDTH = 1.25;

/** Tiles narrower than this many device pixels are drawn as squares, with no edges. */
const TINY_TILE = 3;

type ValueReader = (base: (name: string) => number | undefined) => number | undefined;

/** Draw a tile layer; whether every visible point was drawn. Clears nothing: layers stack. */
export function drawTiles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layer: TileLayer,
  view: LatticeView,
  options: TileDrawOptions,
): boolean {
  if (layer.place) return drawMarks(ctx, width, height, layer, view, options);
  const pixels = height / (2 * view.extent);
  const toScreen = (p: Vec2): Vec2 => [
    (p[0] - view.center[0]) * pixels + width / 2,
    height / 2 - (p[1] - view.center[1]) * pixels,
  ];
  const area = Math.abs(layer.basis[0][0] * layer.basis[1][1] - layer.basis[0][1] * layer.basis[1][0]);
  const size = Math.sqrt(area) * pixels;
  const tiny = size < TINY_TILE;
  const half = (size * options.fill) / 2;
  const shape = voronoiCell(layer.basis).map(
    ([x, y]) => [x * pixels * options.fill, -y * pixels * options.fill] as Vec2,
  );
  const tile = (path: Path2D, x: number, y: number, inset = 0): void => {
    if (tiny) {
      path.rect(x - half, y - half, 2 * half, 2 * half);
      return;
    }
    // Shrink the cell toward its centre by `inset` device pixels, for nested edges.
    const k = half > 0 ? Math.max(0, 1 - inset / half) : 1;
    path.moveTo(x + shape[0]![0] * k, y + shape[0]![1] * k);
    for (let n = 1; n < shape.length; n++) path.lineTo(x + shape[n]![0] * k, y + shape[n]![1] * k);
    path.closePath();
  };

  // Value readers once per gradient, not per point.
  const readers = new Map<unknown, ValueReader | undefined>();
  const readerFor = (json: unknown): ValueReader | undefined => {
    if (!readers.has(json)) readers.set(json, valueOf(json));
    return readers.get(json);
  };

  const fills = new Map<string, Path2D>();
  const edges = new Map<string, Path2D>();
  const pathIn = (paths: Map<string, Path2D>, key: string): Path2D => {
    let path = paths.get(key);
    if (path === undefined) paths.set(key, (path = new Path2D()));
    return path;
  };

  const selected = new Set(options.selection.map(([i, j]) => `${i},${j}`));
  const range = visibleRange(layer.basis, view, width / height);
  const limit = layer.maxIndex;
  const { i: bi, j: bj } = layer.bounds ?? { i: [-limit, limit], j: [-limit, limit] };
  const [i0, i1] = [Math.max(range.i[0], bi[0]), Math.min(range.i[1], bi[1])];
  const [j0, j1] = [Math.max(range.j[0], bj[0]), Math.min(range.j[1], bj[1])];
  const centre = latticeCoordinates(layer.basis, view.center).map(Math.round) as [number, number];
  const rows = Array.from({ length: Math.max(0, j1 - j0 + 1) }, (_, k) => j0 + k).toSorted(
    (a, b) => Math.abs(a - centre[1]) - Math.abs(b - centre[1]),
  );
  const margin = 2 * half + 2;
  // The budget is classifying's alone: drawing the points already known takes its own time, and
  // counting it would leave a zoomed-out view with no time to learn anything new.
  let spent = 0;
  let prepared = 0;
  let complete = true;

  const visit = (i: number, j: number, x: number, y: number): void => {
    if (x < -margin || x > width + margin || y < -margin || y > height + margin) return;
    if (!layer.known(i, j)) {
      if (spent > options.budgetMs && prepared >= MIN_PREPARED) {
        complete = false;
        return;
      }
      const start = performance.now();
      layer.prepare(i, j);
      spent += performance.now() - start;
      prepared++;
    }
    const facts: ElementFacts = {
      has: (p) => layer.has(i, j, p) ?? false,
      related: (r) => options.selection.some((s) => layer.relatedTo(r, s, i, j)),
      selected: selected.has(`${i},${j}`),
    };
    const style = styleElement(
      options.colorRules,
      options.boundaryRules,
      options.colorMixing,
      facts,
      (json) => readerFor(json)?.((name) => layer.value(i, j, name)),
      options.phase,
    );
    if (style.color) tile(pathIn(fills, style.color), x, y);
    if (tiny) return;
    let inset = 0;
    for (const e of style.edges) {
      const w = e.width * dprOf();
      tile(pathIn(edges, `${e.color}|${w}|${e.opacity}|${e.dashing.join(",")}`), x, y, inset + w / 2);
      inset += w;
    }
  };

  const points = layer.points?.();
  if (points) {
    for (let n = 0; n < points.length; n++) {
      const [x, y] = toScreen(points[n]!);
      visit(n, 0, x, y);
    }
  } else {
    for (const j of rows) {
      for (let i = i0; i <= i1; i++) {
        const [x, y] = toScreen(latticePoint(layer.basis, i, j));
        visit(i, j, x, y);
      }
    }
  }

  paintBatches(ctx, fills, edges);
  return complete;
}

/** Fill each color's path, then stroke each edge's. */
function paintBatches(ctx: CanvasRenderingContext2D, fills: Map<string, Path2D>, edges: Map<string, Path2D>): void {
  ctx.save();
  for (const [color, path] of fills) {
    ctx.fillStyle = color;
    ctx.fill(path);
  }
  for (const [key, path] of edges) {
    const [color, w, opacity, dashing] = key.split("|");
    ctx.strokeStyle = color!;
    ctx.lineWidth = Number(w);
    ctx.globalAlpha = Number(opacity);
    ctx.setLineDash(dashing ? dashing.split(",").map((d) => Number(d) * dprOf()) : []);
    ctx.stroke(path);
  }
  ctx.restore();
}

// ── Figures: layers that place their own marks ────────────────────────────────────────────

const xy = (p: FramePoint): Vec2 => [p[0] ?? 0, p[1] ?? 0];

/** Every address of a figure layer: its `bounds`, row by row. */
export function addressesOf(layer: TileLayer): Address[] {
  if (layer.addresses) return [...layer.addresses()];
  const { i, j } = layer.bounds ?? { i: [0, 0], j: [0, 0] };
  const out: Address[] = [];
  for (let b = j[0]; b <= j[1]; b++) for (let a = i[0]; a <= i[1]; a++) out.push([a, b]);
  return out;
}

/** Where an address is, in 2-D: a figure layer's `place`, else the lattice point. */
export const placeOf = (layer: TileLayer, i: number, j: number): Vec2 =>
  layer.place ? xy(layer.place(i, j)) : latticePoint(layer.basis, i, j);

/** What a link draws: its layer's curve, or a line through its members. */
const linkPrimitive = (layer: TileLayer, link: readonly Address[]): GraphicsPrimitive =>
  layer.linkMark?.(link) ?? { head: "Line", points: link.map(([i, j]) => placeOf(layer, i, j)) };

/** The points that bound a primitive: a disk's rim, a line's or polygon's vertices. */
function extentOf(p: GraphicsPrimitive, place: Vec2): Vec2[] {
  if (p.head === "Disk") {
    const [x, y] = p.center ? xy(p.center) : place;
    return [
      [x - p.radius, y - p.radius],
      [x + p.radius, y + p.radius],
    ];
  }
  if (p.head === "Polyhedron") return p.faces.flatMap((ring) => ring.map(xy));
  return p.head === "Line" || p.head === "Polygon" ? p.points.map(xy) : [place];
}

/** The box a figure layer fills, marks and links included: [x0, x1, y0, y1]. */
export function frameBounds(layer: TileLayer): readonly [number, number, number, number] | undefined {
  const points: Vec2[] = [];
  for (const [i, j] of addressesOf(layer))
    points.push(...extentOf(layer.mark?.(i, j) ?? { head: "Disk", radius: 0 }, placeOf(layer, i, j)));
  for (const link of layer.links?.() ?? []) points.push(...extentOf(linkPrimitive(layer, link), [0, 0]));
  if (points.length === 0) return undefined;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
}

/** The view that fits a figure layer whole, with a margin, for a canvas of the given aspect (w / h). */
export function fitView(layer: TileLayer, aspect: number, margin = 0.6): LatticeView {
  const box = frameBounds(layer);
  if (!box) return { center: [0, 0], extent: 1 };
  const [x0, x1, y0, y1] = box;
  return {
    center: [(x0 + x1) / 2, (y0 + y1) / 2],
    extent: Math.max((y1 - y0) / 2 + margin, ((x1 - x0) / 2 + margin) / aspect),
  };
}

/** Whether `p` is inside a polygon (even-odd rule). */
function inside(p: Vec2, poly: readonly Vec2[]): boolean {
  let hit = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [pa, pb] = [poly[a]!, poly[b]!];
    if (pa[1] > p[1] !== pb[1] > p[1] && p[0] < ((pb[0] - pa[0]) * (p[1] - pa[1])) / (pb[1] - pa[1]) + pa[0])
      hit = !hit;
  }
  return hit;
}

/** The distance from `p` to the segment `a`–`b`. */
function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** The distance from `p` to a polyline. */
const polylineDistance = (p: Vec2, points: readonly Vec2[]): number =>
  points.length === 1
    ? Math.hypot(p[0] - points[0]![0], p[1] - points[0]![1])
    : Math.min(...points.slice(1).map((q, k) => segmentDistance(p, points[k]!, q)));

/**
 * What a point of a figure's frame hits, within `reach` of it: the nearest address, else the
 * members of the nearest link; none when nothing is near. Where marks overlap, as a camera
 * frame's do, right on a point beats a line beats the face under the pointer (the last drawn,
 * which is the nearest), and a near miss of a point or line beats only a body: the order a reader picks in.
 */
export function hitAt(layer: TileLayer, at: Vec2, reach: number): Address[] {
  const nearest = { point: reach, line: reach, body: reach };
  let point: Address | undefined;
  let line: Address | undefined;
  let face: Address | undefined;
  let body: Address | undefined;
  for (const [i, j] of addressesOf(layer)) {
    const mark = layer.mark?.(i, j);
    // A polygon mark is hit anywhere inside it, not only near its place.
    if (mark?.head === "Polygon") {
      if (inside(at, mark.points.map(xy))) {
        if (layer.view !== "camera") return [[i, j]];
        face = [i, j];
      }
      // A camera frame's face is hit inside it only; a flat one is also hit near its place.
      if (layer.view === "camera") continue;
    }
    if (mark?.head === "Line") {
      const d = polylineDistance(at, mark.points.map(xy));
      if (d <= nearest.line) [line, nearest.line] = [[i, j], d];
      continue;
    }
    const p = placeOf(layer, i, j);
    const d = Math.hypot(p[0] - at[0], p[1] - at[1]);
    if (mark?.head === "Polyhedron") {
      if (d <= nearest.body) [body, nearest.body] = [[i, j], d];
    } else if (d <= nearest.point) [point, nearest.point] = [[i, j], d];
  }
  // Right on a point or line it wins; else the face under the pointer; else the near miss.
  const close = reach / 3;
  const found =
    (nearest.point <= close ? point : undefined) ??
    (nearest.line <= close ? line : undefined) ??
    face ??
    point ??
    line ??
    body;
  if (found) return [found];
  let link: readonly Address[] = [];
  let nearestLink = reach;
  for (const members of layer.links?.() ?? []) {
    const prim = linkPrimitive(layer, members);
    if (prim.head !== "Line" && prim.head !== "Polygon") continue;
    const pts = prim.points.map(xy);
    const closed = prim.head === "Polygon";
    for (let k = 0; k < (closed ? pts.length : pts.length - 1); k++) {
      const d = segmentDistance(at, pts[k]!, pts[(k + 1) % pts.length]!);
      if (d <= nearestLink) [link, nearestLink] = [members, d];
    }
  }
  return [...link];
}

/** Add a primitive to a path, in screen coordinates; `inset` pulls a disk's rim in, for nested edges. */
function addPrimitive(
  path: Path2D,
  p: GraphicsPrimitive,
  place: Vec2,
  toScreen: (v: Vec2) => Vec2,
  pixels: number,
  inset = 0,
): void {
  if (p.head === "Disk") {
    const [x, y] = toScreen(p.center ? xy(p.center) : place);
    const r = Math.max(0.5, p.radius * pixels - inset);
    path.moveTo(x + r, y);
    path.arc(x, y, r, 0, 2 * Math.PI);
  } else if (p.head === "Line" || p.head === "Polygon") {
    p.points.forEach((q, k) => {
      const [x, y] = toScreen(xy(q));
      if (k === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    if (p.head === "Polygon") path.closePath();
  } else if (p.head === "Polyhedron") {
    for (const ring of p.faces) {
      ring.forEach((q, k) => {
        const [x, y] = toScreen(xy(q));
        if (k === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      });
      path.closePath();
    }
  }
}

/**
 * Draw a figure layer: a mark at each address, styled as a tile is (color by `ColorRules`, edges
 * by `BoundaryStyle`), then the links, each a curve stroked by the edges its members' properties
 * match. A link has a property, relation or selection when any of its members does.
 */
function drawMarks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layer: TileLayer,
  view: LatticeView,
  options: TileDrawOptions,
): boolean {
  const pixels = height / (2 * view.extent);
  const toScreen = (p: Vec2): Vec2 => [
    (p[0] - view.center[0]) * pixels + width / 2,
    height / 2 - (p[1] - view.center[1]) * pixels,
  ];
  const dpr = dprOf();
  const readers = new Map<unknown, ValueReader | undefined>();
  const readerFor = (json: unknown): ValueReader | undefined => {
    if (!readers.has(json)) readers.set(json, valueOf(json));
    return readers.get(json);
  };
  const selected = new Set(options.selection.map(([i, j]) => `${i},${j}`));
  const factsOf = (members: readonly Address[]): ElementFacts => ({
    has: (p) => members.some(([i, j]) => layer.has(i, j, p) ?? false),
    related: (r) => members.some(([i, j]) => options.selection.some((s) => layer.relatedTo(r, s, i, j))),
    selected: members.some(([i, j]) => selected.has(`${i},${j}`)),
  });

  const fills = new Map<string, Path2D>();
  const edges = new Map<string, Path2D>();
  const pathIn = (paths: Map<string, Path2D>, key: string): Path2D => {
    let path = paths.get(key);
    if (path === undefined) paths.set(key, (path = new Path2D()));
    return path;
  };
  const labels: { at: Vec2; text: string; size: number; color: string }[] = [];
  const captions: { at: Vec2; text: string; size: number; opacity: number }[] = [];

  // A camera frame's marks overlap, so each is painted in the order the layer lists them (far to
  // near); the rest are batched by color.
  const ordered = layer.view === "camera";
  // Classifying is the budget's alone, as in `drawTiles`: an address not yet known is skipped
  // for this frame once the budget is spent, and the caller draws again.
  let spent = 0;
  let prepared = 0;
  let complete = true;

  for (const [i, j] of addressesOf(layer)) {
    if (!layer.known(i, j)) {
      if (spent > options.budgetMs && prepared >= MIN_PREPARED) {
        complete = false;
        continue;
      }
      const start = performance.now();
      layer.prepare(i, j);
      spent += performance.now() - start;
      prepared++;
    }
    const facts = factsOf([[i, j]]);
    const style = styleElement(
      options.colorRules,
      options.boundaryRules,
      options.colorMixing,
      facts,
      (json) => readerFor(json)?.((name) => layer.value(i, j, name)),
      options.phase,
    );
    const at = placeOf(layer, i, j);
    const mark: GraphicsPrimitive = layer.mark?.(i, j) ?? { head: "Disk", radius: 0.12 };
    const caption = layer.label?.(i, j, facts.selected);
    if (caption)
      captions.push({
        at: xy(caption.at ?? at),
        text: caption.text,
        size: caption.size,
        opacity: caption.opacity ?? 1,
      });
    if (mark.head === "Text") {
      if (style.color) labels.push({ at: xy(mark.at ?? at), text: mark.text, size: mark.size, color: style.color });
      continue;
    }
    // A line has no inside: its color strokes it.
    if (style.color && mark.head === "Line")
      addPrimitive(pathIn(edges, `${style.color}|${LINE_WIDTH * dpr}|1|`), mark, at, toScreen, pixels);
    else if (style.color) addPrimitive(pathIn(fills, style.color), mark, at, toScreen, pixels);
    let inset = 0;
    for (const e of style.edges) {
      const w = e.width * dpr;
      const key = `${e.color}|${w}|${e.opacity}|${e.dashing.join(",")}`;
      addPrimitive(pathIn(edges, key), mark, at, toScreen, pixels, inset + w / 2);
      inset += w;
    }
    if (ordered) {
      paintBatches(ctx, fills, edges);
      fills.clear();
      edges.clear();
    }
  }
  paintBatches(ctx, fills, edges);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const l of labels) {
    const [x, y] = toScreen(l.at);
    ctx.font = `${Math.round(l.size * pixels)}px system-ui, sans-serif`;
    ctx.fillStyle = l.color;
    ctx.fillText(l.text, x, y);
  }
  for (const c of captions) {
    const [x, y] = toScreen(c.at);
    ctx.font = `${Math.round(c.size * pixels)}px system-ui, sans-serif`;
    ctx.fillStyle = options.ink ?? "#8a8a99";
    ctx.globalAlpha = c.opacity;
    ctx.fillText(c.text, x, y);
  }
  ctx.globalAlpha = 1;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const link of layer.links?.() ?? []) {
    const style = styleElement([], options.boundaryRules, "First", factsOf(link), () => undefined, 0);
    const prim = linkPrimitive(layer, link);
    if (style.edges.length === 0 || (prim.head !== "Line" && prim.head !== "Polygon")) continue;
    const path = new Path2D();
    addPrimitive(path, prim, [0, 0], toScreen, pixels);
    if (prim.head === "Polygon") {
      ctx.globalAlpha = 0.16 * style.edges[0]!.opacity;
      ctx.fillStyle = style.edges[0]!.color;
      ctx.fill(path);
    }
    // The first rule on top: strokes run last to first.
    for (const e of style.edges.toReversed()) {
      ctx.strokeStyle = e.color;
      ctx.lineWidth = e.width * dpr;
      ctx.globalAlpha = e.opacity;
      ctx.setLineDash(e.dashing.map((d) => d * dpr));
      ctx.stroke(path);
    }
  }
  ctx.restore();
  return complete;
}

export interface LineStyle {
  readonly color: string;
  /** CSS pixels. */
  readonly width: number;
  readonly opacity: number;
}

/** Device pixels per CSS pixel, capped as the canvases are. */
const dprOf = (): number => Math.min(globalThis.devicePixelRatio || 1, 2);

/** A step per generator, or one for both; 0 draws none along that generator. */
export type GridStep = number | readonly [number, number];
const stepAlong = (step: GridStep, axis: 0 | 1): number => (typeof step === "number" ? step : step[axis]);

/**
 * The lines of a coarser lattice: through every `step`-th multiple of each generator (given in
 * lattice coordinates), parallel to the other. With `origin`, only the two lines through 0 (the
 * axes). Lines closer than a few pixels are skipped rather than smeared into a wash.
 */
export function drawLatticeLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  basis: readonly [Vec2, Vec2],
  generators: readonly [Vec2, Vec2],
  view: LatticeView,
  step: GridStep,
  style: LineStyle,
  origin = false,
  /** Where the lines are anchored, in lattice coordinates: half a cell for a table, between its cells. */
  offset: Vec2 = [0, 0],
): void {
  const pixels = height / (2 * view.extent);
  const toScreen = (p: Vec2): Vec2 => [
    (p[0] - view.center[0]) * pixels + width / 2,
    height / 2 - (p[1] - view.center[1]) * pixels,
  ];
  const reach = Math.hypot((view.extent * width) / height, view.extent) * 1.05;
  const g = generators.map((v) => latticePoint(basis, v[0], v[1])) as [Vec2, Vec2];
  const dpr = dprOf();
  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width * dpr;
  ctx.globalAlpha = style.opacity;
  ctx.beginPath();
  for (const axis of [0, 1] as const) {
    const along = g[1 - axis]!;
    const unit: Vec2 = [along[0] / Math.hypot(...along), along[1] / Math.hypot(...along)];
    const normal: Vec2 = [-unit[1], unit[0]];
    const every = origin ? 1 : stepAlong(step, axis);
    if (!(every > 0)) continue;
    const stepVec: Vec2 = [g[axis]![0] * every, g[axis]![1] * every];
    const spacing = stepVec[0] * normal[0] + stepVec[1] * normal[1];
    if (!origin && Math.abs(spacing) * pixels < 6) continue;
    const c = view.center[0] * normal[0] + view.center[1] * normal[1];
    const [from, to] = origin
      ? [0, 0]
      : [
          Math.ceil(Math.min((c - reach) / spacing, (c + reach) / spacing)) - 1,
          Math.floor(Math.max((c - reach) / spacing, (c + reach) / spacing)) + 1,
        ];
    const shift = latticePoint(basis, offset[0], offset[1]);
    for (let k = from; k <= to; k++) {
      const base: Vec2 = [stepVec[0] * k + shift[0], stepVec[1] * k + shift[1]];
      const t = (view.center[0] - base[0]) * unit[0] + (view.center[1] - base[1]) * unit[1];
      const foot: Vec2 = [base[0] + unit[0] * t, base[1] + unit[1] * t];
      const a = toScreen([foot[0] - unit[0] * reach, foot[1] - unit[1] * reach]);
      const b = toScreen([foot[0] + unit[0] * reach, foot[1] + unit[1] * reach]);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Least room, in CSS pixels, between neighboring axis labels. */
const LABEL_ROOM = 56;

/**
 * Labels along both axes at multiples of `step`, each on a halo of the opposite lightness so it
 * reads over any tile; thinned (every 2nd, 5th, 10th…) where they would crowd.
 */
export function drawAxisLabels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  basis: readonly [Vec2, Vec2],
  generators: readonly [Vec2, Vec2],
  view: LatticeView,
  step: GridStep,
  label: (axis: 0 | 1, k: number) => string,
  style: { readonly color: string; readonly halo: string; readonly opacity: number },
): void {
  const pixels = height / (2 * view.extent);
  const toScreen = (p: Vec2): Vec2 => [
    (p[0] - view.center[0]) * pixels + width / 2,
    height / 2 - (p[1] - view.center[1]) * pixels,
  ];
  const g = generators.map((v) => latticePoint(basis, v[0], v[1])) as [Vec2, Vec2];
  const dpr = dprOf();
  const reach = Math.hypot((view.extent * width) / height, view.extent);
  ctx.save();
  ctx.font = `${Math.round(11 * dpr)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.globalAlpha = style.opacity;
  for (const axis of [0, 1] as const) {
    const v = g[axis]!;
    const along = stepAlong(step, axis);
    if (!(along > 0)) continue;
    const room = Math.hypot(...v) * along * pixels;
    const stride = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find((n) => n * room >= LABEL_ROOM * dpr) ?? 1000;
    const kMax = Math.ceil((reach + Math.hypot(...view.center)) / (Math.hypot(...v) * along));
    for (let k = -kMax; k <= kMax; k++) {
      if (k === 0 || k % stride !== 0) continue;
      const [x, y] = toScreen([v[0] * along * k, v[1] * along * k]);
      if (x < 0 || x > width || y < 0 || y > height) continue;
      const text = label(axis, k * along);
      ctx.lineWidth = 3 * dpr;
      ctx.strokeStyle = style.halo;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = style.color;
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}
