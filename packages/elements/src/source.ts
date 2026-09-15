import type { ComputeEngine } from "@cortex-js/compute-engine";
import { parseNotatio } from "@enumeratio/formats/notatio";

// The seam between what an author writes and what MathLive edits. Every editable
// element reads notatio by default and hands the editor LaTeX; this is the one place
// that conversion happens, so a cell, a notebook seed and a worksheet seed all agree on
// what a source means.

/** The syntaxes an editable element's `in-form` may name. */
export type InForm = "notatio" | "latex" | "wolfram";

export interface EditorLatex {
  /** LaTeX for the math field, or `""` when the source did not parse. */
  latex: string;
  /** Why it did not, when it did not. */
  errors: string[];
}

export interface EditorLatexOptions {
  /** Let a top-level `name := value` through: a notebook cell binds, a plot does not. */
  assign?: boolean;
}

/**
 * notatio -> the LaTeX a math field shows for it. The tree is boxed without
 * canonicalising, so the LaTeX spells what was written (`a - b`, not `a + -b`) and
 * re-parses to the same expression the notatio meant. Never throws.
 */
export function toEditorLatex(
  engine: ComputeEngine,
  source: string,
  options: EditorLatexOptions = {},
): EditorLatex {
  if (!source.trim()) return { latex: "", errors: [] };
  const { json, errors } = parseNotatio(source, {
    parseLatex: (tex) => engine.parse(tex).json,
    allow: options.assign ? ["Assign"] : [],
  });
  if (errors.length) return { latex: "", errors };
  try {
    return { latex: engine.box(json, { form: "raw" }).latex, errors: [] };
  } catch (err) {
    return { latex: "", errors: [err instanceof Error ? err.message : String(err)] };
  }
}

/**
 * A source in the syntax `form` names, as the LaTeX the editor shows. LaTeX passes
 * through untouched -- `in-form="latex"` is the escape hatch for something notatio
 * cannot yet say.
 */
export function editorLatexOf(
  engine: ComputeEngine,
  form: string,
  source: string,
  options?: EditorLatexOptions,
): EditorLatex {
  return form === "latex" ? { latex: source, errors: [] } : toEditorLatex(engine, source, options);
}
