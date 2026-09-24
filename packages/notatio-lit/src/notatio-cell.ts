import { toInputForm } from "@enumeratio/formats/inputform";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { fromWolfram, toWolfram } from "@enumeratio/wolfram";
import { html, LitElement, type PropertyValues } from "lit";
import "./notatio-in.ts";
import type { HeadInfo } from "./notatio-out.ts";
import "./notatio-out.ts";
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
      const { json, errors } = parseNotatio(text, {
        allow: ["Assign"],
        parseLatex: (tex) => engine.parse(tex).json,
      });
      if (errors.length) throw new Error(errors[0]);
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
 * or `tex` (LaTeX), each parsed back on commit (Enter or blur). The In label opens a
 * menu to switch editors -- converting the current value -- and to copy it out.
 *
 * The cell starts *clean*: `expect`/`planned` reach the Out, and any `slot="aside"`
 * children (badges, alternatives) show at the end of the Out row. The first edit
 * turns it *dirty* -- `expect`/`planned` drop, the aside hides, and a reset button
 * appears that restores the original value and clears it. `notatio-dirty` fires on
 * both transitions; `notatio-change` fires on every edit, with the result as both
 * notatio text and MathJSON.
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
    /** Set once the reader has made an edit; reflected so a stylesheet can key on it. */
    dirty: { type: Boolean, reflect: true },
    /** Property only: forwarded to the In and Out `notatio-out`s' `resolveHead`. */
    resolveHead: { attribute: false },
    _editForm: { state: true },
    _raw: { state: true },
    _json: { state: true },
    _error: { state: true },
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
  declare dirty: boolean;
  declare resolveHead: ((head: string) => HeadInfo | undefined) | undefined;
  /** The editor currently shown -- starts at `inForm`, changed live via the In menu. */
  declare _editForm: EditForm;
  /** The text (or LaTeX) currently in the active editor, unparsed. */
  declare _raw: string;
  /** The last successfully parsed MathJSON, or `undefined` for a blank/unparsed cell. */
  declare _json: unknown;
  /** Why `_raw` did not parse, when it did not. */
  declare _error: string;
  /** This cell's `In[n]`/`Out[n]` line number, read off the Out's own transcript result. */
  declare _n: number | undefined;

  #token = 0;
  /** `slot="aside"` children, captured before our own render would otherwise wipe them. */
  #aside: Element[] = [];

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
    this.dirty = false;
    this._editForm = "standard";
    this._raw = "";
    this._json = undefined;
    this._error = "";
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
  }

  async #load(): Promise<void> {
    const token = ++this.#token;
    this.dirty = false;
    this._error = "";
    const format = this.format || "notatio";
    const editForm = this.inForm || "standard";
    this._editForm = editForm;
    // Fast path: LaTeX in, a LaTeX-native editor, nothing that needs an evaluated
    // result -- skip the engine entirely, matching notatio-out's own no-engine path.
    if (
      format === "latex" &&
      SYNTAX_OF[editForm] === "latex" &&
      !this.evaluate &&
      !this.box &&
      !this.expect
    ) {
      this._json = undefined;
      this._raw = this.value;
      return;
    }
    try {
      const json = await parseSyntax(format, this.value);
      if (token !== this.#token) return;
      this._json = json;
      this._raw =
        SYNTAX_OF[editForm] === format ? this.value : await textInSyntax(SYNTAX_OF[editForm], json);
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
    this._raw =
      SYNTAX_OF[form] === format ? this.value : await textInSyntax(SYNTAX_OF[form], this._json);
  }

  /** An edit landed (live for `standard`, on commit for the text editors). */
  async #commit(form: EditForm, text: string): Promise<void> {
    const token = ++this.#token;
    this._raw = text;
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
    this.dispatchEvent(
      new CustomEvent("notatio-dirty", { detail: { dirty }, bubbles: true, composed: true }),
    );
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
    return html`<details
      class="notatio-menu is-on-label notatio-in-menu"
      @toggle=${this.#onMenuToggle}
    >
      <summary
        class="notatio-io-label notatio-label-btn"
        title=${`${current.label} — click for input forms`}
      >
        In${this._n === undefined ? "" : `[${this._n}]`}${
          current.form === "standard"
            ? ""
            : html`<span class="notatio-label-form">${current.label}</span>`
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

  #onStandardChange = (event: Event): void => {
    event.stopPropagation(); // superseded by the cell's own notatio-change, below
    void this.#commit("standard", (event as CustomEvent<{ latex: string }>).detail.latex);
  };

  #onTextInput = (event: Event): void => {
    this._raw = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  };

  #onTextKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const field = event.target as HTMLInputElement;
    void this.#commit(this._editForm, field.value);
    field.blur();
  };

  #onTextCommit = (event: FocusEvent): void => {
    void this.#commit(
      this._editForm,
      (event.target as HTMLInputElement | HTMLTextAreaElement).value,
    );
  };

  #editor(): unknown {
    if (this._editForm === "standard") {
      return html`<notatio-in
        .value=${this._raw}
        @notatio-change=${this.#onStandardChange}
      ></notatio-in>`;
    }
    if (this._raw.includes("\n")) {
      return html`<textarea
        class="notatio-cell-text"
        spellcheck="false"
        rows=${Math.min(8, this._raw.split("\n").length + 1)}
        .value=${this._raw}
        @input=${this.#onTextInput}
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
      @keydown=${this.#onTextKeydown}
      @blur=${this.#onTextCommit}
    />`;
  }

  // --- output ------------------------------------------------------------------------

  /** What to hand the Out: the fast-path LaTeX text, or the parsed MathJSON. */
  get #out(): { value: string; format: "latex" | "mathjson" } {
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
          ${
            this.dirty
              ? html`<button type="button" class="notatio-reset" @click=${this.#reset}>
                  edited · reset
                </button>`
              : ""
          }
        </div>
        <div class="notatio-row">
          ${this.#output()}
          <span class="notatio-aside" ?hidden=${this.dirty}></span>
        </div>
      </div>
    `;
  }
}

if (!customElements.get("notatio-cell")) {
  customElements.define("notatio-cell", NotatioCell);
}
