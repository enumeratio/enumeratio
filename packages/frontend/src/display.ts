// A result's display, as boxes, built where the definitions are: in the kernel that
// evaluated it (https://github.com/enumeratio/enumeratio/wiki/Speculative-Kernels-and-Front-Ends §5),
// so a front end renders it without an engine of its own. Each form is, for now, a TeX leaf
// the kernel's engine writes (`FormBox(tex, "TeXForm")`); structured boxes replace a leaf as
// `makeBoxes` learns that form.

import type { ComputeEngine, MathJsonExpression } from "@cortex-js/compute-engine";
import type { LatexDictionaryEntry } from "@cortex-js/compute-engine/latex-syntax";
import { type Box, form } from "@enumeratio/boxes";
import { CONVENTIONAL_LATEX } from "./conventional-latex.ts";
import { mergeLatex } from "./engine.ts";
import { latexOf, NOTATIO_LATEX } from "./latex.ts";
import { TRADITIONAL_LATEX, toTraditionalLatex } from "./traditional.ts";

export const DISPLAY_FORMS = ["StandardForm", "TraditionalForm", "MatrixForm"] as const;
export type DisplayForm = (typeof DISPLAY_FORMS)[number];
export type DisplayBoxes = Partial<Record<DisplayForm, Box>>;

type Entry = Partial<LatexDictionaryEntry>;

/** The LaTeX dictionary a kernel's engine writes with: `base` (compute-engine's), ours, then
 *  `extra` (a library's notation), as the page engine merges them. */
export const displayDictionary = (base: readonly Entry[], extra: readonly Entry[] = []): Entry[] =>
  mergeLatex(base, [...NOTATIO_LATEX, ...CONVENTIONAL_LATEX, ...TRADITIONAL_LATEX, ...extra]);

const isList = (json: unknown): boolean => Array.isArray(json) && json[0] === "List";

/** `json`'s display in each form that applies to it (MatrixForm only to a list). */
export function displayBoxes(ce: ComputeEngine, json: unknown): DisplayBoxes {
  const expr = json as MathJsonExpression;
  const tex = (latex: string): Box => form(latex, "TeXForm");
  const out: DisplayBoxes = {
    StandardForm: tex(latexOf(ce, ce.box(expr))),
    TraditionalForm: tex(toTraditionalLatex(expr, ce)),
  };
  if (isList(json)) out.MatrixForm = tex(ce.box(["Matrix", expr] as MathJsonExpression).latex);
  return out;
}
