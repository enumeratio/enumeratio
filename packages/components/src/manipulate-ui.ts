// The shared control panel for Manipulate parameters, used by both plot
// elements: a slider (with a play/pause button that animates it) or a choice
// setter per control. Pure view -- the host element owns the state and the
// animation timer and passes handlers in.

import { html, type TemplateResult } from "lit";
import { type Control, formatValue } from "./manipulate.ts";

import type { LongPress } from "./popover.ts";

export interface ControlHandlers {
  /** Set a control's value from a raw input string. */
  set: (name: string, raw: string) => void;
  /** Start/stop animating a slider. */
  toggle: (name: string) => void;
  /**
   * The long press on a slider's play button that opens its speed-and-loop panel.
   * Optional: a host without one has a play button that only plays.
   */
  press?: (name: string) => LongPress | undefined;
}

/**
 * Render the Manipulate controls; `playing` names the sliders now animating. `fps`,
 * when given, appends a frame-rate readout — the host passes it only while something
 * is actually moving, since an idle rate is meaningless.
 */
export function controlsTemplate(
  controls: readonly Control[],
  playing: ReadonlySet<string>,
  h: ControlHandlers,
  fps?: number,
): TemplateResult | null {
  if (controls.length === 0) return null;
  return html`<div class="notatio-controls" role="group" aria-label="parameters">
    ${controls.map((c) =>
      c.kind === "slider"
        ? html`<label class="notatio-control"
            ><button
              type="button"
              class="notatio-play"
              aria-label=${playing.has(c.name) ? "pause" : "play"}
              title=${h.press ? "play; hold for speed and loop" : "play"}
              @pointerdown=${h.press?.(c.name)?.down}
              @pointerup=${h.press?.(c.name)?.up}
              @pointercancel=${h.press?.(c.name)?.cancel}
              @pointerleave=${h.press?.(c.name)?.cancel}
              @contextmenu=${h.press?.(c.name)?.contextmenu}
              @click=${(e: Event) => {
                if (!h.press?.(c.name)?.click(e)) h.toggle(c.name);
              }}
            >
              ${playing.has(c.name) ? "⏸" : "▶"}</button
            ><span class="notatio-control-name">${c.name}</span
            ><input
              type="range"
              min=${c.min}
              max=${c.max}
              step=${c.step}
              .value=${String(c.value)}
              @input=${(e: Event) => h.set(c.name, (e.target as HTMLInputElement).value)}
            /><span class="notatio-control-val">${formatValue(c.value, c.step)}</span></label
          >`
        : html`<label class="notatio-control"
            ><span class="notatio-control-name">${c.name}</span
            ><select @change=${(e: Event) => h.set(c.name, (e.target as HTMLSelectElement).value)}>
              ${c.choices.map(
                (v) => html`<option value=${v} ?selected=${v === c.value}>${v}</option>`,
              )}
            </select></label
          >`,
    )}${fps ? html`<span class="notatio-control-fps">${fps} fps</span>` : null}
  </div>`;
}
