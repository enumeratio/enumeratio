// A display list as an SVG string: the static drawer of a `GraphicsBox` (SSR, export, print), pure
// and DOM-free. It reads the same list the canvas `paint` does and applies the same geometry, so
// the two agree; only the output differs, elements in the list's order rather than batched.

import type { Edge } from "./graphics-rules.ts";
import { type LatticeView, type Vec2, voronoiCell } from "./lattice.ts";
import type { DisplayList, FramePoint, GraphicsPrimitive, TextLook } from "./tiles-canvas.ts";

export interface SvgOptions {
  /** The ink of captions. */
  readonly ink?: string;
  /** Tile size relative to its cell, as `TileDrawOptions.fill`. */
  readonly fill?: number;
  /** Round joins and caps on a mark's strokes (a plot's curves). */
  readonly rounded?: boolean;
  /** The rectangle (x, y, width, height, in px) that `clipped` marks are cut to. */
  readonly clip?: readonly [number, number, number, number];
  /** The picture's accessible name; gives the SVG `role="img"`. */
  readonly label?: string;
}

const LINE_WIDTH = 1.25;
const xy = (p: FramePoint): Vec2 => [p[0] ?? 0, p[1] ?? 0];
const n = (x: number): string => String(Math.round(x * 100) / 100);
const escape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The path data of a primitive in screen coordinates; `inset` pulls a disk's rim in, for nested edges. */
function pathData(p: GraphicsPrimitive, place: Vec2, toScreen: (v: Vec2) => Vec2, pixels: number, inset = 0): string {
  if (p.head === "Disk") {
    const [x, y] = toScreen(p.center ? xy(p.center) : place);
    const r = Math.max(0.5, p.radius * pixels - inset);
    if (p.angles && p.angles[1] - p.angles[0] < 2 * Math.PI - 1e-9) {
      // A sector: centre, out to the first ray, round the rim counterclockwise (sweep 0 on a y-down screen).
      const [a, b] = p.angles;
      const rim = (t: number): string => `${n(x + r * Math.cos(t))} ${n(y - r * Math.sin(t))}`;
      return `M${n(x)} ${n(y)}L${rim(a)}A${n(r)} ${n(r)} 0 ${b - a > Math.PI ? 1 : 0} 0 ${rim(b)}Z`;
    }
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
    const text = (at: Vec2, label: string, size: number, color: string, opacity = 1, look: TextLook = {}): string => {
      const [x, y] = toScreen(at);
      const family = look.mono ? "ui-monospace, monospace" : "system-ui, sans-serif";
      const halo = look.halo
        ? ` paint-order="stroke" stroke="${escape(look.halo)}" stroke-width="3" stroke-linejoin="round"`
        : "";
      const turn = look.angle ? ` transform="rotate(${n(-look.angle)} ${n(x)} ${n(y)})"` : "";
      return `<text x="${n(x)}" y="${n(y)}"${turn} font-size="${n(size * pixels)}" fill="${escape(color)}" fill-opacity="${n(look.opacity ?? opacity)}" text-anchor="${look.anchor ?? "middle"}"${look.anchor ? "" : ' dominant-baseline="central"'}${look.italic ? ' font-style="italic"' : ""}${halo} font-family="${family}">${escape(label)}</text>`;
    };
    const texts: string[] = [];
    const round = options.rounded ? ' stroke-linejoin="round" stroke-linecap="round"' : "";
    // Marks cut to the clip rectangle share one group, in drawing order with the others.
    let clipped: string[] | undefined;
    const emit = (isClipped: boolean | undefined, piece: string): void => {
      if (isClipped && options.clip) (clipped ??= []).push(piece);
      else {
        if (clipped) flushClipped();
        out.push(piece);
      }
    };
    const flushClipped = (): void => {
      if (!clipped || !options.clip) return;
      const [cx, cy, cw, ch] = options.clip;
      const id = `clip-${[cx, cy, cw, ch].map(n).join("-")}`;
      out.push(
        `<clipPath id="${id}"><rect x="${n(cx)}" y="${n(cy)}" width="${n(cw)}" height="${n(ch)}"/></clipPath>`,
        `<g clip-path="url(#${id})">${clipped.join("")}</g>`,
      );
      clipped = undefined;
    };
    for (const { at, mark, style, caption, clipped: cut } of list.marks) {
      if (caption)
        texts.push(text(xy(caption.at), caption.text, caption.size, options.ink ?? "#8a8a99", caption.opacity));
      if (mark.head === "Text") {
        if (style.color) texts.push(text(xy(mark.at ?? at), mark.text, mark.size, style.color, 1, mark.look));
        continue;
      }
      const d = (inset = 0): string => pathData(mark, at, toScreen, pixels, inset);
      if (style.color && mark.head === "Line")
        emit(cut, `<path d="${d()}" fill="none" stroke="${escape(style.color)}" stroke-width="${LINE_WIDTH}"/>`);
      else if (style.color)
        emit(
          cut,
          `<path d="${d()}" fill="${escape(style.color)}"${style.opacity === undefined ? "" : ` fill-opacity="${n(style.opacity)}"`}/>`,
        );
      let inset = 0;
      for (const e of style.edges) {
        emit(cut, `<path d="${d(inset + e.width / 2)}" ${strokeOf(e)}${round}/>`);
        inset += e.width;
      }
    }
    flushClipped();
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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" viewBox="0 0 ${n(width)} ${n(height)}"${options.label ? ` role="img" aria-label="${escape(options.label)}"` : ""}>${out.join("")}</svg>`;
}
