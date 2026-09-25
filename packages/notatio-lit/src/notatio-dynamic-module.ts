import type { ComputeEngine } from "@cortex-js/compute-engine";
import { CONTROL_EVENT, Transcript, type TrackedSymbols } from "@enumeratio/notatio";
import { LitElement, nothing } from "lit";
import "./notatio-dynamic.ts";
import "./notatio-knob.ts";
import "./notatio-toggler.ts";
import "./notatio-when.ts";
import { ReactiveModule } from "./reactive-module.ts";
import { Scope } from "./scope.ts";
import { ensureStyles } from "./styles.ts";

/** `tracked-symbols="all"` or a comma list -- `symbols.ts`'s `TrackedSymbols` lowering. */
function parseTrackedSymbols(attr: string): TrackedSymbols | undefined {
  const value = attr.trim();
  if (!value) return undefined;
  if (value.toLowerCase() === "all") return "All";
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

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
    /**
     * `All` / a comma list of symbol names -- `symbols.ts`'s `TrackedSymbols` lowering.
     * Absent (the default) keeps this a plain transcript: cells evaluate top to bottom,
     * `Out`/`In`/`InString`/`%` stay live, and cell-number references are allowed.
     */
    trackedSymbols: { type: String, attribute: "tracked-symbols" },
  };

  declare trace: boolean;
  declare trackedSymbols: string;

  #scope = new Scope(this, this);
  #transcript: Transcript | undefined;
  #reactive: ReactiveModule | undefined;

  constructor() {
    super();
    this.trace = false;
    this.trackedSymbols = "";
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
    this.addEventListener("notatio-change", this.#onCellChange as EventListener);
  }

  override disconnectedCallback(): void {
    this.removeEventListener(CONTROL_EVENT, this.#scope.onControl);
    this.removeEventListener("notatio-change", this.#onCellChange as EventListener);
    super.disconnectedCallback();
  }

  /**
   * A descendant `<notatio-cell>` committed a new input -- the trigger a reactive module
   * reacts to (design/rendering-environments.md). Only meaningful once `TrackedSymbols`
   * is set; a plain transcript ignores its own cells' commits here.
   */
  #onCellChange = (event: CustomEvent<{ notatio: string; json: unknown }>): void => {
    if (!this.#reactive) return;
    const el = event.target;
    if (el instanceof Element && el.tagName === "NOTATIO-CELL") {
      this.#reactive.commit(el, event.detail.notatio, event.detail.json as never);
    }
  };

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
   *
   * When `TrackedSymbols` is set, every call also feeds the reactive graph: cheap, since
   * `register` skips a `<notatio-cell>` it already knows, and it is the only place this
   * class is handed an engine to box a not-yet-edited cell's `value` with.
   */
  transcriptFor(engine: ComputeEngine): Transcript {
    const tracked = parseTrackedSymbols(this.trackedSymbols);
    if (tracked !== undefined)
      (this.#reactive ??= new ReactiveModule(tracked)).register(this, engine);
    return (this.#transcript ??= new Transcript(engine));
  }

  protected override render(): unknown {
    return nothing;
  }
}

if (!customElements.get("notatio-dynamic-module")) {
  customElements.define("notatio-dynamic-module", NotatioDynamicModule);
}
