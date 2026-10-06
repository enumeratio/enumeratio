import { html, LitElement, nothing } from "lit";
import { defineControl, emitControl } from "./define.ts";
import { ensureStyles } from "./styles.ts";

/** Integers a stepper may land on: every one, or only those a named rule admits. */
const SKIPS: Readonly<Record<string, (n: number) => boolean>> = {
  /** d for a quadratic field ℚ(√d): squarefree, and neither 0 nor 1. */
  squarefree: (n) => {
    if (n === 0 || n === 1) return false;
    const m = Math.abs(n);
    for (let k = 2; k * k <= m; k++) if (m % (k * k) === 0) return false;
    return true;
  },
  nonzero: (n) => n !== 0,
};

/** Draws a random value takes before it settles for the current one. */
const RANDOM_TRIES = 200;

/**
 * `<notatio-stepper name="d" value="-5" skip="squarefree" random="400">` -- an integer in a
 * sentence, with ◀ ▶ to step to the next value the `skip` rule admits and, given `random`, a
 * die for a random one with |n| ≤ that bound. A tangle-style control: it reads as the number,
 * and binds `_d` like any other.
 */
export class NotatioStepper extends LitElement {
  static properties = {
    name: { type: String, reflect: true },
    value: { type: Number, reflect: true },
    min: { type: Number },
    max: { type: Number },
    /** A rule the values keep to: `squarefree`, `nonzero`, or none. */
    skip: { type: String },
    /** Offer a random value with |n| at most this; 0 offers none. */
    random: { type: Number },
  };

  declare name: string;
  declare value: number;
  declare min: number;
  declare max: number;
  declare skip: string;
  declare random: number;

  constructor() {
    super();
    this.name = "";
    this.value = 0;
    this.min = Number.NEGATIVE_INFINITY;
    this.max = Number.POSITIVE_INFINITY;
    this.skip = "";
    this.random = 0;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  get binding(): number {
    return Number(this.value);
  }

  #admits(n: number): boolean {
    return n >= Number(this.min) && n <= Number(this.max) && (SKIPS[this.skip]?.(n) ?? true);
  }

  #set(n: number): void {
    if (n === Number(this.value)) return;
    this.value = n;
    emitControl(this, { name: this.name, value: n });
  }

  /** The next admitted value from the current one in a direction; the current one when there is none nearby. */
  step(direction: 1 | -1): void {
    for (let n = Number(this.value) + direction, k = 0; k < 10_000; n += direction, k++) {
      if (n < Number(this.min) || n > Number(this.max)) return;
      if (this.#admits(n)) return this.#set(n);
    }
  }

  roll(): void {
    const bound = Math.max(1, Number(this.random));
    for (let k = 0; k < RANDOM_TRIES; k++) {
      const n = Math.round((Math.random() * 2 - 1) * bound);
      if (this.#admits(n) && n !== Number(this.value)) return this.#set(n);
    }
  }

  #onKey = (e: KeyboardEvent): void => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") this.step(-1);
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") this.step(1);
    else return;
    e.preventDefault();
  };

  protected override render(): unknown {
    const v = Number(this.value);
    return html`<span
      class="notatio-stepper"
      role="spinbutton"
      aria-valuenow=${v}
      aria-label=${this.name}
      tabindex="0"
      @keydown=${this.#onKey}
    >
      <button type="button" tabindex="-1" aria-label="Previous" data-tip="Previous" @click=${() => this.step(-1)}>
        ◀</button
      ><span class="notatio-stepper-value">${v < 0 ? `−${-v}` : v}</span
      ><button type="button" tabindex="-1" aria-label="Next" data-tip="Next" @click=${() => this.step(1)}>▶</button>${
        Number(this.random) > 0
          ? html`<button
              type="button"
              tabindex="-1"
              aria-label="Random"
              data-tip=${`A random one, |${this.name}| ≤ ${this.random}`}
              @click=${() => this.roll()}
            >
              ⚄
            </button>`
          : nothing
      }
    </span>`;
  }
}

defineControl("notatio-stepper", NotatioStepper);
