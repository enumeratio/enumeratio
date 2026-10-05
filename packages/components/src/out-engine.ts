// The half of `<Out>` that runs on the page's own engine: evaluating a cell here, when no
// kernel takes it, and the forms only an engine can write. `notatio-out.ts` imports this
// when it needs it, so a page whose cells all go through a kernel never loads it.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type MathJsonExpression, serializeEpsil } from "@cortex-js/compute-engine/epsil";
import { collectMessages, type Message } from "@enumeratio/engine";
import { normalizeInputForm, toInputForm } from "@enumeratio/formats/inputform";
import { parseExpression } from "@enumeratio/formats/expression";
import { boundName, elideResult, latexOf, substitutedForm } from "@enumeratio/frontend/core";
import type { TranscriptHost } from "./notatio-out.ts";

/**
 * What a cell draws its input FROM, when `plot` asks for it: the expression with every
 * currently-bound name substituted but not evaluated, and the free names left over --
 * `reactive.ts`'s `substitutedForm`/`PassCell.plot`, generalised off any `Transcript`'s
 * live scope rather than a worksheet pass's own tracked bindings.
 */
export interface PlotInfo {
  /** InputForm -- Epsil a plot element can re-parse (`toInputForm`, round-trips). */
  readonly source: string;
  /** The names still free after substitution, sorted. */
  readonly free: readonly string[];
}

/**
 * Claim `name` in `engine`'s CURRENT (innermost pushed) scope before an `Assign`
 * evaluates it, the way `reactive.ts`'s `runPass` already does for a worksheet's own
 * pass -- see that function's comment for why this is load-bearing rather than tidy.
 * A no-op when `name` is `undefined` (not an assignment) or already declared there.
 */
function declareLocal(engine: ComputeEngine, name: string | undefined): void {
  if (name === undefined) return;
  try {
    engine.declare(name, "unknown");
  } catch {
    // Already declared locally (a re-run of this same cell), or a protected name --
    // either way there is nothing to claim.
  }
}

/** `PlotInfo` for `raw` (parsed, unevaluated), read against `engine`'s current scope. */
function plotOf(engine: ComputeEngine, raw: BoxedExpression): PlotInfo | undefined {
  try {
    const substituted = substitutedForm(engine, raw);
    return {
      source: toInputForm(substituted.json as MathJsonExpression),
      free: [...substituted.unknowns].toSorted(),
    };
  } catch {
    return undefined;
  }
}

/** A cell's settings, as `evaluateHere` reads them. */
export interface HereCell {
  readonly source: string;
  readonly format: string;
  readonly raw: boolean;
  readonly evaluate: boolean;
  readonly plot: boolean;
  readonly elideAbove: number;
  readonly host: TranscriptHost | undefined;
}

/** `cell` evaluated on `engine`, with its `In[n]` line when a transcript recorded it. */
export function evaluateHere(
  engine: ComputeEngine,
  cell: HereCell,
): {
  evaluated: { latex: string; json: unknown; messages: readonly Message[]; name?: string; plot?: PlotInfo };
  line: number | undefined;
} {
  const source = cell.source;
  let line: number | undefined;
  // `raw` keeps the authored tree; evaluation canonicalises regardless, so it wins.
  const form = cell.raw && !cell.evaluate ? { form: "raw" as const } : undefined;
  const host = cell.host;
  const transcript = host?.transcriptFor(engine);
  const parseText = (): BoxedExpression =>
    cell.format === "latex" ? engine.parse(source, form) : engine.box(cellJson(engine, cell.format, source), form);

  let parsed: BoxedExpression | undefined;
  let plotInfo: PlotInfo | undefined;
  const { value: result, messages } = collectMessages(engine, () => {
    if (transcript && cell.evaluate) {
      // `InString(n)` reads back what the reader typed. Read the JSON *before* boxing:
      // `engine.box` folds closed numeric arithmetic (`3 + 4` boxes straight to `7`).
      const input =
        cell.format === "latex" ? source : toInputForm(cellJson(engine, cell.format, source) as MathJsonExpression);
      // Inside the transcript's scope: `a := 5` binds there, and the result becomes the
      // next `In[n]`/`Out[n]`.
      return transcript.run(() => {
        const boxed = parseText();
        parsed = boxed;
        // Claim the name locally before it assigns, the way `runPass` already does
        // for a worksheet's own pass (see that function's comment) -- an `Assign`
        // with nothing declared here yet has nowhere of its own to land. This closes
        // the common case (nothing else on the page has touched the name yet); it is
        // NOT a complete fix for two sheets sharing a name once BOTH have assigned to
        // it at least once -- that residual cross-scope leak is tracked separately
        // (PR description) rather than solved here.
        declareLocal(engine, boundName(boxed.json));
        const value = boxed.evaluate();
        line = transcript.record(input, boxed, value);
        // Read from the scope after `boxed.evaluate()` has had its chance to bind --
        // an `Assign` is not itself substitutable for, so this is only ever something
        // ELSE in the cell reading a binding another cell (or an earlier pass) made.
        if (cell.plot) plotInfo = plotOf(engine, boxed);
        return value;
      });
    }
    line = undefined;
    const boxed = parseText();
    parsed = boxed;
    return cell.evaluate ? boxed.evaluate() : boxed;
  });
  const name = parsed ? boundName(parsed.json) : undefined;
  const latex =
    cell.elideAbove > 0 ? (elideResult(result, cell.elideAbove) ?? latexOf(engine, result)) : latexOf(engine, result);
  return { evaluated: { latex, json: result.json, messages, name, plot: plotInfo }, line };
}

/** `value` as MathJSON, for the two encodings that are not LaTeX. An Epsil diagnostic throws. */
export function cellJson(engine: ComputeEngine, format: string, source: string): MathJsonExpression {
  if (format === "mathjson") return JSON.parse(source) as MathJsonExpression;
  const { json, errors } = parseExpression(source, {
    ce: engine,
    parseLatex: (tex) => engine.parse(tex).json,
  });
  if (errors.length) throw new Error(errors.join("; "));
  return json;
}

/** InputForm of `json`. */
export const inputFormOf = (json: MathJsonExpression): string => toInputForm(json);

/** `json` as one line of InputForm (a closed TreeForm node's arguments). */
export const oneLine = (json: MathJsonExpression): string =>
  serializeEpsil(normalizeInputForm(json), {
    margin: Number.POSITIVE_INFINITY,
    softMargin: Number.POSITIVE_INFINITY,
    libraryNames: "mathjson",
  });

// Code forms whose source comes from a compute-engine compilation TARGET (via
// `target.compileToSource`). The map is `form -> target export name`; held as a
// value so the classes aren't tree-shaken out of the bundle. JavaScript is a
// code form too but uses the free `compile().code` path (see #codeSources).
const CODE_TARGETS = {
  python: "PythonTarget",
  glsl: "GLSLTarget",
  wgsl: "WGSLTarget",
} as const;
export type CodeForm = keyof typeof CODE_TARGETS | "javascript" | "gpushader";

// Source for every code form, via compute-engine's compilation targets. Each
// only handles numeric/function expressions, so non-numeric results (lists,
// boolean comparisons) simply yield no source for that form.
export async function codeSources(engine: ComputeEngine, json: unknown): Promise<Partial<Record<CodeForm, string>>> {
  const out: Partial<Record<CodeForm, string>> = {};
  try {
    const mod = (await import("@cortex-js/compute-engine")) as unknown as Record<
      string,
      new () => { compileToSource(e: unknown): unknown }
    >;
    const expr = engine.box(json as Parameters<typeof engine.box>[0]);
    for (const [form, targetName] of Object.entries(CODE_TARGETS)) {
      try {
        const src = new mod[targetName]().compileToSource(expr);
        if (typeof src === "string") out[form as CodeForm] = src;
      } catch {
        // this target can't compile this expression -- leave it out
      }
    }
    // JavaScript uses the free compile() path; its result carries `.code`.
    try {
      const compileFn = (mod as unknown as { compile?: (e: unknown, o: unknown) => unknown }).compile;
      const res = compileFn?.(json, { engine });
      const code = (res as { code?: unknown } | undefined)?.code;
      if (typeof code === "string") out.javascript = code;
    } catch {
      // not compilable to JavaScript
    }
    out.gpushader = await gpuShader(expr);
  } catch {
    // compute-engine module unavailable
  }
  return out;
}

// GPUShaderForm: the whole shader one of our GPU paths would run for this expression,
// not just the expression's WGSL. One unknown is a complex variable, so the phase
// portrait's fragment shader (<notatio-complex-plot>); one or two reals, the plot grid's
// compute shader (gpu-eval). Anything neither path takes has no shader form.
async function gpuShader(expr: { unknowns: ReadonlyArray<string> }): Promise<string | undefined> {
  const unknowns = [...expr.unknowns].toSorted();
  if (unknowns.length === 0 || unknowns.length > 2) return undefined;
  try {
    if (unknowns.length === 1) {
      const [{ emitComplexWGSL }, { portraitShader }] = await Promise.all([
        import("@enumeratio/analytic"),
        import("@enumeratio/frontend"),
      ]);
      const emitted = emitComplexWGSL((expr as unknown as { json: unknown }).json as never, unknowns[0]);
      if (emitted) return portraitShader(emitted.code);
    }
    const { computeShader, toWgslFn } = await import("@enumeratio/frontend");
    // A lone unknown still gets a two-parameter plot function; the second is unused.
    const [vx, vy = vx === "y" ? "x" : "y"] = unknowns;
    const fn = toWgslFn(expr as never, vx, vy);
    return fn ? computeShader(fn) : undefined;
  } catch {
    return undefined;
  }
}
