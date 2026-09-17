import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { html, LitElement, type PropertyValues } from "lit";
import { loadEngine } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";
import { defineControl, emitControl } from "./define.ts";

/**
 * `<notatio-input-field name="x" value="3">` -- a field you type a value into, Wolfram's
 * `InputField`. The text is notatio, parsed when you press Enter or leave the field, and
 * the binding `_x` is the expression it parses to: a number, a symbol, `Sin(t)`,
 * whatever was typed. Text that does not parse leaves the binding where it was and
 * marks the field. `type="number"` accepts only a number, and `size` is the width in
 * characters.
 *
 * For a mathematical editor with typeset input, use `<notatio-in>`; this is the plain
 * field a form wants.
 */
export class NotatioInputField extends LitElement {
  static properties = {
    /** The binding this field drives: `name="x"` fills the wildcard `_x`. */
    name: { type: String, reflect: true },
    /** The starting text, as notatio. */
    value: { type: String },
    /** `expression` (default) or `number`. */
    type: { type: String },
    /** Width in characters. */
    size: { type: Number },
    _text: { state: true },
    _invalid: { state: true },
  };

  declare name: string;
  declare value: string;
  declare type: string;
  declare size: number;
  declare _text: string;
  declare _invalid: boolean;

  #binding: MathJsonExpression = 0;

  constructor() {
    super();
    this.name = "";
    this.value = "";
    this.type = "expression";
    this.size = 8;
    this._text = "";
    this._invalid = false;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  get binding(): MathJsonExpression {
    return this.#binding;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("value")) {
      this._text = this.value;
      void this.#adopt(this.value, false);
    }
  }

  /** Parse the text; on success take it as the binding and, if asked, announce it. */
  async #adopt(text: string, announce: boolean): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (this.type === "number") {
      const n = Number(trimmed.replace(/_/g, ""));
      this._invalid = !Number.isFinite(n);
      if (this._invalid) return;
      this.#set(n, announce);
      return;
    }
    const engine = await loadEngine();
    const { json, errors } = parseNotatio(trimmed, {
      parseLatex: (tex) => engine.parse(tex).json,
    });
    this._invalid = errors.length > 0;
    if (!this._invalid) this.#set(json as MathJsonExpression, announce);
  }

  #set(value: MathJsonExpression, announce: boolean): void {
    if (JSON.stringify(value) === JSON.stringify(this.#binding)) return;
    this.#binding = value;
    if (announce) emitControl(this, { name: this.name, value });
  }

  #commit = (event: Event): void => {
    const text = (event.target as HTMLInputElement).value;
    this._text = text;
    void this.#adopt(text, true);
  };

  protected override render(): unknown {
    return html`<input
      type="text"
      class="notatio-input-field"
      inputmode=${this.type === "number" ? "decimal" : "text"}
      size=${this.size}
      .value=${this._text}
      aria-label=${this.name || "value"}
      aria-invalid=${this._invalid ? "true" : "false"}
      spellcheck="false"
      autocomplete="off"
      @change=${this.#commit}
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === "Enter") this.#commit(e);
      }}
    />`;
  }
}

defineControl("notatio-input-field", NotatioInputField);
