import { html, LitElement, nothing } from "lit";
import { ensureStyles } from "./styles.ts";

/**
 * `<notatio-labeled label="the square">` -- its children with a label beside them,
 * Wolfram's `Labeled`. `position` puts the label `after` (default), `before`, `above`
 * or `below`. Inside a choice list an entry `Labeled(2, "two")` shows the label and
 * binds the value.
 */
export class NotatioLabeled extends LitElement {
  static properties = {
    /** The label's text. */
    label: { type: String },
    /** Where the label goes: `after` (default), `before`, `above` or `below`. */
    position: { type: String, reflect: true },
  };

  declare label: string;
  declare position: string;

  constructor() {
    super();
    this.label = "";
    this.position = "after";
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  // The label renders after the author's children; `position` moves it by CSS order,
  // so the children stay where they were written.
  protected override render(): unknown {
    return this.label ? html`<span class="notatio-label">${this.label}</span>` : nothing;
  }
}

if (!customElements.get("notatio-labeled"))
  customElements.define("notatio-labeled", NotatioLabeled);
