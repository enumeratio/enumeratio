// A figure at the terminal: a value that draws as the `Show` of a frame (`Permutation` as its
// strands, `DyckPath` as its path) or a `Show` of a frame written out, lowered to a `GraphicsBox`
// and drawn on cells. Typing the value is enough; the frames are `VALUE_FRAMES`'s.
//
// A layout (`Row`, `Column`, `Grid`, `Panel`, `Labeled`) is boxes laid out on cells, with each
// entry that is a figure a leaf the figure drawer fills.

import { type Box, type BoxNode, LAYOUT_HEADS, makeBoxes, type Notation } from "@enumeratio/boxes";
import {
  FIGURE_NOTATION,
  headOf,
  PLOT_NOTATION,
  type PlotPoint,
  plainJson,
  plotBox,
  registerLatticeModules,
} from "@enumeratio/frontend";
import * as numberTheory from "@enumeratio/number-theory/lattice";
import * as residues from "@enumeratio/residues/table";
import { drawGraphicsBox, drawPlotBox } from "./cell-draw.ts";
import { drawBoxes, type LayoutOptions } from "./cell-layout.ts";

// The lattices the terminal can draw: quadratic rings and multiplication tables.
registerLatticeModules({ numberTheory, residues });

type Json = Parameters<typeof plainJson>[0];

/** A `Plot` result sampled by the session: its curve and the points an `Epilog` marks. */
export interface Sampled {
  readonly points: readonly PlotPoint[];
  readonly marks?: readonly PlotPoint[];
}

export interface FigureOptions extends LayoutOptions {
  /** Samples a plot, which needs the session's engine; a plot is no figure without it. */
  readonly plot?: (json: Json) => Sampled | undefined;
  /** Samples a vector or stream plot, which needs the session's engine too; its `GraphicsBox`. */
  readonly field?: (json: Json) => Box | undefined;
  /** The notation the session's packages bring, so a layout's math is written as the page writes it. */
  readonly notation?: Notation;
}

/**
 * A sampled curve as a plot box drawn on cells: the window is the data's own extent (the y extremes
 * in a gutter, the x extremes under the axis), and each mark one `●`.
 */
export function plotText(sampled: Sampled, options: { width?: number; height?: number; color?: boolean } = {}): string {
  const marks = sampled.marks ?? [];
  const box = plotBox([{ points: [...sampled.points] }], {
    tight: true,
    epilog: marks.length > 0 ? [{ kind: "point", points: marks.map((m) => [m.x, m.y] as const) }] : [],
  }) as BoxNode;
  return drawPlotBox(box, options);
}

/** The result drawn on character cells, or undefined when it is no figure or layout (or none can be made of it). */
export function figureText(json: Json, options: FigureOptions = {}): string | undefined {
  const sampled = options.plot?.(json);
  if (sampled !== undefined)
    return plotText(sampled, { width: options.width, height: options.height, color: options.color });
  const field = options.field?.(json);
  if (field !== undefined)
    return drawPlotBox(field as BoxNode, { width: options.width, height: options.height, color: options.color });
  const head = headOf(plainJson(json));
  const notation = { ...options.notation, ...FIGURE_NOTATION, ...PLOT_NOTATION };
  if (head !== undefined && LAYOUT_HEADS.has(head)) {
    // Each entry that is a figure is a `GraphicsBox` by the figure rules; the rest is written as math.
    return drawBoxes(makeBoxes(plainJson(json) as never, notation), options);
  }
  const box = makeBoxes(plainJson(json) as never, notation);
  return box[0] === "GraphicsBox" ? drawGraphicsBox(box, options) : undefined;
}
