import { toInputForm } from "@enumeratio/formats/inputform";
import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { loadEditor, loadEngine, loadMarkup } from "./mathlive.ts";
import { splitHead, WRAPPER_HEADS, wrapHead } from "./heads.ts";
import { symbolLatex } from "./reactive.ts";
import { ensureStyles } from "./styles.ts";

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
 * `<notatio-input>` -- a LaTeX math field wrapping MathLive's `<math-field>`.
 * Emits `notatio-change` with `{ latex }` on each edit. When `readonly`, it
 * renders static markup via `mathlive/ssr` and never loads the (heavy) editor.
 * MathLive is lazy-loaded the first time an editable input mounts.
 *
 * A control on the field writes a *wrapper head* around what the reader typed --
 * `N(x)` for a number, `FullForm(x)` for the AST, `TraditionalForm(x)` for the
 * rendering (see `WRAPPER_HEADS`). The head lands in the emitted value, not in the
 * editor: the field keeps showing the expression as written, so the wrapper is a
 * reversible request rather than an edit. A value handed back wrapped is unwrapped
 * again into expression plus head, which is also how a saved one is restored.
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
 */
export class NotatioInput extends LitElement {
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
    _pending: { state: true },
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
    _markup: { state: true },
  };

  declare value: string;
  declare readonly: boolean;
  declare inputForm: string;
  declare head: string;
  declare _pending: string;
  declare bind: string;
  declare domain: string;
  declare _markup: string;

  constructor() {
    super();
    this.value = "";
    this.readonly = false;
    this.head = "";
    this._pending = WRAPPER_HEADS[0].head;
    this.inputForm = "";
    this.bind = "";
    this.domain = "";
    this._markup = "";
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
    super.disconnectedCallback();
  }

  get #field(): MathField | null {
    return this.renderRoot.querySelector<MathField>("math-field");
  }

  #onInput = (): void => {
    const next = this.#pinned ? this.#fromPrompt() : (this.#field?.value ?? "");
    if (next === undefined || next === this.value) return;
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

  /** The button applies the head shown on it, and takes it off again. Off by default. */
  #onHead = (): void => {
    if (!this.value.trim()) return; // nothing to ask about
    this.head = this.head ? "" : this._pending;
    this.#emit();
  };

  /** Picking from the menu both chooses the head and writes it. */
  #pickHead(head: string): void {
    this._pending = head;
    const menu = this.querySelector<HTMLDetailsElement>(".notatio-head-menu");
    if (menu) menu.open = false;
    if (!this.value.trim()) return;
    this.head = head;
    this.#emit();
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
    this._pending = head;
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
      const engine = (NotatioInput.#engine ??= await loadEngine());
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
    const engine = NotatioInput.#engine;
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
    const pending = WRAPPER_HEADS.find((h) => h.head === this._pending) ?? WRAPPER_HEADS[0];
    const applied = this.head
      ? (WRAPPER_HEADS.find((h) => h.head === this.head) ?? pending)
      : pending;
    return html`<div class="notatio-input-row">
      <math-field @input=${this.#onInput}></math-field>
      <button
        type="button"
        class="notatio-head-btn"
        title=${applied.title}
        aria-pressed=${this.head ? "true" : "false"}
        @click=${this.#onHead}
      >
        ${applied.label}
      </button>
      <details class="notatio-head-menu">
        <summary
          class="notatio-head-caret"
          title="Wrap in a head"
          aria-label="Wrap in a head"
        ></summary>
        <div class="notatio-menu-list" role="menu">
          ${WRAPPER_HEADS.map(
            (h) => html`<button
              role="menuitemradio"
              aria-checked=${this.head === h.head}
              class=${this.head === h.head ? "is-current" : ""}
              title=${h.title}
              @click=${() => this.#pickHead(h.head)}
            >
              ${h.head}(…)
            </button>`,
          )}
        </div>
      </details>
    </div>`;
  }
}

if (!customElements.get("notatio-input")) {
  customElements.define("notatio-input", NotatioInput);
}
