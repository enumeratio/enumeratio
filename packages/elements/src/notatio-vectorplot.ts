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

// Real-valued kernels for the compiled fast path -- see notatio-plot3d.ts.
const RUNTIME = {
  __hz: hurwitzZetaReal,
  __zg: zetaGeneralizedReal,
  __lp: lerchPhiReal,
  __pl: polyLogReal,
} as const;

import { parseNotatio } from "@enumeratio/formats/notatio";
import { debug } from "./debug.ts";
import { loadEngine } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";
import { type Field2d, vectorPlotSvg } from "./vectorplot.ts";

/**
 * Split a `field` attribute into its two components. Handles an optional
 * `\{...\}`, `{...}` or `(...)` wrapper and only splits on a comma at brace /
 * paren depth zero, so `\{\frac{y}{2}, -x\}` survives intact.
 */
export function splitField(raw: string): [string, string] | undefined {
  let s = raw.trim();
  const unwrap: [string, string][] = [
    ["\\{", "\\}"],
    ["\\left(", "\\right)"],
    ["{", "}"],
    ["(", ")"],
    ["[", "]"],
  ];
  for (const [open, close] of unwrap) {
    if (s.startsWith(open) && s.endsWith(close)) {
      s = s.slice(open.length, s.length - close.length).trim();
      break;
    }
  }
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      const u = s.slice(0, i).trim();
      const v = s.slice(i + 1).trim();
      if (u && v) return [u, v];
      return undefined;
    }
  }
  return undefined;
}

const log = debug("vectorplot");

/**
 * `<notatio-vectorplot u="-y" v="x" xrange="-2,2" yrange="-2,2">` -- a planar
 * vector field (Wolfram's `VectorPlot`): `u`/`v` are the two components in
 * notatio, or `field="-y, x"` gives both at once. Arrows sit on an `n`×`n` grid
 * of cell centres, their length and colour scaling with |F|.
 *
 * `type="stream"` switches to `StreamPlot`: streamlines traced from the same
 * grid by fixed-step RK4 on the normalised field -- deterministic, so the same
 * field always draws the same picture (no random seeding).
 */
export class NotatioVectorPlot extends LitElement {
  static properties = {
    /** The x component of the field, in notatio. */
    u: { type: String },
    /** The y component of the field, in notatio. */
    v: { type: String },
    /** Both components at once, comma-separated — `"-y, x"`. */
    field: { type: String },
    /** The variable on the x axis; defaults to the expression's first unknown. */
    xvar: { type: String },
    /** The variable on the y axis; defaults to the next unknown after `xvar`. */
    yvar: { type: String },
    /** The x sampling range, as `lo,hi`. */
    xrange: { type: String },
    /** The y sampling range, as `lo,hi`. */
    yrange: { type: String },
    /** Arrows (or streamline seeds) per side. */
    n: { type: Number },
    /** `vector` for arrows, `stream` for RK4 streamlines. */
    type: { type: String },
    /** Streamline integration steps taken in each direction from a seed. */
    steps: { type: Number },
    /** `"false"` hides the axes. */
    axes: { type: String },
    /** Axis label for x. */
    xLabel: { type: String, attribute: "x-label" },
    /** Axis label for y. */
    yLabel: { type: String, attribute: "y-label" },
    /** Caption drawn above the figure. */
    label: { type: String },
    _svg: { state: true },
  };

  declare u: string;
  declare v: string;
  declare field: string;
  declare xvar: string;
  declare yvar: string;
  declare xrange: string;
  declare yrange: string;
  declare n: number;
  declare type: "vector" | "stream";
  declare steps: number;
  declare axes: string;
  declare xLabel: string;
  declare yLabel: string;
  declare label: string;
  declare _svg: string;

  constructor() {
    super();
    this.u = "";
    this.v = "";
    this.field = "";
    this.xvar = "x";
    this.yvar = "y";
    this.xrange = "-2,2";
    this.yrange = "-2,2";
    this.n = 0;
    this.type = "vector";
    this.steps = 60;
    this.axes = "true";
    this.xLabel = "";
    this.yLabel = "";
    this.label = "";
    this._svg = "";
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (
      changed.has("u") ||
      changed.has("v") ||
      changed.has("field") ||
      changed.has("xvar") ||
      changed.has("yvar") ||
      changed.has("xrange") ||
      changed.has("yrange") ||
      changed.has("n") ||
      changed.has("type") ||
      changed.has("steps") ||
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

  async #recompute(): Promise<void> {
    const parts = this.u?.trim() && this.v?.trim() ? ([this.u, this.v] as const) : undefined;
    const pair = parts ?? (this.field?.trim() ? splitField(this.field) : undefined);
    if (!pair) {
      this._svg = "";
      return;
    }

    try {
      const engine = await loadEngine();
      const vx = this.xvar || "x";
      const vy = this.yvar || "y";
      const box = (src: string): BoxedExpression | undefined => {
        const { json, errors } = parseNotatio(src, {
          parseLatex: (tex) => engine.parse(tex).json,
        });
        if (errors.length) {
          log("component is not notatio", src, errors);
          return undefined;
        }
        return engine.box(json);
      };

      // Precompile each component to native JS -- see notatio-contourplot.ts.
      // Falls back to symbolic subs()+N() when the compiler can't emit it.
      const compileFn = (e: BoxedExpression): ((x: number, y: number) => number) => {
        try {
          const r = new JavaScriptTarget().compile(e) as { success?: boolean; code?: string };
          if (r?.success && r.code) {
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
          }
        } catch {
          // fall through to the symbolic path
        }
        return (x, y) => {
          const z = e.subs({ [vx]: engine.number(x), [vy]: engine.number(y) }).N();
          return typeof z.re === "number" ? z.re : Number.NaN;
        };
      };

      const [u, v] = [box(pair[0]), box(pair[1])];
      if (!u || !v) {
        this._svg = "";
        return;
      }
      const fu = compileFn(u);
      const fv = compileFn(v);
      const f: Field2d = (x, y) => [fu(x, y), fv(x, y)];

      const [x0, x1] = this.#span(this.xrange, [-2, 2]);
      const [y0, y1] = this.#span(this.yrange, [-2, 2]);
      this._svg = vectorPlotSvg(f, x0, x1, y0, y1, {
        type: this.type === "stream" ? "stream" : "vector",
        n: this.n > 0 ? this.n : undefined,
        steps: this.steps,
        axes: this.axes !== "false",
        xLabel: this.xLabel || undefined,
        yLabel: this.yLabel || undefined,
        title: this.label || undefined,
      });
    } catch (error) {
      log("could not plot", pair, error);
      this._svg = "";
    }
  }

  protected override render(): unknown {
    return html`<span class="notatio-vectorplot-box">${unsafeHTML(this._svg)}</span>`;
  }
}

if (!customElements.get("notatio-vectorplot")) {
  customElements.define("notatio-vectorplot", NotatioVectorPlot);
}
