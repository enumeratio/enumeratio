import { CONTROL_EVENT } from "@enumeratio/notatio";
import { LitElement, nothing } from "lit";
import "./notatio-dynamic.ts";
import "./notatio-knob.ts";
import "./notatio-toggler.ts";
import "./notatio-when.ts";
import { Scope } from "./scope.ts";
import { ensureStyles } from "./styles.ts";

/**
 * `<notatio-tangle>` -- a **reactive document**, after Bret Victor's
 * [Tangle](http://worrydream.com/Tangle/): prose whose numbers you can grab, and whose
 * other numbers follow.
 *
 * It is the scope, not a control panel. The controls live inline where they are read —
 * a `<notatio-knob>` you drag, a `<notatio-toggler>` you click — and each contributes
 * its `name` as a wildcard. Everything else in the subtree that is a notatio expression
 * over those wildcards is a template, re-evaluated on every move: a `<notatio-dynamic>`
 * readout, a `<notatio-when>` condition, or an attribute of any other component, so the
 * same knob can drive a sentence and the plot beside it.
 *
 * ```html
 * <notatio-tangle>
 *   A <notatio-knob name="n" value="4" min="1" max="8" step="1" />-element set has
 *   <notatio-dynamic value="2^_n" /> subsets<notatio-when test="_n > 5">, which is
 *   already more than you want to list</notatio-when>.
 *   <notatio-figure kind="subset" value="[1,3]" n="_n" />
 * </notatio-tangle>
 * ```
 *
 * Unlike `<notatio-manipulate>` — the same substitution machinery behind a Wolfram-style
 * panel of sliders — a tangle has no chrome of its own and renders nothing. Nested
 * tangles are separate scopes: a control belongs to its nearest enclosing one.
 *
 * A tangle is not required: the page itself is a scope, and a control and a readout
 * with no wrapper at all still find each other. The wrapper is for isolation -- two
 * examples on one page that both call their knob `n`.
 */
export class NotatioTangle extends LitElement {
  static properties = {
    /** Announce every knob move on the console under the `tangle` debug namespace. */
    trace: { type: Boolean },
  };

  declare trace: boolean;

  #scope = new Scope(this, this);

  constructor() {
    super();
    this.trace = false;
    ensureStyles();
  }

  // Nothing of ours belongs in the document: the prose and its inline controls are the
  // author's own light-DOM markup.
  protected override createRenderRoot(): DocumentFragment {
    return document.createDocumentFragment();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener(CONTROL_EVENT, this.#scope.onControl);
  }

  override disconnectedCallback(): void {
    this.removeEventListener(CONTROL_EVENT, this.#scope.onControl);
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    this.#scope.trace = this.trace;
    void this.#scope.refresh();
  }

  /** Every control this tangle owns — a nested tangle keeps its own. */
  get controls(): Element[] {
    return this.#scope.controls;
  }

  protected override render(): unknown {
    return nothing;
  }
}

if (!customElements.get("notatio-tangle")) {
  customElements.define("notatio-tangle", NotatioTangle);
}
