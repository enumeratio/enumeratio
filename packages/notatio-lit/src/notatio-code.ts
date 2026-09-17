import { html, LitElement } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { highlightCode } from "@enumeratio/notatio";

/**
 * `<notatio-code language="wolfram" value="Binomial[n, k]">` -- a small code box
 * for source in a named language (wolfram, python, javascript, latex, json,
 * glsl, …). Read-only by default (a `<pre>`), or an editable `<textarea>` that
 * emits `notatio-code-change` with `{ value }`. Syntax highlighting is a planned
 * enhancement -- `#render` is the single seam where a highlighter would turn the
 * value into markup.
 */
export class NotatioCode extends LitElement {
  static properties = {
    /** Syntax highlighting to apply, e.g. `wolfram`, `python`, `javascript`, `glsl`, `wgsl`. */
    language: { type: String },
    // Reflected so the copy handler (selection.ts) can serialise a code box in a
    // selection without picking up the language tag or partial markup.
    /** The source text. Editable unless `readonly`. */
    value: { type: String, reflect: true },
    /** Show the code without allowing edits. */
    readonly: { type: Boolean, reflect: true },
    /** Visible height, in lines. */
    rows: { type: Number },
    // Hide the corner language tag (when the form is already indicated elsewhere,
    // e.g. a notatio-out's In/Out selector).
    /** Hide the corner language tag, when the form is already indicated elsewhere. */
    hideLang: { type: Boolean, attribute: "hide-lang" },
  };

  declare language: string;
  declare value: string;
  declare readonly: boolean;
  declare rows: number;
  declare hideLang: boolean;

  constructor() {
    super();
    this.language = "";
    this.value = "";
    this.readonly = true;
    this.rows = 0;
    this.hideLang = false;
  }

  // Light DOM so the shared stylesheet (styles.ts) applies.
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  #onInput = (event: Event): void => {
    this.value = (event.target as HTMLTextAreaElement).value;
    this.dispatchEvent(
      new CustomEvent("notatio-code-change", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  };

  protected override render(): unknown {
    const showLang = this.language && !this.hideLang;
    const lang = showLang ? html`<span class="notatio-code-lang">${this.language}</span>` : "";
    const cls = `notatio-code${showLang ? "" : " no-lang"}`;
    if (this.readonly) {
      return html`<div class=${cls} data-lang=${this.language}>
        ${lang}
        <pre><code>${unsafeHTML(highlightCode(this.value, this.language))}</code></pre>
      </div>`;
    }
    return html`<div class="${cls} is-editable" data-lang=${this.language}>
      ${lang}<textarea
        spellcheck="false"
        rows=${this.rows || Math.min(8, this.value.split("\n").length + 1)}
        .value=${this.value}
        @input=${this.#onInput}
      ></textarea>
    </div>`;
  }
}

if (!customElements.get("notatio-code")) {
  customElements.define("notatio-code", NotatioCode);
}
