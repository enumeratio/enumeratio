// The one place TeX becomes HTML for the sites and elements: `$…$` islands in prose, and the
// LaTeX compute-engine writes for an expression. Callers ask for markup, not for KaTeX, so a
// different typesetter (MathLive's static renderer) is a change here and nowhere else.

import { katexStrict, trustExpression } from "@enumeratio/boxes/render";
import katex from "katex";
import { portableTeX } from "./tex.ts";

export interface TypesetOptions {
  /** Display style (a `$$…$$` block) rather than inline. */
  readonly display?: boolean;
  /**
   * The TeX is an expression's, as compute-engine writes it for MathLive: made portable first,
   * and the `data-expr` of an interpretation kept. Prose TeX is the author's, trusted with nothing.
   */
  readonly expression?: boolean;
}

/** HTML (and MathML) for TeX. A formula that does not parse is shown as written, not thrown. */
export function typeset(latex: string, { display = false, expression = false }: TypesetOptions = {}): string {
  return katex.renderToString(expression ? portableTeX(latex) : latex, {
    displayMode: display,
    throwOnError: false,
    output: "htmlAndMathml",
    strict: katexStrict(),
    ...(expression ? { trust: trustExpression } : {}),
  });
}
