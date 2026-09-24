import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { html, LitElement, nothing, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { entryMarkup, LONG_PRESS_MS, PRESS_SLOP_PX } from "./choice-menu.ts";
import { openPlaybackMenu } from "./playback-menu.ts";
import { playButton } from "./play-button.ts";
import { capture, release } from "./pointer.ts";
import { ensureStyles } from "./styles.ts";
import {
  boundEntry,
  clamp,
  complexLatex,
  DEFAULT_PIXELS_PER_STEP,
  type Gear,
  gearing,
  holdMultiplier,
  inferRange,
  isIntegerKnob,
  iterate,
  ladderGear,
  type Loop,
  modifierGear,
  numberJson,
  numberLatex,
  parseComplex,
  parseEntries,
  scrubValue,
  sweepInterval,
} from "@enumeratio/notatio";
import { Sweep } from "./sweep.ts";
import { defineControl, emitControl } from "./define.ts";

/** Two taps this close together mean "let me type it". */
const DOUBLE_TAP_MS = 400;

/**
 * `<notatio-knob name="cookies" value="3">` -- a number you **drag inside a sentence**,
 * after Bret Victor's [Tangle](http://worrydream.com/Tangle/). It is not a slider and
 * not a field: it renders exactly what the value looks like when typeset, marked as
 * interactive with a dotted underline, and you change it by dragging across it.
 *
 * Drag **right to raise**, left to lower (or set `axis="y"` and drag up to raise); the
 * value follows the pointer's *position*, so dragging back returns you to where you
 * started. A `complex` knob adds the second axis -- **up raises the imaginary part**,
 * down lowers it -- and shows both parts at all times, since an axis that reads `0` is
 * still an axis you can drag. `choices` scrubs a discrete list instead (an index into a
 * family of objects, say) rather than a numeric range.
 *
 * **Gears.** Every gesture is in one of three gears: normal moves by `step`, coarse by
 * ten steps, fine by a tenth of one (an integer knob's fine gear keeps whole numbers
 * and asks ten times the travel instead). Hold **Shift** for coarse and **Alt** for
 * fine -- while dragging or at the keyboard -- or, on a one-axis knob, drag **off the
 * axis**: up the ladder is coarse, down is fine, and a small ladder beside the value
 * shows which increment you are in. On a touchscreen a second finger anywhere means
 * fine.
 *
 * **Keyboard.** The arrows along the drag axis step (left/right, or up/down for
 * `axis="y"`; a complex knob takes both pairs), and holding one accelerates. PageUp/PageDown step coarse, Home/End go to the ends, and
 * Enter -- or a double tap -- turns the value into a field you can type into.
 *
 * A knob always has an **axis**, which is what makes it a knob: `choices` scrubs its
 * list along that axis rather than offering a menu of it. For a value with no axis to
 * scrub -- a word, an either/or -- reach for `<notatio-toggler>`, which is exactly
 * that: the same binding, a click to cycle, and a menu on a long press.
 *
 * **Playback.** Space sweeps the knob through its range one step at a time, and again
 * to stop; any drag or key stops it too. `play` adds a small button beside the value
 * for the mouse, `autoplay` starts the sweep when the knob scrolls into view and pauses
 * it when it leaves, `interval` sets the milliseconds per step (the default paces a
 * whole sweep at a few seconds) and `rate` multiplies that.
 *
 * **Loop.** `loop` says what an iteration does at the ends -- playback and the arrow
 * keys alike: `cycle` wraps, `reflect` turns round, `none` stops (and a play-through
 * that has reached its end rewinds when played again). A range has ends, so a numeric
 * knob is `none` by default; a list goes round, so `choices` is `cycle`. A long press
 * on the play button opens a panel for the speed and the loop.
 *
 * **Give it children and they become the grip.** A knob with slotted content renders no
 * number of its own — you drag the content instead, and the value it is publishing is
 * whatever that content is showing. That is how a family of objects becomes something
 * you brush through directly rather than through a number sitting next to it:
 *
 * ```html
 * <notatio-knob name="k" value="1" min="1" max="24">
 *   <notatio-figure kind="permutation" value="At(Permutations(Range(1,4)), _k)" />
 * </notatio-knob>
 * ```
 *
 * Inside a `<notatio-dynamic-module>` the knob's `name` becomes the wildcard `_name`, and every
 * notatio template in the surrounding prose re-derives as it moves.
 *
 * ```html
 * <notatio-dynamic-module>
 *   Eat <notatio-knob name="n" value="3" min="0" max="12" step="1" /> cookies and take on
 *   <notatio-dynamic value="_n * 50" /> calories.
 * </notatio-dynamic-module>
 * ```
 *
 * The name is descriptive, not a Wolfram symbol: Wolfram has no inline draggable value
 * (`Manipulator` is a slider with chrome), and the repo already calls a bound, swept
 * parameter a knob.
 */
export class NotatioKnob extends LitElement {
  static properties = {
    /** The binding this knob drives: `name="a"` fills the wildcard `_a`. */
    name: { type: String, reflect: true },
    /** The starting value: `3`, `-1.5`, `3+2i`, or an entry of `choices`. */
    value: { type: String },
    /** Lowest value a drag can reach. Defaults to a symmetric range around the start. */
    min: { type: Number },
    /** Highest value a drag can reach. */
    max: { type: Number },
    /** How much one step of the drag moves the value; also fixes the printed places. */
    step: { type: Number },
    /** Add the imaginary axis: dragging up/down moves the imaginary part. */
    complex: { type: Boolean, reflect: true },
    /** A `|`-separated list to scrub through instead of a numeric range. */
    choices: { type: String },
    /** Pixels of travel per step — lower drags faster. */
    sensitivity: { type: Number },
    /** The drag direction of a one-axis knob: `x` (default, right raises) or `y` (up raises). */
    axis: { type: String, reflect: true },
    /** Show a play/pause button beside the value. Space toggles playback regardless. */
    play: { type: Boolean, reflect: true },
    /** Start sweeping when scrolled into view; pause when scrolled out. */
    autoplay: { type: Boolean },
    /** Milliseconds per playback step. Defaults to a whole sweep in a few seconds. */
    interval: { type: Number },
    /** Playback speed as a multiplier on `interval`: `2` is twice as fast. */
    rate: { type: Number, reflect: true },
    /** What an iteration does at the ends: `cycle`, `reflect` or `none`. */
    loop: { type: String, reflect: true },
    _playing: { state: true },
    _re: { state: true },
    _im: { state: true },
    _index: { state: true },
    _markup: { state: true },
    _dragging: { state: true },
    _gear: { state: true },
    _editing: { state: true },
    _slotted: { state: true },
  };

  declare name: string;
  declare value: string;
  declare min: number;
  declare max: number;
  declare step: number;
  declare complex: boolean;
  declare choices: string;
  declare sensitivity: number;
  declare axis: "x" | "y";
  declare play: boolean;
  declare autoplay: boolean;
  declare interval: number;
  declare rate: number;
  declare loop: Loop | "";
  declare _playing: boolean;
  declare _re: number;
  declare _im: number;
  declare _index: number;
  declare _markup: string;
  declare _dragging: boolean;
  declare _gear: Gear;
  declare _editing: boolean;
  declare _slotted: boolean;

  #entries: string[] = [];
  /** The last typeset source, so an update that changed nothing visible does no work. */
  #typesetFrom: string | undefined;
  /**
   * Pointer origin and the values it started from. Re-anchored whenever the gear
   * changes mid-drag, so the value stays a function of position within each gear and
   * never jumps when the gain does.
   */
  #from:
    | {
        id: number;
        x: number;
        y: number;
        re: number;
        im: number;
        index: number;
        /** Where the drag began, never re-anchored: the ladder is measured from here. */
        ox: number;
        oy: number;
      }
    | undefined;
  /** Where the pointer went down, for telling a tap from a drag. */
  #pressAt: { x: number; y: number } | undefined;
  #lastTap = 0;
  /** A second finger on the screen while dragging: touch's answer to holding Alt. */
  #secondFinger = false;
  #repeats = 0;
  #sweep = new Sweep(
    {
      at: () => (this.discrete ? this._index : this._re),
      set: (v) => this.#commit(this.discrete ? { index: v } : { re: v }, true),
      span: () => this.#span,
      loop: () => this.#loop,
      setLoop: (loop) => (this.loop = loop),
      rate: () => (Number.isFinite(this.rate) && this.rate > 0 ? this.rate : 1),
      setRate: (rate) => (this.rate = rate),
      interval: () =>
        Number.isFinite(this.interval) && this.interval > 0 ? this.interval : this.#pace,
      onState: () => (this._playing = this.#sweep.playing),
    },
    openPlaybackMenu,
    LONG_PRESS_MS,
  );
  #inView: IntersectionObserver | undefined;

  constructor() {
    super();
    this.name = "";
    this.value = "0";
    this.min = Number.NaN;
    this.max = Number.NaN;
    this.step = Number.NaN;
    this.complex = false;
    this.choices = "";
    this.sensitivity = DEFAULT_PIXELS_PER_STEP;
    this.axis = "x";
    this.play = false;
    this.autoplay = false;
    this.interval = Number.NaN;
    this.rate = 1;
    this.loop = "";
    this._playing = false;
    this._re = 0;
    this._im = 0;
    this._index = 0;
    this._markup = "";
    this._dragging = false;
    this._gear = "normal";
    this._editing = false;
    this._slotted = false;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#detectSlotted();
  }

  override disconnectedCallback(): void {
    this.#unlistenFingers();
    this.#stop();
    this.#inView?.disconnect();
    this.#inView = undefined;
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    // Re-checked here as well as on connect: a parsed HTML document runs
    // `connectedCallback` at the opening tag, before the children exist.
    this.#detectSlotted();
  }

  /**
   * Does this knob have content of its own to be dragged?
   *
   * Anything the author put inside counts, and what this element rendered does not —
   * so the check has to run against the light DOM it shares with its own output.
   */
  #detectSlotted(): void {
    const authored = [...this.children].some((el) => !el.matches("[data-notatio-knob]"));
    if (authored === this._slotted) return;
    this._slotted = authored;
    if (authored) this.#adoptHost();
  }

  /**
   * Make the element itself the grip. In slotted mode there is no span of ours to hang
   * the gesture on, and wrapping the author's content in one would change how it lays
   * out — so the host takes the handlers, the cursor and the slider role directly.
   */
  #adoptHost(): void {
    this.classList.add("notatio-knob-grip");
    this.dataset.slotted = "";
    this.tabIndex = 0;
    this.setAttribute("role", "slider");
    this.addEventListener("pointerdown", this.#onPointerDown);
    this.addEventListener("pointermove", this.#onPointerMove);
    this.addEventListener("pointerup", this.#onPointerUp);
    this.addEventListener("pointercancel", this.#onPointerUp);
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("keyup", this.#onKeyUp);
  }

  // --- playback ------------------------------------------------------------------

  /** Milliseconds per step when the author set none: a whole sweep in a few seconds. */
  get #pace(): number {
    if (this.discrete) return sweepInterval(this.#entries.length);
    const { min, max, step } = this.range;
    return sweepInterval((max - min) / step + 1);
  }

  /** The loop in force: the author's, else `cycle` for a list and `none` for a range. */
  get #loop(): Loop {
    if (this.loop === "cycle" || this.loop === "reflect" || this.loop === "none") return this.loop;
    return this.discrete ? "cycle" : "none";
  }

  /** The span an iteration walks: the entry indexes, or the range. */
  get #span(): { min: number; max: number; step: number } {
    return this.discrete ? { min: 0, max: this.#entries.length - 1, step: 1 } : this.range;
  }

  #stop(): void {
    this.#sweep.stop();
  }

  /** `autoplay`: sweep while on screen, and only then. */
  #watchView(): void {
    if (
      !this.autoplay ||
      this.#inView !== undefined ||
      typeof IntersectionObserver === "undefined"
    ) {
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

  /** True when this knob scrubs an explicit list rather than a numeric range. */
  get discrete(): boolean {
    return this.#entries.length > 0;
  }

  /** The current entry of a `choices` knob. */
  get entry(): string | undefined {
    return this.#entries[this._index];
  }

  /**
   * Does this knob step by whole numbers?
   *
   * An explicit `step` settles it. With none, the answer comes from HOW THE VALUE WAS
   * WRITTEN: `value="4"` is a count and steps by one, `value="4.0"` is a measurement
   * and does not. A knob that says 4 and lands on 4.05 when you nudge it is reporting
   * a quantity its author never meant it to have — and the ground-set size of a subset,
   * the index of a permutation and the number of cookies are all written without a
   * point precisely because there is nothing between their values.
   */
  get integer(): boolean {
    return isIntegerKnob(this.value, this.step);
  }

  /**
   * The range a drag moves through. An author may fix any of the three; what is left
   * over comes from `inferRange`, the same predictable ±10-or-wider window the
   * worksheet sliders use — a knob whose sensitivity you cannot guess runs away the
   * moment you touch it.
   */
  get range(): { min: number; max: number; step: number } {
    const base = inferRange(this._re, this.integer);
    const step = Number.isFinite(this.step) && this.step > 0 ? this.step : base.step;
    const min = Number.isFinite(this.min) ? this.min : base.min;
    const max = Number.isFinite(this.max) ? this.max : base.max;
    return max > min ? { min, max, step } : { ...base, step };
  }

  /** The quantum and travel of a gear, for this knob. A list is an integer knob of step one. */
  #gearing(gear: Gear): { step: number; pixelsPerStep: number } {
    return this.discrete
      ? gearing(1, this.sensitivity, gear, true)
      : gearing(this.range.step, this.sensitivity, gear, this.integer);
  }

  /** Is the off-axis direction free to pick the gear? Not on a complex knob: both axes are taken. */
  get #hasLadder(): boolean {
    return !this.complex;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("choices") || changed.has("value")) {
      this.#entries = parseEntries(this.choices);
      this.#readValue();
    }
    if (changed.has("autoplay")) this.#watchView();
    void this.#typeset();
  }

  /** Adopt the author's `value`, as an entry of `choices` or as a (complex) number. */
  #readValue(): void {
    if (this.discrete) {
      const at = this.#entries.indexOf(this.value.trim());
      const asIndex = Number(this.value);
      this._index =
        at >= 0 ? at : Number.isInteger(asIndex) ? clamp(asIndex, 0, this.#entries.length - 1) : 0;
      return;
    }
    const parsed = parseComplex(this.value);
    this._re = parsed?.re ?? 0;
    this._im = parsed?.im ?? 0;
  }

  /** The LaTeX this knob is showing: the chosen entry, or the number it holds. */
  get latex(): string {
    if (this.discrete) return this.entry ?? "";
    const { step } = this.range;
    return this.complex || this._im !== 0
      ? complexLatex(this._re, this._im, step)
      : numberLatex(this._re, step);
  }

  async #typeset(): Promise<void> {
    if (this._slotted) return;
    const source = this.latex;
    if (source === this.#typesetFrom) return;
    this.#typesetFrom = source;
    this._markup = await entryMarkup(source);
  }

  // --- dragging ------------------------------------------------------------------

  #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this._editing) return;
    // Preventing the default keeps the press from selecting text, but it also keeps
    // it from focusing; a press should leave the knob as focused as a Tab would.
    event.preventDefault();
    (event.currentTarget as HTMLElement).focus({ preventScroll: true });
    this.#stop();
    capture(event.currentTarget as HTMLElement, event.pointerId);
    this.#from = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      re: this._re,
      im: this._im,
      index: this._index,
      ox: event.clientX,
      oy: event.clientY,
    };
    this.#pressAt = { x: event.clientX, y: event.clientY };
    this._dragging = true;
    this.#listenFingers();
  };

  #onPointerMove = (event: PointerEvent): void => {
    const from = this.#from;
    if (from === undefined || event.pointerId !== from.id) return;
    event.preventDefault();
    const press = this.#pressAt;
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > PRESS_SLOP_PX) {
      // It is a drag, not a tap, so it does not open the field.
      this.#pressAt = undefined;
    }
    const dx = event.clientX - from.x;
    // Screen y grows downward and every axis here grows upward, so the sign flips.
    const dy = from.y - event.clientY;
    const along = this.axis === "y" ? dy : dx;
    // Off-axis travel from where the drag BEGAN: up (or, for a vertical knob, right)
    // is up the ladder.
    const across = this.axis === "y" ? event.clientX - from.ox : from.oy - event.clientY;

    const gear =
      modifierGear(event) ??
      (this.#secondFinger ? "fine" : this.#hasLadder ? ladderGear(across) : "normal");
    if (gear !== this._gear) {
      // Re-anchor: the value is where it is, and the new gain applies from here.
      this._gear = gear;
      from.x = event.clientX;
      from.y = event.clientY;
      from.re = this._re;
      from.im = this._im;
      from.index = this._index;
      return;
    }

    const { step, pixelsPerStep } = this.#gearing(gear);
    if (this.discrete) {
      const span = { min: 0, max: this.#entries.length - 1, step };
      this.#commit({ index: scrubValue(from.index, along, span, pixelsPerStep) });
      return;
    }
    const range = { ...this.range, step };
    if (this.complex) {
      this.#commit({
        re: scrubValue(from.re, dx, range, pixelsPerStep),
        im: scrubValue(from.im, dy, range, pixelsPerStep),
      });
    } else {
      this.#commit({ re: scrubValue(from.re, along, range, pixelsPerStep) });
    }
  };

  #onPointerUp = (event: PointerEvent): void => {
    const from = this.#from;
    if (from === undefined || event.pointerId !== from.id) return;
    release(event.currentTarget as HTMLElement, event.pointerId);
    this.#from = undefined;
    this._dragging = false;
    this._gear = "normal";
    this.#unlistenFingers();
    if (this.#pressAt !== undefined && event.type === "pointerup") {
      // A clean tap. Two of them in quick succession open the field.
      const now = performance.now();
      if (now - this.#lastTap < DOUBLE_TAP_MS) this.#beginEdit();
      this.#lastTap = now;
    }
    this.#pressAt = undefined;
  };

  // A second pointer anywhere in the document, for the duration of a drag. Pointer
  // capture keeps our own pointer's events here; the other finger's go to wherever it
  // landed, so they are watched from the document.
  #listenFingers(): void {
    document.addEventListener("pointerdown", this.#onFinger, true);
    document.addEventListener("pointerup", this.#onFinger, true);
    document.addEventListener("pointercancel", this.#onFinger, true);
  }

  #unlistenFingers(): void {
    document.removeEventListener("pointerdown", this.#onFinger, true);
    document.removeEventListener("pointerup", this.#onFinger, true);
    document.removeEventListener("pointercancel", this.#onFinger, true);
    this.#secondFinger = false;
  }

  #onFinger = (event: PointerEvent): void => {
    if (this.#from === undefined || event.pointerId === this.#from.id) return;
    if (event.pointerType !== "touch") return;
    this.#secondFinger = event.type === "pointerdown";
    // A tap is a tap only with one finger on it.
    this.#pressAt = undefined;
  };

  /** The element the gestures hang off: the host when slotted, otherwise our own span. */
  get #grip(): HTMLElement {
    return this._slotted ? this : (this.querySelector(".notatio-knob-grip") ?? this);
  }

  // --- keyboard ------------------------------------------------------------------

  /**
   * Arrows step the knob and accelerate when held; Shift or PageUp/PageDown step coarse
   * and Alt steps fine; Home/End go to the ends; Enter opens the field. The arrows
   * that work are the ones the DRAG would take: left/right for a horizontal knob,
   * up/down for a vertical one, both pairs for a complex one -- so the keys teach the
   * gesture, and the pair the knob does not use is left to the page.
   */
  #onKeyDown = (event: KeyboardEvent): void => {
    if (this._editing) return;
    if (event.key === " ") {
      event.preventDefault();
      if (!event.repeat) this.#sweep.toggle();
      return;
    }
    this.#stop();
    this.#repeats = event.repeat ? this.#repeats + 1 : 0;
    const gear: Gear =
      event.key === "PageUp" || event.key === "PageDown"
        ? "coarse"
        : (modifierGear(event) ?? "normal");
    const { step } = this.#gearing(gear);
    const count = holdMultiplier(this.#repeats);
    const range = this.range;

    // An arrow is an explicit step: it walks the span the way the loop says, in gear.
    const walk = (from: number, steps: number): number =>
      iterate(from, steps, { ...this.#span, step }, this.#loop).value;
    const bump = (dx: number, dy: number): void => {
      event.preventDefault();
      if (this.discrete) {
        this.#commit({ index: walk(this._index, (dx || dy) * count) });
        return;
      }
      this.#commit({
        re: dx === 0 ? this._re : walk(this._re, dx * count),
        im: this.complex && dy !== 0 ? walk(this._im, dy * count) : this._im,
      });
    };
    const horizontal = this.complex || this.axis !== "y";
    const vertical = this.complex || this.axis === "y";
    switch (event.key) {
      case "ArrowRight":
        return horizontal ? bump(1, 0) : undefined;
      case "ArrowLeft":
        return horizontal ? bump(-1, 0) : undefined;
      case "ArrowUp":
        return !vertical ? undefined : this.complex ? bump(0, 1) : bump(1, 0);
      case "ArrowDown":
        return !vertical ? undefined : this.complex ? bump(0, -1) : bump(-1, 0);
      case "PageUp":
        return bump(1, 0);
      case "PageDown":
        return bump(-1, 0);
      case "Home":
        event.preventDefault();
        return this.discrete ? this.#commit({ index: 0 }) : this.#commit({ re: range.min });
      case "End":
        event.preventDefault();
        return this.discrete
          ? this.#commit({ index: this.#entries.length - 1 })
          : this.#commit({ re: range.max });
      case "Enter":
      case "F2":
        event.preventDefault();
        return this.#beginEdit();
      default:
        return;
    }
  };

  #onKeyUp = (): void => {
    this.#repeats = 0;
  };

  // --- typing --------------------------------------------------------------------

  /**
   * Swap the readout for a field holding the value as you would type it (`3`, `-1.5`,
   * `3+2i`, an entry or its index). Enter or leaving the field commits, Escape puts the
   * old value back. A slotted knob has no readout to swap, so it has no field.
   */
  #beginEdit(): void {
    if (this._slotted || this._editing) return;
    this._editing = true;
  }

  /** The value as text a reader would type back: InputForm rather than typeset LaTeX. */
  get #typed(): string {
    if (this.discrete) return this.entry ?? "";
    if (!this.complex && this._im === 0) return String(this._re);
    const sign = this._im < 0 ? "-" : "+";
    return `${this._re}${sign}${Math.abs(this._im)}i`;
  }

  #endEdit(commit: boolean): void {
    if (!this._editing) return;
    const field = this.querySelector<HTMLInputElement>(".notatio-knob-field");
    this._editing = false;
    if (commit && field) this.#adoptTyped(field.value);
    this.#grip.focus({ preventScroll: true });
  }

  #adoptTyped(text: string): void {
    const raw = text.trim();
    if (this.discrete) {
      const at = this.#entries.indexOf(raw);
      const asIndex = Number(raw);
      if (at >= 0) this.#commit({ index: at });
      else if (Number.isInteger(asIndex)) {
        this.#commit({ index: clamp(asIndex, 0, this.#entries.length - 1) });
      }
      return;
    }
    const parsed = parseComplex(raw);
    if (parsed === undefined) return;
    const { min, max } = this.range;
    // A count stays a count: 3.7 typed into a whole-number knob is 4, not a readout
    // that says 4 over a value that is not.
    const snap = (v: number): number => clamp(this.integer ? Math.round(v) : v, min, max);
    this.#commit({ re: snap(parsed.re), im: this.complex ? snap(parsed.im) : 0 });
  }

  #onFieldKey = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      this.#endEdit(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.#endEdit(false);
    }
    // Everything else -- arrows included -- belongs to the field, not the knob.
    event.stopPropagation();
  };

  /**
   * The number this knob binds. For a numeric knob that is the value itself; for a
   * `choices` knob it is the ENTRY when the entry is a number (`{p, {2,3,5,7}}` in
   * Manipulate's terms) and otherwise its index, which is the only thing a word can
   * contribute to an expression. Same rule as `<notatio-toggler>`.
   */
  get bound(): number {
    return this.discrete ? boundEntry(this.entry, this._index) : this._re;
  }

  /** The bound value as MathJSON: the number, complex when it has an imaginary part. */
  get binding(): MathJsonExpression {
    return this.discrete ? this.bound : numberJson(this._re, this._im);
  }

  /**
   * Take a new value and tell the surrounding scope about it, if anything changed.
   * `played` marks a step of playback's own, as against the reader's hand.
   */
  #commit(next: { re?: number; im?: number; index?: number }, played = false): void {
    const re = next.re ?? this._re;
    const im = next.im ?? this._im;
    const index = next.index ?? this._index;
    if (re === this._re && im === this._im && index === this._index) return;
    this._re = re;
    this._im = im;
    this._index = index;
    emitControl(this, {
      name: this.name,
      value: this.binding,
      index: this.discrete ? index : undefined,
      played,
    });
  }

  /** What a screen reader is told this knob is showing. */
  get #aria(): Record<string, string> {
    const { min, max, step } = this.range;
    return {
      "aria-label": this.name || "value",
      "aria-valuenow": String(this.discrete ? this._index : this._re),
      "aria-valuemin": String(this.discrete ? 0 : min),
      "aria-valuemax": String(this.discrete ? this.#entries.length - 1 : max),
      "aria-valuetext": this.discrete ? (this.entry ?? "") : numberLatex(this._re, step),
    };
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has("_editing") && this._editing) {
      const field = this.querySelector<HTMLInputElement>(".notatio-knob-field");
      field?.focus();
      field?.select();
    }
    if (!this._slotted) return;
    for (const [key, value] of Object.entries(this.#aria)) this.setAttribute(key, value);
    this.toggleAttribute("data-dragging", this._dragging);
    this.toggleAttribute("data-complex", this.complex);
    this.toggleAttribute("data-playing", this._playing);
    this.dataset.gear = this._gear;
  }

  /**
   * The ladder beside a dragged one-axis knob: the three increments, the live one
   * marked. It teaches the off-axis gesture by being there, and it names what a gear
   * does in the knob's own units rather than as a multiplier.
   */
  #ladder(): unknown {
    if (!this._dragging || !this.#hasLadder) return nothing;
    const label = (gear: Gear): string => {
      const { step } = this.#gearing(gear);
      const base = this.#gearing("normal").step;
      // An integer knob's fine gear is the same step, slower -- say so.
      if (gear === "fine" && step === base) return `${step} slow`;
      return String(step);
    };
    return html`<span class="notatio-knob-ladder" data-notatio-knob aria-hidden="true"
      >${(["coarse", "normal", "fine"] as const).map(
        (gear) =>
          html`<span data-gear=${gear} ?data-live=${gear === this._gear}>${label(gear)}</span>`,
      )}</span
    >`;
  }

  /** The play/pause button `play` asks for: a sibling of the grip, not part of the drag. */
  #playButton(): unknown {
    return this.play ? playButton(this.#sweep, { own: true }) : nothing;
  }

  #field(): unknown {
    const typed = this.#typed;
    return html`<input
      class="notatio-knob-field"
      data-notatio-knob
      type="text"
      inputmode=${this.discrete ? "text" : "decimal"}
      autocomplete="off"
      spellcheck="false"
      aria-label=${this.name || "value"}
      .value=${typed}
      size=${Math.max(2, typed.length + 1)}
      @keydown=${this.#onFieldKey}
      @blur=${() => this.#endEdit(true)}
    />`;
  }

  protected override render(): unknown {
    // Slotted: the author's own content is the grip, and this element renders nothing
    // that would sit beside it -- bar the ladder while it is being dragged.
    if (this._slotted) return html`${this.#ladder()}${this.#playButton()}`;
    const aria = this.#aria;
    return html`<span
        class="notatio-knob-grip"
        data-notatio-knob
        role="slider"
        tabindex="0"
        aria-label=${aria["aria-label"]}
        aria-valuenow=${aria["aria-valuenow"]}
        aria-valuemin=${aria["aria-valuemin"]}
        aria-valuemax=${aria["aria-valuemax"]}
        aria-valuetext=${aria["aria-valuetext"]}
        ?data-dragging=${this._dragging}
        ?data-complex=${this.complex}
        ?data-editing=${this._editing}
        ?data-playing=${this._playing}
        data-gear=${this._gear}
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerUp}
        @keydown=${this.#onKeyDown}
        @keyup=${this.#onKeyUp}
        >${this._editing ? this.#field() : unsafeHTML(this._markup)}${this.#ladder()}</span
      >${this.#playButton()}`;
  }
}

defineControl("notatio-knob", NotatioKnob);
