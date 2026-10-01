import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { plotFunctions } from "./plot-kernel.ts";
import { ensureStyles } from "./styles.ts";
import { debug, polarPlotSvg, type PolarPoint, samplePolar } from "@enumeratio/frontend/core";

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

const log = debug("polarplot");

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** `[[θ, r], ...]` (or a bare `[r, ...]`, indexed by sample) for ListPolarPlot. */
function toPolarPoints(data: unknown, t0: number, t1: number): PolarPoint[] | undefined {
  if (!Array.isArray(data) || data.length === 0) return undefined;
  if (data.every((p) => Array.isArray(p) && p.length >= 2 && p.every(isNumber)))
    return (data as number[][]).map(([theta, r]) => ({ theta, r }));
  if (data.every(isNumber)) {
    const n = data.length;
    return (data as number[]).map((r, i) => ({
      theta: n > 1 ? t0 + ((t1 - t0) * i) / (n - 1) : t0,
      r,
    }));
  }
  return undefined;
}

/**
 * `<PolarPlot expr="1 + \cos(\theta)" trange="0,6.283">` -- a curve
 * r(θ) on a polar grid (Wolfram's `PolarPlot`). `expr` is sampled at `n`
 * angles across `trange`; poles (non-finite r) break the curve rather than
 * joining branches. `data` gives `ListPolarPlot`: a JSON list of `[θ, r]`
 * pairs, or bare radii spread evenly over `trange`.
 */
export class NotatioPolarPlot extends LitElement {
  static properties = {
    /** The radius r(θ), in Epsil. */
    expr: { type: String },
    /** The angle variable; defaults to the expression's first unknown, else `theta`. */
    tvar: { type: String },
    /** The angular sweep, as `lo,hi` in radians. */
    trange: { type: String },
    /** Sample count across the sweep. */
    n: { type: Number },
    /** Clamp the radial axis; 0 fits the samples. */
    max: { type: Number },
    /** `"false"` hides the polar grid. */
    axes: { type: String },
    /** Anything but `"false"` joins the last point back to the first. */
    closed: { type: String },
    /** Anything but `"false"` shades the region the curve encloses. */
    filled: { type: String },
    /** `"false"` hides the point markers on an explicit data list. */
    markers: { type: String },
    /** Caption drawn above the figure. */
    label: { type: String },
    /** An explicit point list — `[[θ,r],…]` or bare radii — plotted instead of `expr`. */
    data: { type: String },
    bindings: { attribute: false },
    _svg: { state: true },
  };

  declare expr: string;
  declare tvar: string;
  declare trange: string;
  declare n: number;
  declare max: number;
  declare axes: string;
  declare closed: string;
  declare filled: string;
  declare markers: string;
  declare label: string;
  declare data: string;
  /** Wildcard values (`_a` → 2) from a surrounding Manipulate: sampled into the same code. */
  declare bindings: Record<string, number> | undefined;
  declare _svg: string;

  constructor() {
    super();
    this.expr = "";
    this.tvar = "";
    this.trange = "0,6.283185307179586";
    this.n = 240;
    this.max = 0;
    this.axes = "true";
    this.closed = "false";
    this.filled = "false";
    this.markers = "";
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
      changed.has("tvar") ||
      changed.has("trange") ||
      changed.has("n") ||
      changed.has("max") ||
      changed.has("axes") ||
      changed.has("closed") ||
      changed.has("filled") ||
      changed.has("markers") ||
      changed.has("label") ||
      changed.has("data") ||
      changed.has("bindings")
    ) {
      void this.#recompute();
    }
  }

  #span(raw: string, fallback: [number, number]): [number, number] {
    const [a, b] = raw.split(",").map((s) => Number(s.trim()));
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : fallback;
  }

  async #recompute(): Promise<void> {
    const on = (v: string): boolean => v !== "false" && v !== "" && v !== undefined;
    const [t0, t1] = this.#span(this.trange, [0, 2 * Math.PI]);
    const view = {
      axes: this.axes !== "false",
      closed: on(this.closed),
      filled: on(this.filled),
      markers: on(this.markers),
      max: this.max > 0 ? this.max : undefined,
      title: this.label || undefined,
    };

    // ListPolarPlot: explicit points, no expression involved. Markers default
    // on here (the samples *are* the data), unless turned off explicitly.
    const listData = toPolarPoints(parseJson(this.data), t0, t1);
    if (listData) {
      this._svg = polarPlotSvg(listData, { ...view, markers: this.markers !== "false" });
      return;
    }

    const raw = this.expr?.trim();
    if (!raw) {
      this._svg = "";
      return;
    }
    try {
      const loaded = await plotFunctions(raw);
      const { plot, samplers } = loaded;
      if (raw !== this.expr?.trim()) return;
      const scope = loaded.scope();
      Object.assign(scope, this.bindings);
      const vt = this.tvar || plot.unknowns.find((u) => !u.startsWith("_")) || "theta";
      const sample = (t: number): number => {
        scope[vt] = t;
        return samplers[0]!(scope);
      };

      const size = Math.max(2, Math.min(2000, this.n));
      this._svg = polarPlotSvg(samplePolar(sample, t0, t1, size), view);
    } catch (error) {
      log("could not plot", raw, error);
      this._svg = "";
    }
  }

  protected override render(): unknown {
    return html`<span class="notatio-polar-plot-box">${unsafeHTML(this._svg)}</span>`;
  }
}

if (!customElements.get("notatio-polar-plot")) {
  customElements.define("notatio-polar-plot", NotatioPolarPlot);
}
