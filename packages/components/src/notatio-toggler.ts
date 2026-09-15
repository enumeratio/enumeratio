import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { html, LitElement, nothing, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { entryMarkup, LONG_PRESS_MS, openChoiceMenu, PRESS_SLOP_PX } from "./choice-menu.ts";
import { defineControl, emitControl } from "./controls.ts";
import { playButton } from "./play-button.ts";
import { iterate, type Loop, Sweep, sweepInterval } from "./playback.ts";
import { openPlaybackMenu } from "./playback-menu.ts";
import { capture, release } from "./pointer.ts";
import { ensureStyles } from "./styles.ts";
import {
  type Choice,
  choiceBinding,
  gearing,
  holdMultiplier,
  modifierGear,
  parseChoices,
} from "./tangle.ts";

/**
 * `<notatio-toggler name="size" values="a few|several|many">` -- a word in the prose
 * that **cycles when you click it**, Wolfram's `Toggler` and Tangle's toggle in one.
 *
 * With no `values` it is Wolfram's `Toggler[x]`: a switch between `False` and `True`.
 * Otherwise the entries are separated by `|`, since commas belong to the sentence, and
 * an entry may be written `value -> label` to show one thing and bind another. An
 * entry that looks like a value is typeset; a word is set as prose. Inside a
 * `<notatio-tangle>` the binding `_name` is the entry's value when it is a number or a
 * named value, and otherwise its **index**, so a toggle over words still drives the
 * rest of the document (`<notatio-when test="_size > 1">`).
 *
 * A toggler is a `<notatio-knob>` **without an axis**, and that is the whole
 * difference: there is no direction to drag a word in, so a click steps it once, and a
 * **long press** (or right-click) opens a menu of every entry -- the way to reach the
 * fifth of twelve without passing four. Left/right step it from the keyboard and
 * accelerate when held, Shift or PageUp/PageDown jump ten, and Space cycles it until
 * pressed again; `play` adds a button for that, `autoplay` cycles while the toggler is
 * on screen, `interval` and `rate` set the pace. `loop` says what reaching an end does
 * -- to a click as much as to playback: `cycle` (the default) wraps, `reflect` turns
 * round, `none` stops. A long press on the play button opens a panel for the speed and
 * the loop.
 *
 * A quantity that *does* have a direction -- including a list you would rather brush
 * through than pick from -- wants a knob with `choices` instead.
 */
export class NotatioToggler extends LitElement {
  static properties = {
    /** The binding this toggler drives: `name="a"` fills the wildcard `_a`. */
    name: { type: String, reflect: true },
    /** The entries to cycle through, `|`-separated, each optionally `value -> label`. None: a True/False switch. */
    values: { type: String },
    /** The entry to start on: one of `values` (by value or label), or its index. */
    value: { type: String },
    /** Show a play/pause button beside the word. Space toggles playback regardless. */
    play: { type: Boolean, reflect: true },
    /** Cycle while scrolled into view; pause when scrolled out. */
    autoplay: { type: Boolean },
    /** Milliseconds per entry while playing. */
    interval: { type: Number },
    /** Playback speed as a multiplier on `interval`. */
    rate: { type: Number, reflect: true },
    /** What reaching an end does: `cycle` (default), `reflect` or `none`. */
    loop: { type: String, reflect: true },
    _index: { state: true },
    _markup: { state: true },
    _playing: { state: true },
  };

  declare name: string;
  declare values: string;
  declare value: string;
  declare play: boolean;
  declare autoplay: boolean;
  declare interval: number;
  declare rate: number;
  declare loop: Loop | "";
  declare _index: number;
  declare _markup: string;
  declare _playing: boolean;

  #choices: Choice[] = [];
  #typesetFrom: string | undefined;
  /** The pointer now pressing, and where it went down -- a press, until it moves. */
  #press: { id: number; x: number; y: number } | undefined;
  #longPress: ReturnType<typeof setTimeout> | undefined;
  /**
   * A long press ARMS the menu and the release opens it. Shown mid-press, a popover
   * would be light-dismissed by the very release that follows.
   */
  #menuArmed = false;
  /** The click after a menu is not a click; the button gets told so. */
  #swallowClick = false;
  #repeats = 0;
  #closeMenu: (() => void) | undefined;
  #sweep = new Sweep(
    {
      at: () => this._index,
      set: (i) => this.#set(i),
      span: () => this.#span,
      loop: () => this.#loop,
      setLoop: (loop) => (this.loop = loop),
      rate: () => (Number.isFinite(this.rate) && this.rate > 0 ? this.rate : 1),
      setRate: (rate) => (this.rate = rate),
      interval: () =>
        Number.isFinite(this.interval) && this.interval > 0
          ? this.interval
          : sweepInterval(this.#choices.length),
      onState: () => (this._playing = this.#sweep.playing),
    },
    openPlaybackMenu,
    LONG_PRESS_MS,
  );
  #inView: IntersectionObserver | undefined;

  constructor() {
    super();
    this.name = "";
    this.values = "";
    this.value = "";
    this.play = false;
    this.autoplay = false;
    this.interval = Number.NaN;
    this.rate = 1;
    this.loop = "";
    this._index = 0;
    this._markup = "";
    this._playing = false;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override disconnectedCallback(): void {
    this.#closeMenu?.();
    this.#sweep.stop();
    this.#inView?.disconnect();
    this.#inView = undefined;
    super.disconnectedCallback();
  }

  /** A switch, when no entries were given: `False`, then `True`. */
  get switch(): boolean {
    return this.values.trim() === "";
  }

  /** The entry now showing. */
  get entry(): string {
    return this.#choices[this._index]?.label ?? "";
  }

  /** The number this toggler binds, for the callers that want one. */
  get bound(): number {
    const b = this.binding;
    return typeof b === "number" ? b : b === "True" ? 1 : b === "False" ? 0 : this._index;
  }

  /** The bound value as MathJSON: the entry's value, `True`/`False`, or the index. */
  get binding(): MathJsonExpression {
    return choiceBinding(this.#choices[this._index], this._index);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("values") || changed.has("value")) {
      this.#choices = this.switch
        ? [
            { value: "False", label: "False" },
            { value: "True", label: "True" },
          ]
        : parseChoices(this.values);
      const raw = this.value.trim();
      const at = this.#choices.findIndex((c) => c.value === raw || c.label === raw);
      const asIndex = Number(raw);
      const n = this.#choices.length;
      this._index = at >= 0 ? at : Number.isInteger(asIndex) && n > 0 ? ((asIndex % n) + n) % n : 0;
    }
    if (changed.has("autoplay")) this.#watchView();
    void this.#typeset();
  }

  async #typeset(): Promise<void> {
    const source = this.entry;
    if (source === this.#typesetFrom) return;
    this.#typesetFrom = source;
    this._markup = this.switch ? "" : await entryMarkup(source);
  }

  #set(index: number): void {
    if (index === this._index) return;
    this._index = index;
    emitControl(this, { name: this.name, value: this.binding, index });
  }

  get #loop(): Loop {
    return this.loop === "reflect" || this.loop === "none" ? this.loop : "cycle";
  }

  get #span(): { min: number; max: number; step: number } {
    return { min: 0, max: this.#choices.length - 1, step: 1 };
  }

  /** An explicit step -- an arrow -- wraps only on `cycle`. */
  #step(delta: number): void {
    this.#set(iterate(this._index, delta, this.#span, this.#loop).value);
  }

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

  // --- pointer -------------------------------------------------------------------

  #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    // Safari does not focus a button on click; a press should leave it as focused as
    // a Tab would.
    (event.currentTarget as HTMLElement).focus({ preventScroll: true });
    this.#sweep.stop();
    capture(event.currentTarget as HTMLElement, event.pointerId);
    this.#press = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.#swallowClick = false;
    this.#menuArmed = false;
    // A switch has two states and nothing to pick from: no menu.
    if (!this.switch) this.#longPress = setTimeout(() => (this.#menuArmed = true), LONG_PRESS_MS);
  };

  /** A press that wanders is a text selection, not a press: it opens nothing. */
  #onPointerMove = (event: PointerEvent): void => {
    const press = this.#press;
    if (press === undefined || event.pointerId !== press.id) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) <= PRESS_SLOP_PX) return;
    this.#press = undefined;
    this.#menuArmed = false;
    this.#cancelLongPress();
  };

  #onPointerUp = (event: PointerEvent): void => {
    if (this.#press !== undefined && event.pointerId !== this.#press.id) return;
    release(event.currentTarget as HTMLElement, event.pointerId);
    this.#press = undefined;
    this.#cancelLongPress();
    if (this.#menuArmed) {
      this.#menuArmed = false;
      void this.#openMenu();
    }
  };

  /** The button's own click, which a plain press still produces: step once, the way the loop says. */
  #onClick = (event: MouseEvent): void => {
    if (this.#swallowClick) {
      this.#swallowClick = false;
      event.preventDefault();
      return;
    }
    this.#sweep.advance();
  };

  #cancelLongPress(): void {
    if (this.#longPress !== undefined) clearTimeout(this.#longPress);
    this.#longPress = undefined;
  }

  #onContextMenu = (event: Event): void => {
    if (this.switch) return;
    event.preventDefault();
    // Android fires this from a long touch while the finger is still down; arm as a
    // long press does, and let the release open it.
    if (this.#press !== undefined) this.#menuArmed = true;
    else void this.#openMenu();
  };

  async #openMenu(): Promise<void> {
    if (this.#closeMenu) return;
    this.#cancelLongPress();
    this.#swallowClick = true;
    const items = await Promise.all(this.#choices.map((c) => entryMarkup(c.label)));
    const grip = this.#grip;
    if (!grip) return;
    this.#closeMenu = openChoiceMenu({
      anchor: grip,
      items,
      selected: this._index,
      label: this.name || "choice",
      onPick: (index) => this.#set(index),
      onClose: () => (this.#closeMenu = undefined),
    });
  }

  get #grip(): HTMLElement | null {
    return this.querySelector<HTMLElement>(".notatio-toggler-grip");
  }

  // --- keyboard ------------------------------------------------------------------

  /**
   * Left/right step and wrap, faster the longer they are held; Shift and the Page
   * keys step ten; Home/End go to the ends. Enter is the button's own and arrives
   * as a click; Space is taken for playback.
   */
  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === " ") {
      // Space is playback, not a click: the button must not also fire.
      event.preventDefault();
      if (!event.repeat) this.#sweep.toggle();
      return;
    }
    this.#sweep.stop();
    this.#repeats = event.repeat ? this.#repeats + 1 : 0;
    const gear =
      event.key === "PageUp" || event.key === "PageDown"
        ? "coarse"
        : (modifierGear(event) ?? "normal");
    const delta = gearing(1, 1, gear, true).step * holdMultiplier(this.#repeats);
    const last = this.#choices.length - 1;
    // Left/right only: a toggler is a line of entries, not a column of them.
    switch (event.key) {
      case "ArrowRight":
      case "PageUp":
        event.preventDefault();
        return this.#step(delta);
      case "ArrowLeft":
      case "PageDown":
        event.preventDefault();
        return this.#step(-delta);
      case "Home":
        event.preventDefault();
        return this.#set(0);
      case "End":
        event.preventDefault();
        return this.#set(Math.max(0, last));
      default:
        return;
    }
  };

  #onKeyUp = (): void => {
    this.#repeats = 0;
  };

  protected override render(): unknown {
    const on = this.switch && this._index === 1;
    return html`<button
        type="button"
        class="notatio-toggler-grip"
        role=${this.switch ? "switch" : nothing}
        aria-checked=${this.switch ? String(on) : nothing}
        aria-label=${this.name || "choice"}
        ?data-switch=${this.switch}
        ?data-on=${on}
        ?data-playing=${this._playing}
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerUp}
        @click=${this.#onClick}
        @contextmenu=${this.#onContextMenu}
        @keydown=${this.#onKeyDown}
        @keyup=${this.#onKeyUp}
      >
        ${this.switch ? html`<span class="notatio-switch-track"><span class="notatio-switch-thumb"></span></span>` : unsafeHTML(this._markup)}</button
      >${this.play ? playButton(this.#sweep) : nothing}`;
  }
}

defineControl("notatio-toggler", NotatioToggler);
