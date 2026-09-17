import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { html, LitElement, type PropertyValues } from "lit";
import { capture, release } from "./pointer.ts";
import { ensureStyles } from "./styles.ts";
import {
  holdMultiplier,
  modifierGear,
  numberJson,
  numberLatex,
  parseComplex,
  type PlotFrame,
} from "@enumeratio/notatio";
import { defineControl, emitControl } from "./define.ts";

interface Framed extends HTMLElement {
  readonly frame?: PlotFrame;
}

/**
 * `<notatio-locator name="p" value="1,0.5">` inside a `<notatio-plot>` -- a point ON the
 * picture that you drag about it, Wolfram's `Locator`. It sits over the plot area in
 * the plot's own coordinates, so the binding `_p` is the `List` `[x, y]` where the dot
 * is (or the complex `x + y i`, with `complex`), and a template that reads `_p` gets a
 * point on the curve's axes. The arrows nudge it by a hundredth of the window, Shift
 * ten times that, Alt a tenth.
 *
 * ```html
 * <notatio-tangle>
 *   <notatio-plot value="Sin(x)" domain="-6.283,6.283">
 *     <notatio-locator name="p" value="0,0" />
 *   </notatio-plot>
 *   The dot is at <notatio-dynamic value="_p" />.
 * </notatio-tangle>
 * ```
 *
 * A `<notatio-slider-2d>` is the same control on a square of its own, off the picture.
 */
export class NotatioLocator extends LitElement {
  static properties = {
    /** The binding this point drives: `name="p"` fills the wildcard `_p`. */
    name: { type: String, reflect: true },
    /** The starting point, `x,y` -- or `a+bi` with `complex`. */
    value: { type: String },
    /** Bind a complex number `x + y i` rather than a list. */
    complex: { type: Boolean, reflect: true },
    _x: { state: true },
    _y: { state: true },
    _left: { state: true },
    _top: { state: true },
    _dragging: { state: true },
  };

  declare name: string;
  declare value: string;
  declare complex: boolean;
  declare _x: number;
  declare _y: number;
  declare _left: number;
  declare _top: number;
  declare _dragging: boolean;

  #pointer: number | undefined;
  #repeats = 0;
  #resize: ResizeObserver | undefined;

  constructor() {
    super();
    this.name = "";
    this.value = "0,0";
    this.complex = false;
    this._x = 0;
    this._y = 0;
    this._left = 0;
    this._top = 0;
    this._dragging = false;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** The plot this locator sits on. */
  get plot(): Framed | null {
    return this.closest<Framed>("notatio-plot");
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const plot = this.plot;
    plot?.addEventListener("notatio-plot-render", this.#placeSoon);
    if (typeof ResizeObserver !== "undefined" && plot) {
      this.#resize = new ResizeObserver(this.#place);
      this.#resize.observe(plot);
    }
  }

  override disconnectedCallback(): void {
    this.plot?.removeEventListener("notatio-plot-render", this.#placeSoon);
    this.#resize?.disconnect();
    this.#resize = undefined;
    super.disconnectedCallback();
  }

  get binding(): MathJsonExpression {
    return this.complex
      ? numberJson(this._x, this._y)
      : (["List", this._x, this._y] as MathJsonExpression);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("value")) {
      const point = this.complex ? parseComplex(this.value) : undefined;
      const parts = point
        ? [point.re, point.im]
        : this.value.split(",").map((s) => Number(s.trim().replace(/_/g, "")));
      this._x = Number.isFinite(parts[0]) ? parts[0] : 0;
      this._y = Number.isFinite(parts[1]) ? parts[1] : 0;
    }
  }

  protected override updated(): void {
    this.#place();
  }

  /** The svg's box within the plot element, in CSS pixels, and its viewBox scale. */
  #geometry(): { left: number; top: number; kx: number; ky: number } | undefined {
    const plot = this.plot;
    const svg = plot?.querySelector("svg");
    if (!plot || !svg) return undefined;
    const outer = plot.getBoundingClientRect();
    const rect = svg.getBoundingClientRect();
    const [, , vw, vh] = (svg.getAttribute("viewBox") ?? "0 0 340 200").split(" ").map(Number);
    return {
      left: rect.left - outer.left,
      top: rect.top - outer.top,
      kx: rect.width / (vw || 1),
      ky: rect.height / (vh || 1),
    };
  }

  /** The plot announces a render before its markup lands; place once it has. */
  #placeSoon = (): void => {
    setTimeout(this.#place, 0);
  };

  /** Put the dot where the value is, in the plot's current geometry. */
  #place = (): void => {
    const frame = this.plot?.frame;
    const g = this.#geometry();
    if (!frame || !g) return;
    const [px, py] = frame.toPixel(this._x, this._y);
    const left = g.left + px * g.kx;
    const top = g.top + py * g.ky;
    if (left !== this._left) this._left = left;
    if (top !== this._top) this._top = top;
  };

  #commit(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === this._x && y === this._y)) return;
    this._x = x;
    this._y = y;
    emitControl(this, { name: this.name, value: this.binding, re: x, im: this.complex ? y : 0 });
  }

  /** The data point under a pointer, clamped to the plot area. */
  #at(event: PointerEvent): [number, number] | undefined {
    const frame = this.plot?.frame;
    const g = this.#geometry();
    const outer = this.plot?.getBoundingClientRect();
    if (!frame || !g || !outer) return undefined;
    const [l, t, r, b] = frame.box;
    const px = Math.max(l, Math.min(r, (event.clientX - outer.left - g.left) / g.kx));
    const py = Math.max(t, Math.min(b, (event.clientY - outer.top - g.top) / g.ky));
    return frame.toData(px, py);
  }

  #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).focus({ preventScroll: true });
    capture(event.currentTarget as HTMLElement, event.pointerId);
    this.#pointer = event.pointerId;
    this._dragging = true;
  };

  #onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.#pointer) return;
    event.preventDefault();
    const at = this.#at(event);
    if (at) this.#commit(...at);
  };

  #onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.#pointer) return;
    release(event.currentTarget as HTMLElement, event.pointerId);
    this.#pointer = undefined;
    this._dragging = false;
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    const dx = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const dy = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
    const frame = this.plot?.frame;
    if ((dx === 0 && dy === 0) || !frame) return;
    event.preventDefault();
    this.#repeats = event.repeat ? this.#repeats + 1 : 0;
    const gear = modifierGear(event);
    const factor = gear === "coarse" ? 10 : gear === "fine" ? 0.1 : 1;
    const count = holdMultiplier(this.#repeats) * factor;
    // A hundredth of the window per press, measured in the picture and read back as data.
    const [l, t, r, b] = frame.box;
    const [px, py] = frame.toPixel(this._x, this._y);
    const nx = Math.max(l, Math.min(r, px + (dx * count * (r - l)) / 100));
    const ny = Math.max(t, Math.min(b, py - (dy * count * (b - t)) / 100));
    this.#commit(...frame.toData(nx, ny));
  };

  #onKeyUp = (): void => {
    this.#repeats = 0;
  };

  protected override render(): unknown {
    const text = `${numberLatex(this._x, 0.01)}, ${numberLatex(this._y, 0.01)}`;
    return html`<span
      class="notatio-locator-dot"
      role="slider"
      tabindex="0"
      aria-label=${this.name || "point"}
      aria-valuetext=${text}
      title=${text}
      ?data-dragging=${this._dragging}
      style=${`left:${this._left}px;top:${this._top}px`}
      @pointerdown=${this.#onPointerDown}
      @pointermove=${this.#onPointerMove}
      @pointerup=${this.#onPointerUp}
      @pointercancel=${this.#onPointerUp}
      @keydown=${this.#onKeyDown}
      @keyup=${this.#onKeyUp}
    ></span>`;
  }
}

defineControl("notatio-locator", NotatioLocator);
