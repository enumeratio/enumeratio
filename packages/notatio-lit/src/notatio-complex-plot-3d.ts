import type { BoxedExpression } from "@cortex-js/compute-engine";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { loadEngine } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";
import {
  type ComplexFunction,
  type ComplexSurface,
  complexFunction,
  complexSurfaceSvg,
  debug,
  Orbit,
  ORBIT_HINT,
  parseComplexDomain,
  sampleComplexSurface,
} from "@enumeratio/notatio";

const log = debug("complex-plot-3d");

/**
 * `<notatio-complex-plot-3d value="1/(z^2 + 1)">` -- Wolfram's `ComplexPlot3D`: |f(z)|
 * as a surface over the complex plane, each face coloured by arg f(z) on the same hue
 * wheel `<notatio-complex-plot>` paints. A pole is a spike that rises to `max-height`
 * with every hue winding round it; a zero is a dimple the hues wind round the other way.
 *
 * `value` is **notatio**; LaTeX is accepted inside a `$…$` island. Sampled on the CPU
 * through the base package's complex evaluator, or through the engine's own numeric
 * evaluation for a head it has no lowering for. Drag rotates, ctrl/⌘ + wheel zooms,
 * double-click resets the view.
 */
export class NotatioComplexPlot3D extends LitElement {
  static properties = {
    /** The complex-valued expression to draw, in notatio. */
    value: { type: String },
    /** The complex variable; defaults to `z`. */
    var: { type: String },
    /** The rectangle to sample, as `re0,re1,im0,im1`. */
    domain: { type: String },
    /** Samples per side, clamped to 2..200. */
    samples: { type: Number },
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
    _status: { state: true },
    _hover: { state: true },
  };

  declare value: string;
  declare var: string;
  declare domain: string;
  declare samples: number;
  declare maxHeight: number;
  declare axes: string;
  declare azimuth: number;
  declare elevation: number;
  declare zoom: number;
  declare label: string;
  declare _svg: string;
  declare _status: string;
  declare _hover: [number, number] | undefined;

  #surface: ComplexSurface | undefined;
  #orbit = new Orbit(this);

  constructor() {
    super();
    this.value = "";
    this.var = "z";
    this.domain = "-2,2,-2,2";
    this.samples = 40;
    this.maxHeight = 4;
    this.axes = "true";
    this.azimuth = 45;
    this.elevation = 25;
    this.zoom = 1;
    this.label = "";
    this._svg = "";
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
      const { json, errors } = parseNotatio(raw, {
        parseLatex: (tex) => engine.parse(tex).json,
      });
      if (errors.length) {
        log("value is not notatio", raw, errors);
        this._status = `Could not parse: ${raw}`;
        this._svg = "";
        return;
      }
      const expr = engine.box(json);
      const variable = this.var || "z";
      const f = complexFunction(expr.json, variable) ?? this.#engineFunction(expr, variable);
      this.#surface = sampleComplexSurface(f, {
        domain: parseComplexDomain(this.domain),
        samples: Number(this.samples),
        maxHeight: Number(this.maxHeight),
      });
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
    this._svg = complexSurfaceSvg(this.#surface, {
      axes: this.axes !== "false",
      azimuth: this.azimuth,
      elevation: this.elevation,
      zoom: this.zoom,
      title: this.label || undefined,
      hover: this._hover,
    });
  }

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
        >${unsafeHTML(this._svg)}</span
      >${this._status ? html`<p class="notatio-plot-status">${this._status}</p>` : null}`;
  }
}

if (!customElements.get("notatio-complex-plot-3d")) {
  customElements.define("notatio-complex-plot-3d", NotatioComplexPlot3D);
}
