import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { html, LitElement, nothing, type PropertyValues } from "lit";
import { defineControl, emitControl, numberJson } from "./controls.ts";
import { clamp } from "./manipulate.ts";
import { iterate } from "./playback.ts";
import { capture, release } from "./pointer.ts";
import { ensureStyles } from "./styles.ts";
import { gearing, holdMultiplier, modifierGear, numberLatex, parseComplex } from "./tangle.ts";

/** `a,b` -> [a, b]; a single number -> [n, n]; nothing -> undefined. */
function pair(raw: string | number | undefined): [number, number] | undefined {
  if (raw === undefined) return undefined;
  const parts = String(raw)
    .split(",")
    .map((s) => Number(s.trim().replace(/_/g, "")));
  if (parts.length === 1 && Number.isFinite(parts[0])) return [parts[0], parts[0]];
  if (parts.length === 2 && parts.every(Number.isFinite)) return [parts[0], parts[1]];
  return undefined;
}

/**
 * `<notatio-slider-2d name="p" value="0.5,0.5" min="0,0" max="1,1">` -- a square with a
 * dot you drag about it, Wolfram's `Slider2D`. `min`/`max` are `x,y` pairs (default the
 * unit square), `step` one step for both axes or `dx,dy`. The arrows nudge the dot in
 * the same gears as a knob (Shift coarse, Alt fine, held arrows accelerate).
 *
 * Inside a scope the binding `_p` is the `List` `[x, y]` -- or, with `complex`, the
 * complex number `x + y i`, so a knob's two axes and a pad's are the same thing.
 */
export class NotatioSlider2D extends LitElement {
  static properties = {
    /** The binding this pad drives: `name="p"` fills the wildcard `_p`. */
    name: { type: String, reflect: true },
    /** The starting point, `x,y` -- or `a+bi` with `complex`. */
    value: { type: String },
    /** The lower-left corner, `x,y`. */
    min: { type: String },
    /** The upper-right corner, `x,y`. */
    max: { type: String },
    /** One step for both axes, or `dx,dy`. */
    step: { type: String },
    /** Bind a complex number `x + y i` rather than a list. */
    complex: { type: Boolean, reflect: true },
    /** Show the point's coordinates beside the pad. */
    readout: { type: Boolean, reflect: true },
    /** The pad's side, in CSS pixels. */
    size: { type: Number },
    _x: { state: true },
    _y: { state: true },
    _dragging: { state: true },
  };

  declare name: string;
  declare value: string;
  declare min: string;
  declare max: string;
  declare step: string;
  declare complex: boolean;
  declare readout: boolean;
  declare size: number;
  declare _x: number;
  declare _y: number;
  declare _dragging: boolean;

  #pointer: number | undefined;
  #repeats = 0;

  constructor() {
    super();
    this.name = "";
    this.value = "0,0";
    this.min = "0,0";
    this.max = "1,1";
    this.step = "";
    this.complex = false;
    this.readout = false;
    this.size = 120;
    this._x = 0;
    this._y = 0;
    this._dragging = false;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** The pad's corners and steps. A missing step is a hundredth of the side. */
  get range(): { min: [number, number]; max: [number, number]; step: [number, number] } {
    const min = pair(this.min) ?? [0, 0];
    const max = pair(this.max) ?? [1, 1];
    const lo: [number, number] = [Math.min(min[0], max[0]), Math.min(min[1], max[1])];
    const hi: [number, number] = [Math.max(lo[0] + 1e-9, max[0]), Math.max(lo[1] + 1e-9, max[1])];
    const step = pair(this.step) ?? [(hi[0] - lo[0]) / 100, (hi[1] - lo[1]) / 100];
    return { min: lo, max: hi, step };
  }

  get binding(): MathJsonExpression {
    return this.complex
      ? numberJson(this._x, this._y)
      : (["List", this._x, this._y] as MathJsonExpression);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("value")) {
      const point = this.complex ? parseComplex(this.value) : undefined;
      const xy = point ? [point.re, point.im] : (pair(this.value) ?? [0, 0]);
      const { min, max } = this.range;
      this._x = clamp(xy[0], min[0], max[0]);
      this._y = clamp(xy[1], min[1], max[1]);
    }
  }

  #commit(x: number, y: number): void {
    const { min, max } = this.range;
    const nx = clamp(x, min[0], max[0]);
    const ny = clamp(y, min[1], max[1]);
    if (nx === this._x && ny === this._y) return;
    this._x = nx;
    this._y = ny;
    emitControl(this, { name: this.name, value: this.binding, re: nx, im: this.complex ? ny : 0 });
  }

  /** Where a pointer is, in value coordinates: `y` grows upward, as on a plot. */
  #at(event: PointerEvent): [number, number] {
    const pad = event.currentTarget as HTMLElement;
    const r = pad.getBoundingClientRect();
    const { min, max, step } = this.range;
    const fx = clamp((event.clientX - r.left) / r.width, 0, 1);
    const fy = clamp(1 - (event.clientY - r.top) / r.height, 0, 1);
    const snap = (v: number, lo: number, s: number): number =>
      Number((lo + Math.round((v - lo) / s) * s).toPrecision(12));
    return [
      snap(min[0] + fx * (max[0] - min[0]), min[0], step[0]),
      snap(min[1] + fy * (max[1] - min[1]), min[1], step[1]),
    ];
  }

  #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).focus({ preventScroll: true });
    capture(event.currentTarget as HTMLElement, event.pointerId);
    this.#pointer = event.pointerId;
    this._dragging = true;
    this.#commit(...this.#at(event));
  };

  #onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.#pointer) return;
    event.preventDefault();
    this.#commit(...this.#at(event));
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
    if (dx === 0 && dy === 0) return;
    event.preventDefault();
    this.#repeats = event.repeat ? this.#repeats + 1 : 0;
    const gear = modifierGear(event) ?? "normal";
    const count = holdMultiplier(this.#repeats);
    const { min, max, step } = this.range;
    const walk = (v: number, d: number, axis: 0 | 1): number => {
      if (d === 0) return v;
      const geared = gearing(step[axis], 1, gear, false).step;
      return iterate(v, d * count, { min: min[axis], max: max[axis], step: geared }, "none").value;
    };
    this.#commit(walk(this._x, dx, 0), walk(this._y, dy, 1));
  };

  #onKeyUp = (): void => {
    this.#repeats = 0;
  };

  protected override render(): unknown {
    const { min, max, step } = this.range;
    const fx = (this._x - min[0]) / (max[0] - min[0]);
    const fy = (this._y - min[1]) / (max[1] - min[1]);
    const text = `${numberLatex(this._x, step[0])}, ${numberLatex(this._y, step[1])}`;
    return html`<span class="notatio-slider-2d" ?data-dragging=${this._dragging}>
      <span
        class="notatio-pad"
        role="slider"
        tabindex="0"
        aria-label=${this.name || "point"}
        aria-valuetext=${text}
        style=${`width:${this.size}px;height:${this.size}px`}
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerUp}
        @keydown=${this.#onKeyDown}
        @keyup=${this.#onKeyUp}
      >
        <span
          class="notatio-pad-dot"
          style=${`left:${fx * 100}%;top:${(1 - fy) * 100}%`}
        ></span> </span
      >${this.readout ? html`<span class="notatio-slider-readout">${text}</span>` : nothing}
    </span>`;
  }
}

defineControl("notatio-slider-2d", NotatioSlider2D);
