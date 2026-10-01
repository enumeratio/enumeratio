import { html, LitElement, type PropertyValues } from "lit";

import { LONG_PRESS_MS } from "./choice-menu.ts";
import { type Clock, pageClock, type Tick } from "./clock.ts";
import type { Loop } from "./playback.ts";
import { openPlaybackMenu } from "./playback-menu.ts";
import { LongPress } from "./popover.ts";
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
 *
 * `loop` says what the end of a cycle does -- `cycle` (default), `reflect` or `none` --
 * and `rate` multiplies the speed; both are the page clock's, so whichever control set
 * them last wins. Holding the play button opens the same speed-and-loop panel every
 * other play button has.
 */
export class NotatioClock extends LitElement {
  static properties = {
    /** Seconds per cycle. */
    period: { type: Number },
    /** Hide the scrubber, leaving just the play button. */
    compact: { type: String },
    label: { type: String },
    /** What the end of a cycle does: `cycle` (default), `reflect` or `none`. */
    loop: { type: String, reflect: true },
    /** Speed, as a multiplier on real time. */
    rate: { type: Number, reflect: true },
    _phase: { state: true },
    _playing: { state: true },
  };

  declare period: number;
  declare compact: string;
  declare label: string;
  declare loop: Loop | "";
  declare rate: number;
  declare _phase: number;
  declare _playing: boolean;

  #clock: Clock = pageClock();
  #unwatch: (() => void) | undefined;
  #playMenu = new LongPress(LONG_PRESS_MS, (anchor) => {
    this.#clock.pause();
    openPlaybackMenu({
      anchor,
      settings: { rate: this.#clock.rate, loop: this.#clock.loop },
      onChange: ({ rate, loop }) => {
        this.rate = rate;
        this.loop = loop;
      },
    });
  });

  constructor() {
    super();
    this.period = 0;
    this.compact = "false";
    this.label = "";
    this.loop = "";
    this.rate = Number.NaN;
    this._phase = 0;
    this._playing = true;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** The attributes are the page clock's settings; write them through as they change. */
  protected override willUpdate(changed: PropertyValues): void {
    if (
      changed.has("loop") &&
      (this.loop === "cycle" || this.loop === "reflect" || this.loop === "none")
    ) {
      this.#clock.loop = this.loop;
    }
    if (changed.has("rate") && Number.isFinite(this.rate) && this.rate > 0)
      this.#clock.rate = this.rate;
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
        @pointerdown=${this.#playMenu.down}
        @pointerup=${this.#playMenu.up}
        @pointercancel=${this.#playMenu.cancel}
        @pointerleave=${this.#playMenu.cancel}
        @contextmenu=${this.#playMenu.contextmenu}
        @click=${(e: Event) => {
          if (!this.#playMenu.click(e)) this.#clock.toggle();
        }}
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
