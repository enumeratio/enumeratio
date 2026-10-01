import { html, LitElement } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { type Clock, pageClock } from "./clock.ts";
import { ensureStyles } from "./styles.ts";
import { torusSquareSvg } from "./torussquare.ts";

/**
 * `<notatio-torus-square p="2" q="3">` -- the torus as a square with its opposite edges glued,
 * and the torus knot T(p, q) on it as a straight line of slope q/p.
 *
 * By default a point travels along the line on the page's shared clock, so this figure and the
 * knot beside it show the SAME parameter at the same moment -- one pause anywhere on the page
 * stops both. Set `at` to pin it to a phase instead, which is what a figure in a printed
 * argument wants.
 */
export class NotatioTorusSquare extends LitElement {
  static properties = {
    p: { type: Number },
    q: { type: Number },
    /** A fixed phase in `[0, 1)`. Given, the figure ignores the clock. */
    at: { type: Number },
    /** Follow the page's clock. `clock`, not `animate`: every element inherits
     *  `Element.animate()` from the DOM, and a reactive property of that name shadows it. */
    clock: { type: String },
    dials: { type: String },
    label: { type: String },
    _phase: { state: true },
  };

  declare p: number;
  declare q: number;
  declare at: number;
  declare clock: string;
  declare dials: string;
  declare label: string;
  declare _phase: number;

  #clock: Clock = pageClock();
  #unwatch: (() => void) | undefined;

  constructor() {
    super();
    this.p = 2;
    this.q = 3;
    this.at = Number.NaN;
    this.clock = "true";
    this.dials = "true";
    this.label = "";
    this._phase = 0;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.clock !== "false" && !Number.isFinite(Number(this.at)))
      this.#unwatch = this.#clock.watch((tick) => {
        this._phase = tick.phase;
      });
  }

  override disconnectedCallback(): void {
    this.#unwatch?.();
    this.#unwatch = undefined;
    super.disconnectedCallback();
  }

  get #shownPhase(): number | undefined {
    const pinned = Number(this.at);
    if (Number.isFinite(pinned)) return pinned;
    return this.clock === "false" ? undefined : this._phase;
  }

  protected override render(): unknown {
    const svg = torusSquareSvg(Math.round(Number(this.p)) || 1, Math.round(Number(this.q)) || 1, {
      phase: this.#shownPhase,
      dials: this.dials !== "false",
      title: this.label || undefined,
    });
    return html`<span class="notatio-torus-square-box">${unsafeHTML(svg)}</span>`;
  }
}

if (!customElements.get("notatio-torus-square")) {
  customElements.define("notatio-torus-square", NotatioTorusSquare);
}
