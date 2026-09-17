import type { BoxedExpression } from "@cortex-js/compute-engine";
import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";
import {
  hurwitzZetaReal,
  lerchPhiReal,
  polyLogReal,
  zetaGeneralizedReal,
} from "@enumeratio/analytic/src";
import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

// Real-valued kernels for the compiled fast path -- see notatio-plot-3d.ts.
const RUNTIME = {
  __hz: hurwitzZetaReal,
  __zg: zetaGeneralizedReal,
  __lp: lerchPhiReal,
  __pl: polyLogReal,
} as const;

import { parseNotatio } from "@enumeratio/formats/notatio";
import { loadEngine } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";
import { debug, densitySvg } from "@enumeratio/notatio";

/** Parse a JSON attribute defensively -- an empty/invalid value reads as `undefined`. */
function parseJson(value: string): unknown {
  const text = value.trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const log = debug("densityplot");

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** A 2-D numeric matrix (for `data`, the ListDensityPlot path). */
function toMatrix(data: unknown): number[][] | undefined {
  if (!Array.isArray(data) || data.length === 0 || !data.every((r) => Array.isArray(r)))
    return undefined;
  const rows = (data as unknown[][]).map((r) => r.filter(isNumber));
  return rows.every((r) => r.length === rows[0].length && r.length > 0) ? rows : undefined;
}

/**
 * `<notatio-density-plot expr="\sin(x)\cos(y)" xrange="-3,3" yrange="-3,3">` --
 * a bivariate function as a heatmap (Wolfram's `DensityPlot`): the expression
 * is sampled on an `n`×`n` grid and each sample is shaded on a sequential
 * ramp. `legend` adds a colour bar; `zrange` pins the colour scale so several
 * plots can share one. `data` (a JSON 2-D array) shades a pre-sampled grid
 * directly (`ListDensityPlot`).
 */
export class NotatioDensityPlot extends LitElement {
  static properties = {
    /** The bivariate expression, in notatio. */
    expr: { type: String },
    /** The variable on the x axis; defaults to the expression's first unknown. */
    xvar: { type: String },
    /** The variable on the y axis; defaults to the next unknown after `xvar`. */
    yvar: { type: String },
    /** The x sampling range, as `lo,hi`. */
    xrange: { type: String },
    /** The y sampling range, as `lo,hi`. */
    yrange: { type: String },
    /** Clamp the colour ramp, as `lo,hi`; empty fits the sampled values. */
    zrange: { type: String },
    /** Grid resolution per side. */
    n: { type: Number },
    /** Anything but `"false"` draws the colour ramp beside the plot. */
    legend: { type: String },
    /** `"false"` hides the axes. */
    axes: { type: String },
    /** Axis label for x. */
    xLabel: { type: String, attribute: "x-label" },
    /** Axis label for y. */
    yLabel: { type: String, attribute: "y-label" },
    /** Caption drawn above the figure. */
    label: { type: String },
    /** A pre-sampled grid as a JSON matrix, plotted instead of `expr`. */
    data: { type: String },
    _svg: { state: true },
  };

  declare expr: string;
  declare xvar: string;
  declare yvar: string;
  declare xrange: string;
  declare yrange: string;
  declare zrange: string;
  declare n: number;
  declare legend: string;
  declare axes: string;
  declare xLabel: string;
  declare yLabel: string;
  declare label: string;
  declare data: string;
  declare _svg: string;

  constructor() {
    super();
    this.expr = "";
    this.xvar = "";
    this.yvar = "";
    this.xrange = "-3,3";
    this.yrange = "-3,3";
    this.zrange = "";
    this.n = 48;
    this.legend = "false";
    this.axes = "true";
    this.xLabel = "";
    this.yLabel = "";
    this.label = "";
    this.data = "";
    this._svg = "";
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (
      changed.has("expr") ||
      changed.has("xvar") ||
      changed.has("yvar") ||
      changed.has("xrange") ||
      changed.has("yrange") ||
      changed.has("zrange") ||
      changed.has("n") ||
      changed.has("legend") ||
      changed.has("axes") ||
      changed.has("xLabel") ||
      changed.has("yLabel") ||
      changed.has("label") ||
      changed.has("data")
    ) {
      void this.#recompute();
    }
  }

  #span(raw: string, fallback?: [number, number]): [number, number] | undefined {
    const [a, b] = raw.split(",").map((s) => Number(s.trim()));
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : fallback;
  }

  async #recompute(): Promise<void> {
    const on = (v: string): boolean => v !== "false" && v !== undefined;
    const view = {
      axes: this.axes !== "false",
      legend: on(this.legend),
      zRange: this.zrange ? this.#span(this.zrange) : undefined,
      xLabel: this.xLabel || undefined,
      yLabel: this.yLabel || undefined,
      title: this.label || undefined,
    };

    // ListDensityPlot: a pre-sampled matrix, no expression involved.
    const listData = toMatrix(parseJson(this.data));
    if (listData) {
      const xs = listData[0].map((_, i) => i);
      const ys = listData.map((_, j) => j);
      this._svg = densitySvg(listData, xs, ys, view);
      return;
    }

    const raw = this.expr?.trim();
    if (!raw) {
      this._svg = "";
      return;
    }
    try {
      const engine = await loadEngine();
      const { json, errors } = parseNotatio(raw, {
        parseLatex: (tex) => engine.parse(tex).json,
      });
      if (errors.length) {
        log("expr is not notatio", raw, errors);
        this._svg = "";
        return;
      }
      const expr = engine.box(json);
      const vx = this.xvar || expr.unknowns[0] || "x";
      const vy = this.yvar || expr.unknowns.find((u: string) => u !== vx) || "y";
      const [xlo, xhi] = this.#span(this.xrange, [-3, 3]) ?? [-3, 3];
      const [ylo, yhi] = this.#span(this.yrange, [-3, 3]) ?? [-3, 3];
      const size = Math.max(2, Math.min(160, this.n));
      const xs = Array.from({ length: size }, (_, i) => xlo + ((xhi - xlo) * i) / (size - 1));
      const ys = Array.from({ length: size }, (_, j) => ylo + ((yhi - ylo) * j) / (size - 1));

      // Precompile to native JS -- see notatio-contour-plot.ts's rationale.
      const compileFn = (e: BoxedExpression): ((x: number, y: number) => number) | undefined => {
        try {
          const r = new JavaScriptTarget().compile(e) as { success?: boolean; code?: string };
          if (!r?.success || !r.code) return undefined;
          // oxlint-disable-next-line no-implied-eval -- running compute-engine-compiled source is the point
          const g = new Function("_", `"use strict"; return (${r.code});`) as (
            s: Record<string, unknown>,
          ) => unknown;
          const scope: Record<string, unknown> = { ...RUNTIME };
          return (x, y) => {
            scope[vx] = x;
            scope[vy] = y;
            const out = g(scope);
            return typeof out === "number" ? out : Number.NaN;
          };
        } catch {
          return undefined;
        }
      };
      const f = compileFn(expr);
      const grid: number[][] = f
        ? ys.map((y) => xs.map((x) => f(x, y)))
        : ys.map((y) =>
            xs.map((x) => {
              const z = expr.subs({ [vx]: engine.number(x), [vy]: engine.number(y) }).N();
              return typeof z.re === "number" ? z.re : Number.NaN;
            }),
          );

      this._svg = densitySvg(grid, xs, ys, view);
    } catch (error) {
      log("could not plot", raw, error);
      this._svg = "";
    }
  }

  protected override render(): unknown {
    return html`<span class="notatio-density-plot-box">${unsafeHTML(this._svg)}</span>`;
  }
}

if (!customElements.get("notatio-density-plot")) {
  customElements.define("notatio-density-plot", NotatioDensityPlot);
}
