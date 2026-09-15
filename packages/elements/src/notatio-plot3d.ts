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
import { evalGridGPU, toWgslFn } from "./gpu-eval.ts";
import { LONG_PRESS_MS } from "./choice-menu.ts";
import { controlsTemplate } from "./manipulate-ui.ts";
import { type Loop, SliderPlayback } from "./playback.ts";
import { openPlaybackMenu } from "./playback-menu.ts";
import { type Control, clamp, parseControls } from "./manipulate.ts";
import { debug } from "./debug.ts";
import { loadEngine } from "./mathlive.ts";
import { type Surface3dOptions, surfacesSvg } from "./plot3d.ts";
import { Orbit, ORBIT_HINT } from "./orbit.ts";
import { ensureStyles } from "./styles.ts";

const log = debug("plot3d");

const LIST_HEADS = new Set(["List", "Set", "Tuple", "Sequence"]);
const opsOf = (e: BoxedExpression): readonly BoxedExpression[] | undefined =>
  (e as unknown as { ops?: readonly BoxedExpression[] }).ops;

/**
 * `<notatio-plot3d value="Sin(x) * Cos(y)" x-domain="-3,3" y-domain="-3,3">` --
 * a surface plot of a bivariate expression, projected to SVG. `value` is
 * **notatio**; LaTeX is accepted inside a `$…$` island.
 * Samples an `n`×`n` grid by substituting the two free variables (defaulting to
 * the first two unknowns) and drawing the height field. compute-engine loads on
 * demand. The view is interactive: drag rotates (`azimuth` / `elevation`), and
 * ctrl/⌘ + wheel (or a pinch) zooms. Sampling happens once per expression; a
 * view change only re-projects the cached grid.
 *
 * `params` adds Manipulate-style sliders whose values fill the matching named
 * wildcards (`_k`) in `value` and re-sample live, e.g. `params="{k, 1, 4}"` over
 * `value="Sin(_k * x) * Cos(_k * y)"`.
 */
export class NotatioPlot3d extends LitElement {
  static properties = {
    /** The surface, in notatio. A list (`{f, g}`) overlays several on one scale. */
    value: { type: String },
    /** The variable on the x axis; defaults to the expression's first unknown. */
    xvar: { type: String },
    /** The variable on the y axis; defaults to the next unknown after `xvar`. */
    yvar: { type: String },
    /** The x sampling range, as `lo,hi`. */
    xDomain: { type: String, attribute: "x-domain" },
    /** The y sampling range, as `lo,hi`. */
    yDomain: { type: String, attribute: "y-domain" },
    /** Grid resolution per side, clamped to 2..60. `gpu` raises this. */
    n: { type: Number },
    /** `"false"` hides the axes frame and its range labels. */
    axes: { type: String },
    /** Scaling function for x: `linear`, `log`, `log10`, `log2` or `sqrt`. */
    xScale: { type: String, attribute: "x-scale" },
    /** Scaling function for y. */
    yScale: { type: String, attribute: "y-scale" },
    /** Scaling function for the height. */
    zScale: { type: String, attribute: "z-scale" },
    /** Rotation about the vertical, in degrees. Dragging changes this. */
    azimuth: { type: Number },
    /** Viewing angle above the plane, in degrees. Dragging changes this. */
    elevation: { type: Number },
    /** View scale; ctrl/cmd + wheel or a pinch changes this. Double-click resets. */
    zoom: { type: Number },
    /** Caption drawn above the surface. */
    label: { type: String },
    /** Anything but `"false"` draws the height-colour ramp beside the surface. */
    colorLegend: { type: String, attribute: "color-legend" },
    /** Anything but `"false"` auto-rotates the view; the ⟳ button toggles it. */
    spin: { type: String },
    /** Evaluate the grid in a WebGPU shader. A number also sets `n`; falls back to the CPU. */
    gpu: { type: String },
    /** Manipulate-style controls, e.g. `{k, 1, 4}`, filling the `_k` wildcards in `value`. */
    params: { type: String },
    /** What a playing slider does at the ends: `cycle` (default), `reflect` or `none`. */
    loop: { type: String, reflect: true },
    _svg: { state: true },
    _controls: { state: true },
    _hover: { state: true },
  };

  declare value: string;
  declare xvar: string;
  declare yvar: string;
  declare xDomain: string;
  declare yDomain: string;
  declare n: number;
  declare axes: string;
  declare xScale: string;
  declare yScale: string;
  declare zScale: string;
  declare azimuth: number;
  declare elevation: number;
  declare zoom: number;
  declare label: string;
  declare colorLegend: string;
  declare spin: string;
  declare gpu: string;
  declare params: string;
  declare loop: Loop | "";
  declare _svg: string;
  declare _controls: Control[];
  declare _hover: [number, number] | undefined;

  #grids: number[][][] = [];
  #xs: number[] = [];
  #ys: number[] = [];
  #usedGpu = false;
  #orbit = new Orbit(this);
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
  #spinTimer: ReturnType<typeof setInterval> | undefined;
  // The initial (attribute-set) view, restored on double-click.

  constructor() {
    super();
    this.value = "";
    this.xvar = "";
    this.yvar = "";
    this.xDomain = "-3,3";
    this.yDomain = "-3,3";
    this.n = 26;
    this.axes = "true";
    this.xScale = "linear";
    this.yScale = "linear";
    this.zScale = "linear";
    this.azimuth = 45;
    this.elevation = 15;
    this.zoom = 1;
    this.label = "";
    this.colorLegend = "false";
    this.spin = "false";
    this.gpu = "false";
    this.params = "";
    this.loop = "";
    this._svg = "";
    this._controls = [];
    this._hover = undefined;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override firstUpdated(): void {
    // Remember the attribute-set view before any drag mutates it.
    this.#orbit.remember();
    if (this.spin !== "false" && this.spin !== undefined) this.#setSpin(true);
  }

  // Auto-rotate: nudge the azimuth on a timer so the surface turns on its own.
  #setSpin(on: boolean): void {
    if (on && !this.#spinTimer) {
      this.#spinTimer = setInterval(() => {
        this.azimuth = (this.azimuth + 1.5) % 360;
      }, 50);
    } else if (!on && this.#spinTimer) {
      clearInterval(this.#spinTimer);
      this.#spinTimer = undefined;
    }
    this.requestUpdate();
  }

  #toggleSpin = (): void => {
    this.#setSpin(!this.#spinTimer);
  };

  protected override willUpdate(changed: PropertyValues): void {
    if (
      changed.has("value") ||
      changed.has("xvar") ||
      changed.has("yvar") ||
      changed.has("xDomain") ||
      changed.has("yDomain") ||
      changed.has("n") ||
      changed.has("gpu") ||
      changed.has("axes") ||
      changed.has("xScale") ||
      changed.has("yScale") ||
      changed.has("zScale") ||
      changed.has("params")
    ) {
      if (changed.has("params")) this._controls = parseControls(this.params);
      void this.#recompute();
    } else if (changed.has("spin") && this.hasUpdated) {
      // Runtime spin attribute change (firstUpdated handles the initial one).
      this.#setSpin(this.spin !== "false" && this.spin !== undefined);
    } else if (
      changed.has("azimuth") ||
      changed.has("elevation") ||
      changed.has("zoom") ||
      changed.has("label") ||
      changed.has("colorLegend") ||
      changed.has("_hover")
    ) {
      this.#draw();
    }
  }

  #span(raw: string, fallback: [number, number]): [number, number] {
    const [a, b] = raw.split(",").map((s) => Number(s.trim()));
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : fallback;
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
        this._svg = "";
        return;
      }
      const parsed = engine.box(json);
      // Bind Manipulate parameters first (control `k` fills the wildcard `_k`);
      // the surface variables are the two free symbols that remain.
      const paramSubs = Object.fromEntries(
        this._controls.map((c) => [`_${c.name}`, engine.number(c.value)]),
      );
      const expr = this._controls.length > 0 ? parsed.subs(paramSubs) : parsed;
      // A list of expressions overlays several surfaces on a shared scale.
      const items = (LIST_HEADS.has(expr.operator) && opsOf(expr)) || [expr];
      const vx = this.xvar || expr.unknowns[0] || "x";
      const vy = this.yvar || expr.unknowns.find((u: string) => u !== vx) || "y";
      const [xlo, xhi] = this.#span(this.xDomain, [-3, 3]);
      const [ylo, yhi] = this.#span(this.yDomain, [-3, 3]);
      const size = Math.max(2, Math.min(60, this.n));
      const xs = Array.from({ length: size }, (_, i) => xlo + ((xhi - xlo) * i) / (size - 1));
      const ys = Array.from({ length: size }, (_, j) => ylo + ((yhi - ylo) * j) / (size - 1));
      // Precompile the surface to a native JS function and sample that -- orders of
      // magnitude faster than a subs()+N() per grid point, which keeps Manipulate
      // sliders smooth. Falls back to symbolic eval for expressions compute-engine's
      // compiler can't emit (e.g. special functions like HurwitzZeta).
      const compileFn = (e: BoxedExpression): ((x: number, y: number) => number) | undefined => {
        try {
          const r = new JavaScriptTarget().compile(e) as { success?: boolean; code?: string };
          if (!r?.success || !r.code) return undefined;
          // `code` is an expression over a scope object `_` (e.g. `Math.sin(_.x)`).
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
      const sampleGrid = (e: BoxedExpression): number[][] => {
        const f = compileFn(e);
        if (f) return ys.map((y) => xs.map((x) => f(x, y)));
        return ys.map((y) =>
          xs.map((x) => {
            const z = e.subs({ [vx]: engine.number(x), [vy]: engine.number(y) }).N();
            return typeof z.re === "number" ? z.re : Number.NaN;
          }),
        );
      };
      // Opt-in GPU path: compile every surface to WGSL and evaluate the grid on the
      // GPU in parallel. Only taken when `gpu` is set, WebGPU is available, and every
      // surface compiled — otherwise the CPU sampler above runs. `gpu` accepts an
      // optional grid override (`gpu="120"`) since the GPU handles far denser grids.
      const wantGpu = this.gpu !== "false" && this.gpu !== undefined && this.gpu !== "";
      let grids: number[][][] | undefined;
      if (wantGpu) {
        const gsize = Math.max(2, Math.min(400, Number(this.gpu) || size));
        const gxs = Array.from({ length: gsize }, (_, i) => xlo + ((xhi - xlo) * i) / (gsize - 1));
        const gys = Array.from({ length: gsize }, (_, j) => ylo + ((yhi - ylo) * j) / (gsize - 1));
        const results = await Promise.all(
          items.map((e) => {
            const fn = toWgslFn(e, vx, vy);
            return fn ? evalGridGPU(fn, gxs, gys) : Promise.resolve(undefined);
          }),
        );
        if (results.every((g): g is number[][] => g !== undefined)) {
          grids = results;
          this.#xs = gxs;
          this.#ys = gys;
        }
      }
      this.#usedGpu = grids !== undefined;
      if (!grids) {
        grids = items.map(sampleGrid);
        this.#xs = xs;
        this.#ys = ys;
      }
      this.#grids = grids;
      this.#draw();
    } catch (error) {
      log("could not plot", raw, error);
      this.#grids = [];
      this._svg = "";
    }
  }

  #draw(): void {
    if (this.#grids.length === 0) return;
    const view: Surface3dOptions = {
      xs: this.#xs,
      ys: this.#ys,
      axes: this.axes !== "false",
      xScale: this.xScale,
      yScale: this.yScale,
      zScale: this.zScale,
      azimuth: this.azimuth,
      elevation: this.elevation,
      zoom: this.zoom,
      title: this.label || undefined,
      colorLegend: this.colorLegend !== "false" && this.colorLegend !== undefined,
      hover: this._hover,
    };
    this._svg = surfacesSvg(this.#grids, view);
  }

  // Map a pointer event to viewBox coordinates of the surface's SVG.
  #toViewBox(e: PointerEvent): [number, number] | undefined {
    const svg = this.querySelector("svg");
    if (!svg) return undefined;
    const rect = svg.getBoundingClientRect();
    const [, , vw, vh] = (svg.getAttribute("viewBox") ?? "0 0 360 260").split(" ").map(Number);
    return [
      ((e.clientX - rect.left) / (rect.width || 1)) * vw,
      ((e.clientY - rect.top) / (rect.height || 1)) * vh,
    ];
  }

  #onPointerMove = (e: PointerEvent): void => {
    this.#orbit.onPointerMove(e);
    // Not dragging: read out the nearest sample under the pointer.
    if (!this.#orbit.dragging) this._hover = this.#toViewBox(e);
  };

  #onPointerLeave = (): void => {
    this._hover = undefined;
  };

  #setControl = (name: string, raw: string): void => {
    this._controls = this._controls.map((c) =>
      c.name === name
        ? c.kind === "slider"
          ? { ...c, value: clamp(Number(raw), c.min, c.max) }
          : { ...c, value: Number(raw) }
        : c,
    );
    void this.#recompute();
  };

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#playback.stop();
    if (this.#spinTimer) clearInterval(this.#spinTimer);
    this.#spinTimer = undefined;
  }

  #controlsView(): unknown {
    return controlsTemplate(this._controls, this.#playback.playing, {
      set: this.#setControl,
      toggle: this.#playback.toggle,
      press: this.#playback.press,
    });
  }

  #toolbar(): unknown {
    // A spin toggle (auto-rotate) sits under the figure, always available.
    return html`<div class="notatio-toolbar">
      <button
        type="button"
        class="notatio-spin ${this.#spinTimer ? "is-on" : ""}"
        aria-pressed=${this.#spinTimer ? "true" : "false"}
        title="auto-rotate"
        aria-label="auto-rotate"
        @click=${this.#toggleSpin}
      >
        ⟳
      </button>
      ${
        this.#usedGpu
          ? html`<span
              title="grid evaluated on the GPU"
              style="margin-left:.5em;padding:.05em .4em;border-radius:4px;font-size:.72em;font-weight:600;letter-spacing:.04em;background:var(--notatio-accent,#d97706);color:#fff"
              >GPU</span
            >`
          : ""
      }
    </div>`;
  }

  protected override render(): unknown {
    return html`<span
        class="notatio-plot-box"
        style="cursor: grab; touch-action: none; user-select: none"
        @pointerdown=${this.#orbit.onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#orbit.onPointerUp}
        @pointercancel=${this.#orbit.onPointerUp}
        @pointerleave=${this.#onPointerLeave}
        @dblclick=${this.#orbit.onDblClick}
        @wheel=${this.#orbit.onWheel}
        title=${ORBIT_HINT}
        >${unsafeHTML(this._svg)}</span
      >${this.#toolbar()}${this.#controlsView()}`;
  }
}

if (!customElements.get("notatio-plot3d")) {
  customElements.define("notatio-plot3d", NotatioPlot3d);
}
