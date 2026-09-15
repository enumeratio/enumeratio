import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { loadEngine, loadMarkup } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";

/**
 * `<notatio-dynamic value="_n * 50">` -- a **derived readout** in running prose, after
 * Wolfram's `Dynamic`. It typesets whatever its `value` evaluates to and nothing else:
 * no editor, no assertion, no In/Out row.
 *
 * Inside a `<notatio-tangle>` the wildcards are the surrounding knobs, and the wrapper
 * rewrites this element's `value` on every move — so what the element itself sees is
 * always a concrete expression. `N(…)` around the value forces a decimal where the
 * exact answer would be a fraction or a surd, and `digits` says how much of that
 * decimal belongs in a sentence.
 */
export class NotatioDynamic extends LitElement {
  static properties = {
    /** The notatio expression to evaluate and typeset. */
    value: { type: String },
    /** Typeset as a centred display equation rather than inline. */
    display: { type: Boolean, reflect: true },
    /** Significant figures to keep of an approximate result; `0` prints all of them. */
    digits: { type: Number },
    _markup: { state: true },
  };

  declare value: string;
  declare display: boolean;
  declare digits: number;
  declare _markup: string;

  constructor() {
    super();
    this.value = "";
    this.display = false;
    this.digits = 6;
    this._markup = "";
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("value") || changed.has("display") || changed.has("digits")) {
      void this.#render();
    }
  }

  async #render(): Promise<void> {
    if (!this.value.trim()) {
      this._markup = "";
      return;
    }
    const [engine, convert] = await Promise.all([loadEngine(), loadMarkup()]);
    const { json, errors } = parseNotatio(this.value, {
      parseLatex: (tex: string) => engine.parse(tex).json,
    });
    // Unparseable input renders nothing rather than an error, as everywhere else here;
    // turn on the `tangle` debug namespace to see why.
    if (errors.length) {
      this._markup = "";
      return;
    }
    const latex = this.#shorten(engine, engine.box(json).evaluate()).latex;
    this._markup = convert(this.display ? `\\displaystyle ${latex}` : latex);
  }

  /**
   * Cap an approximate result at `digits` significant figures.
   *
   * The test is whether the engine already chose to print a DECIMAL POINT: an exact
   * answer comes back as a surd or a fraction and is left alone, while its `N(…)`
   * arrives with twenty digits, which is not a thing to put in the middle of a
   * sentence. A non-numeric result (a list, a symbol) has no `re` and is left alone.
   */
  #shorten(engine: ComputeEngine, expr: BoxedExpression): BoxedExpression {
    if (!(this.digits > 0) || !/\d\.\d/.test(expr.latex)) return expr;
    const round = (v: number) => Number(v.toPrecision(this.digits));
    const re = expr.re;
    const im = expr.im;
    if (!Number.isFinite(re) || !Number.isFinite(im)) return expr;
    return im === 0 ? engine.number(round(re)) : engine.box(["Complex", round(re), round(im)]);
  }

  protected override render(): unknown {
    return html`${unsafeHTML(this._markup)}`;
  }
}

if (!customElements.get("notatio-dynamic")) {
  customElements.define("notatio-dynamic", NotatioDynamic);
}
