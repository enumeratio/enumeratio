import { html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ChoiceControl } from "./choice-control.ts";
import { openChoiceMenu } from "./choice-menu.ts";
import { defineControl } from "./define.ts";

/**
 * `<notatio-popup-menu name="k" values="2|3|5|7">` -- the selected entry, and a menu of
 * the rest when clicked: Wolfram's `PopupMenu`. Arrows step it without opening. Entries
 * are `|`-separated and may be `value -> label`. The binding is the entry's value.
 */
export class NotatioPopupMenu extends ChoiceControl {
  #close: (() => void) | undefined;

  get multiple(): boolean {
    return false;
  }

  override disconnectedCallback(): void {
    this.#close?.();
    super.disconnectedCallback();
  }

  #open(): void {
    if (this.#close) return;
    const anchor = this.querySelector<HTMLElement>(".notatio-popup-btn");
    if (!anchor) return;
    this.#close = openChoiceMenu({
      anchor,
      items: this._markup,
      selected: Math.max(0, this.index),
      label: this.name || "choice",
      onPick: (i) => this.choose(i),
      onClose: () => (this.#close = undefined),
    });
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") this.step(1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") this.step(-1);
    else if (event.key === "Home") this.step(-this.choices.length);
    else if (event.key === "End") this.step(this.choices.length);
    else return;
    event.preventDefault();
  };

  protected override render(): unknown {
    return html`<button
      type="button"
      class="notatio-popup-btn"
      aria-haspopup="listbox"
      aria-label=${this.name || "choice"}
      @click=${() => this.#open()}
      @keydown=${this.#onKeyDown}
    >
      <span class="notatio-popup-current">${unsafeHTML(this._markup[this.index] ?? "")}</span
      ><span class="notatio-popup-caret" aria-hidden="true"></span>
    </button>`;
  }
}

defineControl("notatio-popup-menu", NotatioPopupMenu);
