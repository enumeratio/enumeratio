import type { BoxedExpression } from "@cortex-js/compute-engine";
import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";
import {
  hurwitzZetaReal,
  lerchPhiReal,
  polyLogReal,
  zetaGeneralizedReal,
} from "@enumeratio/analytic/src";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { html, LitElement, type PropertyValues } from "lit";

// Real-valued kernels for the compiled fast path: compute-engine's `compile`
// handler for these heads emits `_.__hz(…)` / `_.__zg(…)`, resolved on the scope.
const RUNTIME = {
  __hz: hurwitzZetaReal,
  __zg: zetaGeneralizedReal,
  __lp: lerchPhiReal,
  __pl: polyLogReal,
} as const;
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { LONG_PRESS_MS } from "./choice-menu.ts";
import { controlsTemplate } from "./manipulate-ui.ts";
import { openPlaybackMenu } from "./playback-menu.ts";
import { loadEngine } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";
import {
  adaptiveParam,
  adaptiveSample,
  clamp,
  type Control,
  debug,
  linePlot,
  type Loop,
  parseControls,
  type PlotFrame,
  type PlotPoint,
  type PlotSeries,
} from "@enumeratio/notatio";
import { SliderPlayback } from "./sweep.ts";

const log = debug("plot");

const LIST_HEADS = new Set(["List", "Set", "Tuple", "Sequence"]);

// `ops` lives on CE's narrowed function interface; read it structurally.
const opsOf = (e: BoxedExpression): readonly BoxedExpression[] | undefined =>
  (e as unknown as { ops?: readonly BoxedExpression[] }).ops;

/**
 * `<notatio-plot value="Sin(x)" domain="-6.28,6.28">` -- a 2-D line plot of a
 * univariate expression. `value` is **notatio** (the restricted-Epsil subset) by
 * default, and accepts LaTeX inside a `$…$` island. Samples the
 * expression across `domain` by substituting `var` (defaults to the sole free
 * variable) and taking the numeric value. compute-engine is loaded on demand.
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
 */
export class NotatioPlot extends LitElement {
  static properties = {
    /** The curve, in notatio. A list (`{f, g}`) overlays a series each; a list of pairs is data. */
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
    /** `x` or `y` colours the curve along that coordinate rather than by series. */
    colorBy: { type: String, attribute: "color-by" },
    /** Manipulate-style controls, e.g. `{a, 1, 5}`, filling the `_a` wildcards in `value`. */
    params: { type: String },
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
  declare grid: string;
  declare fill: string;
  declare legend: string;
  declare xLabel: string;
  declare yLabel: string;
  declare label: string;
  declare colorBy: string;
  declare params: string;
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
    this.grid = "false";
    this.fill = "false";
    this.legend = "false";
    this.xLabel = "";
    this.yLabel = "";
    this.label = "";
    this.colorBy = "";
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
      changed.has("params")
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
      changed.has("colorBy")
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
      const engine = await loadEngine();
      const { json, errors } = parseNotatio(raw, {
        parseLatex: (tex) => engine.parse(tex).json,
      });
      if (errors.length) {
        log("value is not notatio", raw, errors);
        this.#series = [];
        this._svg = "";
        return;
      }
      const parsed = engine.box(json);
      // Bind the Manipulate parameters first (each control `a` fills the wildcard
      // slot `_a`); the plot variable is then whatever free symbol remains.
      const paramSubs = Object.fromEntries(
        this._controls.map((c) => [`_${c.name}`, engine.number(c.value)]),
      );
      const expr = this._controls.length > 0 ? parsed.subs(paramSubs) : parsed;
      const variable = this.var || expr.unknowns[0] || "x";
      const [lo, hi] = this.#range();
      const count = Math.max(2, Math.min(1000, this.samples));
      const ts = Array.from({ length: count }, (_, i) => lo + ((hi - lo) * i) / (count - 1));
      const style = this.mode === "points" ? "points" : "line";
      // Precompile each curve to a native JS function sampled per t -- vastly
      // faster than a subs()+N() per sample (a 1000-point sweep or an animated
      // Manipulate slider stays smooth). Falls back to symbolic eval for
      // expressions compute-engine's compiler can't emit (e.g. special functions).
      const compiledNum = (e: BoxedExpression): ((t: number) => number) => {
        try {
          // `run` is the ready-to-call form, with compute-engine's `_SYS` runtime
          // helpers bound (integer powers, etc.) — correct where the raw `code`
          // string would reference `_SYS`. The analytic kernels (HurwitzZeta, …)
          // resolve from the scope, read by the compiled code as `_.__hz(…)`.
          const r = new JavaScriptTarget().compile(e) as {
            success?: boolean;
            run?: (scope: Record<string, unknown>) => unknown;
          };
          if (r?.success && typeof r.run === "function") {
            const run = r.run;
            const scope: Record<string, unknown> = { ...RUNTIME };
            return (t) => {
              scope[variable] = t;
              const v = run(scope);
              return typeof v === "number" ? v : Number.NaN;
            };
          }
        } catch {
          /* fall through to symbolic sampling */
        }
        return (t) => {
          const v = e.subs({ [variable]: engine.number(t) }).N();
          return typeof v.re === "number" ? v.re : Number.NaN;
        };
      };
      const pair = (e: BoxedExpression): [number, number] | undefined => {
        const ops = opsOf(e);
        if (!ops || ops.length !== 2 || !LIST_HEADS.has(e.operator)) return undefined;
        const [a, b] = ops.map((o) => o.N().re);
        return typeof a === "number" && typeof b === "number" ? [a, b] : undefined;
      };
      const items = (LIST_HEADS.has(expr.operator) && opsOf(expr)) || [expr];
      const parametric = this.parametric !== "false" && this.parametric !== undefined;
      if (parametric && items.length === 2) {
        // (x(t), y(t)) traced over the domain in t; refined by planar bend.
        const [fx, fy] = items;
        const useAdaptive = this.adaptive !== "false" && style === "line";
        const fxn = compiledNum(fx);
        const fyn = compiledNum(fy);
        const trace = (t: number): [number, number] => [fxn(t), fyn(t)];
        this.#series = [
          {
            points: useAdaptive
              ? adaptiveParam(trace, lo, hi, { init: count })
              : ts.map((t) => {
                  const [x, y] = trace(t);
                  return { x, y };
                }),
            style,
          },
        ];
      } else if (items.length > 0 && items.every((e) => pair(e) !== undefined)) {
        // A list of numeric pairs: data points, drawn as dots unless told otherwise.
        const pts: PlotPoint[] = items.map((e) => {
          const [x, y] = pair(e) as [number, number];
          return { x, y };
        });
        this.#series = [{ points: pts, style: this.mode === "line" ? "line" : "points" }];
      } else {
        const useAdaptive = this.adaptive !== "false" && style === "line";
        this.#series = items.map((e) => {
          const en = compiledNum(e);
          return {
            points: useAdaptive
              ? adaptiveSample(en, lo, hi, { init: count })
              : ts.map((t) => ({ x: t, y: en(t) })),
            style,
            label: items.length > 1 ? e.toString() : undefined,
          };
        });
      }
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
    });
    this._svg = svg;
    this.#xAt = xAt;
    this.#frame = frame;
    // Overlays reposition on the new geometry.
    this.dispatchEvent(new CustomEvent("notatio-plot-render"));
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
    return html`<span
        class="notatio-plot-box"
        @pointermove=${this.#onPointerMove}
        @pointerleave=${this.#onPointerLeave}
        >${unsafeHTML(this._svg)}</span
      >${this.#controlsView()}`;
  }
}

if (!customElements.get("notatio-plot")) {
  customElements.define("notatio-plot", NotatioPlot);
}
