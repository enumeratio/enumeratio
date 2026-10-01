import type { LatexDictionaryEntry } from "@cortex-js/compute-engine/latex-syntax";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { fromMathJson } from "../json.ts";
import { toLatex } from "./latex.ts";

// `DisplayForm(boxes)` and `RawBoxes(boxes)` typeset as their boxes. Serialisation only;
// compute-engine takes its LaTeX dictionary at construction, so a host appends these to the
// default one (notatio's `configureLatex(BOXES_LATEX)`). A malformed box argument falls back
// to the functional spelling rather than throwing mid-render.

const shown = (name: string): Partial<LatexDictionaryEntry> => ({
  name,
  serialize: (serializer, expr) => {
    const arg = Array.isArray(expr) ? (expr[1] as MathJsonExpression | undefined) : undefined;
    try {
      if (arg !== undefined) return toLatex(fromMathJson(arg));
    } catch {
      // not boxes: fall through
    }
    return `\\operatorname{${name}}(${arg === undefined ? "" : serializer.serialize(arg)})`;
  },
});

export const BOXES_LATEX: readonly Partial<LatexDictionaryEntry>[] = [shown("DisplayForm"), shown("RawBoxes")];
