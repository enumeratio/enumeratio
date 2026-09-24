// A plot on a grid of character cells: the text surface's reading of `Plot`, for a
// terminal with no image protocol and for a pipe. Braille cells give 2×4 dots each,
// so a curve gets four times the resolution of the line height; the frame is the
// same minimal chrome the SVG plot draws -- the y extremes on the left, the x extremes
// under the axis. Pure: points in, lines out.

import type { PlotPoint } from "./plot.ts";

export interface TextPlotOptions {
  /** Character columns for the curve (default 60). */
  width?: number;
  /** Character rows for the curve (default 12). */
  height?: number;
  /** The y range to show; by default the finite points' own. */
  yRange?: [number, number];
  /** Columns held for the y labels (default 7) -- fixed, so a redraw cannot shift the frame. */
  gutter?: number;
  /** Points marked over the curve (a plot's `Epilog`, a pinned Locator), each as one `●`. */
  marks?: readonly PlotPoint[];
}

const MARK = "●";

const BRAILLE = 0x2800;
// Dot bits by (column, row) inside one cell, per the Unicode braille layout.
const DOT = [
  [0x01, 0x02, 0x04, 0x40],
  [0x08, 0x10, 0x20, 0x80],
] as const;

/** The gutter is fixed, so an axis label never moves the curve sideways as it changes. */
const GUTTER = 7;

/** A y label that fits `width` columns: three significant figures, exponential when it must. */
function label(v: number, width: number): string {
  const s = Number(v.toPrecision(3));
  const plain =
    Math.abs(s) >= 1e5 || (Math.abs(s) < 1e-3 && s !== 0) ? s.toExponential(1) : String(s);
  if (plain.length <= width) return plain;
  for (let digits = 2; digits >= 0; digits--) {
    const short = s.toExponential(digits);
    if (short.length <= width) return short;
  }
  return s.toExponential(0);
}

/** Draw `points` (ascending x) as braille lines, framed. */
export function textPlot(points: readonly PlotPoint[], opts: TextPlotOptions = {}): string {
  const width = Math.max(4, opts.width ?? 60);
  const height = Math.max(2, opts.height ?? 12);
  const finite = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (finite.length === 0) return "(nothing to plot)";
  const xs = finite.map((p) => p.x);
  const ys = finite.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const marks = (opts.marks ?? []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  // A mark off the curve's own range widens it, so it is on the page rather than lost.
  let [y0, y1] = opts.yRange ?? [
    Math.min(...ys, ...marks.map((p) => p.y)),
    Math.max(...ys, ...marks.map((p) => p.y)),
  ];
  if (y1 === y0) {
    y0 -= 1;
    y1 += 1;
  }
  const cols = width * 2;
  const rows = height * 4;
  const cells = new Uint16Array(width * height);
  const dot = (cx: number, cy: number): void => {
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return;
    const bit = DOT[cx % 2]![cy % 4]!;
    cells[Math.floor(cy / 4) * width + Math.floor(cx / 2)]! |= bit;
  };
  const toDot = (p: PlotPoint): [number, number] => [
    Math.round(((p.x - x0) / (x1 - x0 || 1)) * (cols - 1)),
    Math.round(((y1 - p.y) / (y1 - y0)) * (rows - 1)),
  ];
  // Join consecutive finite points; a gap in the data (a pole) breaks the line.
  let prev: [number, number] | undefined;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      prev = undefined;
      continue;
    }
    const cur = toDot(p);
    if (prev === undefined) dot(cur[0], cur[1]);
    else line(prev, cur, dot);
    prev = cur;
  }
  // A mark takes its whole cell, so it reads as a point and not as more curve.
  const marked = new Set<number>();
  for (const m of marks) {
    const [cx, cy] = toDot(m);
    if (cx >= 0 && cy >= 0 && cx < cols && cy < rows)
      marked.add(Math.floor(cy / 4) * width + Math.floor(cx / 2));
  }
  const gutter = Math.max(3, opts.gutter ?? GUTTER);
  const lines: string[] = [];
  for (let r = 0; r < height; r++) {
    const tag = r === 0 ? label(y1, gutter) : r === height - 1 ? label(y0, gutter) : "";
    let row = "";
    for (let c = 0; c < width; c++) {
      const i = r * width + c;
      row += marked.has(i) ? MARK : String.fromCharCode(BRAILLE + cells[i]!);
    }
    lines.push(`${tag.padStart(gutter)} │${row}`);
  }
  lines.push(`${" ".repeat(gutter)} └${"─".repeat(width)}`);
  const lo = label(x0, gutter);
  const hi = label(x1, gutter);
  lines.push(
    `${" ".repeat(gutter)}  ${lo}${" ".repeat(Math.max(1, width - lo.length - hi.length))}${hi}`,
  );
  return lines.join("\n");
}

/** Bresenham between two dot positions. */
function line(a: [number, number], b: [number, number], dot: (x: number, y: number) => void): void {
  let [x, y] = a;
  const [x2, y2] = b;
  const dx = Math.abs(x2 - x);
  const dy = -Math.abs(y2 - y);
  const sx = x < x2 ? 1 : -1;
  const sy = y < y2 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    dot(x, y);
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
