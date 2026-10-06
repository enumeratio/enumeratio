import { html, LitElement, nothing } from "lit";
import {
  BAND_MODES,
  type BandMode,
  DISCRETE_SCHEMES,
  discreteColors,
  GRADIENTS,
  gradientCss,
  PALETTES,
  type Palette,
  resolvePalette,
  reverseGradient,
} from "@enumeratio/frontend/core";
import { ensureStyles } from "./styles.ts";

/** What a palette picker holds; `notatio-palette-change` carries it whole. */
export interface PaletteSetting {
  readonly palette: string;
  /** Overrides of the palette's gradient and category colors, or "" for the palette's own. */
  readonly gradient: string;
  readonly discrete: string;
  readonly reverse: boolean;
  readonly band?: number;
  readonly mode?: BandMode;
}

/** Category colors a swatch shows. */
const DOTS = 4;

/**
 * `<notatio-palette palette="dusk">` -- one menu for a plot's colors. Each palette is drawn as
 * it paints: its gradient, for values, and its first category colors, for kinds of point. Below
 * the palettes, the gradient and the category colors can be swapped on their own, the gradient
 * reversed, and — given `band` — the band set: the distance in value between the gradient's two
 * ends, and how values past it meet the gradient (`mode`).
 *
 * `gradient` and `discrete` say whether those sections are offered at all, so a plot shows only
 * the colors it uses.
 */
export class NotatioPalette extends LitElement {
  static properties = {
    palette: { type: String },
    gradient: { type: String },
    discrete: { type: String },
    reverse: { type: Boolean },
    band: { type: Number },
    mode: { type: String },
    /** What the band measures, for its label: `√|N|`. */
    unit: { type: String },
    /** Offer the gradient section. */
    withGradient: { type: Boolean, attribute: "with-gradient" },
    /** Offer the category-color section. */
    withDiscrete: { type: Boolean, attribute: "with-discrete" },
    _open: { state: true },
  };

  declare palette: string;
  declare gradient: string;
  declare discrete: string;
  declare reverse: boolean;
  declare band: number | undefined;
  declare mode: BandMode | undefined;
  declare unit: string;
  declare withGradient: boolean;
  declare withDiscrete: boolean;
  declare _open: boolean;

  constructor() {
    super();
    this.palette = "dusk";
    this.gradient = "";
    this.discrete = "";
    this.reverse = false;
    this.band = undefined;
    this.mode = undefined;
    this.unit = "";
    this.withGradient = true;
    this.withDiscrete = true;
    this._open = false;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  get setting(): PaletteSetting {
    const band = Number(this.band);
    return {
      palette: this.palette,
      gradient: this.gradient,
      discrete: this.discrete,
      reverse: this.reverse,
      ...(Number.isFinite(band) && band > 0 ? { band } : {}),
      ...(this.mode ? { mode: this.mode } : {}),
    };
  }

  #resolved(over: Partial<PaletteSetting> = {}): Palette {
    const s = { ...this.setting, ...over };
    return resolvePalette({
      palette: s.palette,
      gradient: s.gradient || undefined,
      discrete: s.discrete || undefined,
      reverse: s.reverse,
    });
  }

  #emit(change: Partial<PaletteSetting>): void {
    Object.assign(this, change);
    this.dispatchEvent(
      new CustomEvent("notatio-palette-change", { detail: this.setting, bubbles: true, composed: true }),
    );
  }

  #close = (e: Event): void => {
    if (!this.contains(e.target as Node)) this._open = false;
  };

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("pointerdown", this.#close);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("pointerdown", this.#close);
  }

  #swatch(p: Palette): unknown {
    return html`<span class="notatio-palette-swatch">
      ${this.withGradient ? html`<i class="notatio-palette-bar" style=${`background:${gradientCss(p.gradient)}`}></i>` : nothing}
      ${this.withDiscrete ? discreteColors(p, DOTS).map((c) => html`<i class="notatio-palette-dot" style=${`background:${c}`}></i>`) : nothing}
    </span>`;
  }

  protected override render(): unknown {
    const current = this.#resolved();
    const overridden = this.gradient !== "" || this.discrete !== "";
    const band = Number(this.band);
    return html`<span class="notatio-palette">
      <button
        type="button"
        class="notatio-palette-button"
        aria-haspopup="true"
        aria-expanded=${this._open}
        aria-label="Colors"
        data-tip="Colors: palette, gradient, category colors"
        @click=${() => (this._open = !this._open)}
      >
        ${this.#swatch(current)}<span>${current.label}${overridden ? " (adjusted)" : ""}</span
        ><span aria-hidden="true">▾</span>
      </button>
      ${
        this._open
          ? html`<div class="notatio-palette-panel" role="dialog" aria-label="Colors">
              <section>
                <h4>Palette</h4>
                <div class="notatio-palette-list" role="listbox">
                  ${PALETTES.map((spec) => {
                    const p = this.#resolved({ palette: spec.name, gradient: "", discrete: "", reverse: false });
                    const selected = spec.name === this.palette && !overridden && !this.reverse;
                    return html`<button
                      type="button"
                      role="option"
                      aria-selected=${selected}
                      class=${selected ? "is-selected" : ""}
                      @click=${() => this.#emit({ palette: spec.name, gradient: "", discrete: "", reverse: false })}
                    >
                      ${this.#swatch(p)}${spec.label}
                    </button>`;
                  })}
                </div>
              </section>
              ${
                this.withGradient
                  ? html`<section>
                      <h4>Gradient <small>for values</small></h4>
                      <div class="notatio-palette-gradients">
                        ${GRADIENTS.map(
                          (g) =>
                            html`<button
                              type="button"
                              aria-label=${g.label}
                              data-tip=${g.cyclic ? `${g.label} (cyclic)` : g.label}
                              class=${g.name === current.gradient.name ? "is-selected" : ""}
                              @click=${() => this.#emit({ gradient: g.name })}
                            >
                              <i style=${`background:${gradientCss(this.reverse ? reverseGradient(g) : g)}`}></i>
                            </button>`,
                        )}
                      </div>
                      <label
                        ><input
                          type="checkbox"
                          .checked=${this.reverse}
                          @change=${(e: Event) => this.#emit({ reverse: (e.target as HTMLInputElement).checked })}
                        />
                        reversed</label
                      >
                      ${
                        Number.isFinite(band) && band > 0
                          ? html`<label
                                >band
                                <input
                                  type="number"
                                  min="0.5"
                                  step="any"
                                  .value=${String(band)}
                                  @change=${(e: Event) => {
                                    const v = Number((e.target as HTMLInputElement).value);
                                    if (Number.isFinite(v) && v > 0) this.#emit({ band: v });
                                  }}
                                />
                                ${this.unit} from one end of the gradient to the other</label
                              >
                              <label
                                >past the band
                                <select
                                  @change=${(e: Event) => this.#emit({ mode: (e.target as HTMLSelectElement).value as BandMode })}
                                >
                                  ${BAND_MODES.map(
                                    (m) =>
                                      html`<option value=${m} ?selected=${m === (this.mode ?? "reflect")}>
                                        ${m === "reflect" ? "reflect: back down, then up again" : m === "wrap" ? "wrap: start over (cyclic gradients)" : "clamp: stay at the end"}
                                      </option>`,
                                  )}
                                </select></label
                              >`
                          : nothing
                      }
                    </section>`
                  : nothing
              }
              ${
                this.withDiscrete
                  ? html`<section>
                      <h4>Category colors <small>for kinds of point that aren't values</small></h4>
                      <div class="notatio-palette-list">
                        ${DISCRETE_SCHEMES.map((scheme) => {
                          const p = this.#resolved({ discrete: scheme.name });
                          const selected = scheme.name === current.discrete.name;
                          return html`<button
                            type="button"
                            class=${selected ? "is-selected" : ""}
                            @click=${() => this.#emit({ discrete: scheme.name })}
                          >
                            <span class="notatio-palette-swatch">
                              ${discreteColors(p, 6).map((c) => html`<i class="notatio-palette-dot" style=${`background:${c}`}></i>`)}
                            </span>
                            ${scheme.label}
                          </button>`;
                        })}
                      </div>
                    </section>`
                  : nothing
              }
            </div>`
          : nothing
      }
    </span>`;
  }
}

if (!customElements.get("notatio-palette")) customElements.define("notatio-palette", NotatioPalette);
