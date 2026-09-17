import { html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ChoiceControl } from "./choice-control.ts";
import { defineControl } from "./define.ts";

/**
 * `<notatio-toggler-bar name="s" values="2|3|5|7" value="2|5">` -- a row of buttons of
 * which **any number are down**, Wolfram's `TogglerBar`. Click one to toggle it; the
 * binding `_s` is the `List` of the selected entries' values, in bar order, so
 * `Length(_s)` and `Sum(_s)` mean what they say. Entries are `|`-separated and may be
 * `value -> label`; `value` names the entries down at first, `|`-separated.
 */
export class NotatioTogglerBar extends ChoiceControl {
  get multiple(): boolean {
    return true;
  }

  protected override render(): unknown {
    return html`<span class="notatio-bar" role="group" aria-label=${this.name || "choices"}
      >${this.choices.map(
        (_, i) =>
          html`<button
            type="button"
            class="notatio-bar-option"
            aria-pressed=${String(this.isSelected(i))}
            @click=${() => this.choose(i)}
          >
            ${unsafeHTML(this._markup[i] ?? "")}
          </button>`,
      )}</span
    >`;
  }
}

defineControl("notatio-toggler-bar", NotatioTogglerBar);
