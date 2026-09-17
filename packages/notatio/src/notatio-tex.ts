import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { loadMarkup } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";

/**
 * `<notatio-tex value="\\frac{a}{b}">` -- inline typeset LaTeX for use in prose.
 * A lightweight read-only renderer (no engine, no assertion); it just runs the
 * value through MathLive's static markup.
 *
 * `display` switches to a centred block in display style, for `$$…$$` math: the
 * markdown rules in web/.vitepress/notatio-math.ts route both fence styles here, so
 * prose math and reference math come out of the same renderer.
 */
export class NotatioTex extends LitElement {
  static properties = {
    // Reflected so the copy handler (selection.ts) can read the LaTeX off a
    // cloned selection fragment and serialise it as $latex$.
    /** The LaTeX to typeset. */
    value: { type: String, reflect: true },
    /** Render as a centred display equation rather than inline. */
    display: { type: Boolean, reflect: true },
    _markup: { state: true },
  };

  declare value: string;
  declare display: boolean;
  declare _markup: string;

  constructor() {
    super();
    this.value = "";
    this.display = false;
    this._markup = "";
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("value") || changed.has("display")) void this.#render();
  }

  async #render(): Promise<void> {
    const convert = await loadMarkup();
    // MathLive's static renderer takes its style from the LaTeX, so ask for
    // displaystyle rather than threading an option through.
    const latex = this.display ? `\\displaystyle ${this.value}` : this.value;
    this._markup = this.value ? convert(latex) : "";
  }

  protected override render(): unknown {
    return html`${unsafeHTML(this._markup)}`;
  }
}

if (!customElements.get("notatio-tex")) {
  customElements.define("notatio-tex", NotatioTex);
}
