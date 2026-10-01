// The notebook's side of a kernel (https://github.com/enumeratio/enumeratio/wiki/Speculative-Kernels-and-Front-Ends):
// how a cell's text reads, what a session remembers, and how an answer is shown, as
// `@enumeratio/evaluation`'s `createKernel` options. A cell's front end then sends text and
// renders what comes back, with no engine of its own.

import type { ComputeEngine, MathJsonExpression } from "@cortex-js/compute-engine";
import { makeBoxes, notationOf } from "@enumeratio/boxes";
import { toAscii } from "@enumeratio/boxes/render";
import type { KernelOptions, KernelSession, KernelSource } from "@enumeratio/evaluation";
import { parseExpression } from "@enumeratio/formats/expression";
import { toInputForm } from "@enumeratio/formats/inputform";
import { type CodeForm, codeForms } from "./code-forms.ts";
import { type DisplayBoxes, displayBoxes } from "./display.ts";
import { compilePlot, type PlotCompileSpec } from "./plot-compile.ts";
import { boundName } from "./reactive.ts";
import { renderingOf } from "./symbols.ts";
import { Transcript } from "./transcript.ts";

/** The session a page's cells outside any notebook share: one scope, no `Out[n]` history. */
export const PAGE_SESSION = "page";

/** An answer as the kernel shows it: boxes by form, and the forms that are text. */
export interface Display {
  readonly boxes: DisplayBoxes;
  readonly text: Partial<Record<CodeForm | "asciimath" | "inputform", string>>;
  /** Whether the value is a head that draws: a front end loads its renderer only then. */
  readonly draws: boolean;
}

/** A cell's text as MathJSON: Epsil (`$…$` islands in LaTeX), LaTeX, or MathJSON itself. */
export function readSource(ce: ComputeEngine, { text, format }: KernelSource, raw = false): unknown {
  if (format === "mathjson") return JSON.parse(text);
  if (format === "latex") return ce.parse(text, raw ? { form: "raw" } : undefined).json;
  // A cell is a notebook line, so it may bind (`a := 5`) as well as compute.
  const { json, diagnostics } = parseExpression(text, {
    allow: ["Assign"],
    ce,
    parseLatex: (tex) => ce.parse(tex).json,
  });
  const problem = diagnostics[0];
  // The range travels with the message, so an editor can mark where the problem is.
  if (problem !== undefined) throw Object.assign(new Error(problem.message), { range: problem.range });
  return json;
}

/** `json` in an editor's syntax: LaTeX as written (not canonical), Epsil, or MathJSON. */
export function writeSource(ce: ComputeEngine, json: unknown, syntax: string): string {
  if (syntax === "latex") return ce.box(json as never, { form: "raw" }).latex;
  if (syntax === "epsil") return toInputForm(json as MathJsonExpression);
  if (syntax === "mathjson") return JSON.stringify(json);
  throw new Error(`no ${syntax} spelling`);
}

/** A notebook's session: a transcript's scope and, unless it's the page's or a call's own, its
 *  history. Forgetting it is dropping it: the scope goes with it. */
function transcriptSession(ce: ComputeEngine, id: string | undefined): KernelSession {
  const transcript = new Transcript(ce, { history: id !== undefined && id !== PAGE_SESSION });
  return {
    run: (fn, input) =>
      transcript.run(() => {
        // An `Assign` binds in this scope only if the name is claimed here first.
        const name = boundName(input);
        if (name !== undefined) {
          try {
            ce.declare(name, "unknown");
          } catch {
            // already claimed here, or a name that can't be
          }
        }
        return fn();
      }),
    record: (source, input, value) =>
      transcript.record(
        source?.format === "latex" ? source.text : toInputForm(input as MathJsonExpression),
        ce.box(input as never),
        ce.box(value as never),
      ),
  };
}

/** The display of `json`, from the notation and code the engine's packages bring. */
export function display(ce: ComputeEngine, json: unknown): Display {
  const text: Display["text"] = { ...codeForms(ce, json) };
  try {
    text.asciimath = toAscii(makeBoxes(json as MathJsonExpression, notationOf(ce)));
  } catch {
    // no AsciiMath for this value
  }
  try {
    text.inputform = toInputForm(json as MathJsonExpression);
  } catch {
    // no InputForm for this value
  }
  let draws = false;
  try {
    draws = renderingOf(json as MathJsonExpression) !== undefined;
  } catch {
    // not a head that draws
  }
  return { boxes: displayBoxes(ce, json), text, draws };
}

/** `createKernel`'s options for notatio's cells. */
export const NOTEBOOK_KERNEL: KernelOptions = {
  parse: readSource,
  write: writeSource,
  session: transcriptSession,
  display,
  compile: (ce, json, spec) => compilePlot(ce, json, spec as PlotCompileSpec),
};
