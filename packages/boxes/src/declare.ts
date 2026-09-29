import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import type { DeclaredSymbol } from "@enumeratio/manifest";
import { SYMBOLS } from "@enumeratio/manifest/package/boxes";
import { BOX_HEADS } from "./box.ts";
import { toMathJson } from "./json.ts";
import { makeBoxes } from "./make.ts";

// The box heads as compute-engine heads. `boxes` is a structural type -- a string (a
// token) or an application of one of the box heads -- so a signature says exactly what it
// takes and returns: `ToBoxes` is `(any) -> boxes`, a `RowBox` of anything else is an
// `incompatible-type` error. The box heads are inert: an evaluated box is itself.
//
// Each head's signature, description and attributes are its record's, read back from the
// manifest (https://github.com/enumeratio/enumeratio/wiki/Manifest): written once, in `reference/<Head>/index.md`.

export const BOXES_TYPE = "boxes";

/** What the record says about `head`; a head this package declares must have a typed record. */
function recorded(head: string): { signature: string; description: string; lazy?: true } {
  const symbol: DeclaredSymbol | undefined = SYMBOLS[head];
  if (symbol?.type === undefined) throw new Error(`boxes: reference/${head}.yaml gives no type`);
  return {
    signature: symbol.type,
    description: symbol.summary,
    // `HoldAll` is compute-engine's `lazy`: the arguments arrive unevaluated.
    ...(symbol.attributes?.includes("HoldAll") ? { lazy: true } : {}),
  };
}

export function declareBoxes(ce: ComputeEngine): void {
  ce.declareType(BOXES_TYPE, ["string", ...BOX_HEADS.map((h) => `expression<${h}>`)].join(" | "), { alias: true });

  for (const head of BOX_HEADS) ce.declare(head, recorded(head));

  const boxesOf = (expr: BoxedExpression): BoxedExpression =>
    ce.box(toMathJson(makeBoxes(expr.json as MathJsonExpression)) as never);

  // `ToBoxes` evaluates its argument first; `MakeBoxes` holds it (the notation of what was written).
  ce.declare("ToBoxes", { ...recorded("ToBoxes"), evaluate: ([expr]) => boxesOf(expr) });
  ce.declare("MakeBoxes", { ...recorded("MakeBoxes"), evaluate: ([expr]) => boxesOf(expr) });
  // Both stay as written: whoever draws them draws their boxes (`makeBoxes`, `BOXES_LATEX`).
  ce.declare("DisplayForm", recorded("DisplayForm"));
  ce.declare("RawBoxes", recorded("RawBoxes"));
}
