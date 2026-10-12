// The plots, charts and figures in space as `makeBoxes` rules (the wiki's Speculative-Box-Primitives, §6 slice 4).
// A plot of data is a finite list and lowers whole; so does a chart. A plot of an expression is a
// producer, like a lattice: sampling needs a compiled kernel (the page's, or a session's), so the
// box holds the expression it came from and `Producer -> head`, and an environment that can sample
// asks for the marks (`plotBoxOfSamples`). Not in `/core`: reading an expression's options needs the
// engine's parser.

import type { Notation, NotationRule } from "@enumeratio/boxes";
import { diagramBoxOf } from "./diagram-lowering.ts";
import { plainJson } from "./graphics-rules.ts";
import { plotBox } from "./plot-box.ts";
import {
  CHART_HEADS,
  chartBoxOfSettings,
  FIELD_PLOT_HEADS,
  fieldBoxOfData,
  PLOT_HEADS,
  plotDataSeries,
  plotOptionsOf,
  polarPointsOf,
  spanOf,
  unsampledBox,
} from "./plot-lowering.ts";
import { polarPlotBox } from "./polarplot.ts";
import { FIGURE_NOTATION } from "./show-box.ts";
import { barBoxOfSettings, GRAPHICS_3D_HEADS, listBoxOfSettings, literalCurveBox } from "./graphics-3d-lowering.ts";
import { unsampledGraphics3dBox } from "./graphics-3d-box.ts";
import { complexPlotOptionsOf, unsampledComplexPlotBox } from "./complex-plot-box.ts";
import { complexPlot3dSettingsOf, complexPlotSettingsOf, plotSettingsOf, graphics3dSettingsOf } from "./symbols.ts";

const plotRule =
  (head: string): NotationRule =>
  (args) => {
    const expr = plainJson([head, ...args] as never);
    const settings = plotSettingsOf(expr as never);
    if (settings === undefined) return undefined;
    const diagram = diagramBoxOf(settings);
    if (diagram !== undefined) return diagram;
    if (head === "ListPolarPlot") {
      const [t0, t1] = spanOf(settings["trange"]) ?? [0, 2 * Math.PI];
      let data: unknown;
      try {
        data = JSON.parse(settings["data"] ?? "null");
      } catch {
        data = undefined;
      }
      const points = polarPointsOf(data, t0, t1);
      return polarPlotBox(points ?? [], { markers: true });
    }
    if (FIELD_PLOT_HEADS.includes(head)) return fieldBoxOfData(head, settings) ?? unsampledBox(head, expr);
    const series = plotDataSeries(settings);
    return series === undefined ? unsampledBox(head, expr) : plotBox(series, plotOptionsOf(settings));
  };

/**
 * A chart head's rule. `Chart` may choose a plot (`ListPlot`'s) for the data it is given. An
 * `ArrayPlot` of anything but a matrix is a `Show`'s layer (a table), which the figure rule lowers.
 */
const chartRule =
  (head: string): NotationRule =>
  (args, ...rest) => {
    const settings = plotSettingsOf(plainJson([head, ...args] as never) as never);
    if (settings === undefined) return undefined;
    const chart = chartBoxOfSettings(settings);
    if (chart !== undefined) return chart;
    const series = plotDataSeries(settings);
    if (series !== undefined) return plotBox(series, plotOptionsOf(settings));
    return head === "ArrayPlot" ? FIGURE_NOTATION["ArrayPlot"]?.(args, ...rest) : undefined;
  };

/**
 * A figure in space's rule: `ListPlot3D` and `BarChart3D` hold their data and lower whole; a `Plot3D`
 * or a curve is sampled by the page, so its box holds the expression it came from.
 */
const graphics3dRule =
  (head: string): NotationRule =>
  (args) => {
    const expr = plainJson([head, ...args] as never);
    const settings = graphics3dSettingsOf(expr as never);
    if (settings === undefined) return undefined;
    if (head === "ListPlot3D") return listBoxOfSettings(settings);
    if (head === "BarChart3D") return barBoxOfSettings(settings);
    return (head === "Graphics3D" ? literalCurveBox(settings) : undefined) ?? unsampledGraphics3dBox(head, expr);
  };

/**
 * `ComplexPlot`'s rule: a raster whose producer is a shader on the web and `complex-eval.ts` anywhere
 * else, so the box holds the expression it came from and the frame it is drawn in.
 */
const complexPlotRule: NotationRule = (args) => {
  const expr = plainJson(["ComplexPlot", ...args] as never);
  const settings = complexPlotSettingsOf(expr as never);
  return settings === undefined ? undefined : unsampledComplexPlotBox(expr, complexPlotOptionsOf(settings));
};

/** `ComplexPlot3D`'s rule: a surface sampled by the page's shader or by `complex-eval.ts`, so the box holds the expression. */
const complexPlot3dRule: NotationRule = (args) => {
  const expr = plainJson(["ComplexPlot3D", ...args] as never);
  return complexPlot3dSettingsOf(expr as never) === undefined
    ? undefined
    : unsampledGraphics3dBox("ComplexPlot3D", expr);
};

/** The plot and chart heads as `makeBoxes` rules. */
export const PLOT_NOTATION: Notation = {
  ComplexPlot: complexPlotRule,
  ComplexPlot3D: complexPlot3dRule,
  ...Object.fromEntries(PLOT_HEADS.map((head) => [head, plotRule(head)])),
  ...Object.fromEntries(CHART_HEADS.map((head) => [head, chartRule(head)])),
  ...Object.fromEntries(GRAPHICS_3D_HEADS.map((head) => [head, graphics3dRule(head)])),
};
