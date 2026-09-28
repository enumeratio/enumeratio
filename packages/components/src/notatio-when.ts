import { parseExpression } from "@enumeratio/formats/expression";
import { LitElement, nothing, type PropertyValues } from "lit";
import { loadEngine } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";

/**
 * `<notatio-when test="_n > 3">…</notatio-when>` -- a run of prose that appears only
 * while its condition holds, Tangle's conditional sentence.
 *
 * `test` is an Epsil predicate over the surrounding `<notatio-dynamic-module>`'s knobs; the
 * wrapper substitutes their values into it, and this element shows or hides its own
 * children on the result. `invert` shows the children when the test is *false*, which
 * is how the two halves of an either/or sentence are written.
 *
 * The name is descriptive: Wolfram's `If` is an evaluation, not a display, and
 * `PaneSelector` is about panes rather than a phrase inside a sentence.
 */
export class NotatioWhen extends LitElement {
  static properties = {
    /** The Epsil predicate, over the dynamic module's knob wildcards. */
    test: { type: String, reflect: true },
    /** Show the children when the test is false instead of true. */
    invert: { type: Boolean, reflect: true },
  };

  declare test: string;
  declare invert: boolean;

  constructor() {
    super();
    this.test = "";
    this.invert = false;
    ensureStyles();
  }

  // The children ARE the content, so Lit renders into a detached fragment: its output
  // never reaches the document and the author's markup is never touched.
  protected override createRenderRoot(): DocumentFragment {
    return document.createDocumentFragment();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("test") || changed.has("invert")) void this.#evaluate();
  }

  async #evaluate(): Promise<void> {
    // Hidden through an attribute, not a re-render: the children are the author's own
    // light-DOM markup (links, math, further elements) and must survive untouched.
    this.toggleAttribute("hidden", !(await this.#holds()));
  }

  async #holds(): Promise<boolean> {
    const source = this.test.trim();
    if (!source) return !this.invert;
    const engine = await loadEngine();
    const { json, errors } = parseExpression(source, {
      parseLatex: (tex: string) => engine.parse(tex).json,
    });
    // An unfilled wildcard (`_n`, before the dynamic module has substituted) is not false, it is
    // unknown — keep the previous state rather than flickering the prose out and back.
    if (errors.length) return !this.hasAttribute("hidden");
    const truth = engine.box(json).evaluate().json === "True";
    return this.invert ? !truth : truth;
  }

  protected override render(): unknown {
    return nothing;
  }
}

if (!customElements.get("notatio-when")) {
  customElements.define("notatio-when", NotatioWhen);
}
