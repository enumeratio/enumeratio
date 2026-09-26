import type { BoxedExpression } from "@cortex-js/compute-engine";
import { emitComplexWGSL } from "@enumeratio/analytic/src";
import { parseExpression } from "@enumeratio/formats/expression";
import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { loadEngine } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";
import {
  CANVAS_THRESHOLD,
  type ComplexFunction,
  type ComplexSurface,
  complexFunction,
  complexGrid,
  complexSurfaceOf,
  complexSurfaceScene,
  debug,
  drawSurfaceScene,
  evalComplexGridGPU,
  Orbit,
  ORBIT_HINT,
  parseComplexDomain,
  sampleComplexSurface,
  type SurfacePaint,
  type SurfaceScene,
  surfaceSceneSvg,
} from "@enumeratio/notatio";

const W = 360;
const H = 260;

const log = debug("complex-plot-3d");

/**
 * `<notatio-complex-plot-3d value="1/(z^2 + 1)">` -- Wolfram's `ComplexPlot3D`: |f(z)|
 * as a surface over the complex plane, each face coloured by arg f(z) on the same hue
 * wheel `<notatio-complex-plot>` paints. A pole is a spike that rises to `max-height`
 * with every hue winding round it; a zero is a dimple the hues wind round the other way.
 *
 * `value` is **Epsil**; LaTeX is accepted inside a `$…$` island. Sampled in a WebGPU
 * compute shader through the same complex lowering the portrait uses, falling back to
 * the CPU -- the base package's complex evaluator, or the engine's own numeric evaluation
 * for a head it has no lowering for -- where WebGPU is missing or the expression doesn't
 * lower. `gpu="false"` forces the CPU; a number sets the GPU's `samples`. Drag rotates,
 * ctrl/⌘ + wheel zooms, double-click resets the view.
 *
 * A grid past `CANVAS_THRESHOLD` samples a side is painted on a canvas rather than
 * serialised as SVG: the same projection and painter's order, but no DOM node per face,
 * so a GPU-resolution surface still turns under the pointer.
 */
export class NotatioComplexPlot3D extends LitElement {
  static properties = {
    /** The complex-valued expression to draw, in Epsil. */
    value: { type: String },
    /** The complex variable; defaults to `z`. */
    var: { type: String },
    /** The rectangle to sample, as `re0,re1,im0,im1`. */
    domain: { type: String },
    /** Samples per side, clamped to 2..400. */
    samples: { type: Number },
    /** `"false"` samples on the CPU even where WebGPU is available. A number sets `samples` for the GPU. */
    gpu: { type: String },
    /** Height ceiling for |f|, since a pole goes to infinity. */
    maxHeight: { type: Number, attribute: "max-height" },
    /** `"false"` hides the axes frame and its range labels. */
    axes: { type: String },
    /** Rotation about the vertical, in degrees. Dragging changes this. */
    azimuth: { type: Number },
    /** Viewing angle above the plane, in degrees. Dragging changes this. */
    elevation: { type: Number },
    /** View scale; ctrl/cmd + wheel or a pinch changes this. Double-click resets. */
    zoom: { type: Number },
    /** Caption drawn above the surface. */
    label: { type: String },
    _svg: { state: true },
    _dense: { state: true },
    _status: { state: true },
    _hover: { state: true },
  };

  declare value: string;
  declare var: string;
  declare domain: string;
  declare samples: number;
  declare gpu: string;
  declare maxHeight: number;
  declare axes: string;
  declare azimuth: number;
  declare elevation: number;
  declare zoom: number;
  declare label: string;
  declare _svg: string;
  declare _dense: boolean;
  declare _status: string;
  declare _hover: [number, number] | undefined;

  #surface: ComplexSurface | undefined;
  #scene: SurfaceScene | undefined;
  #frame = 0;
  #usedGpu = false;
  #orbit = new Orbit(this);

  constructor() {
    super();
    this.value = "";
    this.var = "z";
    this.domain = "-2,2,-2,2";
    this.samples = 40;
    this.gpu = "";
    this.maxHeight = 4;
    this.axes = "true";
    this.azimuth = 45;
    this.elevation = 25;
    this.zoom = 1;
    this.label = "";
    this._svg = "";
    this._dense = false;
    this._status = "";
    this._hover = undefined;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override firstUpdated(): void {
    this.#orbit.remember();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (
      changed.has("value") ||
      changed.has("var") ||
      changed.has("domain") ||
      changed.has("samples") ||
      changed.has("gpu") ||
      changed.has("maxHeight")
    ) {
      void this.#recompute();
    } else if (
      changed.has("azimuth") ||
      changed.has("elevation") ||
      changed.has("zoom") ||
      changed.has("axes") ||
      changed.has("label") ||
      changed.has("_hover")
    ) {
      this.#draw();
    }
  }

  async #recompute(): Promise<void> {
    const raw = this.value?.trim();
    if (!raw) {
      this.#surface = undefined;
      this._svg = "";
      return;
    }
    try {
      const engine = await loadEngine();
      const { json, errors } = parseExpression(raw, {
        parseLatex: (tex) => engine.parse(tex).json,
      });
      if (errors.length) {
        log("value is not Epsil", raw, errors);
        this._status = `Could not parse: ${raw}`;
        this._svg = "";
        return;
      }
      const expr = engine.box(json);
      const variable = this.var || "z";
      const domain = parseComplexDomain(this.domain);
      const maxHeight = Number(this.maxHeight);
      // The portrait's complex lowering, dispatched over the grid, unless `gpu="false"`.
      // Where the expression doesn't lower or WebGPU doesn't answer, the CPU sampler below
      // runs, at the CPU sample count.
      let surface: ComplexSurface | undefined;
      if (this.gpu !== "false") {
        try {
          const emitted = emitComplexWGSL(expr.json as never, variable);
          if (emitted) {
            const { xs, ys } = complexGrid({ domain, samples: Number(this.gpu) || this.samples });
            const values = await evalComplexGridGPU(emitted, variable, xs, ys);
            if (values) surface = complexSurfaceOf(values, xs, ys, maxHeight);
          }
        } catch (error) {
          log("GPU sampling failed; using the CPU", raw, error);
        }
      }
      this.#usedGpu = surface !== undefined;
      if (!surface) {
        const f = complexFunction(expr.json, variable) ?? this.#engineFunction(expr, variable);
        surface = sampleComplexSurface(f, { domain, samples: Number(this.samples), maxHeight });
      }
      this.#surface = surface;
      this._dense = Math.max(surface.xs.length, surface.ys.length) > CANVAS_THRESHOLD;
      this._status = "";
      this.#draw();
    } catch (error) {
      log("could not plot", raw, error);
      this.#surface = undefined;
      this._status = `Could not evaluate: ${raw}`;
      this._svg = "";
    }
  }

  /** The slow path: substitute and `N()` per sample, for a head the evaluator lacks. */
  #engineFunction(expr: BoxedExpression, variable: string): ComplexFunction {
    const engine = expr.engine;
    return ([re, im]) => {
      const w = expr.subs({ [variable]: engine.number(engine.complex(re, im)) }).N();
      return [typeof w.re === "number" ? w.re : Number.NaN, typeof w.im === "number" ? w.im : 0];
    };
  }

  #draw(): void {
    if (!this.#surface) return;
    const scene = complexSurfaceScene(this.#surface, {
      width: W,
      height: H,
      axes: this.axes !== "false",
      azimuth: this.azimuth,
      elevation: this.elevation,
      zoom: this.zoom,
      title: this.label || undefined,
      hover: this._hover,
    });
    if (this._dense) {
      this.#scene = scene;
      this.#paintSoon();
    } else {
      this._svg = surfaceSceneSvg(scene);
    }
  }

  /** Paint at most once per animation frame: a drag delivers events faster than that,
   *  and only the last view matters. */
  #paintSoon(): void {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#paint();
    });
  }

  #paint(): void {
    const canvas = this.querySelector("canvas");
    const scene = this.#scene;
    if (!canvas || !scene) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSurfaceScene(ctx, scene, this.#paintColors());
  }

  /** The theme's colours, resolved: a canvas cannot read the CSS variables the SVG uses. */
  #paintColors(): SurfacePaint {
    const style = getComputedStyle(this);
    const read = (names: string[], fallback: string): string => {
      for (const name of names) {
        const v = style.getPropertyValue(name).trim();
        if (v) return v;
      }
      return fallback;
    };
    return {
      fg: read(["--notatio-fg"], style.color || "currentColor"),
      bg: read(["--notatio-bg", "--vp-c-bg"], "#ffffff"),
      edge: read(["--notatio-border", "--vp-c-divider"], "rgba(128, 128, 128, 0.6)"),
      accent: read(["--notatio-accent", "--vp-c-brand-1"], "#d97706"),
    };
  }

  protected override updated(changed: PropertyValues): void {
    // The canvas appears with the first dense render; paint it once it is there.
    if (changed.has("_dense") && this._dense) this.#paintSoon();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#frame) cancelAnimationFrame(this.#frame);
    this.#frame = 0;
  }

  #toViewBox(e: PointerEvent): [number, number] | undefined {
    const el = this.querySelector("svg, canvas");
    if (!el) return undefined;
    const rect = el.getBoundingClientRect();
    return [((e.clientX - rect.left) / (rect.width || 1)) * W, ((e.clientY - rect.top) / (rect.height || 1)) * H];
  }

  #onPointerMove = (e: PointerEvent): void => {
    this.#orbit.onPointerMove(e);
    if (!this.#orbit.dragging) this._hover = this.#toViewBox(e);
  };

  #onPointerLeave = (): void => {
    this._hover = undefined;
  };

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
        >${this._dense ? html`<canvas role="img" aria-label="surface plot"></canvas>` : unsafeHTML(this._svg)}</span
      >${
        this.#usedGpu
          ? html`<div class="notatio-toolbar">
              <span
                title="grid evaluated on the GPU"
                style="padding:.05em .4em;border-radius:4px;font-size:.72em;font-weight:600;letter-spacing:.04em;background:var(--notatio-accent,#d97706);color:#fff"
                >GPU</span
              >
            </div>`
          : ""
      }${this._status ? html`<p class="notatio-plot-status">${this._status}</p>` : null}`;
  }
}

if (!customElements.get("notatio-complex-plot-3d")) {
  customElements.define("notatio-complex-plot-3d", NotatioComplexPlot3D);
}
