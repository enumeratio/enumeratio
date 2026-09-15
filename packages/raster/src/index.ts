// Rasterize an SVG string to a PNG -- the Node-side analogue of Wolfram's
// `Rasterize[graphic]`. resvg renders statically (no DOM, no browser), but it
// does not resolve CSS custom properties, so `flattenCss` first collapses the
// themeable `var(--x, fallback)` / `currentColor` the renderers emit down to
// concrete colours. The result is a self-contained bitmap that reads on any
// terminal or file viewer.

import { Resvg } from "@resvg/resvg-js";

export interface FlattenOptions {
  /** Colour substituted for `currentColor` and valueless `var()` (default dark). */
  color?: string;
}

/** Collapse CSS custom properties to their literal fallbacks for a static renderer. */
export function flattenCss(svg: string, opts: FlattenOptions = {}): string {
  const color = opts.color ?? "#1f2937";
  // Resolve `var(--name, fallback)` innermost-first (a fallback with no comma or
  // parens is innermost); repeat until the nesting is gone.
  const VAR = /var\(\s*--[\w-]+\s*,\s*([^,()]+)\)/g;
  let out = svg;
  let prev: string;
  do {
    prev = out;
    out = out.replace(VAR, (_m, fallback: string) => fallback.trim());
  } while (out !== prev);
  // Anything left (a var with no fallback, or currentColor) becomes `color`.
  return out.replace(/var\(\s*--[\w-]+\s*\)/g, color).replace(/currentColor/g, color);
}

export interface RasterizeOptions extends FlattenOptions {
  /** Render at this pixel width (overrides `scale`). */
  width?: number;
  /** Uniform zoom over the SVG's intrinsic size (default 2, for crisp output). */
  scale?: number;
  /** CSS colour behind the image (default opaque white, so dark strokes read). */
  background?: string;
}

/** Rasterize `svg` to PNG bytes. Wolfram's `Rasterize`. */
export function rasterize(svg: string, opts: RasterizeOptions = {}): Uint8Array {
  const resvg = new Resvg(flattenCss(svg, opts), {
    background: opts.background ?? "#ffffff",
    fitTo: opts.width
      ? { mode: "width", value: opts.width }
      : { mode: "zoom", value: opts.scale ?? 2 },
  });
  return resvg.render().asPng();
}

/** Rasterize to a `data:image/png;base64,…` URI. */
export function rasterizeToDataUri(svg: string, opts?: RasterizeOptions): string {
  return `data:image/png;base64,${Buffer.from(rasterize(svg, opts)).toString("base64")}`;
}
