import { toInputForm } from "@enumeratio/formats/inputform";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { fromWolfram, toWolfram } from "@enumeratio/wolfram";
import { html, LitElement, type PropertyValues } from "lit";
import "./notatio-in.ts";
import { type HeadInfo, transcriptHostOf } from "./notatio-out.ts";
import "./notatio-out.ts";
import { latexForText, pastedFrom } from "./clipboard.ts";
import { loadEngine } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";

/** The syntax `notatio-cell`'s `value` is written in -- what `format` names. */
type Syntax = "notatio" | "latex" | "mathjson" | "wolfram";

/** The editor shown for the In row; each names the syntax its text is written in. */
type EditForm = "standard" | "input" | "full" | "wolfram" | "tex";

const SYNTAX_OF: Record<EditForm, Syntax> = {
  standard: "latex",
  tex: "latex",
  input: "notatio",
  full: "mathjson",
  wolfram: "wolfram",
};

const EDIT_FORMS: readonly { form: EditForm; label: string; title: string }[] = [
  { form: "standard", label: "StandardForm", title: "typeset math" },
  { form: "input", label: "InputForm", title: "notatio you could retype" },
  { form: "full", label: "MathJSON", title: "the MathJSON AST, as text" },
  { form: "wolfram", label: "WolframFullForm", title: "Wolfram source" },
  { form: "tex", label: "TeXForm", title: "LaTeX source" },
];

type Engine = Awaited<ReturnType<typeof loadEngine>>;

/** Text that doesn't parse, and where, when the parser said. */
class SyntaxProblem extends Error {
  constructor(
    message: string,
    readonly range?: readonly [number, number],
  ) {
    super(message);
  }
}

/** How long typing has to pause before the text is parsed for a hint. */
const HINT_DELAY_MS = 300;

/** `text`, in `syntax`, to MathJSON. `""` reads as no expression at all. */
async function parseSyntax(syntax: Syntax, text: string): Promise<unknown> {
  if (!text.trim()) return undefined;
  switch (syntax) {
    case "mathjson":
      return JSON.parse(text);
    case "wolfram":
      return fromWolfram(text);
    case "latex": {
      const engine = await loadEngine();
      return engine.parse(text, { form: "raw" }).json;
    }
    case "notatio":
    default: {
      const engine = await loadEngine();
      // `Assign` is otherwise a statement notatio rejects outside a notebook -- a cell IS
      // a notebook line (`a := 5`, then `a^2` reads it back), whether or not it sits in a
      // transcript.
      const { json, diagnostics } = parseNotatio(text, {
        allow: ["Assign"],
        parseLatex: (tex) => engine.parse(tex).json,
      });
      if (diagnostics.length) throw new SyntaxProblem(diagnostics[0].message, diagnostics[0].range);
      return json;
    }
  }
}

/** MathJSON as text in `syntax`. The inverse of `parseSyntax`. */
async function textInSyntax(syntax: Syntax, json: unknown, engine?: Engine): Promise<string> {
  if (json === undefined) return "";
  switch (syntax) {
    case "mathjson":
      return JSON.stringify(json);
    case "wolfram":
      return toWolfram(json as Parameters<typeof toWolfram>[0]);
    case "latex": {
      const e = engine ?? (await loadEngine());
      return e.box(json as Parameters<Engine["box"]>[0], { form: "raw" }).latex;
    }
    case "notatio":
    default:
      return toInputForm(json as Parameters<typeof toInputForm>[0]);
  }
}

/**
 * `<notatio-cell>` -- one In/Out pair: an editable input over a live read-only
 * `<notatio-out>` of the result. Renders in light DOM so the nested output inherits
 * the page's MathLive styles.
 *
 * `value` is written in the syntax `format` names (`notatio` by default, or `latex`,
 * `mathjson`, `wolfram`); `in-form` picks which editor shows it -- `standard` (the
 * MathLive field, live on every keystroke), or a plain text field in `input`
 * (InputForm/notatio), `full` (the MathJSON AST as text), `wolfram` (Wolfram source)
 * or `tex` (LaTeX), each parsed back on commit (Enter or blur). While one is being typed
 * in, a pause in the typing parses it for a hint -- what is wrong with it, and where --
 * beside the editor, without evaluating; and LaTeX pasted into one (a math field's copy,
 * or `$…$`) goes in as that editor's syntax (see `clipboard.ts`). The In label opens a
 * menu to switch editors -- converting the current value -- and to copy it out.
 *
 * The cell starts *clean*: `expect`/`planned` reach the Out, and any `slot="aside"`
 * children (badges, alternatives) show at the end of the Out row. The first edit
 * turns it *dirty* -- `expect`/`planned` drop, the aside hides, and a reset button
 * appears that restores the original value and clears it. `notatio-dirty` fires on
 * both transitions; `notatio-change` fires on every edit, with the result as both
 * notatio text and MathJSON.
 *
 * Inside a transcript (a `<notatio-dynamic-module>` ancestor, `transcriptHostOf`), a
 * cell evaluates only on COMMIT -- Enter or blur -- never on every keystroke: Wolfram
 * evaluates a notebook cell on Shift+Enter, not as you type, since each evaluation
 * advances the shared `$Line` history (`Out(n)` would otherwise land on every
 * intermediate keystroke). The `standard` (MathLive) editor already commits live
 * outside a transcript; inside one it holds the new value in `_raw` (so the field
 * itself stays responsive) and reflects `pending` until `<notatio-in>`'s own
 * `notatio-commit` -- MathLive's native `change`, on Enter or blur -- lands. The text
 * editors (`input`/`full`/`wolfram`/`tex`) already commit only on Enter/blur outside
 * a transcript too, so this only changes the `standard` editor's behavior inside one.
 */
export class NotatioCell extends LitElement {
  static properties = {
    /** The initial input, in the syntax `format` names. */
    value: { type: String },
    /** The syntax `value` is written in. */
    format: { type: String },
    /** Which editor shows the In row; its menu can switch this live. */
    inForm: { type: String, attribute: "in-form" },
    /** The representation the Out shows; its own menu changes this live. */
    outForm: { type: String, attribute: "out-form" },
    /** Evaluate the input rather than only boxing it. On by default. */
    evaluate: { type: Boolean },
    /** Box the input without evaluating, so a source Out form shows the expression itself. */
    box: { type: Boolean },
    /** A MathJSON value to assert the Out against, while the cell is clean. */
    expect: { type: String },
    /** Mark an `expect` mismatch as a known gap, while the cell is clean. */
    planned: { type: Boolean },
    /** Forwarded to the Out: a preset its picture reduces for, else the page's own. */
    env: { type: String },
    /** Forwarded to the Out: describe a long `List` result rather than typeset it. */
    elideAbove: { type: Number, attribute: "elide-above" },
    /** Forwarded to the Out: also report the substituted-but-unevaluated input. */
    plot: { type: Boolean },
    /**
     * Pin the `standard` editor to a binding, forwarded to `<notatio-in>`: the symbol
     * name and its `\coloneq` become fixed chrome, and only the value can be edited. A
     * page *about* p keeps a p bound to something, whatever the reader types into it.
     */
    bind: { type: String },
    /** The domain asserted for `bind` (`integer`, `real`, `complex`, ...); see `notatio-in`. */
    domain: { type: String },
    /** Set once the reader has made an edit; reflected so a stylesheet can key on it. */
    dirty: { type: Boolean, reflect: true },
    /**
     * Set while an edit is held back waiting for commit (inside a transcript, the
     * `standard` editor between a keystroke and the next Enter/blur); reflected so a
     * stylesheet can dim the now-stale Out.
     */
    pending: { type: Boolean, reflect: true },
    /** Property only: forwarded to the In and Out `notatio-out`s' `resolveHead`. */
    resolveHead: { attribute: false },
    /**
     * Property only: a driver (a worksheet's slider) sets this to override what the Out
     * evaluates, in `format`'s syntax, WITHOUT touching `value`/the editor field -- so a
     * drag redraws the result every frame without MathLive re-typesetting the input it
     * is bound to, which measured 11-31ms of synchronous work each and was what froze a
     * dragged worksheet outright. `undefined` (the default) means the Out evaluates
     * `value` as normal; the driver clears it back to `undefined` and writes the settled
     * value into `value` once, on release.
     */
    liveValue: { attribute: false },
    _editForm: { state: true },
    _raw: { state: true },
    _json: { state: true },
    _liveJson: { state: true },
    _error: { state: true },
    _hint: { state: true },
    _n: { state: true },
  };

  declare value: string;
  declare format: Syntax;
  declare inForm: EditForm;
  declare outForm: string;
  declare evaluate: boolean;
  declare box: boolean;
  declare expect: string;
  declare planned: boolean;
  declare env: string;
  declare elideAbove: number;
  declare plot: boolean;
  declare bind: string;
  declare domain: string;
  declare dirty: boolean;
  declare pending: boolean;
  declare resolveHead: ((head: string) => HeadInfo | undefined) | undefined;
  declare liveValue: string | undefined;
  /** The editor currently shown -- starts at `inForm`, changed live via the In menu. */
  declare _editForm: EditForm;
  /** The text (or LaTeX) currently in the active editor, unparsed. */
  declare _raw: string;
  /** The last successfully parsed MathJSON, or `undefined` for a blank/unparsed cell. */
  declare _json: unknown;
  /** `liveValue` parsed, when set; takes over from `_json` for the Out only. */
  declare _liveJson: unknown;
  /** Why `_raw` did not parse, when it did not. */
  declare _error: string;
  /** Why the text being typed doesn't parse, yet -- ephemeral, never an Out. */
  declare _hint: string;
  /** This cell's `In[n]`/`Out[n]` line number, read off the Out's own transcript result. */
  declare _n: number | undefined;

  #token = 0;
  /** `slot="aside"` children, captured before our own render would otherwise wipe them. */
  #aside: Element[] = [];
  /**
   * True from the moment `_raw` changes until the next `#commit` actually runs --
   * whichever editor is showing. A commit event (blur, or a synthetic one right after
   * Enter) that finds this `false` is a no-op echo and is skipped, which is what keeps
   * the text editors' Enter-then-blur from evaluating twice.
   */
  #uncommitted = false;

  constructor() {
    super();
    this.value = "";
    this.format = "notatio";
    this.inForm = "standard";
    this.outForm = "standard";
    this.evaluate = true;
    this.box = false;
    this.expect = "";
    this.planned = false;
    this.env = "";
    this.elideAbove = 0;
    this.plot = false;
    this.liveValue = undefined;
    this._liveJson = undefined;
    this.bind = "";
    this.domain = "";
    this.dirty = false;
    this.pending = false;
    this._editForm = "standard";
    this._raw = "";
    this._json = undefined;
    this._error = "";
    this._hint = "";
    this._n = undefined;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Light DOM has no native slotting; grab the aside children once, before the
    // first render would otherwise clear them along with the rest of our content.
    if (this.#aside.length === 0) {
      this.#aside = [...this.querySelectorAll(':scope > [slot="aside"]')];
      for (const node of this.#aside) node.remove();
    }
  }

  override disconnectedCallback(): void {
    clearTimeout(this.#hintTimer);
    globalThis.document?.removeEventListener("pointerdown", this.#onDocPointerDown);
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    const container = this.querySelector<HTMLElement>(".notatio-aside");
    if (container) for (const node of this.#aside) container.appendChild(node);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (
      changed.has("value") ||
      changed.has("format") ||
      changed.has("inForm") ||
      changed.has("evaluate") ||
      changed.has("box") ||
      changed.has("expect")
    ) {
      void this.#load();
    }
    if (changed.has("liveValue")) void this.#loadLive();
  }

  /**
   * `liveValue`'s own staleness ticket -- separate from `#token`. A slider's commit
   * changes `value` AND clears `liveValue` in the same update; sharing one counter
   * would have `#loadLive`'s own bump (below) invalidate the `#load` this same
   * `willUpdate` just started, so the settled value it committed never actually
   * landed in `_json` -- the Out went blank on every release.
   */
  #liveToken = 0;

  /** Parse `liveValue`, when set, into `_liveJson` -- the Out's override. See its own doc. */
  async #loadLive(): Promise<void> {
    const token = ++this.#liveToken;
    if (this.liveValue === undefined) {
      this._liveJson = undefined;
      return;
    }
    try {
      const json = await parseSyntax(this.format || "notatio", this.liveValue);
      if (token !== this.#liveToken) return;
      this._liveJson = json;
    } catch {
      // An override that briefly fails to parse (a slider between valid digits) leaves
      // the Out on its last good value rather than erroring out from under a drag.
    }
  }

  async #load(): Promise<void> {
    const token = ++this.#token;
    this.dirty = false;
    this.pending = false;
    this.#uncommitted = false;
    this._error = "";
    this._hint = "";
    const format = this.format || "notatio";
    const editForm = this.inForm || "standard";
    this._editForm = editForm;
    // Fast path: LaTeX in, a LaTeX-native editor, nothing that needs an evaluated
    // result -- skip the engine entirely, matching notatio-out's own no-engine path.
    if (format === "latex" && SYNTAX_OF[editForm] === "latex" && !this.evaluate && !this.box && !this.expect) {
      this._json = undefined;
      this._raw = this.value;
      return;
    }
    try {
      const json = await parseSyntax(format, this.value);
      if (token !== this.#token) return;
      this._json = json;
      this._raw = SYNTAX_OF[editForm] === format ? this.value : await textInSyntax(SYNTAX_OF[editForm], json);
    } catch (err) {
      if (token !== this.#token) return;
      this._json = undefined;
      this._raw = this.value;
      this._error = err instanceof Error ? err.message : String(err);
    }
  }

  /** The In menu picked a different editor: convert the value, don't dirty the cell. */
  async #switchForm(form: EditForm): Promise<void> {
    this.#closeMenu();
    if (form === this._editForm) return;
    // The fast path above may have left `_json` unset; a form change needs it.
    if (this._json === undefined && !this._error && this.value.trim()) {
      try {
        this._json = await parseSyntax(this.format || "notatio", this.value);
      } catch (err) {
        this._error = err instanceof Error ? err.message : String(err);
        this._editForm = form;
        return;
      }
    }
    this._editForm = form;
    const format = this.format || "notatio";
    this._raw = SYNTAX_OF[form] === format ? this.value : await textInSyntax(SYNTAX_OF[form], this._json);
    // Switching editors re-renders the current value, not a new one -- nothing pending.
    this.pending = false;
    this.#uncommitted = false;
    this._hint = "";
  }

  /**
   * An edit landed (live for `standard` outside a transcript, on commit -- Enter or
   * blur -- for the text editors always, and for `standard` inside a transcript too).
   */
  async #commit(form: EditForm, text: string): Promise<void> {
    const token = ++this.#token;
    this._raw = text;
    this.pending = false;
    this.#uncommitted = false;
    clearTimeout(this.#hintTimer);
    this._hint = "";
    try {
      const json = await parseSyntax(SYNTAX_OF[form], text);
      if (token !== this.#token) return;
      this._json = json;
      this._error = "";
    } catch (err) {
      if (token !== this.#token) return;
      this._error = err instanceof Error ? err.message : String(err);
    }
    this.#markDirty();
    void this.#emitChange();
  }

  #markDirty(): void {
    if (this.dirty) return;
    this.dirty = true;
    this.#fireDirty(true);
  }

  #fireDirty(dirty: boolean): void {
    this.dispatchEvent(new CustomEvent("notatio-dirty", { detail: { dirty }, bubbles: true, composed: true }));
  }

  async #emitChange(): Promise<void> {
    const notatio = this._json === undefined ? "" : await textInSyntax("notatio", this._json);
    this.dispatchEvent(
      new CustomEvent("notatio-change", {
        detail: { notatio, json: this._json },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #reset = (): void => {
    void this.#load();
    this.#fireDirty(false);
  };

  // --- In label menu (editor choice + copy) ---------------------------------------

  #details(): HTMLDetailsElement | null {
    return this.querySelector<HTMLDetailsElement>(".notatio-in-menu");
  }

  #closeMenu(): void {
    const menu = this.#details();
    if (menu) menu.open = false;
  }

  #onDocPointerDown = (event: Event): void => {
    if (!event.composedPath().includes(this)) this.#closeMenu();
  };

  #onMenuToggle = (event: Event): void => {
    const open = (event.target as HTMLDetailsElement).open;
    const doc = globalThis.document;
    if (open) doc?.addEventListener("pointerdown", this.#onDocPointerDown);
    else doc?.removeEventListener("pointerdown", this.#onDocPointerDown);
  };

  async #copy(kind: "latex" | "mathjson" | "input"): Promise<void> {
    this.#closeMenu();
    let text: string;
    if (kind === "mathjson") text = this._json === undefined ? "" : JSON.stringify(this._json);
    else if (kind === "input") text = await textInSyntax("notatio", this._json);
    else text = this._json === undefined ? this._raw : await textInSyntax("latex", this._json);
    if (text) await globalThis.navigator?.clipboard?.writeText(text);
  }

  #inMenu(): unknown {
    const current = EDIT_FORMS.find((f) => f.form === this._editForm) ?? EDIT_FORMS[0];
    return html`<details class="notatio-menu is-on-label notatio-in-menu" @toggle=${this.#onMenuToggle}>
      <summary class="notatio-io-label notatio-label-btn" title=${`${current.label} — click for input forms`}>
        In${this._n === undefined ? "" : `[${this._n}]`}${
          current.form === "standard" ? "" : html`<span class="notatio-label-form">${current.label}</span>`
        }
      </summary>
      <div class="notatio-menu-list" role="menu">
        ${EDIT_FORMS.map(
          (f) => html`<button
            role="menuitemradio"
            aria-checked=${this._editForm === f.form}
            class=${this._editForm === f.form ? "is-current" : ""}
            title=${f.title}
            @click=${() => void this.#switchForm(f.form)}
          >
            ${f.label}
          </button>`,
        )}
        <hr />
        <button role="menuitem" @click=${() => void this.#copy("input")}>Copy InputForm</button>
        <button role="menuitem" @click=${() => void this.#copy("latex")}>Copy LaTeX</button>
        <button role="menuitem" @click=${() => void this.#copy("mathjson")}>Copy MathJSON</button>
      </div>
    </details>`;
  }

  // --- editors ---------------------------------------------------------------------

  // Live, on every keystroke. Outside a transcript this both updates the field's own
  // text and commits it, as today. Inside one, a keystroke only updates the field --
  // `<notatio-out>` keeps showing the last committed value until `#onStandardCommit`
  // (MathLive's own `change`, on Enter or blur) actually runs it.
  #onStandardChange = (event: Event): void => {
    event.stopPropagation(); // superseded by the cell's own notatio-change, below
    const latex = (event as CustomEvent<{ latex: string }>).detail.latex;
    this._raw = latex;
    this.#uncommitted = true;
    if (transcriptHostOf(this)) {
      this.#markDirty();
      this.pending = true;
      return;
    }
    void this.#commit("standard", latex);
  };

  // MathLive's own commit (Enter, or blur with a real change). Outside a transcript
  // the live path above already committed this text, so there is nothing to do here.
  #onStandardCommit = (event: Event): void => {
    event.stopPropagation();
    if (!transcriptHostOf(this) || !this.#uncommitted) return;
    void this.#commit("standard", (event as CustomEvent<{ latex: string }>).detail.latex);
  };

  #onTextInput = (event: Event): void => {
    this._raw = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.#uncommitted = true;
    this.#scheduleHint();
  };

  #hintTimer: ReturnType<typeof setTimeout> | undefined;

  // Parse what's being typed once typing pauses, and say what's wrong with it beside the
  // editor -- without evaluating (that waits for commit, as before) and without touching
  // the Out. A keystroke inside the pause starts it over, so a fast typist pays nothing.
  #scheduleHint(): void {
    clearTimeout(this.#hintTimer);
    const [form, text] = [this._editForm, this._raw];
    this.#hintTimer = setTimeout(() => void this.#hint(form, text), HINT_DELAY_MS);
  }

  async #hint(form: EditForm, text: string): Promise<void> {
    let hint = "";
    try {
      await parseSyntax(SYNTAX_OF[form], text);
    } catch (err) {
      const at = err instanceof SyntaxProblem && err.range ? `\u00a0(at\u00a0${err.range[0] + 1})` : "";
      hint = `${err instanceof Error ? err.message : String(err)}${at}`;
    }
    // Stale by the time it parsed: the text moved on, or was committed.
    if (!this.#uncommitted || this._raw !== text || this._editForm !== form) return;
    this._hint = hint;
  }

  // A paste of LaTeX -- another cell's math field, or `$…$` from Copy LaTeX or a web page
  // -- goes in as this editor's own syntax; anything else is inserted as it is.
  #onTextPaste = (event: ClipboardEvent): void => {
    const syntax = SYNTAX_OF[this._editForm];
    const pasted = pastedFrom(event.clipboardData);
    const found = latexForText(pasted);
    if (found === undefined) return;
    event.preventDefault();
    const field = event.target as HTMLInputElement | HTMLTextAreaElement;
    const [start, end] = [field.selectionStart ?? field.value.length, field.selectionEnd ?? field.value.length];
    void (async () => {
      const text = await this.#pastedText(syntax, found, pasted.text ?? found.latex);
      field.setRangeText(text, start, end, "end");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    })();
  };

  /** A LaTeX paste as `syntax` text; `plain` -- what the clipboard said as text -- if it won't convert. */
  async #pastedText(
    syntax: Syntax,
    { latex, maybe }: { latex: string; maybe: boolean },
    plain: string,
  ): Promise<string> {
    if (syntax === "latex") return latex;
    try {
      if (maybe) {
        await parseSyntax(syntax, plain);
        return plain; // already this editor's syntax
      }
    } catch {
      // not this editor's syntax, so LaTeX after all
    }
    try {
      return await textInSyntax(syntax, await parseSyntax("latex", latex));
    } catch {
      return plain;
    }
  }

  #onTextKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const field = event.target as HTMLInputElement;
    void this.#commit(this._editForm, field.value);
    field.blur();
  };

  // Also fires right after `#onTextKeydown`'s own `blur()` call -- `#commit` already
  // cleared `#uncommitted` by then, so that echo is a no-op rather than a second run.
  #onTextCommit = (event: FocusEvent): void => {
    if (!this.#uncommitted) return;
    void this.#commit(this._editForm, (event.target as HTMLInputElement | HTMLTextAreaElement).value);
  };

  #editor(): unknown {
    if (this._editForm === "standard") {
      return html`<notatio-in
        .value=${this._raw}
        .bind=${this.bind}
        .domain=${this.domain}
        @notatio-change=${this.#onStandardChange}
        @notatio-commit=${this.#onStandardCommit}
      ></notatio-in>`;
    }
    if (this._raw.includes("\n")) {
      return html`<textarea
        class="notatio-cell-text"
        spellcheck="false"
        rows=${Math.min(8, this._raw.split("\n").length + 1)}
        .value=${this._raw}
        @input=${this.#onTextInput}
        @paste=${this.#onTextPaste}
        @blur=${this.#onTextCommit}
      ></textarea>`;
    }
    return html`<input
      class="notatio-cell-text"
      type="text"
      spellcheck="false"
      size=${Math.max(12, this._raw.length + 2)}
      .value=${this._raw}
      @input=${this.#onTextInput}
      @paste=${this.#onTextPaste}
      @keydown=${this.#onTextKeydown}
      @blur=${this.#onTextCommit}
    />`;
  }

  // --- output ------------------------------------------------------------------------

  /** What to hand the Out: the fast-path LaTeX text, or the parsed MathJSON. */
  get #out(): { value: string; format: "latex" | "mathjson" } {
    // A live override takes over the Out only -- `_raw`/the editor stays on `value`.
    if (this.liveValue !== undefined) {
      return {
        value: this._liveJson === undefined ? "" : JSON.stringify(this._liveJson),
        format: "mathjson",
      };
    }
    if (this._json === undefined && !this._error && (this.format || "notatio") === "latex") {
      return { value: this._raw, format: "latex" };
    }
    return {
      value: this._json === undefined ? "" : JSON.stringify(this._json),
      format: "mathjson",
    };
  }

  #output(): unknown {
    if (this._error) {
      return html`<span class="notatio-io-label notatio-out-label">Out</span>
        <span class="notatio-error">${this._error}</span>`;
    }
    const out = this.#out;
    return html`<notatio-out
      label="Out"
      label-menu
      .value=${out.value}
      format=${out.format}
      form=${this.outForm}
      ?evaluate=${this.evaluate && !this.box}
      ?box=${this.box}
      expect=${this.dirty ? "" : this.expect}
      ?planned=${!this.dirty && this.planned}
      env=${this.env}
      elide-above=${this.elideAbove || 0}
      ?plot=${this.plot}
      .resolveHead=${this.resolveHead}
      @notatio-result=${this.#onResult}
    ></notatio-out>`;
  }

  // The Out is the only thing that actually evaluates (`notatio-out`'s own engine call),
  // so it is the only thing that knows this line's transcript number; the In label just
  // reads it back.
  #onResult = (event: Event): void => {
    this._n = (event as CustomEvent<{ n?: number }>).detail.n;
  };

  protected override render(): unknown {
    return html`
      <div class="notatio-cell">
        <div class="notatio-row">
          ${this.#inMenu()}
          <span class="notatio-render">${this.#editor()}</span>
          ${this._hint ? html`<span class="notatio-cell-hint" role="status">${this._hint}</span>` : ""}
          ${
            this.dirty
              ? html`<button type="button" class="notatio-reset" @click=${this.#reset}>edited · reset</button>`
              : ""
          }
        </div>
        <div class="notatio-row">
          ${this.#output()} ${this.pending ? html`<span class="notatio-uncommitted-hint">edited — ↵ to run</span>` : ""}
          <span class="notatio-aside" ?hidden=${this.dirty}></span>
        </div>
      </div>
    `;
  }
}

if (!customElements.get("notatio-cell")) {
  customElements.define("notatio-cell", NotatioCell);
}
