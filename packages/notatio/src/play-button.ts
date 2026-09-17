// The play/pause button a control renders when asked to (`play`): one template, so every
// ▶ on the site looks the same, toggles the same, and opens the same speed-and-loop
// panel on a long press.

import { html } from "lit";
import type { Sweep } from "./playback.ts";

export function playButton(sweep: Sweep, extra: { class?: string; own?: boolean } = {}): unknown {
  const press = sweep.press;
  return html`<button
    type="button"
    class="notatio-knob-play ${extra.class ?? ""}"
    ?data-notatio-knob=${extra.own ?? false}
    title="play; hold for speed and loop"
    aria-label=${sweep.playing ? "pause" : "play"}
    aria-pressed=${sweep.playing ? "true" : "false"}
    @pointerdown=${press.down}
    @pointerup=${press.up}
    @pointercancel=${press.cancel}
    @pointerleave=${press.cancel}
    @contextmenu=${press.contextmenu}
    @click=${(e: Event) => {
      e.stopPropagation();
      if (!press.click(e)) sweep.toggle();
    }}
  >
    ${sweep.playing ? "⏸" : "▶"}
  </button>`;
}
