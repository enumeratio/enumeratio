// The 2-D plots as `makeBoxes` rules (the wiki's Speculative-Box-Primitives, §6 slice 4). A plot of
// data is a finite list and lowers whole. A plot of an expression is a producer, like a lattice:
// sampling needs a compiled kernel (the page's, or a session's), so the box holds the expression it
// came from and `Producer -> head`, and an environment that can sample asks for the marks
// (`plotBoxOfSamples`). Not in `/core`: reading an expression's options needs the engine's parser.

import type { Notation, NotationRule } from "@enumeratio/boxes";
import { diagramBoxOf } from "./diagram-lowering.ts";
import { plainJson } from "./graphics-rules.ts";
import { plotBox } from "./plot-box.ts";
import { PLOT_HEADS, plotDataSeries, plotOptionsOf, polarPointsOf, spanOf, unsampledBox } from "./plot-lowering.ts";
import { polarPlotBox } from "./polarplot.ts";
import { plotSettingsOf } from "./symbols.ts";

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
    const series = plotDataSeries(settings);
    return series === undefined ? unsampledBox(head, expr) : plotBox(series, plotOptionsOf(settings));
  };

/** The plot heads as `makeBoxes` rules. */
export const PLOT_NOTATION: Notation = Object.fromEntries(PLOT_HEADS.map((head) => [head, plotRule(head)]));
