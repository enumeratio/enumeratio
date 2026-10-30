// Automatic output presentation (`AutomaticPresentation -> True`): which view a value gets in place
// of its typeset form. Pure -- the value and what the page can tell about it in, a view spec out --
// so the cell, a test and a future host choose the same thing. Off by default; a caller asks.

import { VALUE_FRAMES } from "./figure-frames.ts";
import { inferPlot } from "./infer-controls.ts";
import type { Json } from "./frame-json.ts";
import { AUTOMATIC } from "./table-state.ts";

/** What the page can tell about a value that its JSON alone cannot. */
export interface PresentationContext {
  /**
   * Whether `value` is a collection a table can open (random access, not an eager literal).
   * An evaluated lazy collection's JSON stays its call -- `["SymmetricGroup", 4]` -- so this is
   * asked of the engine rather than read off the printed form.
   */
  opensAsTable(value: Json): boolean;
  /** The value's call as notatio text, for the table's `expr` (passed in so `core` loads no engine). */
  serialize(value: Json): string;
}

/** A view for a value. `figure` is the value's own frame (`VALUE_FRAMES`): drawn by the renderer as it is. */
export type Presentation =
  | {
      readonly kind: "collection";
      /** The collection, in Epsil: `SymmetricGroup(3)`. */
      readonly expr: string;
      readonly glyph: typeof AUTOMATIC;
      readonly columns: typeof AUTOMATIC;
      readonly pageSize: number;
    }
  | { readonly kind: "figure"; readonly frame: string }
  /** The value drawn as `head(value)`: a list of numbers or pairs is a `ListPlot`. */
  | { readonly kind: "plot"; readonly head: string };

/** Rows a presented collection shows per page. */
export const PRESENTED_PAGE_SIZE = 10;

// Heads whose value is the data itself, even when it is a collection: they stay as typeset.
const LITERAL_COLLECTIONS = new Set(["List", "Set", "Tuple", "Dictionary", "Interval", "Matrix", "Vector", "String"]);

/**
 * The view `value` gets under automatic presentation, or `undefined` to leave it as typeset:
 * a collection value opens as a collection table, a combinatorial element draws as its figure,
 * a list of numbers or pairs plots (`inferPlot`; only its list answer, so a bare expression with
 * free symbols is not drawn over invented axes).
 */
export function presentationOf(value: Json, ctx: PresentationContext): Presentation | undefined {
  if (!Array.isArray(value) || typeof value[0] !== "string") return undefined;
  const plot = inferPlot(value);
  // `inferPlot` takes any list of number lists; only points (pairs) are a plot here.
  const points = value.slice(1).every((item) => !Array.isArray(item) || item.length === 3);
  if (plot?.head === "ListPlot" && points) return { kind: "plot", head: plot.head };
  const head = value[0];
  if (Object.hasOwn(VALUE_FRAMES, head))
    return { kind: "figure", frame: VALUE_FRAMES[head as keyof typeof VALUE_FRAMES] };
  if (LITERAL_COLLECTIONS.has(head) || !ctx.opensAsTable(value)) return undefined;
  return {
    kind: "collection",
    expr: ctx.serialize(value),
    glyph: AUTOMATIC,
    columns: AUTOMATIC,
    pageSize: PRESENTED_PAGE_SIZE,
  };
}
