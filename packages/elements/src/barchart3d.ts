// Pure 3-D bar-chart geometry: a matrix of heights in, projected boxes out
// (Wolfram's `BarChart3D`). Each bar is drawn as its top face plus the two side
// faces that turn toward the viewer; bars are painted back-to-front so nearer
// ones occlude farther ones. Shares project3d.ts's camera, and is a pure
// function of its inputs.

import {
  axisBoxSvg,
  camera,
  type CameraOptions,
  frameSvg,
  type ScreenPoint,
  titleSvg,
  unitScale,
} from "./project3d.ts";

const ACCENT = "var(--notatio-accent, var(--vp-c-brand-1, #d97706))";
const BG = "var(--notatio-bg, var(--vp-c-bg, #ffffff))";
const EDGE = "var(--notatio-border, var(--vp-c-divider, currentColor))";
const FG = "var(--notatio-fg, currentColor)";

const n2 = (x: number): string => String(Math.round(x * 100) / 100);

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Matrix = readonly (readonly number[])[];

/**
 * Face shading: the accent mixed into the background by height, then darkened
 * for the sides so the three visible faces of a bar read as distinct without
 * needing a light model. `face` is 1 for the top, lower for a side.
 */
export function barShade(t: number, face: number): string {
  const k = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  return `color-mix(in srgb, ${ACCENT} ${n2((24 + 58 * k) * face)}%, ${BG})`;
}

export interface BarChart3dOptions extends CameraOptions {
  /** Draw the projected axis box behind the bars (default true). */
  axes?: boolean;
  /** Gap between neighbouring bars, as a fraction of a cell (0…0.9, default 0.2). */
  gap?: number;
  /** Explicit height bounds; otherwise min(0, data) … the matrix maximum. */
  zRange?: readonly [number, number];
  /** Category labels along each axis, drawn at the near edges of the floor. */
  rowLabels?: readonly string[];
  colLabels?: readonly string[];
  title?: string;
}

interface Face {
  depth: number;
  points: string;
  fill: string;
}

/**
 * Render `matrix` as 3-D bars: `matrix[j][i]` is the height of the bar in row
 * `j`, column `i`. Each bar occupies its own cell, inset by `gap`, and runs
 * between the zero plane and its value -- so a negative bar hangs below. A
 * non-finite value, or one equal to the zero plane, draws no bar.
 *
 * Painter's algorithm twice over: bars are ordered by the view depth of their
 * base centre, and within a bar the two visible side faces are ordered before
 * the top -- enough for axis-aligned boxes on a regular grid, where no two bars
 * can interpenetrate.
 */
export function barChart3dSvg(matrix: Matrix, opts: BarChart3dOptions = {}): string {
  const cam = camera(opts);
  const aria = "3-D bar chart";
  const ny = matrix.length;
  const nx = ny > 0 ? matrix[0].length : 0;
  if (nx < 1 || ny < 1)
    return frameSvg(cam.width, cam.height, aria, titleSvg(cam.width, opts.title));

  const flat = matrix.flat().filter(Number.isFinite);
  if (flat.length === 0)
    return frameSvg(cam.width, cam.height, aria, titleSvg(cam.width, opts.title));
  const zlo = opts.zRange ? opts.zRange[0] : Math.min(0, ...flat);
  const zhi = opts.zRange ? opts.zRange[1] : Math.max(...flat);
  const sz = unitScale(zlo, zhi === zlo ? zlo + 1 : zhi);

  const gap = Math.max(0, Math.min(0.9, opts.gap ?? 0.2));
  const cw = 1 / nx;
  const ch = 1 / ny;
  const inset = gap / 2;

  const faces: Face[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const h = matrix[j][i];
      if (!Number.isFinite(h)) continue;
      // Bars stand on z = 0 where the data straddles it, and hang below it
      // when the value is negative -- as Wolfram's bars do about the axis.
      const zero = sz(Math.max(zlo, Math.min(zhi, 0)));
      const value = sz(h);
      const top = Math.max(zero, value);
      const base = Math.min(zero, value);
      if (top === base) continue;

      const x0 = (i + inset) * cw;
      const x1 = (i + 1 - inset) * cw;
      const y0 = (j + inset) * ch;
      const y1 = (j + 1 - inset) * ch;
      const t = value;

      // The four upright corners, bottom and top.
      const corners: [number, number][] = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ];
      const lo = corners.map(([x, y]) => cam.at(x, y, base));
      const hi = corners.map(([x, y]) => cam.at(x, y, top));

      const poly = (ps: ScreenPoint[]): string => ps.map((p) => `${n2(p.x)},${n2(p.y)}`).join(" ");
      const centreDepth = (ps: ScreenPoint[]): number =>
        ps.reduce((sum, p) => sum + p.depth, 0) / ps.length;

      // The four sides, of which only the two facing the viewer are drawn --
      // the back pair is always hidden behind the bar's own top and sides.
      const sides = [0, 1, 2, 3].map((k) => {
        const m = (k + 1) % 4;
        return [lo[k], lo[m], hi[m], hi[k]];
      });
      const visible = [...sides]
        .sort((a, b) => centreDepth(b) - centreDepth(a))
        .slice(0, 2)
        .sort((a, b) => centreDepth(a) - centreDepth(b));

      const barDepth = centreDepth(lo);
      // Sides first, top last: the top can never be occluded by its own bar.
      for (const s of visible)
        faces.push({ depth: barDepth - 0.001, points: poly(s), fill: barShade(t, 0.72) });
      faces.push({ depth: barDepth, points: poly(hi), fill: barShade(t, 1) });
    }
  }
  faces.sort((a, b) => a.depth - b.depth);

  const bars = faces
    .map(
      (f) =>
        `<polygon points="${f.points}" fill="${f.fill}" stroke="${EDGE}" stroke-width="0.5" stroke-linejoin="round"/>`,
    )
    .join("");

  let chrome = opts.axes === false ? "" : axisBoxSvg(cam, { zEnd: zhi });

  // Category labels sit just outside the floor, on the two near edges.
  const text = (p: ScreenPoint, anchor: string, s: string): string =>
    `<text x="${n2(p.x)}" y="${n2(p.y)}" text-anchor="${anchor}" font-size="9" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.7">${esc(s)}</text>`;
  if (opts.colLabels)
    for (let i = 0; i < Math.min(nx, opts.colLabels.length); i++)
      chrome += text(cam.at((i + 0.5) * cw, 1.06, 0), "middle", opts.colLabels[i]);
  if (opts.rowLabels)
    for (let j = 0; j < Math.min(ny, opts.rowLabels.length); j++)
      chrome += text(cam.at(1.06, (j + 0.5) * ch, 0), "start", opts.rowLabels[j]);

  return frameSvg(cam.width, cam.height, aria, chrome + bars + titleSvg(cam.width, opts.title));
}
