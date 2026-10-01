// A cell answered ahead of time (https://github.com/enumeratio/enumeratio/wiki/Speculative-Kernels-and-Front-Ends §9):
// what a build writes into the page, so it shows before its scripts run, and what the cell
// renders on load without asking its kernel. The answer and its display are the kernel's
// own (`kernel-host.ts`'s `display`); the HTML is the host's typesetter's.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { toLatex } from "@enumeratio/boxes/render";
import { display, type Display, writeSource } from "./kernel-host.ts";

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
}

/**
 * `input` (MathJSON) with `value` as its answer: one known ahead of time (a reference example's
 * recorded value), so nothing is evaluated here. `typeset` turns TeX into HTML.
 */
export function prerender(
  ce: ComputeEngine,
  input: CellInput,
  json: unknown,
  value: unknown,
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
  return {
    input,
    json,
    inputLatex,
    value,
    display: shown,
    latex,
    ...(typeset === undefined ? {} : { html: { input: typeset(inputLatex), output: typeset(latex) } }),
  };
}
