/// <reference types="@webgpu/types" />
import type { ComputeEngine } from "@cortex-js/compute-engine";
import { emitComplexWGSL } from "@enumeratio/analytic/src";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { html, LitElement, type PropertyValues } from "lit";
import { loadEngine } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";
import {
  ComplexPlotRenderer,
  type ComplexPlotView,
  getComplexPlotDevice,
  parseNumeric,
  zoomAbout,
} from "@enumeratio/notatio";

/**
 * `<notatio-complex-plot value="PolyLog(2, z)">` -- domain-colouring of a complex-valued
 * expression over the complex plane, one GPU invocation per pixel: hue is the
 * argument, brightness a compressed log-magnitude, poles white and zeros black.
 *
 * Any expression the complex emitter can lower works, so this replaces a hand-written
 * shader per function. Under `<notatio-manipulate>` every constant becomes an axis:
 *
 * ```html
 * <notatio-manipulate params="{s, 0.5, 6, 0.05}">
 *   <notatio-complex-plot value="PolyLog(_s, z)" mask="1" />
 * </notatio-manipulate>
 * ```
 *
 * A slider moves a literal, not the expression's shape, so the compiled pipeline is
 * reused and the frame costs one small uniform upload -- which is what lets Manipulate
 * interpolate between slider steps and still hold frame.
 *
 * `mask` dims everything outside that radius, for a series whose disk of convergence
 * is part of the story (the polylog's |z| < 1). Drag to pan, scroll to zoom.
 *
 * Framing is manipulable too: `extent="_e"` takes a wildcard directly, and `center`
 * accepts the notatio list form `[_c, 0]` as well as a bare `re,im`.
 */
export class NotatioComplexPlot extends LitElement {
  static properties = {
    /** The complex-valued expression to colour, in notatio. */
    value: { type: String },
    /** The complex variable; defaults to `z`. */
    var: { type: String },
    /** Centre of the view in the complex plane, as `re,im`. Dragging pans it. */
    center: { type: String },
    /** Half-width of the view. Scrolling zooms it. */
    extent: { type: Number },
    /** Dim everything outside this radius; 0 masks nothing. */
    mask: { type: Number },
    /** Canvas height in pixels. */
    height: { type: Number },
    /** Show a frame-rate readout. */
    fps: { type: Boolean },
    _status: { state: true },
    _fps: { state: true },
  };

  declare value: string;
  declare var: string;
  declare center: string;
  declare extent: number;
  declare mask: number;
  declare height: number;
  declare fps: boolean;
  /** Drop the frame and caption, for a pane that already has its own context. */
  declare bare: boolean;
  declare _status: string;
  declare _fps: number;

  #canvas: HTMLCanvasElement | undefined;
  #engine: ComputeEngine | undefined;
  #renderer: ComplexPlotRenderer | undefined;
  #view: ComplexPlotView = { center: [0, 0], extent: 2.4, mask: 0 };
  #home: ComplexPlotView = { center: [0, 0], extent: 2.4, mask: 0 };
  #w = 2;
  #h = 2;
  #frames = 0;
  #last = 0;
  #queued = false;
  #ro: ResizeObserver | undefined;

  constructor() {
    super();
    this.value = "";
    this.var = "z";
    this.center = "0,0";
    this.extent = 2.4;
    this.mask = 0;
    this.height = 460;
    this.fps = false;
    this.bare = false;
    this._status = "";
    this._fps = 0;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override firstUpdated(): void {
    this.#canvas = this.querySelector("canvas") ?? undefined;
    void this.#init();
  }

  async #init(): Promise<void> {
    const canvas = this.#canvas;
    if (!canvas) return;
    const device = await getComplexPlotDevice();
    if (!device) {
      this._status = "This portrait needs WebGPU (Chrome/Edge 113+, Safari 18+).";
      return;
    }
    this.#renderer = new ComplexPlotRenderer(device, canvas);
    this.#engine ??= await loadEngine();
    this.#readView();
    this.#home = {
      center: [...this.#view.center],
      extent: this.#view.extent,
      mask: this.#view.mask,
    };
    this.#ro = new ResizeObserver(() => this.#resize());
    this.#ro.observe(canvas);
    this.#resize();
    await this.#compile();
  }

  /**
   * Re-read the framing attributes into the live view. `center` takes either a bare
   * `re,im` pair or a notatio list `[re, im]` — the latter so a Manipulate wildcard can
   * drive it, since a bare `_c, 0` is not a parseable expression and would be skipped.
   */
  #readView(): void {
    const [cx, cy] = this.center
      .replace(/^\s*[[({]|[\])}]\s*$/g, "")
      .split(",")
      .map(parseNumeric);
    this.#view.center = [Number.isFinite(cx) ? cx : 0, Number.isFinite(cy) ? cy : 0];
    this.#view.extent = Number.isFinite(this.extent) && this.extent > 0 ? this.extent : 2.4;
    this.#view.mask = Number.isFinite(this.mask) && this.mask > 0 ? this.mask : 0;
  }

  /** Parse `value`, emit complex WGSL, and hand it to the renderer. */
  async #compile(): Promise<void> {
    const engine = this.#engine;
    const renderer = this.#renderer;
    if (!engine || !renderer || !this.value.trim()) return;
    const parseLatex = (tex: string) => engine.parse(tex).json;
    const { json, errors } = parseNotatio(this.value, { parseLatex });
    if (errors.length) {
      this._status = `Could not parse: ${this.value}`;
      return;
    }
    let canonical: unknown;
    try {
      canonical = engine.box(json as Parameters<ComputeEngine["box"]>[0]).json;
    } catch {
      this._status = `Could not evaluate: ${this.value}`;
      return;
    }
    const emitted = emitComplexWGSL(canonical as never, this.var);
    if (!emitted) {
      this._status = `No complex GPU lowering for: ${this.value}`;
      return;
    }
    const outcome = await renderer.setExpression(emitted);
    if (outcome === "failed") {
      this._status = `Shader did not compile for: ${this.value}`;
      return;
    }
    this._status = "";
    this.#draw();
  }

  #resize(): void {
    const canvas = this.#canvas;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.#w = Math.max(2, Math.round(canvas.clientWidth * dpr));
    this.#h = Math.max(2, Math.round(canvas.clientHeight * dpr));
    canvas.width = this.#w;
    canvas.height = this.#h;
    this.#draw();
  }

  /** Render now. Direct interaction takes this path: deferring a drag or a zoom to the
   * next frame is latency the user feels as drag, and the events are already paced by
   * the pointer, so there is nothing to coalesce. */
  #drawNow = (): void => {
    this.#queued = false;
    this.#renderer?.render(this.#view, this.#w, this.#h);
    if (!this.fps) return;
    this.#frames++;
    const now = performance.now();
    if (now - this.#last > 400) {
      this._fps = Math.round((this.#frames * 1000) / (now - this.#last));
      this.#frames = 0;
      this.#last = now;
    }
  };

  /** Draw at most once per animation frame — for changes that can arrive faster than
   * frames (an attribute driven by an animating Manipulate), where coalescing saves
   * real work rather than adding lag. */
  #draw = (): void => {
    if (this.#queued) return;
    this.#queued = true;
    requestAnimationFrame(() => {
      if (this.#queued) this.#drawNow();
    });
  };

  protected override updated(changed: PropertyValues): void {
    if (changed.has("value") || changed.has("var")) void this.#compile();
    if (changed.has("center") || changed.has("extent") || changed.has("mask")) {
      this.#readView();
      this.#draw();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#ro?.disconnect();
    this.#ro = undefined;
  }

  /** Public so a container (a worksheet's toolbar) can put the view back. */
  resetView = (): void => {
    this.#view = {
      center: [...this.#home.center] as [number, number],
      extent: this.#home.extent,
      mask: this.#home.mask,
    };
    this.#drawNow();
  };

  #onPointerDown = (e: PointerEvent): void => {
    const canvas = this.#canvas;
    if (!canvas) return;
    let px = e.clientX;
    let py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      this.#view.center[0] -=
        ((m.clientX - px) / r.width) * this.#view.extent * (this.#w / this.#h);
      this.#view.center[1] += ((m.clientY - py) / r.height) * this.#view.extent;
      px = m.clientX;
      py = m.clientY;
      this.#drawNow();
    };
    const up = () => {
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
  };

  /**
   * Zoom about the pointer, not the centre: the point under the cursor has to stay
   * under it, which means shifting the centre by how far that point moves as the
   * extent changes. Zooming about the centre makes you chase whatever you were
   * aiming at.
   */
  #onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const canvas = this.#canvas;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    // Pointer position in [-0.5, 0.5] of the viewport, y up.
    const ux = (e.clientX - r.left) / r.width - 0.5;
    const uy = 0.5 - (e.clientY - r.top) / r.height;
    const next = zoomAbout(this.#view, ux, uy, this.#w / this.#h, Math.exp(e.deltaY * 0.0012));
    if (next.extent === this.#view.extent) return;
    this.#view = next;
    this.#drawNow();
  };

  protected override render(): unknown {
    // `bare` is for a pane inside something that already says what this is -- a sheet's
    // screen, say. The legend explains a portrait to someone meeting one cold; repeated
    // under every pane it is just noise.
    return html`<div class="notatio-complex-plot ${this.bare ? "notatio-complex-plot-bare" : ""}">
      <div class="notatio-complex-plot-stage" style=${`height:${this.height}px`}>
        <canvas @pointerdown=${this.#onPointerDown} @wheel=${this.#onWheel}></canvas>
        ${this._status ? html`<p class="notatio-complex-plot-status">${this._status}</p>` : null}
      </div>
      ${
        // `bare` drops the whole footer, not just the legend: inside a worksheet's
        // screen a per-layer reset is the wrong scope, and the toolbar owns it.
        this.bare
          ? ""
          : html`<div class="notatio-complex-plot-foot">
              <span
                >hue = arg · brightness = |value| · poles white, zeros black · drag to pan · scroll
                to zoom</span
              >
              <button type="button" @click=${this.resetView}>⟲ reset</button>
              ${
                this.fps && this._fps
                  ? html`<span class="notatio-complex-plot-fps">${this._fps} fps</span>`
                  : null
              }
            </div>`
      }
    </div>`;
  }
}

if (!customElements.get("notatio-complex-plot")) {
  customElements.define("notatio-complex-plot", NotatioComplexPlot);
}
