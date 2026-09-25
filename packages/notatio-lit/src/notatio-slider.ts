import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { html, LitElement, nothing, type PropertyValues } from "lit";
import { LONG_PRESS_MS } from "./choice-menu.ts";
import { playButton } from "./play-button.ts";
import { openPlaybackMenu } from "./playback-menu.ts";
import { ensureStyles } from "./styles.ts";
import {
  clamp,
  gearing,
  holdMultiplier,
  inferRange,
  isIntegerKnob,
  iterate,
  type Loop,
  modifierGear,
  numberLatex,
  sweepInterval,
} from "@enumeratio/notatio";
import { Sweep } from "./sweep.ts";
import { defineControl, emitControl } from "./define.ts";

/**
 * `<notatio-slider name="k" value="1" min="0" max="5" step="0.5">` -- a track with a
 * thumb, Wolfram's `Slider`. Drag the thumb or click the track to set it; the arrows
 * step it, accelerating when held, Shift or PageUp/PageDown step coarse and Alt fine
 * (the same gears as a `<notatio-knob>`), Home/End go to the ends. `readout` shows the
 * value beside the track; `axis="y"` stands it up (Wolfram's `VerticalSlider`, which
 * is also `<notatio-vertical-slider>`).
 *
 * With no `min`/`max` the range is inferred from the value the way a knob's is, and a
 * value written without a point steps by whole numbers. `play` adds a button that
 * sweeps the range (Space does the same when the thumb is focused), `autoplay` sweeps
 * while on screen, `loop` says what the ends do (`none` by default: a range has ends),
 * `interval` and `rate` set the pace, and holding the button opens the speed-and-loop
 * panel. Inside a scope the binding `_k` is the number.
 */
export class NotatioSlider extends LitElement {
  static properties = {
    /** The binding this slider drives: `name="a"` fills the wildcard `_a`. */
    name: { type: String, reflect: true },
    /** The starting value. */
    value: { type: String },
    /** Lowest value. Defaults to a symmetric range around the start. */
    min: { type: Number },
    /** Highest value. */
    max: { type: Number },
    /** How much one step moves the value; also fixes the printed places. */
    step: { type: Number },
    /** `x` (default) lies flat; `y` stands the slider up. */
    axis: { type: String, reflect: true },
    /** Show the value beside the track. */
    readout: { type: Boolean, reflect: true },
    /** Show a play/pause button. Space on the focused thumb toggles playback regardless. */
    play: { type: Boolean, reflect: true },
    /** Sweep while scrolled into view; pause when scrolled out. */
    autoplay: { type: Boolean },
    /** Milliseconds per playback step. Defaults to a whole sweep in a few seconds. */
    interval: { type: Number },
    /** Playback speed as a multiplier on `interval`. */
    rate: { type: Number, reflect: true },
    /** What an iteration does at the ends: `cycle`, `reflect` or `none` (default). */
    loop: { type: String, reflect: true },
    _value: { state: true },
    _playing: { state: true },
  };

  declare name: string;
  declare value: string;
  declare min: number;
  declare max: number;
  declare step: number;
  declare axis: "x" | "y";
  declare readout: boolean;
  declare play: boolean;
  declare autoplay: boolean;
  declare interval: number;
  declare rate: number;
  declare loop: Loop | "";
  declare _value: number;
  declare _playing: boolean;

  #repeats = 0;
  #inView: IntersectionObserver | undefined;
  #sweep = new Sweep(
    {
      at: () => this._value,
      set: (v) => this.#commit(v, true),
      span: () => this.range,
      loop: () => this.#loop,
      setLoop: (loop) => (this.loop = loop),
      rate: () => (Number.isFinite(this.rate) && this.rate > 0 ? this.rate : 1),
      setRate: (rate) => (this.rate = rate),
      interval: () => {
        if (Number.isFinite(this.interval) && this.interval > 0) return this.interval;
        const { min, max, step } = this.range;
        return sweepInterval((max - min) / step + 1);
      },
      onState: () => (this._playing = this.#sweep.playing),
    },
    openPlaybackMenu,
    LONG_PRESS_MS,
  );

  constructor() {
    super();
    this.name = "";
    this.value = "0";
    this.min = Number.NaN;
    this.max = Number.NaN;
    this.step = Number.NaN;
    this.axis = "x";
    this.readout = false;
    this.play = false;
    this.autoplay = false;
    this.interval = Number.NaN;
    this.rate = 1;
    this.loop = "";
    this._value = 0;
    this._playing = false;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override disconnectedCallback(): void {
    this.#sweep.stop();
    this.#inView?.disconnect();
    this.#inView = undefined;
    super.disconnectedCallback();
  }

  /** Whole numbers when `step` is one, or when the value was written without a point. */
  get integer(): boolean {
    return isIntegerKnob(this.value, this.step);
  }

  /** The range: the author's bounds, else the window a knob would infer. */
  get range(): { min: number; max: number; step: number } {
    const base = inferRange(this._value, this.integer);
    const step = Number.isFinite(this.step) && this.step > 0 ? this.step : base.step;
    const min = Number.isFinite(this.min) ? this.min : base.min;
    const max = Number.isFinite(this.max) ? this.max : base.max;
    return max > min ? { min, max, step } : { ...base, step };
  }

  get #loop(): Loop {
    return this.loop === "cycle" || this.loop === "reflect" ? this.loop : "none";
  }

  /** The number this slider binds. */
  get bound(): number {
    return this._value;
  }

  get binding(): MathJsonExpression {
    return this._value;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("value")) {
      const v = Number(String(this.value).replace(/_/g, ""));
      this._value = Number.isFinite(v) ? v : 0;
    }
    if (changed.has("autoplay")) this.#watchView();
  }

  #watchView(): void {
    if (!this.autoplay || this.#inView !== undefined || typeof IntersectionObserver === "undefined") {
      return;
    }
    this.#inView = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) this.#sweep.start();
        else this.#sweep.stop();
      },
      { threshold: 0.5 },
    );
    this.#inView.observe(this);
  }

  #commit(v: number, played = false): void {
    const { min, max } = this.range;
    const next = clamp(v, min, max);
    if (next === this._value) return;
    this._value = next;
    emitControl(this, { name: this.name, value: next, played });
  }

  #onInput = (event: Event): void => {
    this.#sweep.stop();
    this.#commit(Number((event.target as HTMLInputElement).value));
  };

  /** The arrows along the axis step in gear; Space plays; the rest is the input's own. */
  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === " ") {
      event.preventDefault();
      if (!event.repeat) this.#sweep.toggle();
      return;
    }
    const forward = event.key === (this.axis === "y" ? "ArrowUp" : "ArrowRight") || event.key === "PageUp";
    const back = event.key === (this.axis === "y" ? "ArrowDown" : "ArrowLeft") || event.key === "PageDown";
    if (!forward && !back) {
      if (event.key.startsWith("Arrow")) event.preventDefault(); // the other axis: nothing
      return;
    }
    event.preventDefault();
    this.#sweep.stop();
    this.#repeats = event.repeat ? this.#repeats + 1 : 0;
    const gear = event.key === "PageUp" || event.key === "PageDown" ? "coarse" : (modifierGear(event) ?? "normal");
    const { step } = gearing(this.range.step, 1, gear, this.integer);
    const steps = holdMultiplier(this.#repeats) * (forward ? 1 : -1);
    this.#commit(iterate(this._value, steps, { ...this.range, step }, this.#loop).value);
  };

  #onKeyUp = (): void => {
    this.#repeats = 0;
  };

  protected override render(): unknown {
    const { min, max, step } = this.range;
    return html`<span class="notatio-slider" ?data-vertical=${this.axis === "y"}>
      <input
        type="range"
        class="notatio-slider-track"
        orient=${this.axis === "y" ? "vertical" : nothing}
        min=${min}
        max=${max}
        step=${step}
        .value=${String(this._value)}
        aria-label=${this.name || "value"}
        aria-valuetext=${numberLatex(this._value, step)}
        @input=${this.#onInput}
        @keydown=${this.#onKeyDown}
        @keyup=${this.#onKeyUp}
      />${
        this.readout ? html`<span class="notatio-slider-readout">${numberLatex(this._value, step)}</span>` : nothing
      }${this.play ? playButton(this.#sweep) : nothing}
    </span>`;
  }
}

defineControl("notatio-slider", NotatioSlider);
