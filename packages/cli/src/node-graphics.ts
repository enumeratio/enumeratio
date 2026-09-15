// Node-side rendering of the core's structured graphics: turn a Graphic into an
// SVG (via the pure @enumeratio/elements renderers), write it to a temp file, and
// — on a graphics-capable terminal — rasterize to PNG and show it inline. This
// module is Node-only; the browser terminal draws the same Graphic itself.

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rasterize } from "@enumeratio/raster";
// Pure renderers from the sibling package's source (no DOM, no build step).
import { renderGlyph } from "../../elements/src/glyphs.ts";
import { linePlotSvg } from "../../elements/src/plot.ts";
import type { Graphic } from "./core.ts";

/** Draw a core Graphic as an SVG string. */
export function graphicToSvg(g: Graphic): string {
  return g.kind === "plot" ? linePlotSvg(g.points) : renderGlyph(g.glyph, g.values);
}

export function graphicLabel(g: Graphic): string {
  return g.kind === "plot" ? "plot" : g.glyph;
}

/** Write an SVG under the temp dir and return the absolute path. */
export function writeSvg(label: string, svg: string): string {
  const file = join(tmpdir(), `notatio-${label}-${Date.now()}.svg`);
  writeFileSync(file, svg, "utf8");
  return file;
}

type ImageProtocol = "iterm" | "kitty";

/** Which inline-image protocol this terminal speaks, if any (TTY only). */
function detectProtocol(): ImageProtocol | null {
  if (!process.stdout.isTTY) return null;
  const env = process.env;
  if (env.TERM?.includes("kitty") || env.KITTY_WINDOW_ID) return "kitty";
  if (
    env.TERM_PROGRAM === "iTerm.app" ||
    env.TERM_PROGRAM === "WezTerm" ||
    env.LC_TERMINAL === "iTerm2"
  )
    return "iterm";
  return null;
}

/** iTerm2/WezTerm OSC 1337 inline image. */
function itermImage(name: string, png: Uint8Array): string {
  const data = Buffer.from(png).toString("base64");
  const b64name = Buffer.from(name).toString("base64");
  return `\x1b]1337;File=name=${b64name};size=${png.length};inline=1:${data}\x07`;
}

/** kitty graphics protocol: base64 PNG in <=4096-char APC chunks. */
function kittyImage(png: Uint8Array): string {
  const b64 = Buffer.from(png).toString("base64");
  const CHUNK = 4096;
  let out = "";
  for (let i = 0; i < b64.length; i += CHUNK) {
    const more = i + CHUNK < b64.length ? 1 : 0;
    const ctrl = i === 0 ? `a=T,f=100,m=${more}` : `m=${more}`;
    out += `\x1b_G${ctrl};${b64.slice(i, i + CHUNK)}\x1b\\`;
  }
  return out;
}

/** Inline-image escape for `svg` (rasterized to PNG), or null if unsupported. */
export function inlineImage(name: string, svg: string): string | null {
  const protocol = detectProtocol();
  if (!protocol) return null;
  let png: Uint8Array;
  try {
    png = rasterize(svg);
  } catch {
    return null; // rasterization failed -- fall back to the file path
  }
  return protocol === "kitty" ? kittyImage(png) : itermImage(name, png);
}
