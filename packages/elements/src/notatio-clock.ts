import { html, LitElement } from "lit";

import { type Clock, pageClock, type Tick } from "./clock.ts";
import { ensureStyles } from "./styles.ts";

/**
 * `<notatio-clock>` -- play, pause and scrub the page's shared clock.
 *
 * There is one clock per page, so this control is not tied to any particular figure: put it
 * anywhere and it governs every animated figure on the page at once. That is the point. A
 * reader who pauses to look at something should not still be moved past by the figure beside
 * it, and two figures about the same parameter should not drift apart.
 *
 * Several of these on one page are all views of the same clock and stay in step with each
 * other, which is the same property seen from the other side.
 */
export class NotatioClock extends LitElement {
  static properties = {
    /** Seconds per cycle. */
    period: { type: Number },
    /** Hide the scrubber, leaving just the play button. */
    compact: { type: String },
    label: { type: String },
    _phase: { state: true },
    _playing: { state: true },
  };

  declare period: number;
  declare compact: string;
  declare label: string;
  declare _phase: number;
  declare _playing: boolean;

  #clock: Clock = pageClock();
  #unwatch: (() => void) | undefined;

  constructor() {
    super();
    this.period = 0;
    this.compact = "false";
    this.label = "";
    this._phase = 0;
    this._playing = true;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (Number(this.period) > 0) this.#clock.period = Number(this.period);
    this.#unwatch = this.#clock.watch((tick: Tick) => {
      this._phase = tick.phase;
      this._playing = this.#clock.playing;
    });
  }

  override disconnectedCallback(): void {
    this.#unwatch?.();
    this.#unwatch = undefined;
    super.disconnectedCallback();
  }

  protected override render(): unknown {
    const percent = Math.round(this._phase * 100);
    return html`<span class="notatio-clock-box">
      <button
        class="notatio-clock-play"
        type="button"
        title=${this._playing ? "Pause every figure on the page" : "Play"}
        aria-label=${this._playing ? "Pause" : "Play"}
        aria-pressed=${String(this._playing)}
        @click=${() => this.#clock.toggle()}
      >
        ${this._playing ? "❚❚" : "▶"}
      </button>
      ${
        this.compact === "false"
          ? html`<input
              class="notatio-clock-scrub"
              type="range"
              min="0"
              max="1000"
              aria-label="Position in the cycle"
              .value=${String(Math.round(this._phase * 1000))}
              @input=${(e: Event) => {
                // Scrubbing is a deliberate act; keeping the clock running would fight the
                // reader for the handle.
                this.#clock.pause();
                this.#clock.seek(Number((e.target as HTMLInputElement).value) / 1000);
              }}
            />`
          : ""
      }
      <span class="notatio-clock-readout">${this.label || `${percent}%`}</span>
    </span>`;
  }
}

if (!customElements.get("notatio-clock")) {
  customElements.define("notatio-clock", NotatioClock);
}
