// A result's display, as boxes, built where the definitions are: in the kernel that
// evaluated it (https://github.com/enumeratio/enumeratio/wiki/Speculative-Kernels-and-Front-Ends §5),
// so a front end renders it without an engine of its own. TraditionalForm is `makeBoxes`
// with the notation the engine's packages registered; StandardForm and MatrixForm are, for
// now, TeX leaves the engine writes (`FormBox(tex, "TeXForm")`).

import type { ComputeEngine, MathJsonExpression } from "@cortex-js/compute-engine";
import type { LatexDictionaryEntry } from "@cortex-js/compute-engine/latex-syntax";
import { type Box, form, makeBoxes, notationOf } from "@enumeratio/boxes";
import { BOXES_LATEX } from "@enumeratio/boxes/render";
import { CONVENTIONAL_LATEX, DisplayLatexSyntax, probeLanded } from "./conventional-latex.ts";
import { mergeLatex } from "./engine.ts";
import { latexOf, NOTATIO_LATEX } from "./latex.ts";

export const DISPLAY_FORMS = ["StandardForm", "TraditionalForm", "MatrixForm"] as const;
export type DisplayForm = (typeof DISPLAY_FORMS)[number];
export type DisplayBoxes = Partial<Record<DisplayForm, Box>>;

type Entry = Partial<LatexDictionaryEntry>;

/** The LaTeX dictionary a kernel's engine writes with: `base` (compute-engine's), ours (with
 *  boxes' DisplayForm and RawBoxes, which typeset through the serialisers), then `extra` (the
 *  packages' notation), as the page engine merges them. */
export const displayDictionary = (base: readonly Entry[], extra: readonly Entry[] = []): Entry[] => {
  probeLanded();
  return mergeLatex(base, [...NOTATIO_LATEX, ...CONVENTIONAL_LATEX, ...BOXES_LATEX, ...extra]);
};

/** `displayDictionary` as a syntax, which also writes the Unicode list's symbols as Unicode. */
export const displayLatexSyntax = (base: readonly Entry[], extra: readonly Entry[] = []): DisplayLatexSyntax =>
  new DisplayLatexSyntax({ dictionary: displayDictionary(base, extra) as never[] });

const isList = (json: unknown): boolean => Array.isArray(json) && json[0] === "List";

/** `json`'s display in each form that applies to it (MatrixForm only to a list). */
export function displayBoxes(ce: ComputeEngine, json: unknown): DisplayBoxes {
  const expr = json as MathJsonExpression;
  const tex = (latex: string): Box => form(latex, "TeXForm");
  const out: DisplayBoxes = {
    StandardForm: tex(latexOf(ce, ce.box(expr))),
    TraditionalForm: makeBoxes(expr, notationOf(ce)),
  };
  if (isList(json)) out.MatrixForm = tex(ce.box(["Matrix", expr] as MathJsonExpression).latex);
  return out;
}
