import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { plotFunctions } from "./plot-kernel.ts";
import { ensureStyles } from "./styles.ts";
import { debug, type Field2d, vectorPlotSvg } from "@enumeratio/frontend/core";

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
 * `<VectorPlot u="-y" v="x" xrange="-2,2" yrange="-2,2">` -- a planar
 * vector field (Wolfram's `VectorPlot`): `u`/`v` are the two components in
 * Epsil, or `field="-y, x"` gives both at once. Arrows sit on an `n`×`n` grid
 * of cell centers, their length scaling with |F| and their color taking it on
 * the `gradient` (default `viridis`; `reverse` runs it the other way).
 *
 * `type="stream"` switches to `StreamPlot`: streamlines traced from the same
 * grid by fixed-step RK4 on the normalised field -- deterministic, so the same
 * field always draws the same picture (no random seeding).
 */
export class NotatioVectorPlot extends LitElement {
  static properties = {
    /** The x component of the field, in Epsil. */
    u: { type: String },
    /** The y component of the field, in Epsil. */
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
    /** The gradient the arrows or streamlines take by magnitude, |F| (`viridis`, `magma`, `turbo`, …). */
    gradient: { type: String },
    /** Run the gradient from its last color to its first. */
    reverse: { type: Boolean },
    /** Values for a surrounding Manipulate's wildcards, set by the host. */
    bindings: { attribute: false },
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
  declare gradient: string;
  declare reverse: boolean;
  declare bindings: Record<string, number> | undefined;
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
    this.gradient = "viridis";
    this.reverse = false;
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
      changed.has("label") ||
      changed.has("gradient") ||
      changed.has("reverse") ||
      changed.has("bindings")
    ) {
      void this.#recompute();
    }
  }

  #span(raw: string, fallback: [number, number]): [number, number] {
    const [a, b] = raw.split(",").map((s) => Number(s.trim()));
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : fallback;
  }

  #pair(): readonly [string, string] | undefined {
    const parts = this.u?.trim() && this.v?.trim() ? ([this.u, this.v] as const) : undefined;
    return parts ?? (this.field?.trim() ? splitField(this.field) : undefined);
  }

  #key(): string {
    const pair = this.#pair();
    return pair ? `${pair[0]}\u0000${pair[1]}` : "";
  }

  async #recompute(): Promise<void> {
    const pair = this.#pair();
    if (!pair) {
      this._svg = "";
      return;
    }

    try {
      const vx = this.xvar || "x";
      const vy = this.yvar || "y";
      const key = `${pair[0]}\u0000${pair[1]}`;
      const vars = { vars: [vx, vy] };
      const [lu, lv] = await Promise.all([plotFunctions(pair[0], vars), plotFunctions(pair[1], vars)]);
      if (key !== this.#key()) return;

      // Wildcards come from a surrounding Manipulate's bindings.
      const scopeU = lu.scope();
      const scopeV = lv.scope();
      Object.assign(scopeU, this.bindings);
      Object.assign(scopeV, this.bindings);
      const su = lu.samplers[0];
      const sv = lv.samplers[0];
      if (!su || !sv) {
        this._svg = "";
        return;
      }
      const f: Field2d = (x, y) => {
        scopeU[vx] = x;
        scopeU[vy] = y;
        scopeV[vx] = x;
        scopeV[vy] = y;
        return [su(scopeU), sv(scopeV)];
      };

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
        gradient: this.gradient,
        reverse: this.reverse,
      });
    } catch (error) {
      log("could not plot", pair, error);
      this._svg = "";
    }
  }

  protected override render(): unknown {
    return html`<span class="notatio-vector-plot-box">${unsafeHTML(this._svg)}</span>`;
  }
}

if (!customElements.get("notatio-vector-plot")) {
  customElements.define("notatio-vector-plot", NotatioVectorPlot);
}
