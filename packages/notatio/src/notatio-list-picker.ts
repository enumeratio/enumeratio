import { html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ChoiceControl } from "./choice-control.ts";
import { defineControl } from "./controls.ts";

/**
 * `<notatio-list-picker name="s" values="2|3|5|7|11" value="3|7">` -- a list in view,
 * with any number of entries selected: Wolfram's `ListPicker`. Click toggles an entry;
 * arrows move, Space toggles. The binding `_s` is the `List` of selected values in
 * list order. `single` allows one selection only (Wolfram's `Multiselection -> False`),
 * and then binds the value itself. `rows` is how many entries show before scrolling.
 */
export class NotatioListPicker extends ChoiceControl {
  static override properties = {
    ...ChoiceControl.properties,
    /** Allow one selection only; the binding is then the value, not a list of one. */
    single: { type: Boolean, reflect: true },
    /** Entries visible before the list scrolls. */
    rows: { type: Number },
    _active: { state: true },
  };

  declare single: boolean;
  declare rows: number;
  declare _active: number;

  constructor() {
    super();
    this.single = false;
    this.rows = 6;
    this._active = 0;
  }

  get multiple(): boolean {
    return !this.single;
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    const n = this.choices.length;
    if (n === 0) return;
    switch (event.key) {
      case "ArrowDown":
        this._active = Math.min(n - 1, this._active + 1);
        break;
      case "ArrowUp":
        this._active = Math.max(0, this._active - 1);
        break;
      case "Home":
        this._active = 0;
        break;
      case "End":
        this._active = n - 1;
        break;
      case " ":
      case "Enter":
        this.choose(this._active);
        break;
      default:
        return;
    }
    event.preventDefault();
    // A single selection follows the arrows, as a native list does.
    if (this.single && event.key !== " " && event.key !== "Enter") this.choose(this._active);
  };

  protected override render(): unknown {
    return html`<div
      class="notatio-list-picker"
      role="listbox"
      aria-label=${this.name || "choices"}
      aria-multiselectable=${String(this.multiple)}
      tabindex="0"
      style=${`max-height: ${this.rows * 1.7}em`}
      @keydown=${this.#onKeyDown}
    >
      ${this.choices.map(
        (_, i) =>
          html`<div
            class="notatio-list-option"
            role="option"
            aria-selected=${String(this.isSelected(i))}
            ?data-active=${i === this._active}
            @click=${() => {
              this._active = i;
              this.choose(i);
            }}
          >
            ${unsafeHTML(this._markup[i] ?? "")}
          </div>`,
      )}
    </div>`;
  }
}

defineControl("notatio-list-picker", NotatioListPicker);
