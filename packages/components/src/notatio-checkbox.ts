import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { html, LitElement, type PropertyValues } from "lit";
import { ensureStyles } from "./styles.ts";
import { defineControl, emitControl } from "./define.ts";

/**
 * `<notatio-checkbox name="on">` -- a box that is ticked or not, Wolfram's `Checkbox`.
 * The binding `_on` is `True` or `False`; `value="True"` starts it ticked. Put the
 * words beside it in the prose -- the box is the control, the sentence is the label --
 * or give it a `label` of its own.
 */
export class NotatioCheckbox extends LitElement {
  static properties = {
    /** The binding this box drives: `name="a"` fills the wildcard `_a`. */
    name: { type: String, reflect: true },
    /** `True` or `False` at first. */
    value: { type: String },
    /** A label drawn beside the box. */
    label: { type: String },
    _on: { state: true },
  };

  declare name: string;
  declare value: string;
  declare label: string;
  declare _on: boolean;

  constructor() {
    super();
    this.name = "";
    this.value = "";
    this.label = "";
    this._on = false;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  get checked(): boolean {
    return this._on;
  }

  get binding(): MathJsonExpression {
    return this._on ? "True" : "False";
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("value")) {
      const v = this.value.trim().toLowerCase();
      this._on = v === "true" || v === "1";
    }
  }

  #set(on: boolean): void {
    if (on === this._on) return;
    this._on = on;
    emitControl(this, { name: this.name, value: this.binding });
  }

  protected override render(): unknown {
    return html`<label class="notatio-checkbox">
      <input
        type="checkbox"
        .checked=${this._on}
        aria-label=${this.label || this.name || "checkbox"}
        @change=${(e: Event) => this.#set((e.target as HTMLInputElement).checked)}
      />${this.label ? html`<span class="notatio-checkbox-label">${this.label}</span>` : ""}
    </label>`;
  }
}

defineControl("notatio-checkbox", NotatioCheckbox);
