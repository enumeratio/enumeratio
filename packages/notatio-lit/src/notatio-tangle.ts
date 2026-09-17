import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { LitElement, nothing } from "lit";
import { applyTemplates, captureTemplates, type Template } from "./bindings.ts";
import { loadEngine } from "./mathlive.ts";
import "./notatio-dynamic.ts";
import "./notatio-knob.ts";
import "./notatio-toggler.ts";
import "./notatio-when.ts";
import { ensureStyles } from "./styles.ts";
import { CONTROL_EVENT, type ControlChange, debug } from "@enumeratio/notatio";
import { type ControlElement, controlSelector } from "./define.ts";

const log = debug("tangle");

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
 */
export class NotatioTangle extends LitElement {
  static properties = {
    /** Announce every knob move on the console under the `tangle` debug namespace. */
    trace: { type: Boolean },
  };

  declare trace: boolean;

  #engine: ComputeEngine | undefined;
  #templates: Template[] = [];
  /** Current value per control name, as MathJSON: a number, `True`, a `List`, ... */
  #values = new Map<string, MathJsonExpression>();

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
    this.addEventListener(CONTROL_EVENT, this.#onControl as EventListener);
  }

  override disconnectedCallback(): void {
    this.removeEventListener(CONTROL_EVENT, this.#onControl as EventListener);
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    void this.#start();
  }

  /** Every control this tangle owns — a nested tangle keeps its own. */
  get controls(): Element[] {
    return [...this.querySelectorAll(controlSelector())].filter(
      (el) => el.closest("notatio-tangle") === this,
    );
  }

  async #start(): Promise<void> {
    // The controls may not have been upgraded yet, and their values live on the
    // instances (VitePress binds custom-element strings as properties).
    customElements.upgrade(this);
    await Promise.all(
      [...new Set(this.controls.map((el) => el.localName))].map((tag) =>
        customElements.whenDefined(tag),
      ),
    );
    const engine = (this.#engine ??= await loadEngine());
    for (const el of this.controls) this.#read(el);
    this.#templates = captureTemplates(this, new Set(this.#values.keys()), engine);
    log("scope %o over %d templates", [...this.#values.keys()], this.#templates.length);
    this.#apply();
  }

  /**
   * Seed a control's starting value into the scope. Each control exposes `binding` — the
   * one value it contributes, whatever it looks like on the page — so the scope never
   * has to know whether it is reading a scrubber, a list, a word or a bar of them.
   */
  #read(el: Element): void {
    const control = el as Partial<ControlElement>;
    if (!control.name || control.binding === undefined) return;
    this.#values.set(control.name, control.binding);
  }

  #onControl = (event: CustomEvent<ControlChange>): void => {
    const { name, value } = event.detail;
    if (!name) return;
    this.#values.set(name, value);
    if (this.trace) log("%s := %o", name, value);
    this.#apply();
  };

  /** Refill every template from the current scope. */
  #apply(): void {
    const engine = this.#engine;
    if (!engine) return;
    const boxed = new Map<string, BoxedExpression>();
    for (const [name, value] of this.#values) boxed.set(name, engine.box(value as never));
    applyTemplates(engine, this.#templates, boxed);
  }

  protected override render(): unknown {
    return nothing;
  }
}

if (!customElements.get("notatio-tangle")) {
  customElements.define("notatio-tangle", NotatioTangle);
}
