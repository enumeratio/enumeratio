// The 2-D plots as `makeBoxes` rules (the wiki's Speculative-Box-Primitives, §6 slice 4): a plot
// returns `Graphics`, so `Plot`, `ListPlot` and the rest lower to a `GraphicsBox`.
//
// A plot of data is a finite list and lowers whole. A plot of an expression is a producer, like a
// lattice: sampling needs a compiled kernel (the page's, or a session's), so the box holds the
// expression it came from (an `InterpretationBox`) and `Producer -> head`, and an environment that
// can sample asks for the marks (`plotBoxOfSamples`). Sampling stays with that environment.

import { type Box, type BoxNode, graphics, interpretation, row } from "@enumeratio/boxes";
import { isNumber } from "./chart.ts";
import { type PlotOptions, type PlotPoint, type PlotSeries, plotBox } from "./plot-box.ts";
import type { Primitive } from "./primitives.ts";
import type { PolarPoint } from "./polarplot.ts";

/** The heads whose plots are `GraphicsBox`es, drawn by `<graphics-box>`. */
export const PLOT_HEADS: readonly string[] = [
  "Plot",
  "ParametricPlot",
  "PolarPlot",
  "ListPolarPlot",
  "ListPlot",
  "ListLinePlot",
];

/** Plot settings, the attributes an expression's options lower to (`plotSettingsOf`). */
export type PlotSettings = Readonly<Record<string, string>>;

/** `data` (a number list: index against value; pairs; or `{x, y}`) as points. */
export function pointsOfData(data: unknown): PlotPoint[] {
  if (!Array.isArray(data)) return [];
  if (data.every(isNumber)) return data.map((y, x) => ({ x, y }));
  if (data.every((e) => Array.isArray(e) && e.length === 2 && e.every(isNumber)))
    return (data as [number, number][]).map(([x, y]) => ({ x, y }));
  if (data.every((e) => e && typeof e === "object" && isNumber((e as PlotPoint).x) && isNumber((e as PlotPoint).y)))
    return data as PlotPoint[];
  return [];
}

const on = (v: string | undefined): boolean => v !== undefined && v !== "false";

/** `lo,hi` as a pair of finite numbers, else undefined. */
export function spanOf(text: string | undefined): [number, number] | undefined {
  const [a, b] = (text ?? "").split(",").map((s) => Number(s.trim()));
  return Number.isFinite(a) && Number.isFinite(b) ? [a!, b!] : undefined;
}

/** What a plot's settings say about how to draw it: the chrome, the scales, the colors. */
export function plotOptionsOf(
  settings: PlotSettings,
  extra: { epilog?: readonly Primitive[]; prolog?: readonly Primitive[]; hover?: number } = {},
): PlotOptions {
  return {
    axes: settings["axes"] !== "false",
    xScale: settings["x-scale"],
    yScale: settings["y-scale"],
    plotRange: spanOf(settings["plot-range"]),
    gridLines: on(settings["grid"]),
    fill: on(settings["fill"]),
    legend: on(settings["legend"]),
    xLabel: settings["x-label"] || undefined,
    yLabel: settings["y-label"] || undefined,
    title: settings["label"] || undefined,
    colorBy: settings["color-by"] === "x" ? "x" : settings["color-by"] === "y" ? "y" : undefined,
    gradient: settings["gradient"],
    discrete: settings["discrete"],
    reverse: on(settings["reverse"]),
    ...extra,
  };
}

/** The series of a plot of data (`ListPlot`, `ListLinePlot`); undefined for a plot of an expression. */
export function plotDataSeries(settings: PlotSettings): PlotSeries[] | undefined {
  const type = settings["type"];
  if (type !== "list" && type !== "listline") return undefined;
  try {
    const points = pointsOfData(JSON.parse(settings["data"] ?? "null"));
    return [{ points, style: type === "list" ? "points" : "line" }];
  } catch {
    return [];
  }
}

/** A plot of an expression, not yet sampled: its expression and what samples it (`Producer`). */
export function unsampledBox(head: string, expr: unknown): Box {
  return graphics(interpretation(row([]), expr as never), { ViewKind: "fixed", Producer: head });
}

/** `[[θ, r], …]` (or a bare `[r, …]`, spread evenly over `t0..t1`) as polar points. */
export function polarPointsOf(data: unknown, t0: number, t1: number): PolarPoint[] | undefined {
  if (!Array.isArray(data) || data.length === 0) return undefined;
  if (data.every((p) => Array.isArray(p) && p.length >= 2 && p.every(isNumber)))
    return (data as number[][]).map(([theta, r]) => ({ theta: theta!, r: r! }));
  if (data.every(isNumber)) {
    const n = data.length;
    return (data as number[]).map((r, i) => ({ theta: n > 1 ? t0 + ((t1 - t0) * i) / (n - 1) : t0, r }));
  }
  return undefined;
}

/** Whether a `GraphicsBox` is a plot still to be sampled, and the expression it holds. */
export function unsampledPlot(box: Box): unknown {
  if (!Array.isArray(box) || box[0] !== "GraphicsBox") return undefined;
  const content = (box as BoxNode)[1] as Box;
  return Array.isArray(content) && content[0] === "InterpretationBox" ? (content as readonly unknown[])[2] : undefined;
}

/** A sampled plot of an expression as a `GraphicsBox`: its settings and the series sampled for them. */
export function plotBoxOfSamples(
  settings: PlotSettings,
  series: readonly PlotSeries[],
  extra: Parameters<typeof plotOptionsOf>[1] = {},
): Box {
  return plotBox(series, plotOptionsOf(settings, extra));
}
