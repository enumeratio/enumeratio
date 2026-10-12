// A density plot as a `GraphicsBox` (the wiki's Speculative-Box-Primitives, §6 slice 7): a sampled
// grid in, a `RasterBox` of colored cells out, spread over the plot area. Shares contour.ts's
// `grid[j][i]` row-major convention (z at the i-th x, j-th y sample) so the two can be driven from
// the same sampling code. Cells take their color from the palette's gradient (`viridis` unless
// told otherwise); `renderPlot` draws the box.

import { type Box, type BoxNode, graphics, raster, row, tag } from "@enumeratio/boxes";
import { fieldFrame } from "./contour.ts";
import { renderPlot } from "./plot-box.ts";
import { type ColorOptions, gradientOf } from "./plot-color.ts";
import { type Gradient, sampleGradient } from "./palettes.ts";

type Grid = readonly (readonly number[])[];

/**
 * Position of `v` in `[min, max]`, clamped to `[0, 1]`. A degenerate range
 * maps everything to the middle of the ramp rather than to an endpoint.
 */
export function normalize(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return Number.NaN;
  if (!(max > min)) return 0.5;
  return Math.max(0, Math.min(1, (v - min) / (max - min)));
}

/** The color at position `t` in [0, 1] on a gradient (default `viridis`). */
export function densityColor(t: number, gradient: Gradient = gradientOf()): string {
  return sampleGradient(gradient, t);
}

export interface DensityOptions extends ColorOptions {
  width?: number;
  height?: number;
  /** Draw the axis frame with range labels (default true). */
  axes?: boolean;
  /** Draw a vertical color bar with min/max labels (default false). */
  legend?: boolean;
  /** Explicit color-scale bounds; otherwise the sampled min/max. */
  zRange?: readonly [number, number];
  xLabel?: string;
  yLabel?: string;
  title?: string;
}

/** The bands of a color bar, from the least value up. */
const BAR_BANDS = 16;

/**
 * `grid` (sampled at `xs` × `ys`) as a heatmap's `GraphicsBox` (Wolfram's `DensityPlot` /
 * `ListDensityPlot`): one cell per sample, shaded by the sequential ramp, in a `RasterBox` that
 * fills the plot area. A non-finite sample leaves its cell clear. Rows run from the least y up and
 * columns from the least x, whichever way the axes list their samples.
 */
export function densityPlotBox(
  grid: Grid,
  xs: readonly number[],
  ys: readonly number[],
  opts: DensityOptions = {},
): Box {
  const ny = grid.length;
  const nx = ny > 0 ? grid[0]!.length : 0;
  const flat = grid.flat().filter(Number.isFinite);
  const ready = nx >= 1 && ny >= 1 && xs.length >= nx && ys.length >= ny && flat.length > 0;
  const options = fieldFrame(grid, xs, ys, opts, ready);
  if (!ready) return graphics(row([]), options);

  const zmin = opts.zRange ? opts.zRange[0] : Math.min(...flat);
  const zmax = opts.zRange ? opts.zRange[1] : Math.max(...flat);
  const gradient = gradientOf(opts);
  let cells = grid.map((r) =>
    r.map((v) => {
      const t = normalize(v, zmin, zmax);
      return Number.isFinite(t) ? densityColor(t, gradient) : "";
    }),
  );
  if (ys[ny - 1]! < ys[0]!) cells = cells.toReversed();
  if (xs[nx - 1]! < xs[0]!) cells = cells.map((r) => r.toReversed());
  if (opts.legend)
    options["BarLegend"] = [
      Array.from({ length: BAR_BANDS }, (_, k) => densityColor(k / (BAR_BANDS - 1), gradient)),
      [zmin, zmax],
    ];
  const [xlo, xhi] = [Math.min(...xs.slice(0, nx)), Math.max(...xs.slice(0, nx))];
  const [ylo, yhi] = [Math.min(...ys.slice(0, ny)), Math.max(...ys.slice(0, ny))];
  return graphics(
    row([
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
    ]),
    options,
  );
}

/** `densityPlotBox` drawn: the SVG a page, a build or an export shows. */
export function densitySvg(
  grid: Grid,
  xs: readonly number[],
  ys: readonly number[],
  opts: DensityOptions = {},
): string {
  return renderPlot(densityPlotBox(grid, xs, ys, opts) as BoxNode).svg;
}
