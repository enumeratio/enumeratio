// Pure contour-plot geometry, mirroring plot.ts/chart.ts's shape: a sampled
// grid of z-values in, iso-lines (or filled bands) out as an SVG string. The
// marching-squares core (`marchingSquares`) is dependency-free and unit-tested
// on its own; the element layer (notatio-contour-plot) does the compute-engine
// grid sampling. `grid[j][i]` is z at the (i-th x, j-th y) sample -- the same
// row-major convention as plot3d.ts's height grids.

import { niceTicks } from "./plot.ts";

const ACCENT = "var(--notatio-accent, var(--vp-c-brand-1, #d97706))";
const AXIS = "var(--notatio-border, var(--vp-c-divider, currentColor))";
const FG = "var(--notatio-fg, currentColor)";
// Same ramp base as chart.ts's ArrayPlot heatmap, for filled bands.
const RAMP_LO = "var(--notatio-series-2, #2f7ed8)";

const n2 = (x: number): string => String(Math.round(x * 100) / 100);

/** A tiny deterministic string hash (FNV-1a), for a clip-path id that's a pure
 * function of the render inputs rather than `Math.random`. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function label(x: number): string {
  if (!Number.isFinite(x)) return "";
  if (x === 0) return "0";
  const abs = Math.abs(x);
  return abs >= 1000 || abs < 0.01 ? x.toExponential(1) : String(Math.round(x * 100) / 100);
}

export interface ContourPoint {
  x: number;
  y: number;
}

export type ContourSegment = readonly [ContourPoint, ContourPoint];

type Grid = readonly (readonly number[])[];

/** Linear interpolation of the level crossing between two corner samples. */
function crossing(level: number, pa: ContourPoint, va: number, pb: ContourPoint, vb: number): ContourPoint {
  const t = va === vb ? 0.5 : (level - va) / (vb - va);
  return { x: pa.x + t * (pb.x - pa.x), y: pa.y + t * (pb.y - pa.y) };
}

/**
 * Extract the iso-line segments of `grid` at `level` via marching squares.
 * `xs` / `ys` give each column/row's data-space coordinate (length must match
 * the grid's column/row count). A cell touching a non-finite sample is
 * skipped. The classic 16-case table, with the two saddle cases (5 and 10)
 * resolved by comparing the cell's mean value to `level` -- deterministic and
 * side-effect-free, so the same grid always yields the same segments.
 */
export function marchingSquares(
  grid: Grid,
  xs: readonly number[],
  ys: readonly number[],
  level: number,
): ContourSegment[] {
  const ny = grid.length;
  const nx = ny > 0 ? grid[0].length : 0;
  if (nx < 2 || ny < 2 || xs.length < nx || ys.length < ny) return [];

  const segments: ContourSegment[] = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const vTL = grid[j][i];
      const vTR = grid[j][i + 1];
      const vBR = grid[j + 1][i + 1];
      const vBL = grid[j + 1][i];
      if (![vTL, vTR, vBR, vBL].every(Number.isFinite)) continue;

      const pTL: ContourPoint = { x: xs[i], y: ys[j] };
      const pTR: ContourPoint = { x: xs[i + 1], y: ys[j] };
      const pBR: ContourPoint = { x: xs[i + 1], y: ys[j + 1] };
      const pBL: ContourPoint = { x: xs[i], y: ys[j + 1] };

      const bTL = vTL >= level ? 8 : 0;
      const bTR = vTR >= level ? 4 : 0;
      const bBR = vBR >= level ? 2 : 0;
      const bBL = vBL >= level ? 1 : 0;
      const idx = bTL | bTR | bBR | bBL;
      if (idx === 0 || idx === 15) continue;

      // Edge crossings, computed lazily (only the ones a case needs).
      const N = () => crossing(level, pTL, vTL, pTR, vTR);
      const E = () => crossing(level, pTR, vTR, pBR, vBR);
      const S = () => crossing(level, pBL, vBL, pBR, vBR);
      const W = () => crossing(level, pTL, vTL, pBL, vBL);

      const push = (a: ContourPoint, b: ContourPoint): void => {
        segments.push([a, b]);
      };

      switch (idx) {
        case 1:
          push(W(), S());
          break;
        case 2:
          push(S(), E());
          break;
        case 3:
          push(W(), E());
          break;
        case 4:
          push(N(), E());
          break;
        case 6:
          push(N(), S());
          break;
        case 7:
          push(N(), W());
          break;
        case 8:
          push(N(), W());
          break;
        case 9:
          push(N(), S());
          break;
        case 11:
          push(N(), E());
          break;
        case 12:
          push(W(), E());
          break;
        case 13:
          push(S(), E());
          break;
        case 14:
          push(W(), S());
          break;
        case 5: {
          // Saddle: TR & BL above, TL & BR below. Resolve via the cell mean.
          const mean = (vTL + vTR + vBR + vBL) / 4;
          if (mean >= level) {
            push(N(), E());
            push(W(), S());
          } else {
            push(N(), W());
            push(S(), E());
          }
          break;
        }
        case 10: {
          // Saddle: TL & BR above, TR & BL below.
          const mean = (vTL + vTR + vBR + vBL) / 4;
          if (mean >= level) {
            push(N(), W());
            push(S(), E());
          } else {
            push(N(), E());
            push(W(), S());
          }
          break;
        }
        default:
          break;
      }
    }
  }
  return segments;
}

/**
 * ~`count` evenly spaced "nice" levels strictly inside `[min, max]` (Wolfram
 * picks levels between the extremes, never exactly at them -- a contour at the
 * sampled min/max would bound nothing). Falls back to a plain even split when
 * `niceTicks` can't land enough ticks inside the interval.
 */
export function autoLevels(min: number, max: number, count = 8): number[] {
  if (!(max > min) || !Number.isFinite(min) || !Number.isFinite(max)) return [];
  const nice = niceTicks(min, max, count).filter((v) => v > min && v < max);
  if (nice.length >= Math.min(3, count)) return nice;
  const n = Math.max(1, Math.round(count));
  const step = (max - min) / (n + 1);
  return Array.from({ length: n }, (_, k) => min + step * (k + 1));
}

export interface ContourOptions {
  width?: number;
  height?: number;
  /** Draw the axis frame with range labels (default true). */
  axes?: boolean;
  /** Explicit contour levels; overrides the automatic ones. */
  levels?: readonly number[];
  /** Auto level count, used when `levels` isn't given (default 8). */
  count?: number;
  /** Shade the bands between levels with a sequential ramp (default: line contours). */
  filled?: boolean;
  xLabel?: string;
  yLabel?: string;
  title?: string;
}

const frame = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="contour plot">${body}</svg>`;

/**
 * Render `grid` (sampled at `xs` × `ys`) as a contour plot: iso-lines at
 * evenly spaced (or explicit) levels, or -- with `filled` -- shaded bands
 * between them. Pure function of its inputs: same grid in, byte-identical SVG
 * out, so it renders deterministically under SSR.
 */
export function contourSvg(
  grid: Grid,
  xs: readonly number[],
  ys: readonly number[],
  opts: ContourOptions = {},
): string {
  const W = opts.width ?? 340;
  const H = opts.height ?? 200;
  const mL = 38;
  const mR = 10;
  const mT = opts.title ? 26 : 12;
  const mB = 22;
  const showAxes = opts.axes !== false;

  const ny = grid.length;
  const nx = ny > 0 ? grid[0].length : 0;
  if (nx < 2 || ny < 2 || xs.length < nx || ys.length < ny) return frame(W, H, titleSvg(W, opts.title));

  const flat = grid.flat().filter(Number.isFinite);
  if (flat.length === 0) return frame(W, H, titleSvg(W, opts.title));

  const zmin = Math.min(...flat);
  const zmax = Math.max(...flat);
  const levels =
    opts.levels && opts.levels.length > 0
      ? [...opts.levels].sort((a, b) => a - b)
      : autoLevels(zmin, zmax, opts.count ?? 8);

  const xlo = Math.min(...xs.slice(0, nx));
  const xhi = Math.max(...xs.slice(0, nx));
  const ylo = Math.min(...ys.slice(0, ny));
  const yhi = Math.max(...ys.slice(0, ny));

  const plotW = W - mL - mR;
  const plotH = H - mT - mB;
  const sx = (x: number): number => mL + ((x - xlo) / (xhi - xlo || 1)) * plotW;
  const syT = (y: number): number => mT + ((yhi - y) / (yhi - ylo || 1)) * plotH;

  let bands = "";
  if (opts.filled && zmax > zmin) {
    const numBands = levels.length + 1;
    const ramp = (t: number): string =>
      `color-mix(in srgb, ${ACCENT} ${n2(Math.max(0, Math.min(1, t)) * 100)}%, ${RAMP_LO})`;
    const cw = plotW / (nx - 1);
    const ch = plotH / (ny - 1);
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const corners = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]];
        if (!corners.every(Number.isFinite)) continue;
        const mean = corners.reduce((a, b) => a + b, 0) / 4;
        let band = 0;
        for (const lv of levels) if (mean >= lv) band++;
        const t = numBands > 1 ? band / (numBands - 1) : 0.5;
        const x = mL + i * cw;
        const y = mT + j * ch;
        bands += `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(cw + 0.5)}" height="${n2(ch + 0.5)}" fill="${ramp(t)}"/>`;
      }
    }
  }

  // One <path> per level, its subpaths the level's marching-squares segments.
  let lines = "";
  if (!opts.filled) {
    for (const lv of levels) {
      const segs = marchingSquares(grid, xs.slice(0, nx), ys.slice(0, ny), lv);
      if (segs.length === 0) continue;
      const d = segs.map(([a, b]) => `M${n2(sx(a.x))},${n2(syT(a.y))} L${n2(sx(b.x))},${n2(syT(b.y))}`).join(" ");
      lines += `<path d="${d}" fill="none" stroke="${ACCENT}" stroke-width="1.3" stroke-linecap="round" opacity="0.85"/>`;
    }
  }

  let chrome = "";
  if (showAxes) {
    chrome += `<rect x="${n2(mL)}" y="${n2(mT)}" width="${n2(plotW)}" height="${n2(plotH)}" fill="none" stroke="${AXIS}" stroke-width="1" opacity="0.5"/>`;
    const text = (x: number, y: number, anchor: string, s: string): string =>
      `<text x="${n2(x)}" y="${n2(y)}" text-anchor="${anchor}" font-size="10" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.6">${s}</text>`;
    chrome +=
      text(mL, H - 6, "start", label(xlo)) +
      text(W - mR, H - 6, "end", label(xhi)) +
      text(mL - 4, mT + 6, "end", label(yhi)) +
      text(mL - 4, H - mB, "end", label(ylo));
    if (opts.xLabel)
      chrome += `<text x="${n2(W - mR)}" y="${n2(mT + 10)}" text-anchor="end" font-size="10" font-style="italic" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.75">${esc(opts.xLabel)}</text>`;
    if (opts.yLabel)
      chrome += `<text x="${n2(mL + 4)}" y="${n2(mT + 10)}" text-anchor="start" font-size="10" font-style="italic" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.75">${esc(opts.yLabel)}</text>`;
  }

  // A deterministic id (not Math.random -- the whole pipeline must be a pure
  // function of its inputs for SSR to render byte-identical output), unique
  // enough to not collide with a sibling contour plot on the same page.
  const clipId = `ncontour-${fnv1a(`${nx}x${ny}:${levels.join(",")}:${opts.filled ? 1 : 0}:${xlo},${xhi},${ylo},${yhi}`)}`;
  const clip = `<clipPath id="${clipId}"><rect x="${n2(mL)}" y="${n2(mT)}" width="${n2(plotW)}" height="${n2(plotH)}"/></clipPath>`;
  const clipped = `<g clip-path="url(#${clipId})">${bands}${lines}</g>`;

  return frame(W, H, clip + clipped + chrome + titleSvg(W, opts.title));
}

function titleSvg(w: number, title: string | undefined): string {
  return title
    ? `<text x="${n2(w / 2)}" y="14" text-anchor="middle" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="${FG}">${esc(title)}</text>`
    : "";
}
