import { fromWolfram } from "@enumeratio/wolfram";
import { html, LitElement, type PropertyValues } from "lit";
import "./notatio-in.ts";
import "./notatio-out.ts";
import "./notatio-code.ts";
import { loadEngine } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";
import { debug, editorLatexOf, formOfHead, splitHead } from "@enumeratio/notatio";

const log = debug("cell");

/**
 * `<notatio-cell>` -- a notebook-style In/Out pair: an editable input over a live
 * read-only `<notatio-out>` of the result. Renders in light DOM so the nested
 * output inherits the page's MathLive styles.
 *
 * `in-form` picks the input syntax: "notatio" (default -- converted to LaTeX for the
 * MathLive editor, which is the only place LaTeX is the native form), "latex" (handed
 * to the editor as written) or "wolfram" (an editable Wolfram full-form box, parsed
 * back to MathJSON via `fromWolfram`). `out-form` picks the Out form; `box` boxes the
 * input without evaluating (so a source Out form shows the expression itself).
 */
export class NotatioCell extends LitElement {
  static properties = {
    /** The initial input, in the syntax `in-form` names. */
    value: { type: String },
    /** Evaluate the input rather than only boxing it. On by default. */
    evaluate: { type: Boolean },
    /**
     * Input syntax: `notatio` (default), `latex` (the MathLive editor's own form) or
     * `wolfram` (an editable full-form box).
     */
    inForm: { type: String, attribute: "in-form" },
    /** The representation the Out shows; the In/Out menu changes it live. */
    outForm: { type: String, attribute: "out-form" },
    /** Box the input without evaluating, so a source Out form shows the expression itself. */
    box: { type: Boolean },
    _editor: { state: true },
    _latex: { state: true },
    _headForm: { state: true },
    _mathjson: { state: true },
    _wolframSrc: { state: true },
    _error: { state: true },
  };

  declare value: string;
  declare evaluate: boolean;
  declare inForm: string;
  declare outForm: string;
  declare box: boolean;
  /** The LaTeX handed to the editor: `value` as written, or converted from notatio. */
  declare _editor: string;
  /** The LaTeX the Out evaluates: what the editor holds, minus any wrapper head. */
  declare _latex: string;
  declare _headForm: string;
  declare _mathjson: string;
  declare _wolframSrc: string;
  /** Why `value` could not be read, when it could not. */
  declare _error: string;

  constructor() {
    super();
    this.value = "";
    this.evaluate = true;
    this.inForm = "notatio";
    this.outForm = "standard";
    this.box = false;
    this._editor = "";
    this._latex = "";
    this._headForm = "";
    this._mathjson = "";
    this._wolframSrc = "";
    this._error = "";
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("value") || changed.has("inForm")) {
      this._error = "";
      if (this.inForm === "wolfram") {
        this._wolframSrc = this.value;
        this.#parseWolfram(this.value);
      } else if (this.inForm === "latex") {
        this.#absorb(this.value);
      } else {
        void this.#convert(this.value);
      }
    }
  }

  // A later `value` must win over an earlier conversion still awaiting the engine.
  #conversion = 0;

  async #convert(source: string): Promise<void> {
    const token = ++this.#conversion;
    const engine = await loadEngine();
    if (token !== this.#conversion) return;
    const { latex, errors } = editorLatexOf(engine, this.inForm, source);
    if (errors.length) {
      log("value is not notatio", source, errors);
      this._error = errors[0];
    }
    this.#absorb(latex);
  }

  /** Take LaTeX as the cell's content: into the editor whole, into the Out headless. */
  #absorb(latex: string): void {
    this._editor = latex;
    this.#read(latex);
  }

  // Wolfram full-form source -> MathJSON (kept as a JSON string for the Out).
  // On a parse error, hold the last good MathJSON so the Out doesn't flash empty.
  #parseWolfram(src: string): void {
    try {
      this._mathjson = JSON.stringify(fromWolfram(src));
    } catch {
      // keep the previous _mathjson
    }
  }

  // A head written around the input asks for something of the Out. `N` is a head the
  // engine itself acts on, so it stays in the expression; a *Form head is a request for
  // a representation, and the Out shows that form of the expression inside it.
  #read(latex: string): void {
    const { head, body } = splitHead(latex);
    const form = formOfHead(head);
    this._headForm = form ?? "";
    this._latex = form ? body : latex;
  }

  #onLatexChange = (event: Event): void => {
    this.#read((event as CustomEvent<{ latex: string }>).detail.latex);
  };

  #onWolframChange = (event: Event): void => {
    const src = (event as CustomEvent<{ value: string }>).detail.value;
    this._wolframSrc = src;
    this.#parseWolfram(src);
  };

  #input(): unknown {
    if (this.inForm === "wolfram") {
      return html`<notatio-code
        language="wolfram"
        .value=${this._wolframSrc}
        .readonly=${false}
        @notatio-code-change=${this.#onWolframChange}
      ></notatio-code>`;
    }
    return html`<notatio-in
      .value=${this._editor}
      @notatio-change=${this.#onLatexChange}
    ></notatio-in>`;
  }

  #output(): unknown {
    if (this._error) return html`<span class="notatio-error">${this._error}</span>`;
    const wolfram = this.inForm === "wolfram";
    return html`<notatio-out
      .value=${wolfram ? this._mathjson : this._latex}
      format=${wolfram ? "mathjson" : "latex"}
      form=${this._headForm || this.outForm}
      ?evaluate=${this.evaluate && !this.box && !wolfram}
      ?box=${this.box || wolfram}
    ></notatio-out>`;
  }

  protected override render(): unknown {
    return html`
      <div class="notatio-cell">
        <div class="notatio-row">
          <span class="notatio-label notatio-in-label">In</span>
          ${this.#input()}
        </div>
        <div class="notatio-row">
          <span class="notatio-label notatio-out-label">Out</span>
          ${this.#output()}
        </div>
      </div>
    `;
  }
}

if (!customElements.get("notatio-cell")) {
  customElements.define("notatio-cell", NotatioCell);
}
