import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { html, LitElement, nothing } from "lit";
import {
  BAND_MODES,
  type BandMode,
  GRADIENTS,
  gradientCss,
  gradientNamed,
  reverseGradient,
} from "@enumeratio/frontend/core";
import { defineControl, emitControl } from "./define.ts";
import { ensureStyles } from "./styles.ts";

/** What a gradient control holds; `notatio-gradient-change` carries it whole. */
export interface GradientSetting {
  readonly gradient: string;
  readonly reverse: boolean;
  readonly band?: number;
  readonly mode?: BandMode;
}

/**
 * `<notatio-gradient name="g" value="viridis">` -- choose a color gradient: a swatch that opens
 * the presets, each drawn, with a reverse toggle. Given `band`, it also sets the band — the
 * distance in value between the gradient's two ends — and `mode`, how values past it meet the
 * gradient (`reflect`, sweeping up and back; `wrap`; `clamp`).
 *
 * The binding `_g` is the gradient's name as a string; `notatio-gradient-change` carries the
 * whole setting, for a plot that reads all of it.
 */
export class NotatioGradient extends LitElement {
  static properties = {
    /** The binding this control drives: `name="g"` fills the wildcard `_g`. */
    name: { type: String, reflect: true },
    /** The gradient's name: one of `GRADIENTS`. */
    value: { type: String, reflect: true },
    reverse: { type: Boolean, reflect: true },
    /** The band, when this control sets it; absent, the band isn't offered. */
    band: { type: Number },
    mode: { type: String },
    /** What the band measures, for its label: `√|N|`. */
    unit: { type: String },
    _open: { state: true },
  };

  declare name: string;
  declare value: string;
  declare reverse: boolean;
  declare band: number | undefined;
  declare mode: BandMode | undefined;
  declare unit: string;
  declare _open: boolean;

  constructor() {
    super();
    this.name = "";
    this.value = "viridis";
    this.reverse = false;
    this.band = undefined;
    this.mode = undefined;
    this.unit = "";
    this._open = false;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  get binding(): MathJsonExpression {
    return `'${this.value}'` as MathJsonExpression;
  }

  get setting(): GradientSetting {
    const band = Number(this.band);
    return {
      gradient: this.value,
      reverse: this.reverse,
      ...(Number.isFinite(band) && band > 0 ? { band } : {}),
      ...(this.mode ? { mode: this.mode } : {}),
    };
  }

  #emit(): void {
    emitControl(this, { name: this.name, value: this.binding });
    this.dispatchEvent(
      new CustomEvent("notatio-gradient-change", { detail: this.setting, bubbles: true, composed: true }),
    );
  }

  #choose(name: string): void {
    this.value = name;
    this.#emit();
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

  protected override render(): unknown {
    const shown = (name: string) => {
      const g = gradientNamed(name);
      return gradientCss(this.reverse ? reverseGradient(g) : g);
    };
    const band = Number(this.band);
    return html`<span class="notatio-gradient">
      <button
        type="button"
        class="notatio-gradient-button"
        aria-haspopup="true"
        aria-expanded=${this._open}
        title="Gradient"
        @click=${() => (this._open = !this._open)}
      >
        <i style=${`background:${shown(this.value)}`}></i><span>${gradientNamed(this.value).label}</span>
      </button>
      ${
        this._open
          ? html`<div class="notatio-gradient-panel" role="dialog" aria-label="Gradient">
              <div class="notatio-gradient-list" role="listbox">
                ${GRADIENTS.map(
                  (g) =>
                    html`<button
                      type="button"
                      role="option"
                      aria-selected=${g.name === this.value}
                      class=${g.name === this.value ? "is-selected" : ""}
                      @click=${() => this.#choose(g.name)}
                    >
                      <i style=${`background:${shown(g.name)}`}></i
                      >${g.label}${g.cyclic ? html` <small>cyclic</small>` : nothing}
                    </button>`,
                )}
              </div>
              <label
                ><input
                  type="checkbox"
                  .checked=${this.reverse}
                  @change=${(e: Event) => {
                    this.reverse = (e.target as HTMLInputElement).checked;
                    this.#emit();
                  }}
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
                            if (Number.isFinite(v) && v > 0) {
                              this.band = v;
                              this.#emit();
                            }
                          }}
                        />
                        ${this.unit}</label
                      >
                      <label
                        >ends
                        <select
                          @change=${(e: Event) => {
                            this.mode = (e.target as HTMLSelectElement).value as BandMode;
                            this.#emit();
                          }}
                        >
                          ${BAND_MODES.map(
                            (m) =>
                              html`<option value=${m} ?selected=${m === (this.mode ?? "reflect")}>
                                ${m === "reflect" ? "reflect (up, then back)" : m === "wrap" ? "wrap (for a cyclic gradient)" : "clamp (one sweep)"}
                              </option>`,
                          )}
                        </select></label
                      >`
                  : nothing
              }
            </div>`
          : nothing
      }
    </span>`;
  }
}

defineControl("notatio-gradient", NotatioGradient);
