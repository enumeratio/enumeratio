// A display list as an SVG string: the static drawer of a `GraphicsBox` (SSR, export, print), pure
// and DOM-free. It reads the same list the canvas `paint` does and applies the same geometry, so
// the two agree; only the output differs, elements in the list's order rather than batched.

import type { Edge } from "./graphics-rules.ts";
import { type LatticeView, type Vec2, voronoiCell } from "./lattice.ts";
import type { DisplayList, FramePoint, GraphicsPrimitive } from "./tiles-canvas.ts";

export interface SvgOptions {
  /** The ink of captions. */
  readonly ink?: string;
  /** Tile size relative to its cell, as `TileDrawOptions.fill`. */
  readonly fill?: number;
}

const LINE_WIDTH = 1.25;
const xy = (p: FramePoint): Vec2 => [p[0] ?? 0, p[1] ?? 0];
const n = (x: number): string => String(Math.round(x * 100) / 100);
const escape = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** The path data of a primitive in screen coordinates; `inset` pulls a disk's rim in, for nested edges. */
function pathData(p: GraphicsPrimitive, place: Vec2, toScreen: (v: Vec2) => Vec2, pixels: number, inset = 0): string {
  if (p.head === "Disk") {
    const [x, y] = toScreen(p.center ? xy(p.center) : place);
    const r = Math.max(0.5, p.radius * pixels - inset);
    return `M${n(x + r)} ${n(y)}A${n(r)} ${n(r)} 0 1 1 ${n(x - r)} ${n(y)}A${n(r)} ${n(r)} 0 1 1 ${n(x + r)} ${n(y)}`;
  }
  if (p.head === "Line" || p.head === "Polygon") {
    const breaks = p.head === "Line" ? p.breaks : undefined;
    const d = p.points
      .map((q, k) => {
        const [x, y] = toScreen(xy(q));
        return `${k === 0 || breaks?.includes(k) ? "M" : "L"}${n(x)} ${n(y)}`;
      })
      .join("");
    return p.head === "Polygon" ? `${d}Z` : d;
  }
  if (p.head === "Polyhedron")
    return p.faces
      .map(
        (ring) =>
          ring
            .map((q, k) => {
              const [x, y] = toScreen(xy(q));
              return `${k === 0 ? "M" : "L"}${n(x)} ${n(y)}`;
            })
            .join("") + "Z",
      )
      .join("");
  return "";
}

const strokeOf = (e: Edge): string =>
  `fill="none" stroke="${escape(e.color)}" stroke-width="${n(e.width)}" stroke-opacity="${n(e.opacity)}"` +
  (e.dashing.length > 0 ? ` stroke-dasharray="${e.dashing.map(n).join(" ")}"` : "");

/** `list` drawn at `view` into a `width` by `height` SVG. */
export function svg(
  list: DisplayList,
  width: number,
  height: number,
  view: LatticeView,
  options: SvgOptions = {},
): string {
  const pixels = height / (2 * view.extent);
  const toScreen = (p: Vec2): Vec2 => [
    (p[0] - view.center[0]) * pixels + width / 2,
    height / 2 - (p[1] - view.center[1]) * pixels,
  ];
  const out: string[] = [];
  if (list.kind === "tiles") {
    const area = Math.abs(list.basis[0][0] * list.basis[1][1] - list.basis[0][1] * list.basis[1][0]);
    const fill = options.fill ?? 0.9;
    const half = (Math.sqrt(area) * pixels * fill) / 2;
    const shape = voronoiCell(list.basis).map(([x, y]) => [x * pixels * fill, -y * pixels * fill] as Vec2);
    const tile = (x: number, y: number, inset: number): string => {
      const k = half > 0 ? Math.max(0, 1 - inset / half) : 1;
      return `M${shape.map(([sx, sy]) => `${n(x + sx * k)} ${n(y + sy * k)}`).join("L")}Z`;
    };
    for (const { at, style } of list.tiles) {
      const [x, y] = toScreen(at);
      if (style.color) out.push(`<path d="${tile(x, y, 0)}" fill="${escape(style.color)}"/>`);
      let inset = 0;
      for (const e of style.edges) {
        out.push(`<path d="${tile(x, y, inset + e.width / 2)}" ${strokeOf(e)}/>`);
        inset += e.width;
      }
    }
  } else {
    const text = (at: Vec2, label: string, size: number, color: string, opacity = 1): string => {
      const [x, y] = toScreen(at);
      return `<text x="${n(x)}" y="${n(y)}" font-size="${n(size * pixels)}" fill="${escape(color)}" fill-opacity="${n(opacity)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif">${escape(label)}</text>`;
    };
    const texts: string[] = [];
    for (const { at, mark, style, caption } of list.marks) {
      if (caption)
        texts.push(text(xy(caption.at), caption.text, caption.size, options.ink ?? "#8a8a99", caption.opacity));
      if (mark.head === "Text") {
        if (style.color) texts.push(text(xy(mark.at ?? at), mark.text, mark.size, style.color));
        continue;
      }
      const d = (inset = 0): string => pathData(mark, at, toScreen, pixels, inset);
      if (style.color && mark.head === "Line")
        out.push(`<path d="${d()}" fill="none" stroke="${escape(style.color)}" stroke-width="${LINE_WIDTH}"/>`);
      else if (style.color) out.push(`<path d="${d()}" fill="${escape(style.color)}"/>`);
      let inset = 0;
      for (const e of style.edges) {
        out.push(`<path d="${d(inset + e.width / 2)}" ${strokeOf(e)}/>`);
        inset += e.width;
      }
    }
    out.push(...texts);
    for (const { mark, edges } of list.links) {
      const d = pathData(mark, [0, 0], toScreen, pixels);
      if (mark.head === "Polygon")
        out.push(`<path d="${d}" fill="${escape(edges[0]!.color)}" fill-opacity="${n(0.16 * edges[0]!.opacity)}"/>`);
      // The first rule on top: strokes run last to first.
      for (const e of edges.toReversed())
        out.push(`<path d="${d}" ${strokeOf(e)} stroke-linejoin="round" stroke-linecap="round"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" viewBox="0 0 ${n(width)} ${n(height)}">${out.join("")}</svg>`;
}
