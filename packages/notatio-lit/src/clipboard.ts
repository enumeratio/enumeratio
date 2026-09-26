// Copy and paste between our editors, and out to anything else.
//
// One expression goes on the clipboard in two flavours:
//
// - `text/plain` is its InputForm: Epsil you can retype, paste into a text cell, or send
//   to someone (a person, or a chat) as plain text that reads back as the same expression.
// - `application/x-latex` is its LaTeX, which a MathLive field reads first on paste, so
//   field-to-field keeps the typeset form exactly.
//
// A math field copies both by itself -- MathLive writes the LaTeX, and its `onExport` hook
// supplies the plain text. Pasting reverses it: a math field is handed LaTeX (converted
// from Epsil text if that is all there is), a text editor is handed its own syntax
// (converted from LaTeX when that is what arrived). This module is the deciding; the
// elements do the converting, since that needs the engine.

/** The clipboard flavours a paste is read from. */
export interface Pasted {
  /** `application/x-latex`: what a math field put there. */
  readonly latex?: string;
  /** `text/plain`. */
  readonly text?: string;
}

export function pastedFrom(data: DataTransfer | null | undefined): Pasted {
  return {
    latex: data?.getData("application/x-latex") || undefined,
    text: data?.getData("text/plain") || undefined,
  };
}

/** Put one expression on the clipboard: InputForm as plain text, LaTeX for a math field. */
export function writeExpression(data: DataTransfer, { inputForm, latex }: { inputForm: string; latex: string }): void {
  data.setData("text/plain", inputForm || latex);
  if (latex) data.setData("application/x-latex", latex);
}

// A math delimiter pair around the whole text: `$…$`, `$$…$$`, `\(…\)` or `\[…\]`.
const WRAPPED = /^(?:\$\$([^]*)\$\$|\$([^]*)\$|\\\(([^]*)\\\)|\\\[([^]*)\\\])$/;

/**
 * The LaTeX inside a math-delimited text (Copy LaTeX writes `$…$`, as do Markdown and
 * most sites), or undefined when the text isn't delimited math.
 */
export function unwrapLatex(text: string): string | undefined {
  const m = WRAPPED.exec(text.trim());
  if (!m) return undefined;
  const inner = (m[1] ?? m[2] ?? m[3] ?? m[4]).trim();
  return inner || undefined;
}

/** A LaTeX control word -- `\frac`, `\pi` -- which Epsil has no use for outside a string. */
const CONTROL_WORD = /\\[A-Za-z]+/;

/**
 * The LaTeX a paste into a math field should insert, or undefined to leave the paste to
 * MathLive -- which already reads LaTeX, delimited or not, and its own flavours. What it
 * can't read is Epsil: `Sin(x) ^ 2` read as LaTeX is S·i·n·(x)², so plain text that
 * parses as Epsil (`toLatex` answers) goes in as that expression's LaTeX.
 */
export function latexForField(pasted: Pasted, toLatex: (epsil: string) => string | undefined): string | undefined {
  const text = pasted.text?.trim();
  if (pasted.latex !== undefined || !text) return undefined;
  if (unwrapLatex(text) !== undefined || CONTROL_WORD.test(text)) return undefined;
  return toLatex(text);
}

/**
 * The LaTeX a paste into a text editor carries, to be rewritten in the editor's own
 * syntax -- a math field's copy, or delimited math -- or undefined when it is text to
 * insert as it is. `maybe` is bare text with a LaTeX control word in it (`\frac{1}{2}`,
 * as Copy LaTeX writes it): LaTeX only if it isn't already the editor's own syntax.
 */
export function latexForText(pasted: Pasted): { latex: string; maybe: boolean } | undefined {
  if (pasted.latex !== undefined) return { latex: pasted.latex, maybe: false };
  if (pasted.text === undefined) return undefined;
  const unwrapped = unwrapLatex(pasted.text);
  if (unwrapped !== undefined) return { latex: unwrapped, maybe: false };
  return CONTROL_WORD.test(pasted.text) ? { latex: pasted.text.trim(), maybe: true } : undefined;
}
