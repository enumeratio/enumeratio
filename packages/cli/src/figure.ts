// A figure at the terminal: a value that draws as the `Show` of a frame (`Permutation` as its
// strands, `DyckPath` as its path) or a `Show` of a frame written out, lowered to a `GraphicsBox`
// and drawn on cells. Typing the value is enough; the frames are `VALUE_FRAMES`'s.

import { opsOf, figureGraphicsBox, headOf, isFlatFrame, plainJson, VALUE_FRAMES } from "@enumeratio/frontend";
import { type CellOptions, drawGraphicsBox } from "./cell-draw.ts";

type Json = Parameters<typeof plainJson>[0];

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

/** The result drawn on character cells, or undefined when it is no figure (or none can be made of it). */
export function figureText(json: Json, options: CellOptions = {}): string | undefined {
  const figure = figureOf(json);
  if (figure === undefined) return undefined;
  const box = figureGraphicsBox(figure.frame, figure.data);
  return typeof box === "string" ? undefined : drawGraphicsBox(box, options);
}
