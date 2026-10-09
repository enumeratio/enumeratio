// A figure at the terminal: a value that draws as the `Show` of a frame (`Permutation` as its
// strands, `DyckPath` as its path) or a `Show` of a frame written out, lowered to a `GraphicsBox`
// and drawn on cells. Typing the value is enough; the frames are `VALUE_FRAMES`'s.
//
// A layout (`Row`, `Column`, `Grid`, `Panel`, `Labeled`) is boxes laid out on cells, with each
// entry that is a figure a leaf the figure drawer fills.

import { type Box, LAYOUT_HEADS, makeBoxes, type Notation } from "@enumeratio/boxes";
import { figureGraphicsBox, headOf, isFlatFrame, opsOf, plainJson, VALUE_FRAMES } from "@enumeratio/frontend";
import { drawGraphicsBox } from "./cell-draw.ts";
import { drawBoxes, type LayoutOptions } from "./cell-layout.ts";

type Json = Parameters<typeof plainJson>[0];

export interface FigureOptions extends LayoutOptions {
  /** The notation the session's packages bring, so a layout's math is written as the page writes it. */
  readonly notation?: Notation;
}

/** The frame and data a result draws as, if it is a figure: a value head, or `Show` of a frame. */
function figureOf(json: Json): { frame: Parameters<typeof figureGraphicsBox>[0]; data: Json } | undefined {
  const plain = plainJson(json);
  const head = headOf(plain);
  if (head === "Show") {
    const layer = opsOf(plain)[0];
    const frame = headOf(layer);
    return frame !== undefined && isFlatFrame(frame) ? { frame, data: opsOf(layer)[0] } : undefined;
  }
  if (head === undefined || !Object.hasOwn(VALUE_FRAMES, head)) return undefined;
  const frame = VALUE_FRAMES[head as keyof typeof VALUE_FRAMES];
  return isFlatFrame(frame) ? { frame, data: plain } : undefined;
}

/** A figure's `GraphicsBox`, if `json` is one. */
function figureBox(json: Json): Box | undefined {
  const figure = figureOf(json);
  if (figure === undefined) return undefined;
  const box = figureGraphicsBox(figure.frame, figure.data);
  return typeof box === "string" ? undefined : box;
}

/** The result drawn on character cells, or undefined when it is no figure or layout (or none can be made of it). */
export function figureText(json: Json, options: FigureOptions = {}): string | undefined {
  const head = headOf(plainJson(json));
  if (head !== undefined && LAYOUT_HEADS.has(head)) {
    // Each entry that is a figure is a leaf; the rest is written as math, which layout stacks and raises.
    const boxes = makeBoxes(plainJson(json) as never, options.notation, { leaf: (node) => figureBox(node as Json) });
    return drawBoxes(boxes, options);
  }
  const box = figureBox(json);
  return box === undefined ? undefined : drawGraphicsBox(box, options);
}
