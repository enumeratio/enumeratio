import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { html, LitElement, nothing, type PropertyValues } from "lit";
import { ensureStyles } from "./styles.ts";
import {
  clamp,
  gearing,
  holdMultiplier,
  isIntegerKnob,
  iterate,
  modifierGear,
  numberLatex,
} from "@enumeratio/notatio";
import { defineControl, emitControl } from "./define.ts";

/**
 * `<notatio-interval-slider name="r" value="1,3" min="0" max="5" step="0.5">` -- a
 * track with two thumbs, Wolfram's `IntervalSlider`. The binding `_r` is the `List`
 * `[lo, hi]`; the thumbs cannot cross. Each thumb takes the arrows in a knob's gears;
 * `readout` shows the interval beside the track.
 */
export class NotatioIntervalSlider extends LitElement {
  static properties = {
    /** The binding this slider drives: `name="r"` fills the wildcard `_r`. */
    name: { type: String, reflect: true },
    /** The starting interval, `lo,hi`. */
    value: { type: String },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    /** Show the interval beside the track. */
    readout: { type: Boolean, reflect: true },
    _lo: { state: true },
    _hi: { state: true },
  };

  declare name: string;
  declare value: string;
  declare min: number;
  declare max: number;
  declare step: number;
  declare readout: boolean;
  declare _lo: number;
  declare _hi: number;

  #repeats = 0;

  constructor() {
    super();
    this.name = "";
    this.value = "0,1";
    this.min = 0;
    this.max = 1;
    this.step = Number.NaN;
    this.readout = false;
    this._lo = 0;
    this._hi = 1;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  get integer(): boolean {
    return isIntegerKnob(this.value.split(",")[0] ?? "0", this.step);
  }

  get range(): { min: number; max: number; step: number } {
    const min = Number.isFinite(this.min) ? this.min : 0;
    const max = Number.isFinite(this.max) && this.max > min ? this.max : min + 1;
    const step =
      Number.isFinite(this.step) && this.step > 0
        ? this.step
        : this.integer
          ? 1
          : (max - min) / 100;
    return { min, max, step };
  }

  get binding(): MathJsonExpression {
    return ["List", this._lo, this._hi] as MathJsonExpression;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("value") || changed.has("min") || changed.has("max")) {
      const [a, b] = this.value.split(",").map((s) => Number(s.trim().replace(/_/g, "")));
      const { min, max } = this.range;
      const lo = clamp(Number.isFinite(a) ? a : min, min, max);
      const hi = clamp(Number.isFinite(b) ? b : max, min, max);
      this._lo = Math.min(lo, hi);
      this._hi = Math.max(lo, hi);
    }
  }

  #commit(lo: number, hi: number): void {
    const { min, max } = this.range;
    // Thumbs never cross: the moving one stops at the other.
    const nlo = clamp(Math.min(lo, this._hi), min, max);
    const nhi = clamp(Math.max(hi, this._lo), min, max);
    if (nlo === this._lo && nhi === this._hi) return;
    this._lo = nlo;
    this._hi = nhi;
    emitControl(this, { name: this.name, value: this.binding, re: nlo });
  }

  #onKey(which: "lo" | "hi", event: KeyboardEvent): void {
    const forward = event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "PageUp";
    const back = event.key === "ArrowLeft" || event.key === "ArrowDown" || event.key === "PageDown";
    if (!forward && !back) return;
    event.preventDefault();
    this.#repeats = event.repeat ? this.#repeats + 1 : 0;
    const gear =
      event.key === "PageUp" || event.key === "PageDown"
        ? "coarse"
        : (modifierGear(event) ?? "normal");
    const { step } = gearing(this.range.step, 1, gear, this.integer);
    const steps = holdMultiplier(this.#repeats) * (forward ? 1 : -1);
    const span = { ...this.range, step };
    if (which === "lo") this.#commit(iterate(this._lo, steps, span, "none").value, this._hi);
    else this.#commit(this._lo, iterate(this._hi, steps, span, "none").value);
  }

  protected override render(): unknown {
    const { min, max, step } = this.range;
    const pct = (v: number): number => ((v - min) / (max - min)) * 100;
    const thumb = (which: "lo" | "hi", v: number): unknown =>
      html`<input
        type="range"
        class="notatio-interval-thumb"
        data-thumb=${which}
        min=${min}
        max=${max}
        step=${step}
        .value=${String(v)}
        aria-label=${`${this.name || "interval"} ${which === "lo" ? "from" : "to"}`}
        aria-valuetext=${numberLatex(v, step)}
        @input=${(e: Event) => {
          const n = Number((e.target as HTMLInputElement).value);
          if (which === "lo") this.#commit(n, this._hi);
          else this.#commit(this._lo, n);
        }}
        @keydown=${(e: KeyboardEvent) => this.#onKey(which, e)}
        @keyup=${() => (this.#repeats = 0)}
      />`;
    return html`<span class="notatio-interval-slider">
      <span class="notatio-interval-track">
        <span
          class="notatio-interval-fill"
          style=${`left:${pct(this._lo)}%;right:${100 - pct(this._hi)}%`}
        ></span>
        ${thumb("lo", this._lo)}${thumb("hi", this._hi)} </span
      >${
        this.readout
          ? html`<span class="notatio-slider-readout"
              >[${numberLatex(this._lo, step)}, ${numberLatex(this._hi, step)}]</span
            >`
          : nothing
      }
    </span>`;
  }
}

defineControl("notatio-interval-slider", NotatioIntervalSlider);
