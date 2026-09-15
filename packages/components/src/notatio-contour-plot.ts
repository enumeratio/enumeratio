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

import { contourSvg } from "./contour.ts";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { debug } from "./debug.ts";
import { loadEngine } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";

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

const log = debug("contourplot");

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** A 2-D numeric matrix (for `data`, the ListContourPlot path). */
function toMatrix(data: unknown): number[][] | undefined {
  if (!Array.isArray(data) || data.length === 0 || !data.every((r) => Array.isArray(r)))
    return undefined;
  const rows = (data as unknown[][]).map((r) => r.filter(isNumber));
  return rows.every((r) => r.length === rows[0].length) ? rows : undefined;
}

/**
 * `<notatio-contour-plot expr="x^2 - y^2" xrange="-3,3" yrange="-3,3">` -- the
 * contour lines of a bivariate expression (Wolfram's `ContourPlot`): the
 * expression is sampled on an `n`×`n` grid over `xrange`/`yrange` (substituting
 * the two free variables) and iso-lines are extracted at several levels via
 * marching squares. `levels` accepts either a level count or an explicit JSON
 * array of level values; omitted, ~8 evenly spaced levels are chosen between
 * the sampled min and max. `filled` shades the bands between levels with a
 * sequential ramp instead of drawing lines. `data` (a JSON 2-D array) plots a
 * pre-sampled grid directly, skipping expression evaluation (ListContourPlot).
 */
export class NotatioContourPlot extends LitElement {
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
    /** Grid resolution per side. */
    n: { type: Number },
    /** A contour count, or an explicit JSON list of level values. */
    levels: { type: String },
    /** Anything but `"false"` shades the bands between contours. */
    filled: { type: String },
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
  declare n: number;
  declare levels: string;
  declare filled: string;
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
    this.n = 40;
    this.levels = "";
    this.filled = "false";
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
      changed.has("n") ||
      changed.has("data") ||
      changed.has("levels") ||
      changed.has("filled") ||
      changed.has("axes") ||
      changed.has("xLabel") ||
      changed.has("yLabel") ||
      changed.has("label")
    ) {
      void this.#recompute();
    }
  }

  #span(raw: string, fallback: [number, number]): [number, number] {
    const [a, b] = raw.split(",").map((s) => Number(s.trim()));
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : fallback;
  }

  /** `levels` reads as either an explicit JSON number array, or a bare count. */
  #levels(): { explicit?: readonly number[]; count?: number } {
    const raw = this.levels?.trim();
    if (!raw) return {};
    const asCount = Number(raw);
    if (Number.isFinite(asCount) && !raw.startsWith("[")) return { count: asCount };
    const parsed = parseJson(raw);
    if (Array.isArray(parsed) && parsed.every(isNumber)) return { explicit: parsed };
    return {};
  }

  async #recompute(): Promise<void> {
    const on = (v: string): boolean => v !== "false" && v !== undefined;
    const view = {
      axes: this.axes !== "false",
      filled: on(this.filled),
      xLabel: this.xLabel || undefined,
      yLabel: this.yLabel || undefined,
      title: this.label || undefined,
      ...this.#levels(),
    };

    // ListContourPlot: a pre-sampled matrix, no expression involved.
    const listData = toMatrix(parseJson(this.data));
    if (listData) {
      const xs = listData[0].map((_, i) => i);
      const ys = listData.map((_, j) => j);
      this._svg = contourSvg(listData, xs, ys, view);
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
      const [xlo, xhi] = this.#span(this.xrange, [-3, 3]);
      const [ylo, yhi] = this.#span(this.yrange, [-3, 3]);
      const size = Math.max(2, Math.min(120, this.n));
      const xs = Array.from({ length: size }, (_, i) => xlo + ((xhi - xlo) * i) / (size - 1));
      const ys = Array.from({ length: size }, (_, j) => ylo + ((yhi - ylo) * j) / (size - 1));

      // Precompile to a native JS function -- see notatio-plot-3d.ts's rationale.
      // Falls back to symbolic subs()+N() per sample when the compiler can't
      // emit the expression (e.g. a special function).
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
            const v = g(scope);
            return typeof v === "number" ? v : Number.NaN;
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

      this._svg = contourSvg(grid, xs, ys, view);
    } catch (error) {
      log("could not plot", raw, error);
      this._svg = "";
    }
  }

  protected override render(): unknown {
    return html`<span class="notatio-contour-plot-box">${unsafeHTML(this._svg)}</span>`;
  }
}

if (!customElements.get("notatio-contour-plot")) {
  customElements.define("notatio-contour-plot", NotatioContourPlot);
}
