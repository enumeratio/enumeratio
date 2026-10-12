// Contour plots as a `GraphicsBox` (the wiki's Speculative-Box-Primitives, §6 slice 7): a sampled
// grid of z-values in, iso-lines (a `LineBox` per level) or filled bands (a `RasterBox`) in data
// coordinates out, with the frame as options. The marching-squares core (`marchingSquares`) is
// dependency-free and unit-tested on its own; the element layer (`plot-view.ts`) does the
// compute-engine grid sampling, and `renderPlot` draws the box. `grid[j][i]` is z at the (i-th x,
// j-th y) sample -- the same row-major convention as plot3d.ts's height grids.

import { type Box, type BoxNode, graphics, line, type OptionValue, raster, row, style, tag } from "@enumeratio/boxes";
import { niceTicks } from "./plot.ts";
import { renderPlot } from "./plot-box.ts";
import { type ColorOptions, plotPalette, rampColor } from "./plot-color.ts";

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

/** Color: filled bands and iso-lines take the gradient by level (`viridis` unless told otherwise). */
export interface ContourOptions extends ColorOptions {
  width?: number;
  height?: number;
  /** Draw the axis frame with range labels (default true). */
  axes?: boolean;
  /** Explicit contour levels; overrides the automatic ones. */
  levels?: readonly number[];
  /** Auto level count, used when `levels` isn't given (default 8). */
  count?: number;
  /** Shade the bands between levels along the gradient (default: line contours). */
  filled?: boolean;
  xLabel?: string;
  yLabel?: string;
  title?: string;
}

const LINE_WIDTH = 1.3;
const LINE_OPACITY = 0.85;

/** The frame of a field plot (`ContourPlot`, `DensityPlot`): a frame with the range at its corners, no zero axes. */
export function fieldFrame(
  grid: Grid,
  xs: readonly number[],
  ys: readonly number[],
  opts: { width?: number; height?: number; axes?: boolean; xLabel?: string; yLabel?: string; title?: string },
  ready: boolean,
): Record<string, OptionValue> {
  const nx = grid[0]?.length ?? 0;
  const ny = grid.length;
  const options: Record<string, OptionValue> = {
    ImageSize: [opts.width ?? 340, opts.height ?? 200],
    Axes: false,
    Frame: opts.axes !== false,
    ScalingFunctions: ["linear", "linear"],
    ViewKind: "fixed",
    ...((opts.xLabel || opts.yLabel) && { AxesLabel: [opts.xLabel ?? null, opts.yLabel ?? null] }),
    ...(opts.title && { PlotLabel: opts.title }),
  };
  if (ready)
    options["PlotRange"] = [
      [Math.min(...xs.slice(0, nx)), Math.max(...xs.slice(0, nx))],
      [Math.min(...ys.slice(0, ny)), Math.max(...ys.slice(0, ny))],
    ];
  return options;
}

/**
 * `grid` (sampled at `xs` × `ys`) as a contour plot's `GraphicsBox`: iso-lines at evenly spaced (or
 * explicit) levels, a `LineBox` each, or -- with `filled` -- the bands between them as a
 * `RasterBox`, one cell per grid cell colored by its mean. A pure function of its inputs: same grid
 * in, same box out, so it draws deterministically under SSR.
 */
export function contourPlotBox(
  grid: Grid,
  xs: readonly number[],
  ys: readonly number[],
  opts: ContourOptions = {},
): Box {
  const ny = grid.length;
  const nx = ny > 0 ? grid[0]!.length : 0;
  const flat = grid.flat().filter(Number.isFinite);
  const ready = nx >= 2 && ny >= 2 && xs.length >= nx && ys.length >= ny && flat.length > 0;
  const options = fieldFrame(grid, xs, ys, opts, ready);
  if (!ready) return graphics(row([]), options);

  const zmin = Math.min(...flat);
  const zmax = Math.max(...flat);
  const levels =
    opts.levels && opts.levels.length > 0
      ? [...opts.levels].toSorted((a, b) => a - b)
      : autoLevels(zmin, zmax, opts.count ?? 8);
  const palette = plotPalette(opts);
  const [xlo, xhi] = [Math.min(...xs.slice(0, nx)), Math.max(...xs.slice(0, nx))];
  const [ylo, yhi] = [Math.min(...ys.slice(0, ny)), Math.max(...ys.slice(0, ny))];
  const marks: Box[] = [];

  if (opts.filled) {
    if (zmax > zmin) {
      const bands = levels.length + 1;
      // Rows run from the least y up, columns from the least x: a descending axis is turned round.
      let cells = Array.from({ length: ny - 1 }, (_, j) =>
        Array.from({ length: nx - 1 }, (_, i) => {
          const corners = [grid[j]![i]!, grid[j]![i + 1]!, grid[j + 1]![i + 1]!, grid[j + 1]![i]!];
          if (!corners.every(Number.isFinite)) return "";
          const mean = corners.reduce((a, b) => a + b, 0) / 4;
          const band = levels.reduce((k, level) => (mean >= level ? k + 1 : k), 0);
          return rampColor(palette, bands > 1 ? band / (bands - 1) : 0.5);
        }),
      );
      if (ys[ny - 1]! < ys[0]!) cells = cells.toReversed();
      if (xs[nx - 1]! < xs[0]!) cells = cells.map((r) => r.toReversed());
      marks.push(
        tag(
          raster({
            Colors: cells,
            DataRange: [
              [xlo, xhi],
              [ylo, yhi],
            ],
          }),
          "Raster",
        ),
      );
    }
  } else {
    // One `LineBox` per level, its segments disjoint: the pen lifts at each pair of points.
    for (const level of levels) {
      const segments = marchingSquares(grid, xs.slice(0, nx), ys.slice(0, ny), level);
      if (segments.length === 0) continue;
      const color = rampColor(palette, (level - zmin) / (zmax - zmin || 1));
      marks.push(
        style(
          tag(
            line({
              Points: segments.flatMap(([a, b]) => [
                [a.x, a.y],
                [b.x, b.y],
              ]),
              Breaks: segments.map((_, k) => 2 * k).filter((k) => k > 0),
            }),
            "Series",
          ),
          { EdgeForm: [[color, LINE_WIDTH, LINE_OPACITY, []]] },
        ),
      );
    }
  }
  return graphics(row(marks), options);
}

/** `contourPlotBox` drawn: the SVG a page, a build or an export shows. */
export function contourSvg(
  grid: Grid,
  xs: readonly number[],
  ys: readonly number[],
  opts: ContourOptions = {},
): string {
  return renderPlot(contourPlotBox(grid, xs, ys, opts) as BoxNode).svg;
}
