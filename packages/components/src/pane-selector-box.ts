import { parseExpression } from "@enumeratio/formats/expression";
import { LitElement, nothing, type PropertyValues } from "lit";
import { parseFor } from "./mathlive.ts";

/** A value as the text a pane's key is compared with: `"a"` and `'a'` are `a`, `True` is `True`. */
const keyOf = (text: string): string => text.trim().replace(/^(["'])(.*)\1$/s, "$2");

/** Whether `text` is just a value: a name, a number or a string, with nothing left to evaluate. */
const isLiteral = (text: string): boolean => /^(?:[\w.+-]+|"[^"]*"|'[^']*')$/.test(text.trim());

/** A wildcard (`_n`) not yet filled by the scope around it. */
const hasWildcard = (text: string): boolean => /(?:^|[^\w])_[A-Za-z]/.test(text);

/**
 * `<pane-selector-box selector="_n > 5"><span data-pane="True">…</span><span data-pane="False">…</span></pane-selector-box>`
 * -- Wolfram's `PaneSelectorBox`: alternatives, of which the one whose key is the selector's value
 * shows. A value with no pane shows nothing, so a phrase that appears only under a condition is
 * a pane under `True` alone.
 *
 * `selector` is an Epsil expression over the surrounding scope's variables, which the scope
 * refills (and evaluates) as they move, leaving its value; an expression with nothing to fill is
 * evaluated here. The panes are the author's own light-DOM markup (links, math, further
 * elements) and are only marked (`data-selected`), never rebuilt.
 */
export class PaneSelectorBox extends LitElement {
  static properties = {
    /** The Epsil expression whose value picks the pane. */
    selector: { type: String, reflect: true },
  };

  declare selector: string;

  #pending = 0;

  constructor() {
    super();
    this.selector = "";
  }

  // The children ARE the content, so Lit renders into a detached fragment: its output never
  // reaches the document and the author's markup is never touched.
  protected override createRenderRoot(): DocumentFragment {
    return document.createDocumentFragment();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("selector")) void this.#select();
  }

  async #select(): Promise<void> {
    const ticket = ++this.#pending;
    const key = await this.#value(this.selector);
    // A later change has overtaken this one, or the selector isn't known yet: keep what shows.
    if (key === undefined || ticket !== this.#pending) return;
    for (const pane of this.querySelectorAll(":scope > [data-pane]")) {
      pane.toggleAttribute("data-selected", pane.getAttribute("data-pane") === key);
    }
  }

  async #value(source: string): Promise<string | undefined> {
    if (hasWildcard(source)) return undefined;
    if (isLiteral(source)) return keyOf(source);
    const { engine, parsed } = await parseFor((ce) =>
      parseExpression(source, { parseLatex: (tex: string) => ce.parse(tex).json }),
    );
    if (parsed.errors.length) return undefined;
    const json = engine.box(parsed.json).evaluate().json as unknown;
    if (typeof json === "number") return String(json);
    if (typeof json === "string") return keyOf(json);
    const atom = json as { num?: string | number; str?: string; sym?: string };
    const text = atom.num ?? atom.str ?? atom.sym;
    return text === undefined ? undefined : keyOf(String(text));
  }

  protected override render(): unknown {
    return nothing;
  }
}

if (!customElements.get("pane-selector-box")) customElements.define("pane-selector-box", PaneSelectorBox);
