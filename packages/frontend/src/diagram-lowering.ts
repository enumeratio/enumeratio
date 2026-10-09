// The graph plots and the torus square as `makeBoxes` rules (the wiki's Speculative-Box-Primitives,
// §6 slice 4): each returns `Graphics`, so `GraphPlot`, `TreeGraph`, `LayeredGraphPlot`,
// `Dendrogram` and `TorusSquare` lower to a `GraphicsBox` that `diagram.ts` draws. Their data is
// finite, so the box holds the whole figure; only the torus square's travelling point moves, and
// that is the page clock's (`phase`), not a different box.

import type { Box } from "@enumeratio/boxes";
import { dendrogramBox, graphOf, graphPlotBox, layeredGraphPlotBox, treeOf, treePlotBox } from "./graph.ts";
import { torusSquareBox } from "./torussquare.ts";

/** The heads whose figures are diagram `GraphicsBox`es, drawn by `<graphics-box>`. */
export const DIAGRAM_HEADS: readonly string[] = [
  "GraphPlot",
  "TreeGraph",
  "LayeredGraphPlot",
  "Dendrogram",
  "TorusSquare",
];

/** A diagram head's settings, the attributes its expression lowers to (`plotSettingsOf`). */
export type DiagramSettings = Readonly<Record<string, string | undefined>>;

const truthy = (v: string | undefined): boolean => v !== undefined && !/^(false|0|)$/i.test(v.trim());

function jsonOf(text: string | undefined): unknown {
  try {
    return JSON.parse(text?.trim() || "null");
  } catch {
    return undefined;
  }
}

/** A torus square's pinned phase (`Phase -> 0.32`), else undefined. */
export function pinnedPhase(settings: DiagramSettings): number | undefined {
  const text = settings["phase"]?.trim();
  return text ? (Number.isFinite(Number(text)) ? Number(text) : undefined) : undefined;
}

/** Whether a torus square's point travels on the page's clock: unless pinned, or `Clock -> False`. */
export const followsClock = (settings: DiagramSettings): boolean =>
  settings["layout"] === "torus" &&
  pinnedPhase(settings) === undefined &&
  settings["clock"]?.trim().toLowerCase() !== "false";

/**
 * The box for a diagram's settings, or undefined for settings that are no diagram's. `phase` is
 * the clock's, used where the square follows it.
 */
export function diagramBoxOf(settings: DiagramSettings, phase = 0): Box | undefined {
  const title = settings["label"] || undefined;
  switch (settings["layout"]) {
    case "tree":
      return treePlotBox(treeOf(jsonOf(settings["data"])), { title });
    case "dendrogram":
      return dendrogramBox(treeOf(jsonOf(settings["data"])), { title });
    case "graph":
      return graphPlotBox(graphOf(jsonOf(settings["data"])), { title, directed: truthy(settings["directed"]) });
    case "layered":
      return layeredGraphPlotBox(graphOf(jsonOf(settings["data"])), { title });
    case "torus":
      return torusSquareBox(Math.round(Number(settings["p"])) || 1, Math.round(Number(settings["q"])) || 1, {
        phase: pinnedPhase(settings) ?? (followsClock(settings) ? phase : undefined),
        dials: settings["dials"]?.trim().toLowerCase() !== "false",
        title,
        discrete: settings["discrete"],
      });
    default:
      return undefined;
  }
}
