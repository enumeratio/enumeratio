import { type Domain, randomInteger, stepInteger } from "@enumeratio/frontend/core";
import { html, LitElement, nothing } from "lit";
import { defineControl, emitControl } from "./define.ts";
import { ensureStyles } from "./styles.ts";

type Integers = Extract<Domain, { kind: "integers" }>;

/**
 * `<stepper-box name="d" value="-5" min="-400" max="400" random>` -- an integer in a
 * sentence, with ◀ ▶ to step to the next value its domain admits and, with `random`, a die for
 * a random one. A tangle-style control: it reads as the number, and binds `_d` like any other.
 * A `StringTemplate` hole sets `domain` from the variable's declaration, `Where` included.
 */
export class NotatioStepper extends LitElement {
  static properties = {
    name: { type: String, reflect: true },
    value: { type: Number, reflect: true },
    min: { type: Number },
    max: { type: Number },
    /** Offer a random value from the domain. */
    random: { type: Boolean },
    /** The integers it may land on, as a declaration gives them; `min` and `max` otherwise. */
    domain: { attribute: false },
  };

  declare name: string;
  declare value: number;
  declare min: number;
  declare max: number;
  declare random: boolean;
  declare domain: Integers | undefined;

  constructor() {
    super();
    this.name = "";
    this.value = 0;
    this.min = -100;
    this.max = 100;
    this.random = false;
    this.domain = undefined;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  get binding(): number {
    return Number(this.value);
  }

  get #domain(): Integers {
    return this.domain ?? { kind: "integers", min: Number(this.min), max: Number(this.max) };
  }

  #set(n: number): void {
    if (n === Number(this.value)) return;
    this.value = n;
    emitControl(this, { name: this.name, value: n });
  }

  step(direction: 1 | -1): void {
    this.#set(stepInteger(this.#domain, Number(this.value), direction));
  }

  roll(): void {
    this.#set(randomInteger(this.#domain, Number(this.value)));
  }

  #onKey = (e: KeyboardEvent): void => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") this.step(-1);
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") this.step(1);
    else return;
    e.preventDefault();
  };

  protected override render(): unknown {
    const v = Number(this.value);
    const { min, max } = this.#domain;
    return html`<span
      class="stepper-box"
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
        this.random
          ? html`<button
              type="button"
              tabindex="-1"
              aria-label="Random"
              data-tip=${`A random one, ${min} to ${max}`}
              @click=${() => this.roll()}
            >
              ⚄
            </button>`
          : nothing
      }
    </span>`;
  }
}

defineControl("stepper-box", NotatioStepper);
