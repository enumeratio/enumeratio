import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { html, LitElement, type PropertyValues } from "lit";

import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { LONG_PRESS_MS } from "./choice-menu.ts";
import { controlsTemplate } from "./manipulate-ui.ts";
import { openPlaybackMenu } from "./playback-menu.ts";
import { plotFunctions, readEpsil } from "./plot-kernel.ts";
import { ensureStyles } from "./styles.ts";
import {
  clamp,
  type Control,
  debug,
  linePlot,
  type Loop,
  parseControls,
  plotSeries,
  type PlotFrame,
  type PlotSeries,
  type Primitive,
  primitivesOf,
} from "@enumeratio/frontend/core";
import { SliderPlayback } from "./sweep.ts";

const log = debug("plot");

/**
 * `<Plot value="Sin(x)" domain="-6.28,6.28">` -- a 2-D line plot of a
 * univariate expression. `value` is **Epsil** by default, and accepts LaTeX
 * inside a `$…$` island. Samples the
 * expression across `domain` by substituting `var` (defaults to the sole free
 * variable) and taking the numeric value. The page's kernel compiles it; the page samples
 * the code.
 *
 * A list of expressions (`{Sin(x), Cos(x)}`) overlays one series per entry; a
 * list of numeric pairs is plotted as data (ListPlot). `parametric` reads a pair
 * `(x(t), y(t))` as a curve traced over `domain` in `var`; `mode` picks `line` or
 * `points` (data defaults to points, functions to lines). Hovering reads out the
 * nearest sample of each series. Function curves are sampled adaptively (à la
 * Plot's refinement) unless `adaptive="false"`.
 *
 * `params` adds Manipulate-style controls whose values fill the matching **named
 * wildcards** (`_a`, `_b`) in `value` — compute-engine's own slot notation — and
 * re-sample live, e.g. `params="{a, 1, 5}; {b, 0, 6.28}"` over
 * `value="Sin(_a * x + _b)"`. The bare symbol left after the slots are filled is
 * the plot variable.
 *
 * Color is explicit. Each series takes one color of the `discrete` scheme (default
 * `tableau10`); `color-by` instead colors a curve along `x` or `y` on the `gradient`
 * (default `viridis`), reversed by `reverse`. Axes and text follow the page theme.
 */
export class NotatioPlot extends LitElement {
  static properties = {
    /** The curve, in Epsil. A list (`{f, g}`) overlays a series each; a list of pairs is data. */
    value: { type: String },
    /** The plot variable; defaults to the sole free symbol left after the slots are filled. */
    var: { type: String },
    /** The sampling range, as `lo,hi`. */
    domain: { type: String },
    /** Sample count across the domain. Adaptive refinement adds more where the curve bends. */
    samples: { type: Number },
    /** `"false"` hides the axes. */
    axes: { type: String },
    /** Scaling function for x: `linear`, `log`, `log10`, `log2` or `sqrt`. */
    xScale: { type: String, attribute: "x-scale" },
    /** Scaling function for y. */
    yScale: { type: String, attribute: "y-scale" },
    /** Anything but `"false"` reads `value` as a pair `(x(t), y(t))` traced over `domain`. */
    parametric: { type: String },
    /** `line` or `points`; data defaults to points and functions to lines. */
    mode: { type: String },
    /** `"false"` samples on a uniform grid instead of refining where the curve bends. */
    adaptive: { type: String },
    /** Clamp the y range, as `lo,hi`; empty fits the samples. */
    plotRange: { type: String, attribute: "plot-range" },
    /** Marks drawn over the curve, as Epsil graphics primitives: `Point((1, 0.5))`, `Line([...])`, `Circle(c, r)`, `Text("t", p)`. Wolfram's `Epilog`. */
    epilog: { type: String },
    /** Marks drawn under the curve; Wolfram's `Prolog`. */
    prolog: { type: String },
    /** Anything but `"false"` draws grid lines. */
    grid: { type: String },
    /** Anything but `"false"` fills between the curve and the axis. */
    fill: { type: String },
    /** Anything but `"false"` draws a series legend. */
    legend: { type: String },
    /** Axis label for x. */
    xLabel: { type: String, attribute: "x-label" },
    /** Axis label for y. */
    yLabel: { type: String, attribute: "y-label" },
    /** Caption drawn above the plot. */
    label: { type: String },
    /** `x` or `y` colors the curve along that coordinate, on `gradient`, rather than by series. */
    colorBy: { type: String, attribute: "color-by" },
    /** The gradient `color-by` colors along (`viridis`, `magma`, `turbo`, …; see `palettes.ts`). */
    gradient: { type: String },
    /** The discrete scheme that colors the series, one color each: `tableau10`, `set1`, `glasbey`, …. */
    discrete: { type: String },
    /** Run the gradient from its last color to its first. */
    reverse: { type: Boolean },
    /** Manipulate-style controls, e.g. `{a, 1, 5}`, filling the `_a` wildcards in `value`. */
    params: { type: String },
    bindings: { attribute: false },
    /** What a playing slider does at the ends: `cycle` (default), `reflect` or `none`. */
    loop: { type: String, reflect: true },
    _svg: { state: true },
    _hover: { state: true },
    _controls: { state: true },
  };

  declare value: string;
  declare var: string;
  declare domain: string;
  declare samples: number;
  declare axes: string;
  declare xScale: string;
  declare yScale: string;
  declare parametric: string;
  declare mode: string;
  declare adaptive: string;
  declare plotRange: string;
  declare epilog: string;
  declare prolog: string;
  declare grid: string;
  declare fill: string;
  declare legend: string;
  declare xLabel: string;
  declare yLabel: string;
  declare label: string;
  declare colorBy: string;
  declare gradient: string;
  declare discrete: string;
  declare reverse: boolean;
  declare params: string;
  /** Wildcard values (`_a` → 2) from a surrounding Manipulate: sampled into the same code. */
  declare bindings: Record<string, number> | undefined;
  declare loop: Loop | "";
  declare _svg: string;
  declare _hover: number | undefined;
  declare _controls: Control[];

  #series: PlotSeries[] = [];
  #xAt: (px: number) => number = () => Number.NaN;
  #frame: PlotFrame | undefined;

  /** The plot area's geometry after the last render, for an overlay such as a locator. */
  get frame(): PlotFrame | undefined {
    return this.#frame;
  }
  /** Steps a playing slider on the grid, one per interval: a plot's redraw is worth rationing. */
  #playback = new SliderPlayback(
    {
      slider: (n) => {
        const c = this._controls.find((k) => k.name === n);
        return c?.kind === "slider" ? c : undefined;
      },
      set: (n, value) => this.#setControl(n, String(value)),
      loop: () => (this.loop === "reflect" || this.loop === "none" ? this.loop : "cycle"),
      setLoop: (loop) => (this.loop = loop),
      interval: 120,
      motion: "grid",
      update: () => this.requestUpdate(),
    },
    openPlaybackMenu,
    LONG_PRESS_MS,
  );

  constructor() {
    super();
    this.value = "";
    this.var = "";
    this.domain = "-6.283185,6.283185";
    this.samples = 160;
    this.axes = "true";
    this.xScale = "linear";
    this.yScale = "linear";
    this.parametric = "false";
    this.mode = "";
    this.adaptive = "true";
    this.plotRange = "";
    this.epilog = "";
    this.prolog = "";
    this.grid = "false";
    this.fill = "false";
    this.legend = "false";
    this.xLabel = "";
    this.yLabel = "";
    this.label = "";
    this.colorBy = "";
    this.gradient = "viridis";
    this.discrete = "tableau10";
    this.reverse = false;
    this.params = "";
    this.loop = "";
    this._svg = "";
    this._hover = undefined;
    this._controls = [];
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("epilog") || changed.has("prolog")) void this.#readMarks();
    if (
      changed.has("value") ||
      changed.has("var") ||
      changed.has("domain") ||
      changed.has("samples") ||
      changed.has("axes") ||
      changed.has("xScale") ||
      changed.has("yScale") ||
      changed.has("parametric") ||
      changed.has("mode") ||
      changed.has("adaptive") ||
      changed.has("params") ||
      changed.has("bindings")
    ) {
      if (changed.has("params")) this._controls = parseControls(this.params);
      void this.#recompute();
    } else if (
      changed.has("_hover") ||
      changed.has("plotRange") ||
      changed.has("grid") ||
      changed.has("fill") ||
      changed.has("legend") ||
      changed.has("xLabel") ||
      changed.has("yLabel") ||
      changed.has("label") ||
      changed.has("colorBy") ||
      changed.has("gradient") ||
      changed.has("discrete") ||
      changed.has("reverse")
    ) {
      // These only affect drawing, not the sampled data.
      this.#draw();
    }
  }

  #range(): [number, number] {
    const [a, b] = this.domain.split(",").map((s) => Number(s.trim()));
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : [-6.283185, 6.283185];
  }

  async #recompute(): Promise<void> {
    const raw = this.value?.trim();
    if (!raw) {
      this._svg = "";
      return;
    }
    try {
      const loaded = await plotFunctions(raw, { each: true });
      const { plot, samplers } = loaded;
      if (raw !== this.value?.trim()) return;
      // The Manipulate parameters fill the wildcard slots (`_a`), from this plot's own
      // controls or a surrounding Manipulate's bindings; the plot variable is then whatever
      // free symbol remains.
      const scope = loaded.scope();
      for (const c of this._controls) scope[`_${c.name}`] = c.value;
      Object.assign(scope, this.bindings);
      const variable = this.var || plot.unknowns.find((u) => !u.startsWith("_")) || "x";
      // Each curve is code the kernel compiled, sampled per t: vastly faster than a
      // subs()+N() per sample, so a 1000-point sweep or an animated slider stays smooth.
      const at =
        (k: number) =>
        (t: number): number => {
          scope[variable] = t;
          return samplers[k]!(scope);
        };
      this.#series = plotSeries(plot.items, at, {
        domain: this.#range(),
        samples: this.samples,
        mode: this.mode,
        adaptive: this.adaptive !== "false",
        parametric: this.parametric !== "false" && this.parametric !== undefined,
      });
      this.#draw();
    } catch (error) {
      log("could not plot", raw, error);
      this.#series = [];
      this._svg = "";
    }
  }

  #plotRange(): [number, number] | undefined {
    const [a, b] = this.plotRange.split(",").map((s) => Number(s.trim()));
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : undefined;
  }

  #draw(): void {
    if (this.#series.length === 0) return;
    const on = (v: string): boolean => v !== "false" && v !== undefined;
    const { svg, xAt, frame } = linePlot(this.#series, {
      axes: this.axes !== "false",
      xScale: this.xScale,
      yScale: this.yScale,
      hover: this._hover,
      plotRange: this.#plotRange(),
      gridLines: on(this.grid),
      fill: on(this.fill),
      legend: on(this.legend),
      xLabel: this.xLabel || undefined,
      yLabel: this.yLabel || undefined,
      title: this.label || undefined,
      colorBy: this.colorBy === "x" ? "x" : this.colorBy === "y" ? "y" : undefined,
      gradient: this.gradient,
      discrete: this.discrete,
      reverse: this.reverse,
      epilog: this.#marks(this.epilog),
      prolog: this.#marks(this.prolog),
    });
    this._svg = svg;
    // What the build drew for this plot gives way (`data-rendered`).
    this.toggleAttribute("data-rendered", true);
    this.#xAt = xAt;
    this.#frame = frame;
    // Overlays reposition on the new geometry.
    this.dispatchEvent(new CustomEvent("notatio-plot-render"));
  }

  // Graphics primitives from an `epilog`/`prolog` attribute's Epsil, read once each
  // (`#readMarks`); nothing on a parse error.
  #marksOf = new Map<string, Primitive[] | undefined>();

  #marks(source: string): Primitive[] | undefined {
    return source.trim() ? this.#marksOf.get(source) : undefined;
  }

  async #readMarks(): Promise<void> {
    let read = false;
    for (const source of [this.epilog, this.prolog]) {
      if (!source?.trim() || this.#marksOf.has(source)) continue;
      const json = await readEpsil(source);
      this.#marksOf.set(source, json === undefined ? undefined : primitivesOf(json as MathJsonExpression));
      read = true;
    }
    if (read) this.#draw();
  }

  #onPointerMove = (e: PointerEvent): void => {
    const svg = this.querySelector("svg");
    if (!svg) return;
    // Map the pointer into viewBox units; the SVG scales to fit its box.
    const rect = svg.getBoundingClientRect();
    const [, , vw] = (svg.getAttribute("viewBox") ?? "0 0 340 200").split(" ").map(Number);
    const px = ((e.clientX - rect.left) / (rect.width || 1)) * vw;
    this._hover = this.#xAt(px);
  };

  #onPointerLeave = (): void => {
    this._hover = undefined;
  };

  #setControl = (name: string, raw: string): void => {
    this._controls = this._controls.map((c) => {
      if (c.name !== name) return c;
      const v = Number(raw);
      return c.kind === "slider" ? { ...c, value: clamp(v, c.min, c.max) } : { ...c, value: v };
    });
    void this.#recompute();
  };

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#playback.stop();
  }

  #controlsView(): unknown {
    return controlsTemplate(this._controls, this.#playback.playing, {
      set: this.#setControl,
      toggle: this.#playback.toggle,
      press: this.#playback.press,
    });
  }

  protected override render(): unknown {
    return html`<span class="notatio-plot-box" @pointermove=${this.#onPointerMove} @pointerleave=${this.#onPointerLeave}
        >${unsafeHTML(this._svg)}</span
      >${this.#controlsView()}`;
  }
}

if (!customElements.get("notatio-plot")) {
  customElements.define("notatio-plot", NotatioPlot);
}
