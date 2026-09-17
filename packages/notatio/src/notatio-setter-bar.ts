import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ChoiceControl } from "./choice-control.ts";
import { defineControl } from "./controls.ts";

/**
 * `<notatio-setter-bar name="k" values="1|2|3|5">` -- a row of buttons of which **one is
 * down**, Wolfram's `SetterBar`. Click one to set it; arrows move the selection along
 * the bar. Entries are `|`-separated and may be `value -> label`; a value that looks
 * like mathematics is typeset. Inside a scope the binding `_k` is the entry's value
 * (a number, a named value) or its index for a bare word.
 *
 * `<notatio-radio-button-bar>` is the same control drawn with radio buttons.
 */
export class NotatioSetterBar extends ChoiceControl {
  get multiple(): boolean {
    return false;
  }

  /** How an entry is drawn: a set button, or a radio button. (Not `style`: that is the element's.) */
  protected get look(): "setter" | "radio" {
    return "setter";
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") this.step(1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") this.step(-1);
    else if (event.key === "Home") this.step(-this.choices.length);
    else if (event.key === "End") this.step(this.choices.length);
    else return;
    event.preventDefault();
    this.querySelectorAll<HTMLElement>(".notatio-bar-option")[this.index]?.focus();
  };

  protected override render(): unknown {
    const radio = this.look === "radio";
    return html`<span
      class="notatio-bar"
      role=${radio ? "radiogroup" : "group"}
      aria-label=${this.name || "choice"}
      @keydown=${this.#onKeyDown}
      >${this.choices.map(
        (_, i) =>
          html`<button
            type="button"
            class="notatio-bar-option"
            role=${radio ? "radio" : nothing}
            aria-checked=${radio ? String(this.isSelected(i)) : nothing}
            aria-pressed=${radio ? nothing : String(this.isSelected(i))}
            tabindex=${this.isSelected(i) || (this.index < 0 && i === 0) ? 0 : -1}
            @click=${() => this.choose(i)}
          >
            ${radio ? html`<span class="notatio-radio-dot" aria-hidden="true"></span>` : nothing}${unsafeHTML(
              this._markup[i] ?? "",
            )}
          </button>`,
      )}</span
    >`;
  }
}

defineControl("notatio-setter-bar", NotatioSetterBar);
