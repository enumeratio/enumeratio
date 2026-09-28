import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { BOX_HEADS, type BoxHead } from "./box.ts";
import { toMathJson } from "./json.ts";
import { makeBoxes } from "./make.ts";
import { SUMMARIES } from "./summaries-data.ts";

// The box heads as compute-engine heads. `boxes` is a structural type -- a string (a
// token) or an application of one of the box heads -- so a signature says exactly what it
// takes and returns: `ToBoxes` is `(any) -> boxes`, a `RowBox` of anything else is an
// `incompatible-type` error. The box heads are inert: an evaluated box is itself.

export const BOXES_TYPE = "boxes";

/** Each box head's arguments; a trailing `expression*` takes its options (rules). */
const SIGNATURES: Readonly<Record<BoxHead, string>> = {
  RowBox: "(list<boxes>) -> boxes",
  TextBox: "(string, expression*) -> boxes",
  SuperscriptBox: "(boxes, boxes, expression*) -> boxes",
  SubscriptBox: "(boxes, boxes, expression*) -> boxes",
  SubsuperscriptBox: "(boxes, boxes, boxes, expression*) -> boxes",
  OverscriptBox: "(boxes, boxes, expression*) -> boxes",
  UnderscriptBox: "(boxes, boxes, expression*) -> boxes",
  UnderoverscriptBox: "(boxes, boxes, boxes, expression*) -> boxes",
  FractionBox: "(boxes, boxes, expression*) -> boxes",
  SqrtBox: "(boxes, expression*) -> boxes",
  RadicalBox: "(boxes, boxes, expression*) -> boxes",
  GridBox: "(list<list<boxes>>, expression*) -> boxes",
  StyleBox: "(boxes, expression*) -> boxes",
  FrameBox: "(boxes, expression*) -> boxes",
  TagBox: "(boxes, symbol, expression*) -> boxes",
  InterpretationBox: "(boxes, expression, expression*) -> boxes",
  ErrorBox: "(boxes) -> boxes",
};

export function declareBoxes(ce: ComputeEngine): void {
  ce.declareType(BOXES_TYPE, ["string", ...BOX_HEADS.map((h) => `expression<${h}>`)].join(" | "), { alias: true });

  for (const head of BOX_HEADS) {
    // `InterpretationBox` holds the expression it stands for, as Wolfram's does.
    ce.declare(head, {
      signature: SIGNATURES[head],
      description: SUMMARIES[head],
      ...(head === "InterpretationBox" ? { lazy: true } : {}),
    });
  }

  const boxesOf = (expr: BoxedExpression): BoxedExpression =>
    ce.box(toMathJson(makeBoxes(expr.json as MathJsonExpression)) as never);

  ce.declare("ToBoxes", {
    signature: "(any) -> boxes",
    description: SUMMARIES.ToBoxes,
    evaluate: ([expr]) => boxesOf(expr),
  });
  // `MakeBoxes` holds its argument: the notation of what was written, not of its value.
  ce.declare("MakeBoxes", {
    signature: "(any) -> boxes",
    description: SUMMARIES.MakeBoxes,
    lazy: true,
    evaluate: ([expr]) => boxesOf(expr),
  });
  // Both stay as written: whoever draws them draws their boxes (`makeBoxes`, `BOXES_LATEX`).
  ce.declare("DisplayForm", { signature: "(boxes) -> expression", description: SUMMARIES.DisplayForm });
  ce.declare("RawBoxes", { signature: "(boxes) -> expression", description: SUMMARIES.RawBoxes });
}
