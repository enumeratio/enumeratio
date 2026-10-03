// A plot's side of a kernel: it sends the expression, gets source back
// (`@enumeratio/frontend/plot-compile`), and samples that with no engine of its own. Free
// names, a Manipulate's wildcards (`_a`) included, are the scope's, so moving a control
// samples the same code again rather than asking for new code.

import type { CompiledItem, CompiledPlot, PlotCompileSpec } from "@enumeratio/frontend/plot-compile";
import { loadBareEngine, loadEngineFor, parseFor } from "@enumeratio/frontend/core";
import { pageKernel, translate, WorkerUnavailableError } from "./kernel-client.ts";

export type { CompiledItem, CompiledPlot, PlotCompileSpec };

/** What a compiled function reads: the plot's variables, the wildcards, and its runtime. */
export type Scope = Record<string, unknown>;

/** One item, as a function of a scope; `NaN` where it has no real value. */
export type Sampler = (scope: Scope) => number;

/** A compiled plot with its items ready to sample, and the scope they read from. */
export interface LoadedPlot {
  readonly plot: CompiledPlot;
  readonly samplers: readonly Sampler[];
  /** A fresh scope for one sampling pass: the runtime the code calls, nothing else. */
  scope(): Scope;
}

const compiled = new Map<string, Promise<CompiledPlot>>();
const COMPILED_LIMIT = 64;

/** `text` (Epsil) compiled as `spec` asks: by the page's kernel, else by the page's engine. */
export function compilePlotText(text: string, spec: PlotCompileSpec): Promise<CompiledPlot> {
  const key = JSON.stringify([text, spec]);
  let hit = compiled.get(key);
  if (hit === undefined) {
    if (compiled.size > COMPILED_LIMIT) compiled.clear();
    hit = compileOnce(text, spec);
    compiled.set(key, hit);
    hit.catch(() => compiled.delete(key));
  }
  return hit;
}

async function compileOnce(text: string, spec: PlotCompileSpec): Promise<CompiledPlot> {
  const ask = pageKernel();
  if (ask !== undefined) {
    try {
      const answer = await ask({ source: { text, format: "epsil" }, compile: spec });
      if (answer.error !== undefined) throw new Error(answer.error);
      return answer.compiled as CompiledPlot;
    } catch (err) {
      if (!(err instanceof WorkerUnavailableError)) throw err;
    }
  }
  const [{ compilePlot }, { parseExpression }] = await Promise.all([
    import("@enumeratio/frontend/plot-compile"),
    import("@enumeratio/formats/expression"),
  ]);
  const { engine, parsed } = await parseFor((ce) =>
    parseExpression(text, { ce, parseLatex: (tex) => ce.parse(tex).json }),
  );
  if (parsed.errors.length > 0) throw new Error(parsed.errors.join("; "));
  return compilePlot(engine, parsed.json, spec);
}

// compute-engine's helpers for compiled JavaScript (`_SYS`: integer powers, gamma, …) come
// only with an engine, so a bare one (no libraries) lends them: the first compiled function
// carries them. An upstream candidate: an engine-free runtime entry.
let helpers: Promise<unknown> | undefined;
const systemHelpers = (): Promise<unknown> =>
  (helpers ??= Promise.all([loadBareEngine(), import("@cortex-js/compute-engine/compile")]).then(
    ([ce, { JavaScriptTarget }]) =>
      (new JavaScriptTarget().compile(ce.box(["Power", "x", 3])).run as unknown as { SYS: unknown }).SYS,
  ));

// The analytic kernels the JavaScript target emits calls to, read from the scope
// (`_.__hz(…)`): loaded only for code that calls one.
let analytic: Promise<Scope> | undefined;
const analyticRuntime = (): Promise<Scope> =>
  (analytic ??= import("@enumeratio/analytic").then((m) => ({
    __hz: m.hurwitzZetaReal,
    __zg: m.zetaGeneralizedReal,
    __lp: m.lerchPhiReal,
    __pl: m.polyLogReal,
  })));

/** `text` (Epsil) evaluated numerically (`N`), as MathJSON: by the page's kernel, else the
 *  page's engine. */
export async function numericValueOf(text: string): Promise<unknown> {
  const ask = pageKernel();
  if (ask !== undefined) {
    try {
      const answer = await ask({ source: { text: `N(${text})`, format: "epsil" } });
      if (answer.error !== undefined) throw new Error(answer.error);
      return answer.value;
    } catch (err) {
      if (!(err instanceof WorkerUnavailableError)) throw err;
    }
  }
  const { parseExpression } = await import("@enumeratio/formats/expression");
  const { engine, parsed } = await parseFor((ce) =>
    parseExpression(text, { ce, parseLatex: (tex) => ce.parse(tex).json }),
  );
  if (parsed.errors.length > 0) throw new Error(parsed.errors.join("; "));
  return engine
    .box(parsed.json as never)
    .evaluate()
    .N().json;
}

/** `text` (Epsil) in canonical form, unevaluated: by the page's kernel, else the page's engine. */
export async function canonicalOf(text: string): Promise<unknown> {
  const ask = pageKernel();
  if (ask !== undefined) {
    try {
      const answer = await ask({ source: { text, format: "epsil" }, evaluate: false });
      if (answer.error !== undefined) throw new Error(answer.error);
      return answer.value;
    } catch (err) {
      if (!(err instanceof WorkerUnavailableError)) throw err;
    }
  }
  const { parseExpression } = await import("@enumeratio/formats/expression");
  const { engine, parsed } = await parseFor((ce) =>
    parseExpression(text, { ce, parseLatex: (tex) => ce.parse(tex).json }),
  );
  if (parsed.errors.length > 0) throw new Error(parsed.errors.join("; "));
  return engine.box(parsed.json as never).json;
}

/** `json` with each bound wildcard (`_a`) replaced by its number. Structural; nothing evaluates. */
export function bindWildcards(json: unknown, bindings: Readonly<Record<string, number>> | undefined): unknown {
  if (bindings === undefined) return json;
  const walk = (node: unknown): unknown =>
    typeof node === "string" && Object.hasOwn(bindings, node)
      ? bindings[node]
      : Array.isArray(node)
        ? node.map(walk)
        : node;
  return walk(json);
}

/** `text` (Epsil) as MathJSON: read by the page's kernel, else by the page's engine;
 *  `undefined` when it doesn't parse. */
export async function readEpsil(text: string): Promise<unknown> {
  try {
    const read = await translate({ source: { text, format: "epsil" }, write: "mathjson" });
    if (read !== undefined) return read.json;
  } catch {
    return undefined;
  }
  const { parseExpression } = await import("@enumeratio/formats/expression");
  const { parsed } = await parseFor((ce) => parseExpression(text, { ce, parseLatex: (tex) => ce.parse(tex).json }));
  return parsed.errors.length > 0 ? undefined : parsed.json;
}

const numberOf = (v: unknown): number => (typeof v === "number" ? v : Number.NaN);

/** An item with no compiled code, sampled by the page's engine: `subs`, then `N`, per sample. */
async function engineSampler(item: CompiledItem): Promise<Sampler> {
  const ce = await loadEngineFor(item.json);
  const expr = ce.box(item.json as never);
  return (scope) => {
    const subs: Record<string, ReturnType<typeof ce.number>> = {};
    for (const name of expr.unknowns) {
      const v = scope[name];
      if (typeof v === "number") subs[name] = ce.number(v);
    }
    return numberOf(expr.subs(subs).N().re);
  };
}

/** `plot`'s items as samplers. */
export async function loadPlot(plot: CompiledPlot): Promise<LoadedPlot> {
  const codes = plot.items.map((item) => item.code ?? "");
  const [sys, runtime] = await Promise.all([
    codes.some((c) => c.includes("_SYS")) ? systemHelpers() : undefined,
    codes.some((c) => c.includes("_.__")) ? analyticRuntime() : ({} as Scope),
  ]);
  const samplers = await Promise.all(
    plot.items.map(async (item): Promise<Sampler> => {
      if (item.code === undefined) return engineSampler(item);
      // oxlint-disable-next-line no-implied-eval -- the code is the kernel's compiled output
      const fn = new Function("_SYS", "_", `return (${item.code});`) as (sys: unknown, scope: Scope) => unknown;
      return (scope) => numberOf(fn(sys, scope));
    }),
  );
  return { plot, samplers, scope: () => ({ ...runtime }) };
}

/** `text` compiled to JavaScript and ready to sample. */
export async function plotFunctions(text: string, spec: Omit<PlotCompileSpec, "target"> = {}): Promise<LoadedPlot> {
  return loadPlot(await compilePlotText(text, { ...spec, target: "javascript" }));
}
