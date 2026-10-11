import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { LitElement, nothing } from "lit";
import { scopeOf } from "./scope.ts";

/** A setter's value as MathJSON: a quoted string, a number, or a name. */
function valueOf(text: string): MathJsonExpression {
  const quoted = /^"(.*)"$/s.exec(text);
  if (quoted) return `'${quoted[1]}'`;
  return /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : text;
}

/**
 * `<button-box set="e" to='"twindragon"'><a href="#">the twindragon</a></button-box>` -- a
 * `ButtonBox` whose `ButtonFunction` is `Set(_e, "twindragon")`: a click on the anchor sets the
 * variable in the scope it sits in. The anchor is drawn by the renderer, so the element only
 * listens; a link needs no element.
 */
export class ButtonBox extends LitElement {
  // Nothing to draw: Lit renders into a detached fragment, and the anchor is left alone.
  protected override createRenderRoot(): DocumentFragment {
    return document.createDocumentFragment();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("click", this.#click);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("click", this.#click);
  }

  #click = (event: Event): void => {
    event.preventDefault();
    const name = this.getAttribute("set");
    const to = this.getAttribute("to");
    if (name && to !== null) scopeOf(this)?.set(name, valueOf(to));
  };

  protected override render(): unknown {
    return nothing;
  }
}

if (!customElements.get("button-box")) customElements.define("button-box", ButtonBox);
