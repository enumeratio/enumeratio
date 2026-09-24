import type { ComputeEngine } from "@cortex-js/compute-engine";
import { CONTROL_EVENT, Transcript } from "@enumeratio/notatio";
import { LitElement, nothing } from "lit";
import "./notatio-dynamic.ts";
import "./notatio-knob.ts";
import "./notatio-toggler.ts";
import "./notatio-when.ts";
import { Scope } from "./scope.ts";
import { ensureStyles } from "./styles.ts";

/**
 * `<notatio-dynamic-module>` -- a **reactive document**, after Bret Victor's
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
 * <notatio-dynamic-module>
 *   A <notatio-knob name="n" value="4" min="1" max="8" step="1" />-element set has
 *   <notatio-dynamic value="2^_n" /> subsets<notatio-when test="_n > 5">, which is
 *   already more than you want to list</notatio-when>.
 *   <notatio-figure kind="subset" value="[1,3]" n="_n" />
 * </notatio-dynamic-module>
 * ```
 *
 * Unlike `<notatio-manipulate>` — the same substitution machinery behind a Wolfram-style
 * panel of sliders — a dynamic module has no chrome of its own and renders nothing. Nested
 * modules are separate scopes: a control belongs to its nearest enclosing one.
 *
 * A dynamic module is not required: the page itself is a scope, and a control and a readout
 * with no wrapper at all still find each other. The wrapper is for isolation -- two
 * examples on one page that both call their knob `n`.
 *
 * A SECOND, unrelated capability lives here too: a **transcript**. When a `<notatio-cell>`
 * inside a module asks (`transcriptFor`), the module lazily creates one shared
 * compute-engine scope and history (`@enumeratio/notatio`'s `Transcript`) and hands it back
 * to every cell that asks -- so `Cell(a := 5)` then `Cell(a^2)` share a binding and
 * `Out(n)` / `%` read each other back, Wolfram's `$Line` transcript. This is `Notebook`'s
 * rendering (`Notebook(cells)` is `DynamicModule([Cell(...), ...])` under a Wolfram name,
 * `symbols.ts`), and it is independent of the `_k` hole-filling `Scope` above: a module
 * with no cells in it never creates one.
 */
export class NotatioDynamicModule extends LitElement {
  static properties = {
    /** Announce every knob move on the console under the `scope` debug namespace. */
    trace: { type: Boolean },
  };

  declare trace: boolean;

  #scope = new Scope(this, this);
  #transcript: Transcript | undefined;

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

  /** Every control this module owns — a nested module keeps its own. */
  get controls(): Element[] {
    return this.#scope.controls;
  }

  /**
   * This module's shared evaluation scope, created the first time any cell inside it asks
   * -- lazily, so a module with no cells never pays for one, and memoized, so the FIRST
   * cell to evaluate (not necessarily the first in document order, since each cell loads
   * the engine on its own schedule) settles which scope every other cell in this module
   * shares.
   */
  transcriptFor(engine: ComputeEngine): Transcript {
    return (this.#transcript ??= new Transcript(engine));
  }

  protected override render(): unknown {
    return nothing;
  }
}

if (!customElements.get("notatio-dynamic-module")) {
  customElements.define("notatio-dynamic-module", NotatioDynamicModule);
}
