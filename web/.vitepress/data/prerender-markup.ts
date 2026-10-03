// The build as a kernel, for a page's own cells and plots (https://github.com/enumeratio/enumeratio/wiki/Speculative-Kernels-and-Front-Ends §9):
// each element `prerender-markup.ts` marked is answered here, in page order, by the site's own
// notebook kernel in Node, and its result written into the page's placeholder. A cell gets
// its typeset rows and its answer (which it renders on load, asking no kernel); a plot, its
// picture at the starting values of the controls it reads.

import { readFileSync } from "node:fs";
import type { ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";
import { createKernel, type Kernel } from "@enumeratio/evaluation";
import { linePlot, parseControls, plotSeries } from "@enumeratio/frontend/core";
import { NOTEBOOK_KERNEL } from "@enumeratio/frontend/kernel-host";
import type { CompiledPlot } from "@enumeratio/frontend/plot-compile";
import { prerender } from "@enumeratio/frontend/prerender";
import { libraryRegistry, registerLibraryNotation } from "../theme/libraries.ts";
import { CATALOGUE } from "../theme/worker-catalogue.ts";
import { type MarkupSpec, specsFile } from "../prerender-markup.ts";
import { makeEngine, typeset } from "./prerender.ts";

let kernel: Promise<Kernel> | undefined;
const pageKernel = (): Promise<Kernel> =>
  (kernel ??= makeEngine().then((ce) =>
    createKernel(ce, CATALOGUE, {
      ...NOTEBOOK_KERNEL,
      libraries: libraryRegistry(),
      notation: registerLibraryNotation,
    }),
  ));

/** A cell's attributes this build can't reproduce: the cell renders them live. */
const LIVE_ONLY = ["box", "raw", "plot", "elide-above", "live-value", "in-form", "out-form", "env"];

const escapeScript = (json: string): string => json.replace(/</g, "\\u003c");

async function cellPreview(spec: MarkupSpec, session: string): Promise<string | undefined> {
  const a = spec.attributes;
  const text = a["value"];
  if (text === undefined || spec.inSession || spec.manipulate.length > 0) return undefined;
  if (Object.keys(a).some((name) => name.startsWith(":") || name.startsWith("v-") || LIVE_ONLY.includes(name)))
    return undefined;
  const format = a["format"] ?? "epsil";
  const k = await pageKernel();
  const answer = await k.evaluate({ source: { text, format }, session, evaluate: a["evaluate"] !== "false" });
  if (!answer.ok || answer.input === undefined) return undefined;
  const { html, ...data } = prerender(k.ce, { text, format }, answer.input, answer.json, typeset);
  return (
    `<span class="notatio-preview"><span class="notatio-preview-label">In</span><span>${html!.input}</span>` +
    `<span class="notatio-preview-label">Out</span><span>${html!.output}</span></span>` +
    `<script type="application/json" class="notatio-answer">${escapeScript(JSON.stringify(data))}</script>`
  );
}

// compute-engine's helpers for compiled code, lent by a compiled function (as on the page).
const systemHelpers = (ce: ComputeEngine): unknown =>
  (new JavaScriptTarget().compile(ce.box(["Power", "x", 3])).run as unknown as { SYS: unknown }).SYS;

async function plotPreview(spec: MarkupSpec): Promise<string | undefined> {
  const a = spec.attributes;
  const text = a["value"];
  if (text === undefined || Object.keys(a).some((name) => name.startsWith(":") || name.startsWith("v-")))
    return undefined;
  const k = await pageKernel();
  const answer = await k.evaluate({ source: { text, format: "epsil" }, compile: { target: "javascript", each: true } });
  const plot = answer.compiled as CompiledPlot | undefined;
  if (!answer.ok || plot === undefined || plot.items.some((item) => item.code === undefined)) return undefined;
  // The wildcards start where their controls do: the plot's own, then a Manipulate's around it.
  const scope: Record<string, unknown> = {};
  if (plot.items.some((item) => item.code!.includes("_.__"))) {
    const m = await import("@enumeratio/analytic");
    Object.assign(scope, {
      __hz: m.hurwitzZetaReal,
      __zg: m.zetaGeneralizedReal,
      __lp: m.lerchPhiReal,
      __pl: m.polyLogReal,
    });
  }
  for (const params of [...spec.manipulate, a["params"] ?? ""])
    for (const c of parseControls(params)) scope[`_${c.name}`] = c.value;
  const sys = systemHelpers(k.ce);
  type Compiled = (s: unknown, v: unknown) => unknown;
  // oxlint-disable-next-line no-implied-eval -- the kernel's compiled output
  const compiled = (code: string): Compiled => new Function("_SYS", "_", `return (${code});`) as Compiled;
  const fns = plot.items.map((item) => compiled(item.code!));
  const variable = a["var"] || plot.unknowns.find((u) => !u.startsWith("_")) || "x";
  const at =
    (i: number) =>
    (t: number): number => {
      scope[variable] = t;
      const v = fns[i]!(sys, scope);
      return typeof v === "number" ? v : Number.NaN;
    };
  const [lo, hi] = (a["domain"] ?? "").split(",").map((s) => Number(s.trim()));
  const series = plotSeries(plot.items, at, {
    domain: Number.isFinite(lo) && Number.isFinite(hi) ? [lo!, hi!] : [-6.283185, 6.283185],
    samples: Number(a["samples"]) || 200,
    mode: a["mode"],
    adaptive: a["adaptive"] !== "false",
    parametric: a["parametric"] !== undefined && a["parametric"] !== "false",
  });
  const on = (v: string | undefined): boolean => v !== undefined && v !== "false";
  const { svg } = linePlot(series, {
    axes: a["axes"] !== "false",
    xScale: a["x-scale"],
    yScale: a["y-scale"],
    gridLines: on(a["grid"]),
    fill: on(a["fill"]),
    legend: on(a["legend"]),
    xLabel: a["x-label"] || undefined,
    yLabel: a["y-label"] || undefined,
    title: a["label"] || undefined,
  });
  return `<span class="notatio-plot-box">${svg}</span>`;
}

/** `html` with each of `page`'s marked elements rendered into its placeholder. */
export async function fillMarkup(html: string, page: string): Promise<string> {
  let specs: MarkupSpec[];
  try {
    specs = JSON.parse(readFileSync(specsFile(page), "utf8")) as MarkupSpec[];
  } catch {
    return html;
  }
  if (specs.length === 0) return html;
  const session = `prerender:${page}`;
  const previews = new Map<number, string>();
  for (const spec of specs) {
    try {
      const preview = spec.tag === "notatio-cell" ? await cellPreview(spec, session) : await plotPreview(spec);
      if (preview !== undefined) previews.set(spec.at, preview);
    } catch {
      // the element renders it live
    }
  }
  const k = await pageKernel();
  await k.evaluate({ session, close: true });
  return html.replace(
    /(<span class="notatio-prerendered" data-prerender="(\d+)"[^>]*>)(<\/span>)/g,
    (whole, open: string, at: string, close: string) => {
      const preview = previews.get(Number(at));
      return preview === undefined ? whole : `${open}${preview}${close}`;
    },
  );
}
