// A figure at the terminal: a value that draws as the `Show` of a frame (`Permutation` as its
// strands, `DyckPath` as its path) or a `Show` of a frame written out, lowered to a `GraphicsBox`
// and drawn on cells. Typing the value is enough; the frames are `VALUE_FRAMES`'s.
//
// A layout (`Row`, `Column`, `Grid`, `Panel`, `Labeled`) is boxes laid out on cells, with each
// entry that is a figure a leaf the figure drawer fills.

import { LAYOUT_HEADS, makeBoxes, type Notation } from "@enumeratio/boxes";
import { FIGURE_NOTATION, headOf, plainJson } from "@enumeratio/frontend";
import { drawGraphicsBox } from "./cell-draw.ts";
import { drawBoxes, type LayoutOptions } from "./cell-layout.ts";

type Json = Parameters<typeof plainJson>[0];

export interface FigureOptions extends LayoutOptions {
  /** The notation the session's packages bring, so a layout's math is written as the page writes it. */
  readonly notation?: Notation;
}

/** The result drawn on character cells, or undefined when it is no figure or layout (or none can be made of it). */
export function figureText(json: Json, options: FigureOptions = {}): string | undefined {
  const head = headOf(plainJson(json));
  const notation = { ...options.notation, ...FIGURE_NOTATION };
  if (head !== undefined && LAYOUT_HEADS.has(head)) {
    // Each entry that is a figure is a `GraphicsBox` by the figure rules; the rest is written as math.
    return drawBoxes(makeBoxes(plainJson(json) as never, notation), options);
  }
  const box = makeBoxes(plainJson(json) as never, notation);
  return box[0] === "GraphicsBox" ? drawGraphicsBox(box, options) : undefined;
}
