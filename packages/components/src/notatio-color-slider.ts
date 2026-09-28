import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { html, LitElement, type PropertyValues } from "lit";
import { ensureStyles } from "./styles.ts";
import { defineControl, emitControl } from "./define.ts";

/** `#rrggbb` -> [r, g, b] in 0..1. */
export function rgbOf(hex: string): [number, number, number] | undefined {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const n = Number.parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** [r, g, b] in 0..1 -> `#rrggbb`. */
export function hexOf(rgb: readonly [number, number, number]): string {
  const c = (v: number): string =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(rgb[0])}${c(rgb[1])}${c(rgb[2])}`;
}

/**
 * `<notatio-color-slider name="c" value="#3451b2">` -- a swatch that opens the colour
 * picker, Wolfram's `ColorSlider`. The binding `_c` is `RGBColor(r, g, b)` with the
 * parts in `0..1`, which is what a plot's colour attribute or a template can read.
 */
export class NotatioColorSlider extends LitElement {
  static properties = {
    /** The binding this swatch drives: `name="c"` fills the wildcard `_c`. */
    name: { type: String, reflect: true },
    /** The starting colour, `#rrggbb`. */
    value: { type: String },
    _rgb: { state: true },
  };

  declare name: string;
  declare value: string;
  declare _rgb: [number, number, number];

  constructor() {
    super();
    this.name = "";
    this.value = "#3451b2";
    this._rgb = [0.2, 0.32, 0.7];
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  get hex(): string {
    return hexOf(this._rgb);
  }

  get binding(): MathJsonExpression {
    return ["RGBColor", ...this._rgb] as MathJsonExpression;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("value")) this._rgb = rgbOf(this.value) ?? this._rgb;
  }

  #onInput = (event: Event): void => {
    const rgb = rgbOf((event.target as HTMLInputElement).value);
    if (!rgb || rgb.every((v, i) => v === this._rgb[i])) return;
    this._rgb = rgb;
    emitControl(this, { name: this.name, value: this.binding });
  };

  protected override render(): unknown {
    return html`<input
      type="color"
      class="notatio-color-slider"
      .value=${this.hex}
      aria-label=${this.name || "colour"}
      @input=${this.#onInput}
    />`;
  }
}

defineControl("notatio-color-slider", NotatioColorSlider);
