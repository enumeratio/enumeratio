import { toInputForm } from "@enumeratio/formats/inputform";
import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { LONG_PRESS_MS } from "./choice-menu.ts";
import { loadEditor, loadEngine, loadMarkup } from "./mathlive.ts";
import { openPlaybackMenu } from "./playback-menu.ts";
import { ensureStyles } from "./styles.ts";
import {
  inferRange,
  isIntegerKnob,
  type Loop,
  numberLatex,
  parseComplex,
  splitHead,
  sweepInterval,
  symbolLatex,
  wrapHead,
} from "@enumeratio/notatio";
import { Sweep } from "./sweep.ts";

/** The subset of MathLive's `<math-field>` this element drives. */
interface MathField extends HTMLElement {
  value: string;
  readOnly: boolean;
  /** MathLive's current selection, and a reader for the LaTeX inside it. */
  selection?: unknown;
  getValue?: (range?: unknown, format?: string) => string;
  /** MathLive's fill-in-the-blank API: the content of a `\placeholder[id]{}`. */
  getPromptValue?: (id: string, format?: string) => string;
}

/**
 * How a compute-engine type is written on the page. Everything else falls back to
 * an upright name, which is still readable if less conventional.
 */
const TYPE_LATEX: Record<string, string> = {
  integer: "\\mathbb{Z}",
  finite_integer: "\\mathbb{Z}",
  rational: "\\mathbb{Q}",
  finite_rational: "\\mathbb{Q}",
  real: "\\mathbb{R}",
  finite_real: "\\mathbb{R}",
  complex: "\\mathbb{C}",
  finite_complex: "\\mathbb{C}",
  number: "\\mathbb{C}",
  boolean: "\\mathbb{B}",
};

const typeLatex = (type: string): string =>
  TYPE_LATEX[type] ?? `\\mathrm{${type.replace(/_/g, "\\_")}}`;

/** The assignment operators a bound cell may be written with. */
const ASSIGN = /\\coloneqq?|:=/;

/** Everything after the assignment operator -- the part a pinned input lets you edit. */
function valuePart(latex: string): string {
  const m = ASSIGN.exec(latex);
  return (m ? latex.slice(m.index + m[0].length) : latex).trim();
}

/** The id of the one editable hole in a pinned field. */
const PROMPT = "value";

/**
 * `<notatio-in>` -- a LaTeX math field wrapping MathLive's `<math-field>`.
 * Emits `notatio-change` with `{ latex }` on each edit, live as the reader types, and
 * `notatio-commit` with the same shape when MathLive itself considers the edit
 * committed -- its native `change` event, which it fires on Enter and on blur (only if
 * the value actually changed since focus). A consumer that only cares about finished
 * edits -- a cell inside a transcript, where Wolfram evaluates on Shift+Enter, not on
 * every keystroke -- listens for `notatio-commit` instead. When `readonly`, it renders
 * static markup via `mathlive/ssr` and never loads the (heavy) editor. MathLive is
 * lazy-loaded the first time an editable input mounts.
 *
 * A reader can type a *wrapper head* around an expression -- `N(x)` for a number,
 * `FullForm(x)` for the AST, `TraditionalForm(x)` for the rendering (see
 * `WRAPPER_HEADS`). The head lands in the emitted value, not in the editor: the field
 * strips it from the display and keeps showing the expression as written, so the
 * wrapper is a reversible request rather than an edit. A value handed back wrapped is
 * unwrapped again into expression plus head, which is also how a saved one is restored.
 *
 * With `bind` (and optionally `type`) the field is *pinned*: it shows a declaration
 * like `p \in \mathbb{Z} \coloneq 3` where only the value is editable. The
 * declaration is not text the reader could delete -- it is a read-only field with one
 * `\placeholder[value]{}` hole, so the caret cannot leave the value at all.
 *
 * The asserted type is shown, not parsed: `p \in \mathbb{Z} \coloneq 3` reads as a
 * declaration but parses as `Element(p, Assign(Integers, 3))`, binding the assignment
 * to the domain instead of to `p`. So `value` stays the plain `p \coloneq 3` that
 * everything downstream already understands, and the type travels beside it as
 * structure. Enforcing it is a separate job, done by whoever declares the symbol.
 *
 * A pinned field holding a number can **play**: `play` adds a button that sweeps the
 * value through `min`..`max` by `step` (inferred from the value when not given, the
 * way a knob's are), emitting each step as if it had been typed. `loop` says what the
 * ends do -- `cycle`, `reflect` or `none` (the default: a range has ends) -- `interval`
 * and `rate` set the pace, and holding the button opens the speed-and-loop panel.
 * Typing into the field stops it.
 */
export class NotatioIn extends LitElement {
  static properties = {
    /** The LaTeX in the editor; changes emit `notatio-change`. */
    value: { type: String },
    /** Typeset the value without allowing edits. */
    readonly: { type: Boolean, reflect: true },
    /**
     * Read-only: `value` as InputForm, kept in sync and reflected so a copy can read it
     * off a cloned selection fragment. Set `value`, not this.
     */
    inputForm: { type: String, attribute: "input-form", reflect: true },
    /**
     * The wrapper head asked for -- `N`, `FullForm`, `TraditionalForm`, ... (see
     * `WRAPPER_HEADS`), or `""` for none. The emitted value is wrapped in it while the
     * editor keeps showing the expression as written.
     */
    head: { type: String, reflect: true },
    /**
     * Pin this field to a binding: the symbol name and its `\coloneq` become fixed
     * chrome, and only the value can be edited.
     */
    bind: { type: String },
    /**
     * The domain asserted for `bind`, spelled as a compute-engine type (`integer`,
     * `real`, `complex`, ...). Shown as a membership beside the name. Not `type`:
     * that attribute already means "which symbol this component is" elsewhere.
     */
    domain: { type: String },
    /** Show a play button that sweeps a pinned numeric value through its range. */
    play: { type: Boolean, reflect: true },
    /** What a sweep does at the ends: `cycle`, `reflect` or `none` (default). */
    loop: { type: String, reflect: true },
    /** Playback speed as a multiplier on `interval`. */
    rate: { type: Number, reflect: true },
    /** Milliseconds per step; defaults to a whole sweep in a few seconds. */
    interval: { type: Number },
    /** The sweep's range and step; inferred from the value when not given. */
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    _markup: { state: true },
    _playing: { state: true },
  };

  declare value: string;
  declare readonly: boolean;
  declare inputForm: string;
  declare head: string;
  declare bind: string;
  declare domain: string;
  declare play: boolean;
  declare loop: Loop | "";
  declare rate: number;
  declare interval: number;
  declare min: number;
  declare max: number;
  declare step: number;
  declare _markup: string;
  declare _playing: boolean;

  constructor() {
    super();
    this.value = "";
    this.readonly = false;
    this.head = "";
    this.inputForm = "";
    this.bind = "";
    this.domain = "";
    this.play = false;
    this.loop = "";
    this.rate = 1;
    this.interval = Number.NaN;
    this.min = Number.NaN;
    this.max = Number.NaN;
    this.step = Number.NaN;
    this._markup = "";
    this._playing = false;
    ensureStyles();
  }

  // Light DOM so the shared stylesheet and MathLive static CSS apply.
  // The engine, once loaded, so `#onCopy` can reach it without awaiting.
  static #engine: Awaited<ReturnType<typeof loadEngine>> | undefined;

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("copy", this.#onCopy, true);
  }

  override disconnectedCallback(): void {
    this.removeEventListener("copy", this.#onCopy, true);
    this.#stop();
    super.disconnectedCallback();
  }

  // --- playback ------------------------------------------------------------------

  #sweep = new Sweep(
    {
      at: () => this.#number ?? 0,
      set: (v) => this.#write(v),
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

  /** The number a pinned field holds, if it holds one (and only a real one). */
  get #number(): number | undefined {
    if (!this.#pinned) return undefined;
    const parsed = parseComplex(valuePart(this.value));
    return parsed !== undefined && parsed.im === 0 ? parsed.re : undefined;
  }

  /** Whole numbers when the domain says so, or when the value was written as one. */
  get #integer(): boolean {
    const domain = this.domain.trim();
    if (domain === "integer" || domain === "finite_integer") return true;
    return isIntegerKnob(valuePart(this.value), this.step);
  }

  /** The sweep's span: the author's bounds, else the same window a knob would infer. */
  get #span(): { min: number; max: number; step: number } {
    const base = inferRange(this.#number ?? 0, this.#integer);
    const step = Number.isFinite(this.step) && this.step > 0 ? this.step : base.step;
    const min = Number.isFinite(this.min) ? this.min : base.min;
    const max = Number.isFinite(this.max) ? this.max : base.max;
    return max > min ? { min, max, step } : { ...base, step };
  }

  get #loop(): Loop {
    return this.loop === "cycle" || this.loop === "reflect" ? this.loop : "none";
  }

  get #pace(): number {
    const { min, max, step } = this.#span;
    return sweepInterval((max - min) / step + 1);
  }

  /** Write a swept value into the binding, as if it had been typed. */
  #write(v: number): void {
    const { step } = this.#span;
    this.value = `${symbolLatex(this.bind)}\\coloneq ${numberLatex(v, step)}`;
    this.#emit();
  }

  #stop(): void {
    this.#sweep.stop();
  }

  #playButton(): unknown {
    if (!this.play || !this.#pinned) return html``;
    const numeric = this.#number !== undefined;
    return html`<button
      type="button"
      class="notatio-head-btn notatio-in-play"
      title=${numeric ? "play; hold for speed and loop" : "not a number"}
      aria-label=${this._playing ? "pause" : "play"}
      aria-pressed=${this._playing ? "true" : "false"}
      ?disabled=${!numeric}
      @pointerdown=${this.#sweep.press.down}
      @pointerup=${this.#sweep.press.up}
      @pointercancel=${this.#sweep.press.cancel}
      @pointerleave=${this.#sweep.press.cancel}
      @contextmenu=${this.#sweep.press.contextmenu}
      @click=${(e: Event) => {
        if (!this.#sweep.press.click(e) && this.#number !== undefined) this.#sweep.toggle();
      }}
    >
      ${this._playing ? "\u23F8" : "\u25B6"}
    </button>`;
  }

  get #field(): MathField | null {
    return this.renderRoot.querySelector<MathField>("math-field");
  }

  #onInput = (): void => {
    const next = this.#pinned ? this.#fromPrompt() : (this.#field?.value ?? "");
    if (next === undefined || next === this.value) return;
    // The reader's hand wins over the sweep.
    this.#stop();
    this.value = next;
    this.#emit();
  };

  #emit(): void {
    this.dispatchEvent(
      new CustomEvent("notatio-change", {
        detail: { latex: this.#emitted },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // MathLive's own `change` -- Enter, or blur with the value changed since focus.
  #onCommit = (): void => {
    this.dispatchEvent(
      new CustomEvent("notatio-commit", {
        detail: { latex: this.#emitted },
        bubbles: true,
        composed: true,
      }),
    );
  };

  /**
   * What the field reports: the expression as written, or written inside the head. A
   * binding keeps its `\coloneq` outside the wrapper -- it is the value the head is
   * asked about, not the assignment.
   */
  get #emitted(): string {
    if (!this.head || !this.value.trim()) return this.value;
    const m = ASSIGN.exec(this.value);
    if (!m) return wrapHead(this.value, this.head);
    const cut = m.index + m[0].length;
    return `${this.value.slice(0, cut)} ${wrapHead(this.value.slice(cut), this.head)}`;
  }

  /** True when this field shows a pinned declaration rather than a free expression. */
  get #pinned(): boolean {
    return !this.readonly && this.bind.trim() !== "";
  }

  /**
   * Reassemble the whole binding from the one editable hole -- and record what the
   * field now holds, so `updated` does not write it back and take the caret with it.
   */
  #fromPrompt(): string | undefined {
    const field = this.#field;
    const inner = field?.getPromptValue?.(PROMPT, "latex");
    if (inner === undefined) return undefined;
    this.#written = this.#template(inner);
    return `${symbolLatex(this.bind)}\\coloneq ${inner}`.trim();
  }

  /** The pinned part: `p \in \mathbb{Z} \coloneq`, up to but not including the value. */
  get #declaration(): string {
    const domain = this.domain.trim() ? ` \\in ${typeLatex(this.domain.trim())}` : "";
    // An explicit thin space: MathLive sets `\coloneq` tight against the domain.
    return `${symbolLatex(this.bind)}${domain}\\;\\coloneq `;
  }

  /** The field's full LaTeX: the pinned declaration around one editable hole. */
  #template(inner: string): string {
    return `${this.#declaration}\\placeholder[${PROMPT}]{${inner}}`;
  }

  /** The last template written into the field, so an echo is not mistaken for a change. */
  #written = "";

  async #renderStatic(): Promise<void> {
    try {
      const convert = await loadMarkup();
      // A pinned field still shows its declaration when typeset -- the reader should
      // see what the symbol is, not just what it currently equals.
      const latex = this.bind.trim() ? this.#declaration + valuePart(this.value) : this.value;
      this._markup = latex.trim() ? convert(latex) : "";
    } catch (err) {
      this._markup = `<span class="notatio-error">${
        err instanceof Error ? err.message : String(err)
      }</span>`;
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (this.readonly && (changed.has("value") || changed.has("readonly"))) {
      void this.#renderStatic();
    }
    if (changed.has("value")) {
      this.#absorb();
      void this.#syncInputForm();
    }
  }

  /**
   * A value handed back wrapped -- a consumer echoing what we emitted, or a saved
   * document -- unwraps into the expression plus a pressed button, so the editor never
   * shows the reader a wrapper they did not type and the toggle stays reversible.
   */
  #absorb(): void {
    const m = ASSIGN.exec(this.value);
    const cut = m ? m.index + m[0].length : 0;
    const { head, body } = splitHead(this.value.slice(cut));
    if (!head) return;
    this.head = head;
    this.value = `${this.value.slice(0, cut)}${m ? " " : ""}${body}`;
  }

  // Keep `inputForm` current, so a copy -- which cannot await -- always has an answer
  // ready. A value that will not parse leaves the last good one alone rather than
  // blanking it mid-edit.
  async #syncInputForm(): Promise<void> {
    const latex = this.value;
    if (!latex.trim()) {
      this.inputForm = "";
      return;
    }
    try {
      const engine = (NotatioIn.#engine ??= await loadEngine());
      const next = toInputForm(engine.parse(latex, { form: "raw" }).json);
      if (this.value === latex) this.inputForm = next;
    } catch {
      // keep the previous InputForm
    }
  }

  // MathLive owns copy inside the field and would put LaTeX on the clipboard. Replace
  // it with InputForm: the selected range when there is one, else the whole value.
  #onCopy = (event: ClipboardEvent): void => {
    const field = this.#field;
    const selected = field?.getValue?.(field.selection, "latex") ?? "";
    const latex = selected.trim() ? selected : this.value;
    const text = latex === this.value ? this.inputForm : this.#inputFormOf(latex);
    if (!text) return; // nothing cached yet -- let MathLive copy its LaTeX
    event.clipboardData?.setData("text/plain", text);
    event.preventDefault();
    event.stopPropagation();
  };

  // A synchronous InputForm for a partial selection, possible only once the engine has
  // been loaded (which `#syncInputForm` has already done by the time anyone selects).
  #inputFormOf(latex: string): string {
    const engine = NotatioIn.#engine;
    if (!engine) return "";
    try {
      return toInputForm(engine.parse(latex, { form: "raw" }).json);
    } catch {
      return "";
    }
  }

  protected override async updated(): Promise<void> {
    if (this.readonly) return;
    await loadEditor();
    const field = this.#field;
    if (!field) return;
    if (this.#pinned) {
      // Read-only *plus* prompts is what makes the declaration unreachable: MathLive
      // confines the caret to the holes, so there is no caret position from which the
      // name or the operator could be deleted.
      field.readOnly = true;
      const desired = this.#template(valuePart(this.value));
      if (desired !== this.#written) {
        field.value = desired;
        this.#written = desired;
      }
      return;
    }
    field.readOnly = false;
    this.#written = "";
    if (field.value !== this.value) field.value = this.value;
  }

  protected override render(): unknown {
    if (this.readonly) return html`<span class="notatio-static">${unsafeHTML(this._markup)}</span>`;
    return html`<div class="notatio-in-row">
      <math-field @input=${this.#onInput} @change=${this.#onCommit}></math-field>
      ${this.#playButton()}
    </div>`;
  }
}

if (!customElements.get("notatio-in")) {
  customElements.define("notatio-in", NotatioIn);
}
