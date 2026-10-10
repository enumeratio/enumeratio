// A cell answered ahead of time (https://github.com/enumeratio/enumeratio/wiki/Speculative-Kernels-and-Front-Ends §9):
// what a build writes into the page, so it shows before its scripts run, and what the cell
// renders on load without asking its kernel. The answer and its display are the kernel's
// own (`kernel-host.ts`'s `display`); the HTML is the host's typesetter's.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { toLatex } from "@enumeratio/boxes/render";
import { markupOf, typesetLeaf } from "./box-leaf.ts";
import { display, type Display, writeSource } from "./kernel-host.ts";
import { layoutMarkupEverywhere } from "./layout-markup.ts";

/** A cell's input, as written: kept with its answer, for debugging among other reasons. */
export interface CellInput {
  readonly text: string;
  readonly format: string;
}

export interface Prerendered {
  readonly input: CellInput;
  /** The input as read (MathJSON): a cell needs no kernel to read it. */
  readonly json: unknown;
  /** The input's TeX, as written (not canonical): what the In row typesets. */
  readonly inputLatex: string;
  /** The answer, as MathJSON. */
  readonly value: unknown;
  /** As the kernel's, less the code forms: an Out asks for those when one is shown. */
  readonly display: Display;
  /** The answer's StandardForm TeX: what the Out row typesets. */
  readonly latex: string;
  /** Both rows typeset, when the host has a typesetter. */
  readonly html?: { readonly input: string; readonly output: string };
  /**
   * The Out as the browser draws it when that is a closed layout (a grid of leaves) in every
   * environment: kept with the data, so the Out adopts it, not just the page.
   */
  readonly visual?: string;
}

/** The Out row's markup as `<notatio-out>` first draws it: a layout where the answer is one, else the standard form's leaf. */
export function outMarkup(pre: Prerendered & { readonly html: NonNullable<Prerendered["html"]> }): string {
  if (pre.visual !== undefined) return pre.visual;
  const { output } = pre.html;
  return pre.latex === "" ? output : markupOf(typesetLeaf(["FormBox", pre.latex, "TeXForm"], "TeXForm"), () => output);
}

/**
 * `input` (MathJSON) with `value` as its answer: one known ahead of time (a reference example's
 * recorded value), so nothing is evaluated here. `evaluated` is whether `value` is the answer to
 * `input` (not `input` itself), which decides whether a layout of closed cells is final. `typeset`
 * turns TeX into HTML.
 */
export function prerender(
  ce: ComputeEngine,
  input: CellInput,
  json: unknown,
  value: unknown,
  evaluated: boolean,
  typeset?: (latex: string) => string,
): Prerendered {
  const inputLatex = writeSource(ce, json, "latex");
  // The code forms are compiled when one is asked for, not for every answer on a page.
  const { boxes, text, draws } = display(ce, value);
  const shown: Display = {
    boxes,
    text: {
      ...(text.asciimath ? { asciimath: text.asciimath } : {}),
      ...(text.inputform ? { inputform: text.inputform } : {}),
    },
    draws,
  };
  const standard = shown.boxes.StandardForm;
  const latex = standard === undefined ? "" : toLatex(standard);
  // As the Out draws it in the browser (`visual.ts`), so the page's first paint is its last.
  const visual =
    typeset === undefined
      ? undefined
      : layoutMarkupEverywhere(value as MathJsonExpression, { typeset, evaluated, written: boxes.TraditionalForm });
  return {
    input,
    json,
    inputLatex,
    value,
    display: shown,
    latex,
    ...(visual === undefined ? {} : { visual }),
    ...(typeset === undefined ? {} : { html: { input: typeset(inputLatex), output: typeset(latex) } }),
  };
}
