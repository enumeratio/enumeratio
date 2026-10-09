// A plot's expression compiled where the definitions are: in a kernel (`kernel-host.ts`'s
// `compile`), or on the page's own engine when there is none. The page gets source text, and
// runs it with no engine of its own (`@enumeratio/components`' `plot-kernel.ts`).

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget, WGSLTarget } from "@cortex-js/compute-engine/compile";
import { zetaWGSL } from "@enumeratio/analytic/shader";

/** What to compile a plot's expression to. */
export interface PlotCompileSpec {
  /** `javascript`: an expression over the scope `_` (and compute-engine's helpers `_SYS`).
   *  `wgsl`: a `plotFn(vx, vy) -> f32` function, for the GPU grid. */
  readonly target: "javascript" | "wgsl";
  /** The plot's variables, in order, for `wgsl`; the free names stand in when absent. */
  readonly vars?: readonly string[];
  /** Compile each element of a list on its own: one curve, or one component, per element. */
  readonly each?: boolean;
  /** Wildcard values (`_a` → 2) compiled in, for a target with no scope to read them from. */
  readonly bindings?: Readonly<Record<string, number>>;
}

/** One compiled curve, surface or component. */
export interface CompiledItem {
  /** The canonical MathJSON, for a page that samples it itself when there's no `code`. */
  readonly json: unknown;
  readonly label: string;
  /** The compiled source, when the target could compile it. */
  readonly code?: string;
  /** Its value, when it has no free names. */
  readonly value?: number;
  /** Its two values, when it's a pair of numbers (a data point). */
  readonly point?: readonly [number, number];
}

export interface CompiledPlot {
  /** The free names, sorted, wildcards (`_a`) included: a scope fills them. */
  readonly unknowns: readonly string[];
  /** Whether the expression was a list split into its elements (`each`). */
  readonly list: boolean;
  readonly items: readonly CompiledItem[];
}

const LIST_HEADS = new Set(["List", "Set", "Tuple", "Sequence"]);

// `ops` lives on compute-engine's narrowed function interface; read it structurally.
const opsOf = (e: BoxedExpression): readonly BoxedExpression[] | undefined =>
  (e as unknown as { ops?: readonly BoxedExpression[] }).ops;

const numeric = (e: BoxedExpression): number | undefined => {
  if (e.unknowns.length > 0) return undefined;
  const re = e.N().re;
  return typeof re === "number" && Number.isFinite(re) ? re : undefined;
};

/** A bivariate expression as a WGSL `plotFn`; `zetaWGSL` comes first so the zeta heads resolve. */
export function toWgslFn(expr: BoxedExpression, vx: string, vy: string): string | undefined {
  try {
    const r = new WGSLTarget().compile(expr) as { success?: boolean; code?: string };
    if (!r?.success || !r.code) return undefined;
    return `${zetaWGSL}\nfn plotFn(${vx}: f32, ${vy}: f32) -> f32 { return ${r.code}; }`;
  } catch {
    return undefined;
  }
}

function compileItem(e: BoxedExpression, spec: PlotCompileSpec, unknowns: readonly string[]): CompiledItem {
  const item: { -readonly [K in keyof CompiledItem]: CompiledItem[K] } = { json: e.json, label: e.toString() };
  const value = numeric(e);
  if (value !== undefined) item.value = value;
  const ops = opsOf(e);
  if (ops !== undefined && ops.length === 2 && LIST_HEADS.has(e.operator)) {
    const [a, b] = ops.map(numeric);
    if (a !== undefined && b !== undefined) item.point = [a, b];
  }
  if (spec.target === "wgsl") {
    const free = unknowns.filter((u) => !u.startsWith("_"));
    const [vx = free[0] ?? "x", vy = free.find((u) => u !== vx) ?? "y"] = spec.vars ?? [];
    const code = toWgslFn(e, vx, vy);
    if (code !== undefined) item.code = code;
    return item;
  }
  try {
    const r = new JavaScriptTarget().compile(e) as { success?: boolean; code?: string };
    if (r?.success && typeof r.code === "string") item.code = r.code;
  } catch {
    // not compilable: the page samples `json` itself
  }
  return item;
}

/** `json` compiled as `spec` asks, on `ce`. */
export function compilePlot(ce: ComputeEngine, json: unknown, spec: PlotCompileSpec): CompiledPlot {
  const boxed = ce.box(json as never);
  const bound = Object.entries(spec.bindings ?? {});
  const expr = bound.length > 0 ? boxed.subs(Object.fromEntries(bound.map(([k, v]) => [k, ce.number(v)]))) : boxed;
  const unknowns = [...expr.unknowns].toSorted();
  const list = spec.each === true && LIST_HEADS.has(expr.operator) && (opsOf(expr)?.length ?? 0) > 0;
  const items = list ? [...(opsOf(expr) ?? [])] : [expr];
  return { unknowns, list, items: items.map((e) => compileItem(e, spec, unknowns)) };
}
