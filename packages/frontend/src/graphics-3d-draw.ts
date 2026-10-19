// A `Graphics3DBox` drawn: the web's (and any SVG consumer's) half of the contract. The primitives
// are placed in a unit cube from `PlotRange` (through `ScalingFunctions`), projected orthographically
// from an azimuth and an elevation, and painted back to front on their depth (the painter's
// algorithm): a polygon on its mean depth, a bar on its base, a curve in arcs. Colors arrive resolved
// in the box (`FaceColors`, `VertexColors`, `PointColors`), so nothing here knows a gradient. Pure: the
// same box and view give byte-identical SVG, in Node and in the browser.

import { type Box, type BoxNode, graphics3dOf, isNode, type Options, optionsOfBox } from "@enumeratio/boxes";
import { label } from "./plot-box.ts";
import type { Triple } from "./plot3d.ts";
import { camera } from "./project3d.ts";
import { scale } from "./scales.ts";

const ACCENT = "var(--notatio-accent, var(--vp-c-brand-1, #d97706))";
const MARKER = "var(--notatio-accent, #b8860b)";
const BG = "var(--notatio-bg, var(--vp-c-bg, #ffffff))";
const CASING = "var(--notatio-bg, #fff)";
const EDGE = "var(--notatio-border, var(--vp-c-divider, currentColor))";
const FG = "var(--notatio-fg, currentColor)";

/** How dark the sides of a bar are against its top. */
const SIDE_SHADE = 72;
/** How near (viewBox units) the pointer must be to read out a vertex. */
const HOVER_REACH = 40;

const n2 = (x: number): string => String(Math.round(x * 100) / 100);
const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * A color a box holds, as an attribute value: a name, `#hex`, `rgb()`/`hsl()`, `color-mix()` or
 * `var()` -- nothing with a quote or a bracket in it -- else the fallback. The SVG is markup, so a
 * value out of a box is never trusted to stay inside its attribute.
 */
const SAFE_COLOR = /^[#\w\s.,%()/-]+$/;
const color = (value: unknown, fallback = "currentColor"): string =>
  typeof value === "string" && SAFE_COLOR.test(value) ? esc(value) : fallback;

/** The view a figure is turned to; what is absent is the box's own. */
export interface Graphics3dView {
  readonly azimuth?: number;
  readonly elevation?: number;
  readonly zoom?: number;
  /** The pointer, in viewBox units: the nearest vertex is marked and read out. */
  readonly hover?: readonly [number, number];
}

/** Whether `box` is a `Graphics3DBox`. */
export const isGraphics3dBox = (box: Box): boolean => graphics3dOf(box) !== undefined;

/** The expression an unsampled plot of `box` came from (its `InterpretationBox`), else undefined. */
export function unsampledGraphics3d(box: Box): unknown {
  return graphics3dOf(box)?.held;
}

const numbers = (value: unknown): number[] | undefined =>
  Array.isArray(value) && value.every((v) => typeof v === "number") ? (value as number[]) : undefined;
const triples = (value: unknown): Triple[] =>
  Array.isArray(value) ? value.flatMap((p) => (numbers(p)?.length === 3 ? [numbers(p) as unknown as Triple] : [])) : [];
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((v) => (typeof v === "string" ? v : "")) : [];

/** The view a box starts at. */
export function graphics3dHome(box: Box): Required<Pick<Graphics3dView, "azimuth" | "elevation" | "zoom">> {
  const drawing = graphics3dOf(box)?.box;
  const o = drawing ? optionsOfBox(drawing) : {};
  return {
    azimuth: typeof o.Azimuth === "number" ? o.Azimuth : 45,
    elevation: typeof o.Elevation === "number" ? o.Elevation : 15,
    zoom: typeof o.Zoom === "number" ? o.Zoom : 1,
  };
}

/** A primitive and the vertices it indexes, when it sits in a complex. */
interface Entry {
  readonly node: BoxNode;
  readonly vertices?: readonly Triple[];
}

function collect(box: Box, vertices: readonly Triple[] | undefined, out: Entry[]): void {
  if (!isNode(box)) return;
  switch (box[0]) {
    case "GraphicsComplex3DBox":
      for (const item of box[1]) collect(item, triples(optionsOfBox(box).Points), out);
      return;
    case "Polygon3DBox":
    case "Line3DBox":
    case "Point3DBox":
    case "CuboidBox":
    case "InsetBox":
      out.push(vertices === undefined ? { node: box } : { node: box, vertices });
      return;
    default:
  }
}

/** A point on the page, with how near it is to the viewer (larger is nearer). */
type Projected = readonly [number, number, number];

/** The frame a figure is projected in. */
type Cam = (x: number, y: number, z: number) => Projected;

/** A constant scale, the way a surface is framed: the unit cube sits in the middle of the frame. */
function fixedCamera(W: number, H: number, azimuth: number, elevation: number, zoom: number): Cam {
  const a = (azimuth * Math.PI) / 180;
  const e = (Math.max(-90, Math.min(90, elevation)) * Math.PI) / 180;
  const [cosA, sinA, cosE, sinE] = [Math.cos(a), Math.sin(a), Math.cos(e), Math.sin(e)];
  const S = 181 * zoom;
  const L = 95 * zoom;
  const cx = W / 2;
  const cy = H / 2 + 0.03 * H;
  return (px, py, pz) => {
    const x = px - 0.5;
    const y = py - 0.5;
    const z = pz - 0.5;
    const u = x * cosA - y * sinA; // screen-right
    const v = x * sinA + y * cosA; // toward the viewer, on the floor
    return [cx + u * S, cy + v * S * sinE - z * L * cosE, v * cosE + z * sinE];
  };
}

/** The whole cube fills the frame, whatever the view. */
function fitCamera(W: number, H: number, azimuth: number, elevation: number, zoom: number): Cam {
  const cam = camera({ width: W, height: H, azimuth, elevation, zoom });
  return (x, y, z) => {
    const p = cam.at(x, y, z);
    return [p.x, p.y, p.depth];
  };
}

/** `[lo, hi]` through a scaling function as a map onto the unit interval (a degenerate range is the middle). */
function unitAxis(name: string | undefined, range: readonly [number, number]): (v: number) => number {
  const s = scale(name);
  const [lo, hi] = [s.fwd(range[0]), s.fwd(range[1])];
  return hi > lo ? (v) => (s.fwd(v) - lo) / (hi - lo) : () => 0.5;
}

/** The bounding box of every vertex the primitives name, when the box states no `PlotRange`. */
function extentOf(entries: readonly Entry[]): readonly [readonly [number, number], ...(readonly [number, number])[]] {
  const all = entries.flatMap(({ node, vertices }) => [...(vertices ?? []), ...triples(optionsOfBox(node).Points)]);
  const axis = (k: number): [number, number] => {
    const values = all.map((p) => p[k]!).filter(Number.isFinite);
    return values.length === 0 ? [0, 1] : [Math.min(...values), Math.max(...values)];
  };
  return [axis(0), axis(1), axis(2)];
}

/** A painted thing and how far it is from the viewer. */
interface Drawable {
  readonly depth: number;
  readonly svg: string;
}

const byDepth = (items: Drawable[]): string =>
  items
    .toSorted((p, q) => p.depth - q.depth)
    .map((d) => d.svg)
    .join("");

const mean = (values: readonly number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length;

/** The axes: the floor outline and the three edges that rise from its farthest corner, labeled at their free ends. */
function axesSvg(
  at: Cam,
  flags: readonly [boolean, boolean, boolean],
  range: readonly [readonly [number, number], ...(readonly [number, number])[]],
): string {
  const corners: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const [bx, by] = corners.reduce((far, c) => (at(c[0], c[1], 0)[2] < at(far[0], far[1], 0)[2] ? c : far));
  const o = at(bx, by, 0);
  const line = (a: Projected, b: Projected): string =>
    `<line x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}" stroke="${EDGE}" stroke-width="1" opacity="0.5"/>`;
  const tick = (p: Projected, anchor: string, text: string): string =>
    text
      ? `<text x="${n2(p[0])}" y="${n2(p[1])}" text-anchor="${anchor}" font-size="9" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.6">${esc(text)}</text>`
      : "";
  const floor = corners.map(([x, y]) => at(x, y, 0)).map((p) => `${n2(p[0])},${n2(p[1])}`);
  const xEnd = range[0]![bx === 0 ? 1 : 0]!;
  const yEnd = range[1]![by === 0 ? 1 : 0]!;
  return (
    `<polygon points="${floor.join(" ")}" fill="none" stroke="${EDGE}" stroke-width="1" opacity="0.35"/>` +
    line(o, at(1 - bx, by, 0)) +
    line(o, at(bx, 1 - by, 0)) +
    line(o, at(bx, by, 1)) +
    tick(at(1 - bx, by, 0), "middle", flags[0] ? label(xEnd) : "") +
    tick(at(bx, 1 - by, 0), "middle", flags[1] ? label(yEnd) : "") +
    tick(at(bx, by, 1), "end", flags[2] ? label(range[2]![1]!) : "")
  );
}

/** A height key: swatches from the top down, labeled at both ends. */
function legendSvg(width: number, value: unknown): string {
  if (!Array.isArray(value)) return "";
  const colors = strings(value[0]);
  const labels = strings(value[1]);
  if (colors.length === 0) return "";
  const [x, y, w, h] = [width - 14, 16, 8, 76];
  let out = colors
    .map(
      (fill, k) =>
        `<rect x="${n2(x)}" y="${n2(y + (h * k) / colors.length)}" width="${w}" height="${n2(h / colors.length + 0.5)}" fill="${fill}" stroke="none"/>`,
    )
    .join("");
  out += `<rect x="${n2(x)}" y="${n2(y)}" width="${w}" height="${n2(h)}" fill="none" stroke="${EDGE}" stroke-width="0.5" opacity="0.5"/>`;
  const ends = [y + 4, y + h];
  labels.forEach((text, k) => {
    out += `<text x="${n2(x - 2)}" y="${n2(ends[k] ?? y)}" text-anchor="end" font-size="9" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.6">${esc(text)}</text>`;
  });
  return out;
}

const strokeOf = (o: Options, fallback: string): string => color(o.EdgeColor, fallback);

function polygons(
  entry: Entry,
  at: (p: Triple) => Projected | undefined,
  known: readonly (Projected | undefined)[] | undefined,
  out: Drawable[],
): void {
  const o = optionsOfBox(entry.node);
  const rings: number[][] = Array.isArray(o.Indices)
    ? o.Indices.flatMap((ring) => (numbers(ring) ? [numbers(ring)!] : []))
    : [];
  const own = triples(o.Points);
  const faces: (Projected | undefined)[][] =
    rings.length > 0 ? rings.map((ring) => ring.map((i) => known?.[i])) : own.length >= 3 ? [own.map(at)] : [];
  const colors = strings(o.FaceColors);
  const wire = o.Wireframe === true;
  const width = typeof o.EdgeWidth === "number" ? o.EdgeWidth : 0.5;
  faces.forEach((ring, k) => {
    if (ring.some((p) => p === undefined)) return;
    const pts = ring as Projected[];
    const fill = color(colors[k] ?? o.FaceForm);
    const points = pts.map((p) => `${n2(p[0])},${n2(p[1])}`).join(" ");
    const look = wire
      ? `fill="none" stroke="${fill}" stroke-width="0.7" stroke-linejoin="round" opacity="0.8"`
      : `fill="${fill}"${typeof o.Opacity === "number" ? ` fill-opacity="${o.Opacity}"` : ""} stroke="${strokeOf(o, EDGE)}" stroke-width="${n2(width)}"${typeof o.EdgeOpacity === "number" ? ` stroke-opacity="${o.EdgeOpacity}"` : ""} stroke-linejoin="round"`;
    out.push({ depth: mean(pts.map((p) => p[2])), svg: `<polygon points="${points}" ${look}/>` });
  });
}

function cuboidFaces(entry: Entry, at: (p: Triple) => Projected | undefined, out: Drawable[]): void {
  const o = optionsOfBox(entry.node);
  const min = numbers(o.Min);
  const max = numbers(o.Max);
  if (min?.length !== 3 || max?.length !== 3) return;
  const ring: [number, number][] = [
    [min[0]!, min[1]!],
    [max[0]!, min[1]!],
    [max[0]!, max[1]!],
    [min[0]!, max[1]!],
  ];
  const lo = ring.map(([x, y]) => at([x, y, min[2]!]));
  const hi = ring.map(([x, y]) => at([x, y, max[2]!]));
  if (lo.some((p) => p === undefined) || hi.some((p) => p === undefined)) return;
  const [low, high] = [lo as Projected[], hi as Projected[]];
  const poly = (ps: readonly Projected[]): string => ps.map((p) => `${n2(p[0])},${n2(p[1])}`).join(" ");
  const depth = (ps: readonly Projected[]): number => mean(ps.map((p) => p[2]));
  const top = color(o.FaceForm);
  const side = `color-mix(in srgb, ${top} ${SIDE_SHADE}%, black)`;
  const face = (ps: readonly Projected[], fill: string, d: number): Drawable => ({
    depth: d,
    svg: `<polygon points="${poly(ps)}" fill="${fill}" stroke="${EDGE}" stroke-width="0.5" stroke-linejoin="round"/>`,
  });
  // Of the four sides only the two facing the viewer show; the back pair hides behind the bar's own top and sides.
  const sides = [0, 1, 2, 3].map((k) => {
    const m = (k + 1) % 4;
    return [low[k]!, low[m]!, high[m]!, high[k]!];
  });
  const visible = sides
    .toSorted((a, b) => depth(b) - depth(a))
    .slice(0, 2)
    .toSorted((a, b) => depth(a) - depth(b));
  // Sides first, top last: the top can never be hidden by its own bar.
  const base = depth(low);
  for (const s of visible) out.push(face(s, side, base - 0.001));
  out.push(face(high, top, base));
}

function lines(
  entry: Entry,
  at: (p: Triple) => Projected | undefined,
  known: readonly (Projected | undefined)[] | undefined,
  out: Drawable[],
): void {
  const o = optionsOfBox(entry.node);
  const projected =
    known !== undefined && numbers(o.Indices) ? numbers(o.Indices)!.map((i) => known[i]) : triples(o.Points).map(at);
  const pts = projected.filter((p): p is Projected => p !== undefined);
  if (pts.length < 2) return;
  const colors = strings(o.VertexColors);
  const stroke = typeof o.Thickness === "number" ? o.Thickness : 2.4;
  const path = (ps: readonly Projected[]): string =>
    ps.map((q, i) => `${i === 0 ? "M" : "L"}${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join("");
  // Drawn as depth-sorted arcs, not segments: casing one segment at a time rubs out its own
  // neighbors, which touch it by construction. An arc is cased once along its whole length, so a
  // casing interrupts something only where a different arc passes in front, which is a crossing.
  const arcs = Math.max(16, Math.min(64, Math.round(pts.length / 16)));
  const per = Math.ceil((pts.length - 1) / arcs);
  for (let i = 0; i < pts.length - 1; i += per) {
    // One point of overlap, so consecutive arcs meet with no seam.
    const arc = pts.slice(i, Math.min(pts.length, i + per + 1));
    if (arc.length < 2) continue;
    let svg = "";
    // Inset, the casing cannot rub out the neighboring arc at a join.
    const inner = arc.slice(1, -1);
    if (o.Casing === true && inner.length >= 2)
      svg += `<path d="${path(inner)}" stroke="${CASING}" stroke-width="${(stroke * 3).toFixed(2)}" stroke-linecap="butt" stroke-linejoin="round" fill="none"/>`;
    svg += `<path d="${path(arc)}" stroke="${color(colors[i])}" stroke-width="${stroke.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    out.push({ depth: mean(arc.map((p) => p[2])), svg });
  }
}

function dots(entry: Entry, at: (p: Triple) => Projected | undefined, out: Drawable[]): void {
  const o = optionsOfBox(entry.node);
  const placed = triples(o.Points).flatMap((p, k) => {
    const q = at(p);
    return q === undefined ? [] : [{ q, color: color(strings(o.PointColors)[k]) }];
  });
  const size = typeof o.PointSize === "number" ? o.PointSize : 3.2;
  if (o.Role === "Marker") {
    // A tracer the eye follows: full strength over the figure, never sorted into it.
    for (const { q } of placed)
      out.push({
        depth: q[2],
        svg:
          `<circle cx="${q[0].toFixed(2)}" cy="${q[1].toFixed(2)}" r="${(size * 2.1).toFixed(2)}" fill="${CASING}"/>` +
          `<circle class="notatio-curve-marker" cx="${q[0].toFixed(2)}" cy="${q[1].toFixed(2)}" r="${(size * 1.5).toFixed(2)}" fill="${MARKER}"/>`,
      });
    return;
  }
  // Orthographic, so nearness is the only depth cue: a far dot shrinks and fades.
  const cue = typeof o.DepthCue === "number" ? Math.max(0, Math.min(1, o.DepthCue)) : 0.45;
  const depths = placed.map(({ q }) => q[2]);
  const [lo, hi] = [Math.min(...depths), Math.max(...depths)];
  const near = (d: number): number => (hi > lo ? (d - lo) / (hi - lo) : 0.5);
  for (const { q, color } of placed) {
    const k = 1 - cue * (1 - near(q[2]));
    out.push({
      depth: q[2],
      svg: `<circle cx="${n2(q[0])}" cy="${n2(q[1])}" r="${n2(size * k)}" fill="${color}" fill-opacity="${n2(k)}" stroke="${EDGE}" stroke-width="0.5"/>`,
    });
  }
}

function insetSvg(entry: Entry, at: (p: Triple) => Projected | undefined): string {
  const o = optionsOfBox(entry.node);
  const center = numbers(o.Center);
  const text = entry.node[1];
  const q = center?.length === 3 ? at(center as unknown as Triple) : undefined;
  if (q === undefined || typeof text !== "string") return "";
  const anchor = o.Anchor === "Left" ? "start" : "middle";
  return `<text x="${n2(q[0])}" y="${n2(q[1])}" text-anchor="${anchor}" font-size="${n2(typeof o.Size === "number" ? o.Size : 9)}" font-family="ui-monospace, monospace" fill="${FG}" opacity="${n2(typeof o.Opacity === "number" ? o.Opacity : 0.7)}">${esc(text)}</text>`;
}

/**
 * `box` as SVG, turned to `view` (else to its own `Azimuth`, `Elevation` and `Zoom`). A box this
 * does not know draws as an empty frame, never an error.
 */
export function graphics3dSvg(box: Box, view: Graphics3dView = {}): string {
  const drawing = graphics3dOf(box)?.box;
  const o: Options = drawing ? optionsOfBox(drawing) : {};
  const size = numbers(o.ImageSize);
  const [W, H] = [size?.[0] ?? 360, size?.[1] ?? 260];
  const home = graphics3dHome(box);
  const [azimuth, elevation, zoom] = [
    view.azimuth ?? home.azimuth,
    view.elevation ?? home.elevation,
    view.zoom ?? home.zoom,
  ];
  const frame = (body: string): string =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(typeof o.Description === "string" ? o.Description : "3-D figure")}">${body}</svg>`;
  if (!drawing) return frame("");

  const entries: Entry[] = [];
  for (const item of drawing[1]) collect(item, undefined, entries);

  const stated = Array.isArray(o.PlotRange) ? o.PlotRange.map(numbers) : [];
  const fallback = extentOf(entries);
  const range = [0, 1, 2].map((k) => {
    const r = stated[k];
    return (r?.length === 2 ? r : fallback[k]) as [number, number];
  }) as unknown as readonly [readonly [number, number], readonly [number, number], readonly [number, number]];
  const names = strings(o.ScalingFunctions);
  const axis = [0, 1, 2].map((k) => unitAxis(names[k], range[k]!));
  const cam = (o.Framing === "Fit" ? fitCamera : fixedCamera)(W, H, azimuth, elevation, zoom);
  const at = (p: Triple): Projected | undefined => {
    const [x, y, z] = [axis[0]!(p[0]), axis[1]!(p[1]), axis[2]!(p[2])];
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? cam(x, y, z) : undefined;
  };

  // A complex's vertices are projected once, however many faces share them.
  const shared = new Map<readonly Triple[], (Projected | undefined)[]>();
  const projectedVertices = (vertices: readonly Triple[]): (Projected | undefined)[] => {
    let found = shared.get(vertices);
    if (found === undefined) shared.set(vertices, (found = vertices.map(at)));
    return found;
  };

  const layers: Record<"under" | "main" | "over", Drawable[]> = { under: [], main: [], over: [] };
  let labels = "";
  for (const entry of entries) {
    const own = optionsOfBox(entry.node);
    const layer = layers[own.Behind === true ? "under" : own.OnTop === true ? "over" : "main"];
    const known = entry.vertices && projectedVertices(entry.vertices);
    switch (entry.node[0]) {
      case "Polygon3DBox":
        polygons(entry, at, known, layer);
        break;
      case "CuboidBox":
        cuboidFaces(entry, at, layer);
        break;
      case "Line3DBox":
        lines(entry, at, known, layer);
        break;
      case "Point3DBox":
        dots(entry, at, layer);
        break;
      case "InsetBox":
        labels += insetSvg(entry, at);
        break;
      default:
    }
  }

  const flags = Array.isArray(o.Axes)
    ? ([0, 1, 2].map((k) => (o.Axes as unknown[])[k] === true) as [boolean, boolean, boolean])
    : ([o.Axes === true, o.Axes === true, o.Axes === true] as [boolean, boolean, boolean]);
  let body = flags.some(Boolean) ? axesSvg((x, y, z) => cam(x, y, z), flags, range) : "";
  body += labels;
  body += byDepth(layers.under) + byDepth(layers.main) + layers.over.map((d) => d.svg).join("");
  body += legendSvg(W, o.PlotLegends);
  if (typeof o.PlotLabel === "string" && o.PlotLabel)
    body += `<text x="${n2(W / 2)}" y="13" text-anchor="middle" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="${FG}">${esc(o.PlotLabel)}</text>`;

  if (view.hover) {
    const [hx, hy] = view.hover;
    let best: { d: number; q: Projected; p: Triple } | undefined;
    for (const entry of entries)
      if (entry.vertices !== undefined)
        projectedVertices(entry.vertices).forEach((q, k) => {
          if (q === undefined) return;
          const d = Math.hypot(q[0] - hx, q[1] - hy);
          if (best === undefined || d < best.d) best = { d, q, p: entry.vertices![k]! };
        });
    const found = best as { d: number; q: Projected; p: Triple } | undefined;
    if (found !== undefined && found.d < HOVER_REACH)
      body +=
        `<circle cx="${n2(found.q[0])}" cy="${n2(found.q[1])}" r="3.5" fill="${BG}" stroke="${ACCENT}" stroke-width="2"/>` +
        `<text x="6" y="${n2(H - 6)}" font-size="10" font-family="ui-monospace, monospace" fill="${FG}" paint-order="stroke" stroke="${BG}" stroke-width="3" stroke-linejoin="round">(${label(found.p[0])}, ${label(found.p[1])}, ${label(found.p[2])})</text>`;
  }
  return frame(body);
}
